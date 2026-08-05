import { MarkdownView, Notice, Platform, Plugin, TFile, getAllTags, type Editor, type MarkdownFileInfo } from 'obsidian';
import { generateCardUid } from './core/card-identity';
import { ensureCardLink } from './core/card-link';
import {
	findCardAtLine,
	getCardTitle,
	parseCardCandidates,
	type ParsedCard,
} from './core/card-parser';
import {
	buildAnkiMediaFilename,
	encodeArrayBufferAsBase64,
	extractObsidianImageReferences,
} from './core/anki-media';
import { buildFolderDeckName } from './core/deck-name';
import {
	buildClozeReplacement,
	getClozeContentCursorOffset,
	getClozeNumber,
	insertClozeRegion as insertClozeRegionInMarkdown,
	type ClozeNumberMode,
} from './core/cloze-editor';
import { getClozeScopeAtOffset } from './core/cloze-region';
import { buildAnkiQuery } from './core/query-builder';
import {
	OPEN_OBSIDIAN_PROTOCOL_ACTION,
	parseOpenObsidianProtocolParams,
	type OpenObsidianSourceParams,
} from './core/open-source-uri';
import { OPEN_ANKI_PROTOCOL_ACTION, parseProtocolParams } from './core/uri-parser';
import { createPlatformRouter } from './platform/router';
import { AnkiConnectService } from './services/anki-connect';
import { CardLocationIndex } from './services/card-location-index';
import { CardSyncService, type CardSyncResult, type CardSyncStatus } from './services/card-sync';
import { AppObsidianSourceHost } from './services/obsidian-source-host';
import { ObsidianSourceLocator } from './services/obsidian-source-locator';
import { migratePluginData, type PersistedPluginDataV2 } from './services/plugin-data-store';
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
import { buildCardSyntax } from './core/card-syntax';
import { ensureObsidianTag } from './core/note-tag';
import { ReadingReviewControllerRegistry, type ReadingReviewController } from './reading-review/controller';
import { processReadingReviewSection } from './reading-review/markdown-processor';
import type { ReadingReviewMaskKind } from './reading-review/mask-model';
import { LOCALIZED_COMMAND_IDS } from './reading-review/command-ids';

export default class AnkiCardLinkPlugin extends Plugin {
	settings: AnkiCardLinkSettings = DEFAULT_SETTINGS;
	private cardLocations = new CardLocationIndex();
	private localizedCommandsRegistered = false;
	private layoutReady = false;
	private pendingOpenSource?: OpenObsidianSourceParams;
	private openingSource = false;
	private readonly readingReviewControllers = new ReadingReviewControllerRegistry(this.app);

