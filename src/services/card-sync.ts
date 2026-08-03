import { toAnkiHtml } from '../core/anki-content';
import { buildOpenObsidianUri } from '../core/open-source-uri';
import type { ParsedCard } from '../core/card-parser';
import type { AnkiNoteInfo, AnkiNoteInput } from './anki-connect';
import { AnkiCardLinkError, type AnkiCardLinkSettings } from '../types';

export interface AnkiSyncClient {
	testConnection(): Promise<void>;
	modelNames(): Promise<string[]>;
	deckNames(): Promise<string[]>;
	createDeck(deck: string): Promise<number>;
	modelFieldNames(modelName: string): Promise<string[]>;
	findNotes(query: string): Promise<number[]>;
	notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]>;
	addNote(note: AnkiNoteInput): Promise<number>;
	updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void>;
	removeTags(noteIds: number[], tags: string[]): Promise<void>;
}

export interface CardSyncInput {
	card: ParsedCard;
	uid: string;
	noteIdHint?: number;
	title: string;
	vaultName: string;
	filePath: string;
	folderDeckName?: string;
	imageMedia?: ReadonlyMap<string, string>;
}

export interface SyncConfigurationResult {
	basicModelFields: string[];
	clozeModelFields: string[];
	choiceModelFields?: string[];
	choiceWarning?: AnkiCardLinkError;
}

export type CardSyncStatus = 'created' | 'updated';

export interface CardSyncResult {
	status: CardSyncStatus;
	noteId: number;
}

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
		this.requireDeckName();
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
		const uidTag = `anki-card-link::${input.uid}`;
		const fieldsToSync = this.buildFields(input);
		const { noteIds: existing, removeLegacyTag } = await this.findExistingNotes(input, uidTag);
		if (existing.length > 1) {
			throw new AnkiCardLinkError('DUPLICATE_UID', `More than one Anki note uses UID ${input.uid}.`);
		}

		if (existing.length === 0) {
			const deckName = await this.ensureDeck(input);
			const noteId = await this.anki.addNote({
				deckName,
				modelName: this.getModelName(input.card.type),
				fields: this.buildCreateFields(input, fieldsToSync, fields),
				tags: ['anki-card-link'],
			});
			return { status: 'created', noteId };
		}

		const noteId = existing[0];
		if (noteId === undefined) {
			throw new AnkiCardLinkError('ANKICONNECT_ERROR', 'AnkiConnect returned an invalid note ID.');
		}
		await this.anki.updateNoteFields(noteId, fieldsToSync);
		if (removeLegacyTag) {
			await this.anki.removeTags([noteId], [uidTag]);
		}
		return { status: 'updated', noteId };
	}

	/** 优先核对链接中的 noteId；失效或 UID 不一致时才执行兼容性回退查找。 */
	private async findExistingNotes(
		input: CardSyncInput,
		uidTag: string,
	): Promise<{ noteIds: number[]; removeLegacyTag: boolean }> {
		const uriField = input.card.type === 'basic'
			? this.settings.basicObsidianUriField
			: input.card.type === 'cloze'
				? this.settings.clozeObsidianUriField
				: this.settings.choiceObsidianUrlField;
		if (input.noteIdHint !== undefined) {
			const notes = await this.anki.notesInfo([input.noteIdHint]);
			const hinted = notes.find((note) => note.noteId === input.noteIdHint);
			const hintMatches = hinted !== undefined && (input.card.type === 'choice'
				? uriHasUid(hinted.fields[uriField]?.value ?? '', input.uid)
				: noteHasUid(hinted, input.uid));
			if (hinted !== undefined && hintMatches) {
				return { noteIds: [hinted.noteId], removeLegacyTag: hinted.tags.includes(uidTag) };
			}
		}
		const legacyMatches = await this.anki.findNotes(`tag:${uidTag}`);
		if (legacyMatches.length > 0) {
			return { noteIds: legacyMatches, removeLegacyTag: true };
		}

		const taggedNotes = await this.anki.findNotes('tag:anki-card-link');
		const matches: number[] = [];
		for (let start = 0; start < taggedNotes.length; start += 50) {
			const noteIds = taggedNotes.slice(start, start + 50);
			const notes = await this.anki.notesInfo(noteIds);
			for (const note of notes) {
				const uri = note.fields[uriField]?.value;
				if (uri !== undefined && uriHasUid(uri, input.uid)) {
					matches.push(note.noteId);
				}
			}
		}
		return { noteIds: matches, removeLegacyTag: false };
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

	private resolveDeckName(input: CardSyncInput): string {
		const folderDeckName = input.folderDeckName?.trim();
		if (this.settings.useCurrentFolderAsDeck && folderDeckName !== undefined && folderDeckName.length > 0) {
			return folderDeckName;
		}
		return this.requireDeckName();
	}

	/**
	 * AnkiConnect 不会在 addNote 时自动创建牌组，必须先明确创建。
	 */
	private async ensureDeck(input: CardSyncInput): Promise<string> {
		const deckName = this.resolveDeckName(input);
		const existingDecks = await this.anki.deckNames();
		if (!existingDecks.includes(deckName)) {
			await this.anki.createDeck(deckName);
		}
		return deckName;
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
				[this.settings.clozeContentField]: toAnkiHtml(content, input.imageMedia),
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

function uriHasUid(uri: string, uid: string): boolean {
	try {
		const params = new URL(uri).searchParams;
		return params.get('uid') === uid || params.get('block') === uid;
	} catch {
		return false;
	}
}

function noteHasUid(note: AnkiNoteInfo, uid: string): boolean {
	return Object.values(note.fields).some((field) => uriHasUid(field.value, uid));
}
