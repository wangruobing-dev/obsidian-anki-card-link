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
import { getStrings } from '../strings';
import { SEARCH_TYPES, type Language, type SearchType } from '../types';
import type AnkiCardLinkPlugin from '../main';

const DEFAULT_ANKI_CONNECT_URL = 'http://127.0.0.1:8765';

export class AnkiCardLinkSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: AnkiCardLinkPlugin) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [];
	}

	display(): void {
		this.renderSettings();
	}

	private renderSettings(): void {
		this.containerEl.empty();
		const strings = getStrings(this.plugin.settings.language);

		new Setting(this.containerEl)
			.setName(strings.settings.language)
			.setDesc(strings.settings.languageDesc)
			.addDropdown((dropdown) => {
				dropdown.addOption('en', 'English');
				dropdown.addOption('zh-CN', '简体中文');
				dropdown.setValue(this.plugin.settings.language);
				dropdown.onChange(async (value) => {
					await this.plugin.updateLanguage(value as Language);
					this.renderSettings();
				});
			});

		new Setting(this.containerEl).setName(strings.settings.connection).setHeading();

		new Setting(this.containerEl)
			.setName(strings.settings.ankiConnectAddress)
			.setDesc(strings.settings.ankiConnectAddressDesc(DEFAULT_ANKI_CONNECT_URL))
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
				.setName(strings.settings.testDesktopConnection)
				.setDesc(strings.settings.testDesktopConnectionDesc)
				.addButton((button) => {
					button.setButtonText(strings.settings.testConnection).onClick(() => {
						void this.testConnection();
					});
				});
		}

		new Setting(this.containerEl).setName(strings.settings.synchronization).setHeading();

		this.addTextSetting(strings.settings.defaultDeckName, strings.settings.defaultDeckNameDesc, 'defaultDeckName');
		this.addSeparatorSetting(
			strings.settings.singleLineSeparators,
			strings.settings.singleLineSeparatorsDesc,
			'singleLineSeparators',
		);
		this.addSeparatorSetting(
			strings.settings.multiLineSeparators,
			strings.settings.multiLineSeparatorsDesc,
			'multiLineSeparators',
		);
		new Setting(this.containerEl)
			.setName(strings.settings.useCurrentFolderAsDeck)
			.setDesc(strings.settings.useCurrentFolderAsDeckDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.useCurrentFolderAsDeck);
				toggle.onChange((value) => {
					void this.plugin.updateSettings({ useCurrentFolderAsDeck: value });
				});
			});
		new Setting(this.containerEl).setName(strings.settings.basicConfiguration).setHeading();
		this.addTextSetting(strings.settings.basicModelName, strings.settings.basicModelNameDesc, 'basicModelName');
		this.addTextSetting(strings.settings.basicTitleField, '', 'basicTitleField');
		this.addTextSetting(strings.settings.basicFrontField, '', 'basicFrontField');
		this.addTextSetting(strings.settings.basicBackField, '', 'basicBackField');
		this.addTextSetting(strings.settings.basicHintField, '', 'basicHintField');
		this.addTextSetting(strings.settings.basicObsidianUriField, '', 'basicObsidianUriField');
		new Setting(this.containerEl).setName(strings.settings.clozeConfiguration).setHeading();
		this.addTextSetting(strings.settings.clozeModelName, strings.settings.clozeModelNameDesc, 'clozeModelName');
		this.addTextSetting(strings.settings.clozeContentField, '', 'clozeContentField');
		this.addTextSetting(strings.settings.clozeTitleField, strings.settings.clozeTitleFieldDesc, 'clozeTitleField');
		this.addTextSetting(
			strings.settings.clozeObsidianUriField,
			strings.settings.clozeObsidianUriFieldDesc,
			'clozeObsidianUriField',
		);
		new Setting(this.containerEl).setName(strings.settings.choiceConfiguration).setHeading();
		this.addTextSetting(strings.settings.choiceModelName, strings.settings.choiceModelNameDesc, 'choiceModelName');
		this.addTextSetting(strings.settings.choiceCardIdField, '', 'choiceCardIdField');
		this.addTextSetting(strings.settings.choiceTitleField, '', 'choiceTitleField');
		this.addTextSetting(strings.settings.choiceFrontField, '', 'choiceFrontField');
		this.addTextSetting(strings.settings.choiceBackField, '', 'choiceBackField');
		this.addTextSetting(strings.settings.choiceObsidianUrlField, '', 'choiceObsidianUrlField');
		this.addTextSetting(strings.settings.choiceOptionField('A'), '', 'choiceOptionAField');
		this.addTextSetting(strings.settings.choiceOptionField('B'), '', 'choiceOptionBField');
		this.addTextSetting(strings.settings.choiceOptionField('C'), '', 'choiceOptionCField');
		this.addTextSetting(strings.settings.choiceOptionField('D'), '', 'choiceOptionDField');
		this.addTextSetting(strings.settings.choiceOptionField('E'), '', 'choiceOptionEField');
		this.addTextSetting(strings.settings.choiceOptionField('F'), '', 'choiceOptionFField');
		this.addTextSetting(strings.settings.choiceOptionField('G'), '', 'choiceOptionGField');
		this.addTextSetting(strings.settings.choiceCorrectAnswerField, '', 'choiceCorrectAnswerField');

		if (Platform.isDesktopApp) {
			new Setting(this.containerEl)
				.setName(strings.settings.testSyncConfiguration)
				.setDesc(strings.settings.testSyncConfigurationDesc)
				.addButton((button) => {
					button.setButtonText(strings.settings.testSyncConfiguration).onClick(() => {
						void this.plugin.testSyncConfiguration();
					});
				});
		}

		new Setting(this.containerEl)
			.setName(strings.settings.defaultLinkText)
			.setDesc(strings.settings.defaultLinkTextDesc)
			.addText((text) => {
				text.setValue(this.plugin.settings.defaultLinkText);
				text.onChange((value) => {
					void this.plugin.updateSettings({ defaultLinkText: value });
				});
			});

		new Setting(this.containerEl)
			.setName(strings.settings.defaultSearchType)
			.addDropdown((dropdown) => {
				for (const type of SEARCH_TYPES) {
					dropdown.addOption(type, strings.searchTypes[type]);
				}
				dropdown.setValue(this.plugin.settings.defaultSearchType);
				dropdown.onChange((value) => {
					void this.plugin.updateSettings({ defaultSearchType: value as SearchType });
				});
			});

		new Setting(this.containerEl)
			.setName(strings.settings.debugLogging)
			.setDesc(strings.settings.debugLoggingDesc)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.debugLogging);
				toggle.onChange((value) => {
					void this.plugin.updateSettings({ debugLogging: value });
				});
			});

		new Setting(this.containerEl)
			.setName(strings.settings.copyQueryOnFailure)
			.setDesc(strings.settings.copyQueryOnFailureDesc)
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
			new Notice(getStrings(this.plugin.settings.language).notices.connectionOk);
		} catch (error) {
			this.plugin.handleError(error);
		}
	}

	private addTextSetting(
		name: string,
		description: string,
		key:
			| 'defaultDeckName'
			| 'basicModelName'
			| 'basicTitleField'
			| 'basicFrontField'
			| 'basicBackField'
			| 'basicHintField'
			| 'basicObsidianUriField'
			| 'clozeModelName'
			| 'clozeContentField'
			| 'clozeTitleField'
			| 'clozeObsidianUriField'
			| 'choiceModelName'
			| 'choiceCardIdField'
			| 'choiceTitleField'
			| 'choiceFrontField'
			| 'choiceBackField'
			| 'choiceObsidianUrlField'
			| 'choiceOptionAField'
			| 'choiceOptionBField'
			| 'choiceOptionCField'
			| 'choiceOptionDField'
			| 'choiceOptionEField'
			| 'choiceOptionFField'
			| 'choiceOptionGField'
			| 'choiceCorrectAnswerField',
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.setValue(this.plugin.settings[key]);
				text.onChange((value) => {
					void this.plugin.updateSettings({ [key]: value });
				});
			});
	}

	private addSeparatorSetting(
		name: string,
		description: string,
		key: 'singleLineSeparators' | 'multiLineSeparators',
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addTextArea((text) => {
				text.setValue(this.plugin.settings[key]);
				text.onChange((value) => {
					void this.plugin.updateSettings({ [key]: value });
				});
			});
	}
}
