import { Notice, Plugin, type Editor } from 'obsidian';
import { buildAnkiQuery } from './core/query-builder';
import { OBSIDIAN_PROTOCOL_ACTION, parseProtocolParams } from './core/uri-parser';
import { createPlatformRouter } from './platform/router';
import { AnkiConnectService } from './services/anki-connect';
import { DEFAULT_SETTINGS } from './settings';
import { STRINGS } from './strings';
import {
	AnkiCardLinkError,
	type AnkiCardLinkSettings,
	type SearchType,
} from './types';
import { InsertLinkModal, OpenLinkModal } from './ui/insert-link-modal';
import { AnkiCardLinkSettingTab } from './ui/settings-tab';

export default class AnkiCardLinkPlugin extends Plugin {
	settings: AnkiCardLinkSettings = DEFAULT_SETTINGS;

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

		this.addCommand({
			id: 'insert-link',
			name: STRINGS.commands.insertLink,
			editorCallback: (editor: Editor) => {
				new InsertLinkModal(this.app, this, editor).open();
			},
		});

		this.addCommand({
			id: 'open-link',
			name: STRINGS.commands.openLink,
			callback: () => {
				new OpenLinkModal(this.app, this).open();
			},
		});

		this.addSettingTab(new AnkiCardLinkSettingTab(this.app, this));
		this.debug('Plugin loaded.');
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

	showNotice(message: string): void {
		new Notice(message);
	}

	handleError(error: unknown): void {
		if (error instanceof AnkiCardLinkError) {
			this.showNotice(error.message);
			this.debug(`${error.code}: ${error.message}`, error.cause);
			return;
		}

		const message = error instanceof Error ? error.message : String(error);
		this.showNotice(`An unexpected error occurred: ${message}`);
		this.debug('Unexpected error.', error);
	}

	private async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<AnkiCardLinkSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	private async copyQuery(query: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(query);
			this.showNotice(STRINGS.notices.queryCopied);
		} catch (error) {
			this.showNotice(STRINGS.notices.clipboardFailed);
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
