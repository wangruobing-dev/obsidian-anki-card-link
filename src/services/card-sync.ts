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
		return { basicModelFields, clozeModelFields };
	}

	async sync(input: CardSyncInput): Promise<CardSyncResult> {
		if (input.uid.length === 0) {
			throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', 'Card UID is missing.');
		}
		await this.anki.testConnection();
		const models = await this.anki.modelNames();
		const fields = input.card.type === 'basic'
			? await this.validateBasicConfiguration(models)
			: await this.validateClozeConfiguration(models);
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
				modelName: input.card.type === 'basic' ? this.settings.basicModelName : this.settings.clozeModelName,
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
		if (input.noteIdHint !== undefined) {
			const notes = await this.anki.notesInfo([input.noteIdHint]);
			const hinted = notes.find((note) => note.noteId === input.noteIdHint);
			if (hinted !== undefined && noteHasUid(hinted, input.uid)) {
				return { noteIds: [hinted.noteId], removeLegacyTag: hinted.tags.includes(uidTag) };
			}
		}
		const legacyMatches = await this.anki.findNotes(`tag:${uidTag}`);
		if (legacyMatches.length > 0) {
			return { noteIds: legacyMatches, removeLegacyTag: true };
		}

		const uriField = input.card.type === 'basic'
			? this.settings.basicObsidianUriField
			: this.settings.clozeObsidianUriField;
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