	override async onload(): Promise<void> {
		try {
			await this.loadPluginData();
		} catch (error) {
			this.handleError(error);
			throw error;
		}

		this.registerObsidianProtocolHandler(OPEN_ANKI_PROTOCOL_ACTION, (params) => {
			try {
				const input = parseProtocolParams(params);
				void this.openSearch(input.type, input.value);
			} catch (error) {
				this.handleError(error);
			}
		});
		this.registerObsidianProtocolHandler(OPEN_OBSIDIAN_PROTOCOL_ACTION, (params) => {
			try {
				this.pendingOpenSource = parseOpenObsidianProtocolParams(params);
				void this.flushPendingOpenSource();
			} catch (error) {
				this.handleError(error);
			}
		});
		this.app.workspace.onLayoutReady(() => {
			this.layoutReady = true;
			void this.flushPendingOpenSource();
		});

		this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
			const newPath = file.path;
			if (this.cardLocations.renamePath(oldPath, newPath) > 0) {
				void this.savePluginData();
			}
		}));
		this.registerEvent(this.app.vault.on('delete', (file) => {
			if (this.cardLocations.removePath(file.path) > 0) {
				void this.savePluginData();
			}
		}));

		this.registerLocalizedCommands();
		this.registerMarkdownPostProcessor((el, ctx) => processReadingReviewSection(this, this.readingReviewControllers, el, ctx));
		this.addSettingTab(new AnkiCardLinkSettingTab(this.app, this));
		this.debug('Plugin loaded.');
	}

	private registerLocalizedCommands(): void {
		const strings = getStrings(this.settings.language);
		if (this.localizedCommandsRegistered) {
			for (const id of LOCALIZED_COMMAND_IDS) {
				this.removeCommand(id);
			}
		}
		this.addCommand({ id: 'insert-link', name: strings.commands.insertLink, editorCallback: (editor: Editor) => new InsertLinkModal(this.app, this, editor).open() });
		this.addCommand({ id: 'open-link', name: strings.commands.openLink, callback: () => new OpenLinkModal(this.app, this).open() });
		this.addCommand({ id: 'sync-current-card', name: strings.commands.syncCurrentCard, editorCallback: (editor, context) => void this.syncCurrentCard(editor, context) });
		this.addCommand({ id: 'sync-current-file', name: strings.commands.syncCurrentFile, editorCallback: (editor, context) => void this.syncCurrentFile(editor, context) });
		this.addCommand({ id: 'cloze-next-number', name: strings.commands.clozeNextNumber, editorCallback: (editor) => this.insertCloze(editor, 'next') });
		this.addCommand({ id: 'cloze-current-number', name: strings.commands.clozeCurrentNumber, editorCallback: (editor) => this.insertCloze(editor, 'current') });
		this.addCommand({ id: 'insert-cloze-region', name: strings.commands.insertClozeRegion, editorCallback: (editor) => this.insertClozeRegion(editor) });
		this.addReadingReviewCommand('reveal-next-reading-cloze', strings.commands.revealNextReadingCloze, 'cloze', false);
		this.addReadingReviewCommand('toggle-all-reading-clozes', strings.commands.toggleAllReadingClozes, 'cloze', true);
		this.addReadingReviewCommand('reveal-next-reading-back', strings.commands.revealNextReadingBack, 'back', false);
		this.addReadingReviewCommand('toggle-all-reading-backs', strings.commands.toggleAllReadingBacks, 'back', true);
		this.localizedCommandsRegistered = true;
	}

	async openSearch(type: SearchType, value: string): Promise<boolean> {
		let query: string | undefined;
		try {
			query = buildAnkiQuery(type, value);
			await createPlatformRouter(this.createAnkiConnect()).open(query);
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
		const refreshReadingReview = changes.readingReviewEnabled !== undefined
			|| changes.readingReviewEdgeTapEnabled !== undefined;
		this.settings = { ...this.settings, ...changes };
		await this.savePluginData();
		if (refreshReadingReview) {
			this.rerenderReadingViews();
		}
	}

	override onunload(): void {
		this.readingReviewControllers.clear();
	}

	resolveReadingReviewRoot(el: HTMLElement): HTMLElement | undefined {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView
				&& leaf.view.previewMode.containerEl.contains(el)) {
				return leaf.view.previewMode.containerEl;
			}
		}
		return el.closest<HTMLElement>(
			'.markdown-preview-view, .markdown-reading-view, .workspace-leaf-content, .view-content',
		) ?? el.parentElement ?? undefined;
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
			const result = await new CardSyncService(this.createAnkiConnect(), this.settings).testConfiguration();
			const strings = getStrings(this.settings.language);
			this.showNotice(result.choiceWarning === undefined
				? strings.notices.syncConfigurationOk
				: strings.notices.syncConfigurationChoiceWarning(getLocalizedErrorMessage(result.choiceWarning, this.settings.language)));
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCurrentCard(editor: Editor, context: MarkdownFileInfo): Promise<void> {
		try {
			this.requireDesktopSync();
			const file = this.requireMarkdownFile(context);
			const source = editor.getValue();
			const syntax = buildCardSyntax(this.settings);
			const cursor = editor.getCursor();
			const card = findCardAtLine(source, cursor.line, syntax);
			if (card === undefined) {
				const invalid = parseCardCandidates(source, syntax).find((candidate) => candidate.error !== undefined && cursor.line >= candidate.startLine && cursor.line <= candidate.endLine);
				throw invalid?.error ?? new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The cursor is not inside a supported card.');
			}
			const uid = card.uid ?? generateCardUid();
			const result = await this.syncCard(card, uid, file.path);
			try {
				const withLink = ensureCardLink(source, card, { uid, noteId: result.noteId }, this.settings.defaultLinkText);
				const updated = ensureObsidianTag(withLink, 'anki-card-link');
				editor.setValue(updated);
			} catch (error) {
				throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', `Anki note ${result.noteId} was synchronized with UID ${uid}, but the Markdown link could not be written.`, { cause: error });
			}
			this.cardLocations.set(uid, file.path);
			await this.savePluginData();
			this.showNotice(result.status === 'created' ? getStrings(this.settings.language).notices.cardCreated : getStrings(this.settings.language).notices.cardUpdated);
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCurrentFile(editor: Editor, context: MarkdownFileInfo): Promise<void> {
		try {
			this.requireDesktopSync();
			const file = this.requireMarkdownFile(context);
			const original = editor.getValue();
			const candidates = parseCardCandidates(original, buildCardSyntax(this.settings));
			const cards = candidates.flatMap((candidate) => candidate.card === undefined ? [] : [candidate.card]);
			const parseErrors = candidates.flatMap((candidate) => candidate.error === undefined ? [] : [candidate.error]);
			const parseFailureCount = parseErrors.length;
			if (cards.length === 0 && parseFailureCount === 0) {
				throw new AnkiCardLinkError('NO_SYNCABLE_CARDS', 'No supported cards were found in the current file.');
			}
			const summary: Record<CardSyncStatus | 'skipped' | 'failed', number> = { created: 0, updated: 0, skipped: 0, failed: parseFailureCount };
			for (const error of parseErrors) {
				this.showNotice(getLocalizedErrorMessage(error, this.settings.language));
			}
			const synchronized: Array<{ card: ParsedCard; uid: string; result: CardSyncResult }> = [];
			for (const card of cards) {
				try {
					const uid = card.uid ?? generateCardUid();
					const result = await this.syncCard(card, uid, file.path);
					summary[result.status] += 1;
					synchronized.push({ card, uid, result });
				} catch (error) {
					summary.failed += 1;
					this.handleError(error);
				}
			}
			try {
				let updated = original;
				for (const item of [...synchronized].reverse()) {
					updated = ensureCardLink(updated, item.card, { uid: item.uid, noteId: item.result.noteId }, this.settings.defaultLinkText);
				}
				if (synchronized.length > 0) {
					updated = ensureObsidianTag(updated, 'anki-card-link');
				}
				if (updated !== original) {
					editor.setValue(updated);
				}
			} catch (error) {
				const identities = synchronized.map((item) => `${item.result.noteId}/${item.uid}`).join(', ');
				throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', `Anki notes were synchronized, but Markdown links could not be written: ${identities}.`, { cause: error });
			}
			for (const item of synchronized) {
				this.cardLocations.set(item.uid, file.path);
			}
			if (synchronized.length > 0) {
				await this.savePluginData();
			}
			this.showNotice(getStrings(this.settings.language).notices.syncSummary(summary));
		} catch (error) {
			this.handleError(error);
		}
	}

	private async syncCard(card: ParsedCard, uid: string, filePath: string): Promise<CardSyncResult> {
		const anki = this.createAnkiConnect();
		const imageMedia = await this.uploadCardImages(card, filePath, anki);
		return new CardSyncService(anki, this.settings).sync({
			card,
			uid,
			noteIdHint: card.noteId,
			title: getCardTitle(filePath),
			vaultName: this.app.vault.getName(),
			filePath,
			folderDeckName: buildFolderDeckName(filePath),
			imageMedia,
		});
	}

	private async uploadCardImages(card: ParsedCard, filePath: string, anki: AnkiConnectService): Promise<Map<string, string>> {
		const contents = card.type === 'cloze'
			? [card.content]
			: card.type === 'choice'
				? [card.front, card.back, ...card.options]
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
			const filename = buildAnkiMediaFilename(imageFile.path, imageFile.extension);
			await anki.storeMediaFile(filename, encodeArrayBufferAsBase64(await this.app.vault.readBinary(imageFile)));
			imageMedia.set(reference, filename);
		}
		return imageMedia;
	}

	private async flushPendingOpenSource(): Promise<void> {
		if (!this.layoutReady || this.openingSource) {
			return;
		}
		this.openingSource = true;
		try {
			while (this.pendingOpenSource !== undefined) {
				const request = this.pendingOpenSource;
				this.pendingOpenSource = undefined;
				try {
					const locator = new ObsidianSourceLocator(
						new AppObsidianSourceHost(this.app),
						this.cardLocations,
						buildCardSyntax(this.settings),
					);
					const result = await locator.open(request);
					if (!result.positioned) {
						this.showNotice(getStrings(this.settings.language).notices.sourceOpenedWithoutPosition);
					}
				} catch (error) {
					this.handleError(error);
				}
			}
		} finally {
			this.openingSource = false;
		}
	}

	private insertCloze(editor: Editor, mode: ClozeNumberMode): void {
		const cursor = editor.getCursor();
		const source = editor.getValue();
		const scope = getClozeScopeAtOffset(source, editor.posToOffset(cursor));
		const fallback = this.getCurrentParagraph(editor, cursor.line);
		const number = getClozeNumber(scope?.text ?? fallback, mode, scope?.beforeCursor ?? fallback);
		const selection = editor.getSelection();
		editor.replaceSelection(buildClozeReplacement(selection, number));
		if (selection.length === 0) {
			editor.setCursor({ line: cursor.line, ch: cursor.ch + getClozeContentCursorOffset(number) });
		}
	}

	private insertClozeRegion(editor: Editor): void {
		const source = editor.getValue();
		const start = editor.posToOffset(editor.getCursor('from'));
		const end = editor.posToOffset(editor.getCursor('to'));
		const result = insertClozeRegionInMarkdown(source, start, end);
		if (!result.ok) {
			const notices = getStrings(this.settings.language).notices;
			this.showNotice(result.reason === 'inside-region' ? notices.clozeRegionInside : notices.clozeRegionOverlap);
			return;
		}
		editor.setValue(result.markdown);
		editor.setSelection(editor.offsetToPos(result.selectionStart), editor.offsetToPos(result.selectionEnd));
	}

	private addReadingReviewCommand(
		id: string,
		name: string,
		kind: ReadingReviewMaskKind,
		toggleAll: boolean,
	): void {
		this.addCommand({
			id,
			name,
			checkCallback: (checking) => {
				const controller = this.getActiveReadingReviewController();
				if (controller === undefined) {
					return false;
				}
				if (!checking) {
					if (toggleAll) {
						controller.toggleAll(kind);
					} else {
						controller.revealNext(kind);
					}
				}
				return true;
			},
		});
	}

	private getActiveReadingReviewController(): ReadingReviewController | undefined {
		if (!this.settings.readingReviewEnabled) {
			return undefined;
		}
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view === null || view.getMode() !== 'preview' || view.file === null) {
			return undefined;
		}
		const tags = getAllTags(this.app.metadataCache.getFileCache(view.file) ?? {});
		if (!tags?.some((tag) => tag.replace(/^#/u, '').toLowerCase() === 'anki-card-link')) {
			return undefined;
		}
		return this.readingReviewControllers.getForContainer(view.previewMode.containerEl);
	}

	private rerenderReadingViews(): void {
		for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
			if (leaf.view instanceof MarkdownView && leaf.view.getMode() === 'preview') {
				leaf.view.previewMode.rerender(true);
			}
		}
	}

	private getCurrentParagraph(editor: Editor, line: number): string {
		let first = line;
		let last = line;
		while (first > 0 && editor.getLine(first - 1).trim().length > 0) first -= 1;
		while (last < editor.lastLine() && editor.getLine(last + 1).trim().length > 0) last += 1;
		const lines: string[] = [];
		for (let index = first; index <= last; index += 1) lines.push(editor.getLine(index));
		return lines.join('\n');
	}

	private createAnkiConnect(): AnkiConnectService {
		return new AnkiConnectService({ url: this.settings.ankiConnectUrl });
	}

	private requireDesktopSync(): void {
		if (!Platform.isDesktopApp) {
			throw new AnkiCardLinkError('MOBILE_SYNC_UNSUPPORTED', 'Synchronization is currently available only on desktop. Anki links are still available.');
		}
	}

	private requireMarkdownFile(context: MarkdownFileInfo): TFile {
		if (context.file === null || context.file.extension !== 'md') {
			throw new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The current editor does not contain a Markdown file.');
		}
		return context.file;
	}

	private async loadPluginData(): Promise<void> {
		try {
			const data = migratePluginData(await this.loadData());
			this.settings = data.settings;
			this.cardLocations = new CardLocationIndex(data.cardLocations);
		} catch (error) {
			throw new AnkiCardLinkError('PLUGIN_DATA_MIGRATION_FAILED', 'Plugin data could not be migrated to version 2.', { cause: error });
		}
	}

	private async savePluginData(): Promise<void> {
		const data: PersistedPluginDataV2 = { version: 2, settings: this.settings, cardLocations: this.cardLocations.toJSON() };
		await this.saveData(data);
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
		if (this.settings.debugLogging) {
			if (detail === undefined) console.debug(`[Anki Card Link] ${message}`);
			else console.debug(`[Anki Card Link] ${message}`, detail);
		}
	}
}

function isSupportedImageExtension(extension: string): boolean {
	return new Set(['apng', 'avif', 'bmp', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']).has(extension.toLowerCase());
}
