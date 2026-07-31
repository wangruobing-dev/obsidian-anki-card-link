import { describe, expect, it } from 'vitest';
import { parseCardBlock } from '../src/core/card-parser';
import { DEFAULT_SETTINGS } from '../src/settings';
import { CardSyncService, type AnkiSyncClient } from '../src/services/card-sync';
import type { AnkiNoteInfo, AnkiNoteInput } from '../src/services/anki-connect';

class FakeAnkiClient implements AnkiSyncClient {
	modelList = ['Anki Card Link Basic', 'Enhanced Cloze 2.1 v2'];
	decks = ['Default'];
	createdDecks: string[] = [];
	fields = new Map<string, string[]>([
		['Anki Card Link Basic', ['标题', 'Front', 'Back', '提示', 'ObsidianURI', 'Other']],
		['Enhanced Cloze 2.1 v2', ['Content', 'Note', 'Mnemonics', 'Extra', 'Cloze99', 'ObsidianURI']],
	]);
	matchingNotes: number[] = [];
	matchingNotesByQuery = new Map<string, number[]>();
	noteInfoById = new Map<number, AnkiNoteInfo>();
	createdNotes: AnkiNoteInput[] = [];
	updatedNotes: Array<{ id: number; fields: Record<string, string> }> = [];
	removedTags: Array<{ noteIds: number[]; tags: string[] }> = [];
	connectionError?: Error;

	async testConnection(): Promise<void> {
		if (this.connectionError !== undefined) {
			throw this.connectionError;
		}
	}

	async modelNames(): Promise<string[]> {
		return this.modelList;
	}

	async deckNames(): Promise<string[]> {
		return this.decks;
	}

	async createDeck(deck: string): Promise<number> {
		this.createdDecks.push(deck);
		this.decks.push(deck);
		return 1;
	}

	async modelFieldNames(modelName: string): Promise<string[]> {
		return this.fields.get(modelName) ?? [];
	}

	async findNotes(query: string): Promise<number[]> {
		return this.matchingNotesByQuery.get(query) ?? this.matchingNotes;
	}

	async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
		return noteIds.flatMap((noteId) => {
			const note = this.noteInfoById.get(noteId);
			return note === undefined ? [] : [note];
		});
	}

	async addNote(note: AnkiNoteInput): Promise<number> {
		this.createdNotes.push(note);
		return 100;
	}

	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
		this.updatedNotes.push({ id: noteId, fields });
	}

	async removeTags(noteIds: number[], tags: string[]): Promise<void> {
		this.removedTags.push({ noteIds, tags });
	}

}

function createService(client: FakeAnkiClient): CardSyncService {
	return new CardSyncService(client, { ...DEFAULT_SETTINGS });
}

function basicInput() {
	const card = parseCardBlock('Front & <tag>\n?\nBack\nline\n^acl-1234abcd');
	if (card === null) {
		throw new Error('Test card was not parsed.');
	}
	return { card, blockId: 'acl-1234abcd', title: '章节', vaultName: '我的库', filePath: 'cards.md' };
}

describe('card synchronization', () => {
	it('creates a note for the first sync with stable tags and escaped fields', async () => {
		const client = new FakeAnkiClient();
		await expect(createService(client).sync(basicInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes).toHaveLength(1);
		expect(client.createdNotes[0]).toMatchObject({
			deckName: 'Default',
			modelName: 'Anki Card Link Basic',
			tags: ['anki-card-link'],
			fields: {
				标题: '章节',
				Front: 'Front &amp; &lt;tag&gt;',
				Back: 'Back<br>line',
				提示: '',
			},
		});
	});

	it('uses the current note folder as the deck name when the setting is enabled', async () => {
		const client = new FakeAnkiClient();
		await expect(createService(client).sync({ ...basicInput(), folderDeckName: '若冰的知识库::软考' })).resolves.toMatchObject({ status: 'created' });
		expect(client.createdNotes[0]?.deckName).toBe('若冰的知识库::软考');
		expect(client.createdDecks).toEqual(['若冰的知识库::软考']);
	});

	it('does not create a deck again when it already exists', async () => {
		const client = new FakeAnkiClient();
		client.decks.push('若冰的知识库::软考');
		await expect(createService(client).sync({ ...basicInput(), folderDeckName: '若冰的知识库::软考' })).resolves.toMatchObject({ status: 'created' });
		expect(client.createdDecks).toHaveLength(0);
	});

	it('updates exactly mapped fields without modifying existing tags', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotes = [200];
		await expect(createService(client).sync(basicInput())).resolves.toEqual({ status: 'updated', noteId: 200 });
		expect(client.createdNotes).toHaveLength(0);
		expect(client.updatedNotes[0]).toMatchObject({ id: 200 });
		expect(client.updatedNotes[0]?.fields).not.toHaveProperty('提示');
		expect(client.removedTags).toEqual([{ noteIds: [200], tags: ['anki-card-link::acl-1234abcd'] }]);
	});

	it('finds an existing note by the block ID stored in ObsidianURI', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link::acl-1234abcd', []);
		client.matchingNotesByQuery.set('tag:anki-card-link', [400]);
		client.noteInfoById.set(400, {
			noteId: 400,
			modelName: 'Anki Card Link Basic',
			tags: ['anki-card-link'],
			fields: {
				ObsidianURI: {
					order: 4,
					value: 'obsidian://advanced-uri?vault=old&filepath=old.md&block=acl-1234abcd',
				},
			},
		});
		await expect(createService(client).sync(basicInput())).resolves.toEqual({ status: 'updated', noteId: 400 });
		expect(client.createdNotes).toHaveLength(0);
		expect(client.removedTags).toHaveLength(0);
	});

	it('stops when a block UID is duplicated in Anki', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotes = [1, 2];
		await expect(createService(client).sync(basicInput())).rejects.toThrow(/More than one/u);
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('reports missing note types and fields before writing', async () => {
		const missingModel = new FakeAnkiClient();
		missingModel.modelList = [];
		await expect(createService(missingModel).sync(basicInput())).rejects.toThrow(/note type was not found/u);

		const missingField = new FakeAnkiClient();
		missingField.fields.set('Anki Card Link Basic', ['标题', 'Front', 'Back']);
		await expect(createService(missingField).sync(basicInput())).rejects.toThrow(/field was not found/u);
	});

	it('updates Enhanced Cloze content, title, and Obsidian URI fields', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotes = [300];
		const service = new CardSyncService(client, DEFAULT_SETTINGS);
		const card = parseCardBlock('Java {{c1::自动管理}} 内存\n^acl-1234abcd');
		if (card === null) {
			throw new Error('Test cloze card was not parsed.');
		}
		await expect(service.sync({ ...basicInput(), card })).resolves.toEqual({ status: 'updated', noteId: 300 });
		const fields = client.updatedNotes[0]?.fields;
		expect(fields?.Content).toBe('Java {{c1::自动管理}} 内存');
		expect(fields?.Note).toBe('章节');
		expect(fields?.ObsidianURI).toContain('advanced-uri');
		expect(fields).not.toHaveProperty('Mnemonics');
		expect(fields).not.toHaveProperty('Extra');
		expect(fields).not.toHaveProperty('Cloze99');
	});

	it('propagates AnkiConnect failures without performing a write', async () => {
		const client = new FakeAnkiClient();
		client.connectionError = new Error('connection refused');
		await expect(createService(client).sync(basicInput())).rejects.toThrow(/connection refused/u);
		expect(client.createdNotes).toHaveLength(0);
	});
});
