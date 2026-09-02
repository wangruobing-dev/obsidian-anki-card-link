import { toAnkiHtml } from '../core/anki-content';
import { buildOpenObsidianUri } from '../core/open-source-uri';
import { buildFolderDeckName } from '../core/deck-name';
import type { ParsedCard } from '../core/card-parser';
import type { AnkiNoteInfo, AnkiNoteInput } from './anki-connect';
import { AnkiCardLinkError, type AnkiCardLinkSettings } from '../types';

export interface AnkiSyncClient {
	testConnection(): Promise<void>;
	modelNames(): Promise<string[]>;
	deckNames(): Promise<string[]>;
	createDeck(deck: string): Promise<number>;
	getDecks(cards: number[]): Promise<Record<string, number[]>>;
	changeDeck(cards: number[], deck: string): Promise<void>;
	modelFieldNames(modelName: string): Promise<string[]>;
	notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]>;
	addNote(note: AnkiNoteInput): Promise<number>;
	updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void>;
}

export interface CardSyncInput {
	card: ParsedCard;
	uid: string;
	noteIdHint?: number;
	title: string;
	vaultName: string;
	filePath: string;
	imageMedia?: ReadonlyMap<string, string>;
}

export interface SyncConfigurationResult {
	basicModelFields: string[];
	clozeModelFields: string[];
	choiceModelFields?: string[];
	choiceWarning?: AnkiCardLinkError;
}

export type CardSyncStatus = 'created' | 'updated' | 'skipped';

export type CardSyncSkipReason = 'NOTE_NOT_FOUND' | 'MODEL_MISMATCH' | 'URI_UID_MISMATCH' | 'NO_CHANGES';

export interface CompletedCardSyncResult {
	status: 'created' | 'updated';
	noteId: number;
}

export interface SkippedCardSyncResult {
	status: 'skipped';
	reason: CardSyncSkipReason;
}

export type CardSyncResult = CompletedCardSyncResult | SkippedCardSyncResult;

/**
	 * 负责把已解析的卡片写入 Anki。UID 保存在 ObsidianURI 中，用它确定唯一笔记，绝不按题面内容猜测。
 */
export class CardSyncService {
	constructor(
		private readonly anki: AnkiSyncClient,
		private readonly settings: AnkiCardLinkSettings,
	) {}

	async testConfiguration(): Promise<SyncConfigurationResult> {
		await this.anki.testConnection();
		if (!this.settings.useCurrentFolderAsDeck) {
			this.requireDeckName();
		}
		const models = await this.anki.modelNames();
		const basicModelFields = await this.validateBasicConfiguration(models);
		const clozeModelFields = await this.validateClozeConfiguration(models);
		try {
			const choiceModelFields = await this.validateChoiceConfiguration(models);
			return { basicModelFields, clozeModelFields, choiceModelFields };
		} catch (error) {
			if (error instanceof AnkiCardLinkError && ['CHOICE_MODEL_NOT_FOUND', 'CHOICE_FIELD_NOT_FOUND'].includes(error.code)) {
				return { basicModelFields, clozeModelFields, choiceWarning: error };
			}
			throw error;
		}
	}

	async sync(input: CardSyncInput): Promise<CardSyncResult> {
		if (input.uid.length === 0) {
			throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', 'Card UID is missing.');
		}
		await this.anki.testConnection();
		const models = await this.anki.modelNames();
		const fields = input.card.type === 'basic'
			? await this.validateBasicConfiguration(models)
			: input.card.type === 'cloze'
				? await this.validateClozeConfiguration(models)
				: await this.validateChoiceConfiguration(models);
		const fieldsToSync = this.buildFields(input);
		if (input.noteIdHint !== undefined) {
			const note = await this.getVerifiedNote(input);
			if (typeof note === 'string') {
				return { status: 'skipped', reason: note };
			}
			const targetDeck = this.settings.useCurrentFolderAsDeck ? this.resolveDeckName(input) : undefined;
			const fieldsChanged = !this.hasSameFields(note, fieldsToSync);
			if (fieldsChanged) {
				await this.anki.updateNoteFields(note.noteId, fieldsToSync);
			}
			let deckChanged = false;
			if (targetDeck !== undefined) {
				// 更新挖空内容可能生成新卡片，重新核验后再读取完整卡片列表。
				const latestNote = fieldsChanged ? await this.getVerifiedNote(input) : note;
				if (typeof latestNote === 'string') {
					throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'Anki note could not be verified after updating its fields.');
				}
				deckChanged = await this.moveNoteCards(latestNote, targetDeck);
			}
			if (!fieldsChanged && !deckChanged) {
				return { status: 'skipped', reason: 'NO_CHANGES' };
			}
			return { status: 'updated', noteId: note.noteId };
		}

