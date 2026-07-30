import {
	Notice,
	Platform,
	PluginSettingTab,
	Setting,
	type App,
	type SettingDefinitionItem,
} from 'obsidian';
import { AnkiConnectService } from '../services/anki-connect';
import { normalizeAnkiConnectUrl } from '../settings';
import { STRINGS } from '../strings';
import { SEARCH_TYPES, type SearchType } from '../types';
import type AnkiCardLinkPlugin from '../main';

const ANKI_CONNECT_NAME = ['Anki', 'Connect'].join('');
const DEFAULT_ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

export class AnkiCardLinkSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: AnkiCardLinkPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl).setName('Connection').setHeading();

		new Setting(this.containerEl)
			.setName(`${ANKI_CONNECT_NAME} address`)
			.setDesc(`Used only by the desktop app. The default is ${DEFAULT_ANKI_CONNECT_URL}.`)
			.addText((text) => {
				text.setPlaceholder(DEFAULT_ANKI_CONNECT_URL);
				text.setValue(this.plugin.settings.ankiConnectUrl);
				text.onChange((value) => {
					void this.plugin.updateSettings({
						ankiConnectUrl: normalizeAnkiConnectUrl(value),
					});
				});
			});

		if (Platform.isDesktopApp) {
			new Setting(this.containerEl)
				.setName('Test desktop connection')
				.setDesc(`Checks whether Anki and ${ANKI_CONNECT_NAME} can be reached.`)
				.addButton((button) => {
					button.setButtonText('Test connection').onClick(() => {
						void this.testConnection();
					});
				});
		}

		new Setting(this.containerEl)
			.setName('Default link text')
			.setDesc('Pre-filled when inserting a Markdown link.')
			.addText((text) => {
				text.setValue(this.plugin.settings.defaultLinkText);
				text.onChange((value) => {
					void this.plugin.updateSettings({ defaultLinkText: value });
				});
			});

		new Setting(this.containerEl)
			.setName('Default search type')
			.addDropdown((dropdown) => {
				for (const type of SEARCH_TYPES) {
					dropdown.addOption(type, STRINGS.searchTypes[type]);
				}
				dropdown.setValue(this.plugin.settings.defaultSearchType);
				dropdown.onChange((value) => {
					void this.plugin.updateSettings({ defaultSearchType: value as SearchType });
				});
			});

		new Setting(this.containerEl)
			.setName('Debug logging')
			.setDesc('Writes diagnostic messages to the developer console. No telemetry is collected.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.debugLogging);
				toggle.onChange((value) => {
					void this.plugin.updateSettings({ debugLogging: value });
				});
			});

		new Setting(this.containerEl)
			.setName('Copy query when opening fails')
			.setDesc('Copies the generated Anki search query to the clipboard as a fallback.')
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.copyQueryOnFailure);
				toggle.onChange((value) => {
					void this.plugin.updateSettings({ copyQueryOnFailure: value });
				});
			});
	}

	private async testConnection(): Promise<void> {
		try {
			const service = new AnkiConnectService({
				url: this.plugin.settings.ankiConnectUrl,
			});
			await service.testConnection();
			new Notice(STRINGS.notices.connectionOk);
		} catch (error) {
			this.plugin.handleError(error);
		}
	}
}
