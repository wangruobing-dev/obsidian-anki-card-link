import { Modal, Notice, Setting, type App, type ButtonComponent } from 'obsidian';
import { getStrings } from '../strings';
import type { Language } from '../types';

const YOUDAO_LOGIN_URL = 'https://note.youdao.com/web/';
const YOUDAO_COOKIE_URL = 'https://note.youdao.com';

interface ElectronCookie {
	name: string;
	value: string;
}

interface ElectronSessionModule {
	BrowserWindow?: ElectronBrowserWindowConstructor;
	session?: {
		defaultSession?: ElectronSession;
	};
	remote?: {
		BrowserWindow?: ElectronBrowserWindowConstructor;
		session?: {
			defaultSession?: ElectronSession;
		};
	};
}

interface ElectronBrowserWindowConstructor {
	new(options: ElectronBrowserWindowOptions): ElectronBrowserWindow;
}

interface ElectronBrowserWindowOptions {
	width: number;
	height: number;
	title: string;
	autoHideMenuBar: boolean;
	webPreferences: {
		nodeIntegration: boolean;
		contextIsolation: boolean;
		sandbox: boolean;
	};
}

interface ElectronBrowserWindow {
	loadURL(url: string): Promise<void>;
	focus(): void;
	close(): void;
	on(event: 'closed', listener: () => void): void;
	webContents?: {
		session?: ElectronSession;
	};
}

interface ElectronSession {
	cookies: {
		get(filter: { url: string }): Promise<ElectronCookie[]>;
	};
}

export class YoudaoLoginModal extends Modal {
	private loginWindow?: ElectronBrowserWindow;
	private frame?: HTMLIFrameElement;
	private completeButton?: ButtonComponent;
	private ready = false;
	private saving = false;

	constructor(
		app: App,
		private readonly language: Language,
		private readonly onConnected: (cookieHeader: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const strings = getStrings(this.language);
		this.modalEl.addClass('anki-card-link-youdao-login-modal');
		this.setTitle(strings.settings.youdaoLoginTitle);
		this.contentEl.createEl('p', { text: strings.settings.youdaoLoginDesc });

		this.openLoginWindow();

		new Setting(this.contentEl)
			.addButton((button) => {
				this.completeButton = button;
				button.setButtonText(strings.settings.youdaoLoginComplete);
				button.setCta();
				button.setDisabled(!this.ready);
				button.onClick(() => void this.completeLogin());
			})
			.addExtraButton((button) => {
				button.setIcon('x');
				button.setTooltip(strings.settings.cancel);
				button.onClick(() => this.close());
			});
	}

	onClose(): void {
		this.loginWindow?.close();
		this.loginWindow = undefined;
		this.frame?.remove();
		this.frame = undefined;
		this.contentEl.empty();
	}

	private openLoginWindow(): void {
		const electron = getElectron();
		const BrowserWindow = electron?.remote?.BrowserWindow ?? electron?.BrowserWindow;
		if (BrowserWindow === undefined) {
			this.openEmbeddedLogin();
			return;
		}
		try {
			const loginWindow = new BrowserWindow({
				width: 1040,
				height: 760,
				title: getStrings(this.language).settings.youdaoLoginTitle,
				autoHideMenuBar: true,
				webPreferences: {
					nodeIntegration: false,
					contextIsolation: true,
					sandbox: true,
				},
			});
			this.loginWindow = loginWindow;
			loginWindow.on('closed', () => {
				this.loginWindow = undefined;
			});
			void loginWindow.loadURL(YOUDAO_LOGIN_URL);
			loginWindow.focus();
			this.ready = true;
			this.completeButton?.setDisabled(false);
		} catch {
			this.openEmbeddedLogin();
		}
	}

	private openEmbeddedLogin(): void {
		const frame = this.contentEl.createEl('iframe');
		frame.addClass('anki-card-link-youdao-login-modal__frame');
		frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
		frame.addEventListener('load', () => {
			this.ready = true;
			this.completeButton?.setDisabled(false);
		});
		frame.src = YOUDAO_LOGIN_URL;
		this.frame = frame;
	}

	private async completeLogin(): Promise<void> {
		if (!this.ready || this.saving) {
			return;
		}
		this.saving = true;
		this.completeButton?.setDisabled(true);
		const strings = getStrings(this.language);
		try {
			const cookieHeader = await this.readCookieHeader();
			if (cookieHeader === undefined) {
				new Notice(strings.notices.youdaoLoginCookieMissing);
				return;
			}
			await this.onConnected(cookieHeader);
			new Notice(strings.notices.youdaoLoginConnected);
			this.close();
		} catch {
			new Notice(strings.notices.youdaoLoginFailed);
		} finally {
			this.saving = false;
			this.completeButton?.setDisabled(false);
		}
	}

	private async readCookieHeader(): Promise<string | undefined> {
		return readDesktopYoudaoCookieHeader(this.loginWindow);
	}
}

async function readDesktopYoudaoCookieHeader(loginWindow?: ElectronBrowserWindow): Promise<string | undefined> {
	try {
		const electron = getElectron();
		if (electron === undefined) {
			return undefined;
		}
		const session = loginWindow?.webContents?.session ?? electron.remote?.session?.defaultSession ?? electron.session?.defaultSession;
		const cookies = await session?.cookies.get({ url: YOUDAO_COOKIE_URL });
		const credentialCookies = cookies?.filter((cookie) => cookie.name.trim().length > 0 && cookie.value.length > 0) ?? [];
		if (!credentialCookies.some((cookie) => /^(?:YNOTE-PC|YNOTE_SESS|YNOTE_LOGIN|YNOTE_CSTK|YNOTE_PERS|P_INFO)$/u.test(cookie.name))) {
			return undefined;
		}
		return credentialCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
	} catch {
		return undefined;
	}
}

function getElectron(): ElectronSessionModule | undefined {
	return (window as ElectronWindow).require?.('electron') as ElectronSessionModule | undefined;
}

interface ElectronWindow extends Window {
	require?: (moduleName: string) => unknown;
}