		const deckName = this.resolveDeckName(input);
		await this.ensureDeck(deckName);
		const noteId = await this.anki.addNote({
			deckName,
			modelName: this.getModelName(input.card.type),
			fields: this.buildCreateFields(input, fieldsToSync, fields),
			tags: ['anki-card-link'],
		});
		return { status: 'created', noteId };
	}

	/** 核对链接中的 noteId、笔记类型和 UID；不匹配时跳过，不按内容查找替代笔记。 */
	private async getVerifiedNote(input: CardSyncInput): Promise<AnkiNoteInfo | CardSyncSkipReason> {
		const noteId = input.noteIdHint;
		if (noteId === undefined) {
			throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'Anki note ID is required for verification.');
		}
		const notes = await this.anki.notesInfo([noteId]);
		const note = notes.find((candidate) => candidate.noteId === noteId);
		if (note === undefined) {
			return 'NOTE_NOT_FOUND';
		}
		if (note.modelName !== this.getModelName(input.card.type)) {
			return 'MODEL_MISMATCH';
		}
		const uri = note.fields[this.getUriField(input.card.type)]?.value ?? '';
		return uriHasUid(uri, input.uid) ? note : 'URI_UID_MISMATCH';
	}

	private getUriField(type: ParsedCard['type']): string {
		return type === 'basic'
			? this.settings.basicObsidianUriField
			: type === 'cloze'
				? this.settings.clozeObsidianUriField
				: this.settings.choiceObsidianUrlField;
	}

	private hasSameFields(note: AnkiNoteInfo, fieldsToSync: Record<string, string>): boolean {
		return Object.entries(fieldsToSync).every(([name, value]) => note.fields[name]?.value === value);
	}

	private async validateBasicConfiguration(models: string[]): Promise<string[]> {
		if (!models.includes(this.settings.basicModelName)) {
			throw new AnkiCardLinkError('MODEL_NOT_FOUND', `Anki note type was not found: ${this.settings.basicModelName}.`);
		}
		const fields = await this.anki.modelFieldNames(this.settings.basicModelName);
		this.requireFields(fields, [
			this.settings.basicTitleField,
			this.settings.basicFrontField,
			this.settings.basicBackField,
			this.settings.basicHintField,
			this.settings.basicObsidianUriField,
		]);
		return fields;
	}

	private async validateClozeConfiguration(models: string[]): Promise<string[]> {
		if (!models.includes(this.settings.clozeModelName)) {
			throw new AnkiCardLinkError('MODEL_NOT_FOUND', `Anki note type was not found: ${this.settings.clozeModelName}.`);
		}
		const fields = await this.anki.modelFieldNames(this.settings.clozeModelName);
		this.requireFields(fields, [
			this.settings.clozeContentField,
			this.settings.clozeTitleField,
			this.settings.clozeObsidianUriField,
		]);
		return fields;
	}

	private async validateChoiceConfiguration(models: string[]): Promise<string[]> {
		if (!models.includes(this.settings.choiceModelName)) {
			throw new AnkiCardLinkError('CHOICE_MODEL_NOT_FOUND', `Multiple Choice note type was not found: ${this.settings.choiceModelName}.`);
		}
		const fields = await this.anki.modelFieldNames(this.settings.choiceModelName);
		this.requireChoiceFields(fields, [
			this.settings.choiceCardIdField,
			this.settings.choiceTitleField,
			this.settings.choiceFrontField,
			this.settings.choiceBackField,
			this.settings.choiceObsidianUrlField,
			...this.getChoiceOptionFields(),
			this.settings.choiceCorrectAnswerField,
		]);
		return fields;
	}

	private requireFields(existing: string[], required: string[]): void {
		for (const field of required) {
			if (field.trim().length === 0) {
				continue;
			}
			if (!existing.includes(field)) {
				throw new AnkiCardLinkError('FIELD_NOT_FOUND', `Anki field was not found: ${field}.`);
			}
		}
	}

	private requireChoiceFields(existing: string[], required: string[]): void {
		for (const field of required) {
			if (field.trim().length === 0 || !existing.includes(field)) {
				throw new AnkiCardLinkError('CHOICE_FIELD_NOT_FOUND', `Multiple Choice field was not found: ${field || '(empty setting)'}.`);
			}
		}
	}

	private requireDeckName(): string {
		const deckName = this.settings.defaultDeckName.trim();
		if (deckName.length === 0) {
			throw new AnkiCardLinkError('EMPTY_DECK', 'Default deck name cannot be empty.');
		}
		return deckName;
	}

	/** 牌组名称可以自定义，来源链接始终使用真实知识库名称。 */
	private resolveDeckName(input: CardSyncInput): string {
		if (!this.settings.useCurrentFolderAsDeck) {
			return this.requireDeckName();
		}
		const vaultDeckName = this.settings.vaultDeckName.trim() || input.vaultName.trim();
		const folderDeckName = buildFolderDeckName(input.filePath);
		return folderDeckName === undefined ? vaultDeckName : `${vaultDeckName}::${folderDeckName}`;
	}

	/**
	 * AnkiConnect 不会在 addNote 时自动创建牌组，必须先明确创建。
	 */
	private async ensureDeck(deckName: string): Promise<void> {
		const existingDecks = await this.anki.deckNames();
		if (!existingDecks.includes(deckName)) {
			await this.anki.createDeck(deckName);
		}
	}

	/** 只移动已核验笔记中归组不符的卡片；查询或移动失败交给同步报告，重试时重新比较。 */
	private async moveNoteCards(note: AnkiNoteInfo, deckName: string): Promise<boolean> {
		if (!Array.isArray(note.cards) || note.cards.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
			throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'AnkiConnect returned an invalid card list.');
		}
		if (note.cards.length === 0) {
			return false;
		}
		const decks = await this.anki.getDecks(note.cards);
		if (typeof decks !== 'object' || decks === null || Array.isArray(decks)) {
			throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'AnkiConnect returned incomplete card deck information.');
		}
		const groups = Object.values(decks);
		if (groups.some((cards) => !Array.isArray(cards)) || !note.cards.every((id) => groups.some((cards) => cards.includes(id)))) {
			throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'AnkiConnect returned incomplete card deck information.');
		}
		const targetCards = new Set(Object.entries(decks).find(([name]) => name === deckName)?.[1] ?? []);
		const cardsToMove = note.cards.filter((id) => !targetCards.has(id));
		if (cardsToMove.length === 0) {
			return false;
		}
		await this.ensureDeck(deckName);
		await this.anki.changeDeck(cardsToMove, deckName);
		return true;
	}

	private buildFields(input: CardSyncInput): Record<string, string> {
		const uri = buildOpenObsidianUri({
			vaultName: input.vaultName,
			filePath: input.filePath,
			uid: input.uid,
		});
		if (input.card.type === 'cloze') {
			const content = input.card.content;
			if (content === undefined) {
				throw new AnkiCardLinkError('INVALID_CLOZE', 'Cloze card does not contain content.');
			}
			const fields: Record<string, string> = {
				[this.settings.clozeContentField]: toAnkiHtml(prependFileHeading(content, input.filePath), input.imageMedia),
			};
			if (this.settings.clozeTitleField.trim().length > 0) {
				fields[this.settings.clozeTitleField] = toAnkiHtml(input.title);
			}
			if (this.settings.clozeObsidianUriField.trim().length > 0) {
				fields[this.settings.clozeObsidianUriField] = uri;
			}
			return fields;
		}
		if (input.card.type === 'choice') {
			const fields: Record<string, string> = {
				[this.settings.choiceCardIdField]: input.uid,
				[this.settings.choiceTitleField]: toAnkiHtml(input.title),
				[this.settings.choiceFrontField]: toAnkiHtml(input.card.front, input.imageMedia),
				[this.settings.choiceBackField]: toAnkiHtml(input.card.back, input.imageMedia),
				[this.settings.choiceObsidianUrlField]: uri,
				[this.settings.choiceCorrectAnswerField]: input.card.correctAnswers.join(','),
			};
			for (const [index, field] of this.getChoiceOptionFields().entries()) {
				fields[field] = toAnkiHtml(input.card.options[index] ?? '', input.imageMedia);
			}
			return fields;
		}

		if (input.card.front === undefined || input.card.back === undefined) {
			throw new AnkiCardLinkError('INVALID_CARD', 'Basic card fields are missing.');
		}
		return {
			[this.settings.basicTitleField]: toAnkiHtml(input.title),
			[this.settings.basicFrontField]: toAnkiHtml(input.card.front, input.imageMedia),
			[this.settings.basicBackField]: toAnkiHtml(input.card.back, input.imageMedia),
			[this.settings.basicObsidianUriField]: uri,
		};
	}

	private buildCreateFields(
		input: CardSyncInput,
		fieldsToSync: Record<string, string>,
		modelFields: string[],
	): Record<string, string> {
		const createdFields = Object.fromEntries(modelFields.map((field) => [field, '']));
		if (input.card.type === 'basic') {
			createdFields[this.settings.basicHintField] = '';
		}
		return { ...createdFields, ...fieldsToSync };
	}

	private getModelName(type: ParsedCard['type']): string {
		if (type === 'basic') {
			return this.settings.basicModelName;
		}
		return type === 'cloze' ? this.settings.clozeModelName : this.settings.choiceModelName;
	}

	private getChoiceOptionFields(): string[] {
		return [
			this.settings.choiceOptionAField,
			this.settings.choiceOptionBField,
			this.settings.choiceOptionCField,
			this.settings.choiceOptionDField,
			this.settings.choiceOptionEField,
			this.settings.choiceOptionFField,
			this.settings.choiceOptionGField,
		];
	}
}

function prependFileHeading(content: string, filePath: string): string {
	const fileName = getFileNameWithoutExtension(filePath);
	return fileName.length === 0 ? content : `# ${fileName}\n${content}`;
}

function getFileNameWithoutExtension(filePath: string): string {
	return filePath
		.replaceAll('\\', '/')
		.replace(/^.*\//u, '')
		.replace(/\.md$/iu, '')
		.trim();
}

function uriHasUid(uri: string, uid: string): boolean {
	try {
		const params = new URL(uri.replaceAll('&amp;', '&')).searchParams;
		return params.get('uid') === uid || params.get('block') === uid;
	} catch {
		return false;
	}
}
