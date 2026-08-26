import { Modal, Notice, Setting, type App, type ButtonComponent } from 'obsidian';
import { YOUDAO_PC_COOKIE } from '../services/youdao-auth';
import { getStrings } from '../strings';
import type { Language } from '../types';

const YOUDAO_LOGIN_URL = 'https://note.youdao.com/web/';
const YOUDAO_COOKIE_URL = 'https://note.youdao.com';

interface ElectronCookie {
	name: string;
	value: string;
}

interface ElectronSessionModule {
	session?: {
		defaultSession?: {
			cookies: {
				get(filter: { url: string }): Promise<ElectronCookie[]>;
			};
		};
	};
	remote?: {
		session?: {
			defaultSession?: {
				cookies: {
					get(filter: { url: string }): Promise<ElectronCookie[]>;
				};
			};
		};
	};
}

export class YoudaoLoginModal extends Modal {
	private frame?: HTMLIFrameElement;
	private completeButton?: ButtonComponent;
	private ready = false;
	private saving = false;

	constructor(
		app: App,
		private readonly language: Language,
		private readonly onConnected: (ynotePc: string) => Promise<void>,
	) {
		super(app);
	}

	onOpen(): void {
		const strings = getStrings(this.language);
		this.modalEl.addClass('anki-card-link-youdao-login-modal');
		this.setTitle(strings.settings.youdaoLoginTitle);
		this.contentEl.createEl('p', { text: strings.settings.youdaoLoginDesc });

		this.openEmbeddedLogin();

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
		this.frame?.remove();
		this.frame = undefined;
		this.contentEl.empty();
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
			const ynotePc = await this.readYnotePc();
			if (ynotePc === undefined) {
				new Notice(strings.notices.youdaoLoginCookieMissing);
				return;
			}
			await this.onConnected(ynotePc);
			new Notice(strings.notices.youdaoLoginConnected);
			this.close();
		} catch {
			new Notice(strings.notices.youdaoLoginFailed);
		} finally {
			this.saving = false;
			if (this.frame !== undefined) {
				this.completeButton?.setDisabled(false);
			}
		}
	}

	private async readYnotePc(): Promise<string | undefined> {
		return readDesktopYoudaoCookie();
	}
}

async function readDesktopYoudaoCookie(): Promise<string | undefined> {
	try {
		const electron = getElectron();
		if (electron === undefined) {
			return undefined;
		}
		const session = electron.remote?.session ?? electron.session;
		const cookies = await session?.defaultSession?.cookies.get({ url: YOUDAO_COOKIE_URL });
		return cookies?.find((cookie) => cookie.name === YOUDAO_PC_COOKIE)?.value;
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
