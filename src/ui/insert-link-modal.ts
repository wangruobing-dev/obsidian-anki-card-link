import { Modal, Setting, type App, type Editor } from 'obsidian';
import { buildMarkdownLink } from '../core/uri-parser';
import { STRINGS } from '../strings';
import { SEARCH_TYPES, type SearchType } from '../types';
import type AnkiCardLinkPlugin from '../main';

interface SearchFormState {
	type: SearchType;
	value: string;
}

abstract class SearchModalBase extends Modal {
	protected state: SearchFormState;

	protected constructor(
		app: App,
		protected readonly plugin: AnkiCardLinkPlugin,
	) {
		super(app);
		this.contentEl.addClass('anki-card-link-modal');
		this.state = {
			type: plugin.settings.defaultSearchType,
			value: '',
		};
	}

	protected addSearchFields(): void {
		new Setting(this.contentEl)
			.setName(STRINGS.labels.searchType)
			.addDropdown((dropdown) => {
				for (const type of SEARCH_TYPES) {
					dropdown.addOption(type, STRINGS.searchTypes[type]);
				}
				dropdown.setValue(this.state.type);
				dropdown.onChange((value) => {
					this.state.type = value as SearchType;
				});
			});

		new Setting(this.contentEl)
			.setName(STRINGS.labels.value)
			.addText((text) => {
				text.inputEl.addClass('anki-card-link__value-input');
				text.setPlaceholder('Enter an ID or Anki query');
				text.onChange((value) => {
					this.state.value = value;
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});
	}

	override onClose(): void {
		this.contentEl.empty();
	}
}

export class InsertLinkModal extends SearchModalBase {
	private linkText: string;

	constructor(
		app: App,
		plugin: AnkiCardLinkPlugin,
		private readonly editor: Editor,
	) {
		super(app, plugin);
		this.linkText = plugin.settings.defaultLinkText;
	}

	override onOpen(): void {
		this.setTitle(STRINGS.titles.insertLink);
		this.addSearchFields();

		new Setting(this.contentEl)
			.setName(STRINGS.labels.linkText)
			.addText((text) => {
				text.setValue(this.linkText);
				text.onChange((value) => {
					this.linkText = value;
				});
			});

		new Setting(this.contentEl).addButton((button) => {
			button.setButtonText(STRINGS.labels.cancel).onClick(() => this.close());
		}).addButton((button) => {
			button
				.setButtonText(STRINGS.labels.insert)
				.setCta()
				.onClick(() => this.insertLink());
		});
	}

	private insertLink(): void {
		try {
			const markdown = buildMarkdownLink(this.state.type, this.state.value, this.linkText);
			this.editor.replaceSelection(markdown);
			this.plugin.showNotice(STRINGS.notices.linkInserted);
			this.close();
		} catch (error) {
			this.plugin.handleError(error);
		}
	}
}

export class OpenLinkModal extends SearchModalBase {
	constructor(app: App, plugin: AnkiCardLinkPlugin) {
		super(app, plugin);
	}

	override onOpen(): void {
		this.setTitle(STRINGS.titles.openLink);
		this.addSearchFields();

		new Setting(this.contentEl).addButton((button) => {
			button.setButtonText(STRINGS.labels.cancel).onClick(() => this.close());
		}).addButton((button) => {
			button
				.setButtonText(STRINGS.labels.open)
				.setCta()
				.onClick(() => {
					void this.openLink();
				});
		});
	}

	private async openLink(): Promise<void> {
		const opened = await this.plugin.openSearch(this.state.type, this.state.value);
		if (opened) {
			this.close();
		}
	}
}
