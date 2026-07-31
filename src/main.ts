import { Notice, Plugin, type Editor } from 'obsidian';
import { buildAnkiQuery } from './core/query-builder';
import { OBSIDIAN_PROTOCOL_ACTION, parseProtocolParams } from './core/uri-parser';
import { createPlatformRouter } from './platform/router';
import { AnkiConnectService } from './services/anki-connect';
import { DEFAULT_SETTINGS } from './settings';
import { getLocalizedErrorMessage, getStrings } from './strings';
import {
	AnkiCardLinkError,
	type AnkiCardLinkSettings,
	type Language,
	type SearchType,
} from './types';
import { InsertLinkModal, OpenLinkModal } from './ui/insert-link-modal';
import { AnkiCardLinkSettingTab } from './ui/settings-tab';

export default class AnkiCardLinkPlugin extends Plugin {
	settings: AnkiCardLinkSettings = DEFAULT_SETTINGS;
	private localizedCommandsRegistered = false;

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.registerObsidianProtocolHandler(OBSIDIAN_PROTOCOL_ACTION, (params) => {
			try {
				const input = parseProtocolParams(params);
				void this.openSearch(input.type, input.value);
			} catch (error) {
				this.handleError(error);
			}
		});

		this.registerLocalizedCommands();

		this.addSettingTab(new AnkiCardLinkSettingTab(this.app, this));
		this.debug('Plugin loaded.');
	}

	private registerLocalizedCommands(): void {
		const strings = getStrings(this.settings.language);
		if (this.localizedCommandsRegistered) {
			this.removeCommand('insert-link');
			this.removeCommand('open-link');
		}

		this.addCommand({
			id: 'insert-link',
			name: strings.commands.insertLink,
			editorCallback: (editor: Editor) => {
				new InsertLinkModal(this.app, this, editor).open();
			},
		});

		this.addCommand({
			id: 'open-link',
			name: strings.commands.openLink,
			callback: () => {
				new OpenLinkModal(this.app, this).open();
			},
		});
		this.localizedCommandsRegistered = true;
	}

	async openSearch(type: SearchType, value: string): Promise<boolean> {
		let query: string | undefined;

		try {
			query = buildAnkiQuery(type, value);
			this.debug(`Opening query on the current platform: ${query}`);
			const ankiConnect = new AnkiConnectService({
				url: this.settings.ankiConnectUrl,
			});
			await createPlatformRouter(ankiConnect).open(query);
			return true;
		} catch (error) {
			this.handleError(error);
			if (query !== undefined && this.settings.copyQueryOnFailure) {
				await this.copyQuery(query);
			}
			return false;
		}
	}

	async updateSettings(changes: Partial<AnkiCardLinkSettings>): Promise<void> {
		this.settings = { ...this.settings, ...changes };
		await this.saveData(this.settings);
	}

	async updateLanguage(language: Language): Promise<void> {
		const oldStrings = getStrings(this.settings.language);
		const changes: Partial<AnkiCardLinkSettings> = { language };
		if (this.settings.defaultLinkText === oldStrings.defaultLinkText) {
			changes.defaultLinkText = getStrings(language).defaultLinkText;
		}
		await this.updateSettings(changes);
		this.registerLocalizedCommands();
	}

	showNotice(message: string): void {
		new Notice(message);
	}

	handleError(error: unknown): void {
		if (error instanceof AnkiCardLinkError) {
			this.showNotice(getLocalizedErrorMessage(error, this.settings.language));
			this.debug(`${error.code}: ${error.message}`, error.cause);
			return;
		}

		const message = error instanceof Error ? error.message : String(error);
		this.showNotice(getStrings(this.settings.language).notices.unexpectedError(message));
		this.debug('Unexpected error.', error);
	}

	private async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<AnkiCardLinkSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	private async copyQuery(query: string): Promise<void> {
		const strings = getStrings(this.settings.language);
		try {
			await navigator.clipboard.writeText(query);
			this.showNotice(strings.notices.queryCopied);
		} catch (error) {
			this.showNotice(strings.notices.clipboardFailed);
			this.debug('Clipboard fallback failed.', error);
		}
	}

	private debug(message: string, detail?: unknown): void {
		if (!this.settings.debugLogging) {
			return;
		}
		if (detail === undefined) {
			console.debug(`[Anki Card Link] ${message}`);
		} else {
			console.debug(`[Anki Card Link] ${message}`, detail);
		}
	}
}
