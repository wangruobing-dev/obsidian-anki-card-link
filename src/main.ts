import { Notice, Platform, Plugin, TFile, type Editor, type MarkdownFileInfo } from 'obsidian';
import {
	addBlockId,
	findCardAtLine,
	getCardTitle,
	parseCardCandidates,
	parseCards,
	type ParsedCard,
} from './core/card-parser';
import {
	buildAnkiMediaFilename,
	encodeArrayBufferAsBase64,
	extractObsidianImageReferences,
} from './core/anki-media';
import { ensureAnkiNoteLink } from './core/card-link';
import { buildFolderDeckName } from './core/deck-name';
import {
	buildClozeReplacement,
	getClozeContentCursorOffset,
	getClozeNumber,
	type ClozeNumberMode,
} from './core/cloze-editor';
import { buildAnkiQuery } from './core/query-builder';
import { OBSIDIAN_PROTOCOL_ACTION, parseProtocolParams } from './core/uri-parser';
import { createPlatformRouter } from './platform/router';
import { AnkiConnectService } from './services/anki-connect';
import { CardSyncService, type CardSyncResult, type CardSyncStatus } from './services/card-sync';
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
			this.removeCommand('sync-current-card');
			this.removeCommand('sync-current-file');
			this.removeCommand('cloze-next-number');
			this.removeCommand('cloze-current-number');
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

		this.addCommand({
			id: 'sync-current-card',
			name: strings.commands.syncCurrentCard,
			editorCallback: (editor: Editor, context: MarkdownFileInfo) => {
				void this.syncCurrentCard(editor, context);
			},
		});

		this.addCommand({
			id: 'sync-current-file',
			name: strings.commands.syncCurrentFile,
			editorCallback: (editor: Editor, context: MarkdownFileInfo) => {
				void this.syncCurrentFile(editor, context);
			},
		});

		this.addCommand({
			id: 'cloze-next-number',
			name: strings.commands.clozeNextNumber,
			editorCallback: (editor: Editor) => this.insertCloze(editor, 'next'),
		});

		this.addCommand({
			id: 'cloze-current-number',
			name: strings.commands.clozeCurrentNumber,
			editorCallback: (editor: Editor) => this.insertCloze(editor, 'current'),
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

	async testSyncConfiguration(): Promise<void> {
		try {
			this.requireDesktopSync();
			const service = new CardSyncService(this.createAnkiConnect(), this.settings);
			await service.testConfiguration();
			this.showNotice(getStrings(this.settings.language).notices.syncConfigurationOk);
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCurrentCard(editor: Editor, context: MarkdownFileInfo): Promise<void> {
		try {
			this.requireDesktopSync();
			const file = this.requireMarkdownFile(context);
			const cursor = editor.getCursor();
			let source = editor.getValue();
			let card = findCardAtLine(source, cursor.line);
			if (card === undefined) {
				const invalidCard = parseCardCandidates(source).find(
					(candidate) =>
						candidate.error !== undefined &&
						cursor.line >= candidate.startLine &&
						cursor.line <= candidate.endLine,
				);
				if (invalidCard?.error !== undefined) {
					throw invalidCard.error;
				}
				throw new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The cursor is not inside a supported card.');
			}
			if (card.blockId === undefined) {
				source = addBlockId(source, card);
				editor.setValue(source);
				card = findCardAtLine(source, cursor.line);
				if (card === undefined || card.blockId === undefined) {
					throw new AnkiCardLinkError('BLOCK_ID_WRITE_FAILED', 'Could not write a stable card block ID to the current note.');
				}
			}
			const result = await this.syncCard(card, source, file.name, file.path);
			const sourceWithLink = ensureAnkiNoteLink(
				source,
				card,
				result.noteId,
				getStrings(this.settings.language).labels.openAnkiCard,
			);
			if (sourceWithLink !== source) {
				editor.setValue(sourceWithLink);
			}
			this.showNotice(
				result.status === 'created'
					? getStrings(this.settings.language).notices.cardCreated
					: getStrings(this.settings.language).notices.cardUpdated,
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCurrentFile(editor: Editor, context: MarkdownFileInfo): Promise<void> {
		try {
			this.requireDesktopSync();
			const file = this.requireMarkdownFile(context);
			let source = editor.getValue();
			const candidates = parseCardCandidates(source);
			let cards = candidates.flatMap((candidate) =>
				candidate.card === undefined ? [] : [candidate.card],
			);
			const parseFailureCount = candidates.filter((candidate) => candidate.error !== undefined).length;
			if (cards.length === 0 && parseFailureCount === 0) {
				throw new AnkiCardLinkError('NO_SYNCABLE_CARDS', 'No supported cards were found in the current file.');
			}
			for (const card of [...cards].reverse()) {
				if (card.blockId === undefined) {
					source = addBlockId(source, card);
				}
			}
			if (source !== editor.getValue()) {
				editor.setValue(source);
			}
			cards = parseCards(source);
			const summary: Record<CardSyncStatus | 'skipped' | 'failed', number> = {
				created: 0,
				updated: 0,
				skipped: 0,
				failed: parseFailureCount,
			};
			const synchronizedCards: Array<{ card: ParsedCard; noteId: number }> = [];
			for (const card of cards) {
				try {
					const result = await this.syncCard(card, source, file.name, file.path);
					summary[result.status] += 1;
					synchronizedCards.push({ card, noteId: result.noteId });
				} catch (error) {
					summary.failed += 1;
					this.debug('A card in the current file could not be synchronized.', error);
				}
			}
			for (const synchronized of [...synchronizedCards].reverse()) {
				source = ensureAnkiNoteLink(
					source,
				synchronized.card,
				synchronized.noteId,
					getStrings(this.settings.language).labels.openAnkiCard,
				);
			}
			if (source !== editor.getValue()) {
				editor.setValue(source);
			}
			this.showNotice(getStrings(this.settings.language).notices.syncSummary(summary));
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCard(card: ParsedCard, source: string, fileName: string, filePath: string): Promise<CardSyncResult> {
		if (card.blockId === undefined) {
			throw new AnkiCardLinkError('BLOCK_ID_WRITE_FAILED', 'Card block ID is missing after writing the current note.');
		}
		const anki = this.createAnkiConnect();
		const imageMedia = await this.uploadCardImages(card, filePath, anki);
		return new CardSyncService(anki, this.settings).sync({
			card,
			blockId: card.blockId,
			title: getCardTitle(source, card, fileName),
			vaultName: this.app.vault.getName(),
			filePath,
			folderDeckName: buildFolderDeckName(filePath),
			imageMedia,
		});
	}

	/** 将卡片引用的 Obsidian 本地图片上传到 Anki 媒体库，并返回对应的 Anki 文件名。 */
	private async uploadCardImages(
		card: ParsedCard,
		filePath: string,
		anki: AnkiConnectService,
	): Promise<Map<string, string>> {
		const contents = card.type === 'cloze'
			? [card.content]
			: [card.front, card.back];
		const references = extractObsidianImageReferences(contents.filter((content): content is string => content !== undefined).join('\n'));
		const imageMedia = new Map<string, string>();
		for (const reference of references) {
			const imageFile = this.app.metadataCache.getFirstLinkpathDest(reference, filePath);
			if (!(imageFile instanceof TFile)) {
				throw new AnkiCardLinkError('IMAGE_NOT_FOUND', `Image attachment was not found: ${reference}.`);
			}
			if (!isSupportedImageExtension(imageFile.extension)) {
				throw new AnkiCardLinkError('UNSUPPORTED_IMAGE', `Unsupported image format: ${imageFile.extension}.`);
			}
			const ankiFilename = buildAnkiMediaFilename(imageFile.path, imageFile.extension);
			const data = encodeArrayBufferAsBase64(await this.app.vault.readBinary(imageFile));
			await anki.storeMediaFile(ankiFilename, data);
			imageMedia.set(reference, ankiFilename);
			this.debug(`Uploaded image to Anki media: ${imageFile.path} -> ${ankiFilename}`);
		}
		return imageMedia;
	}

	private insertCloze(editor: Editor, mode: ClozeNumberMode): void {
		const cursor = editor.getCursor();
		const cardText = this.getCurrentParagraph(editor, cursor.line);
		const number = getClozeNumber(cardText, mode);
		const selection = editor.getSelection();
		editor.replaceSelection(buildClozeReplacement(selection, number));
		if (selection.length === 0) {
			editor.setCursor({ line: cursor.line, ch: cursor.ch + getClozeContentCursorOffset(number) });
		}
	}

	private getCurrentParagraph(editor: Editor, line: number): string {
		let first = line;
		let last = line;
		while (first > 0 && editor.getLine(first - 1).trim().length > 0) {
			first -= 1;
		}
		while (last < editor.lastLine() && editor.getLine(last + 1).trim().length > 0) {
			last += 1;
		}
		const lines: string[] = [];
		for (let index = first; index <= last; index += 1) {
			lines.push(editor.getLine(index));
		}
		return lines.join('\n');
	}

	private createAnkiConnect(): AnkiConnectService {
		return new AnkiConnectService({ url: this.settings.ankiConnectUrl });
	}

	private requireDesktopSync(): void {
		if (!Platform.isDesktopApp) {
			throw new AnkiCardLinkError(
				'MOBILE_SYNC_UNSUPPORTED',
				'Synchronization is currently available only on desktop. Anki links are still available.',
			);
		}
	}

	private requireMarkdownFile(context: MarkdownFileInfo) {
		if (context.file === null || context.file.extension !== 'md') {
			throw new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The current editor does not contain a Markdown file.');
		}
		return context.file;
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

function isSupportedImageExtension(extension: string): boolean {
	return new Set(['apng', 'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']).has(extension.toLowerCase());
}
