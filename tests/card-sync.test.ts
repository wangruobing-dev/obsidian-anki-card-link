import { describe, expect, it } from 'vitest';
import { parseCardBlock } from '../src/core/card-parser';
import { DEFAULT_SETTINGS } from '../src/settings';
import { CardSyncService, type AnkiSyncClient } from '../src/services/card-sync';
import type { AnkiNoteInfo, AnkiNoteInput } from '../src/services/anki-connect';

class FakeAnkiClient implements AnkiSyncClient {
	modelList = ['Anki Card Link Basic', 'Enhanced Cloze 2.1 v2', 'Multiple Choice'];
	decks = ['Default'];
	createdNotes: AnkiNoteInput[] = [];
	updatedNotes: Array<{ id: number; fields: Record<string, string> }> = [];
	noteInfoById = new Map<number, AnkiNoteInfo>();

	async testConnection(): Promise<void> {}
	async modelNames(): Promise<string[]> { return this.modelList; }
	async deckNames(): Promise<string[]> { return this.decks; }
	async createDeck(deck: string): Promise<number> { this.decks.push(deck); return 1; }
	async modelFieldNames(modelName: string): Promise<string[]> {
		return modelName === 'Anki Card Link Basic'
			? ['Title', 'Front', 'Back', 'Hint', 'ObsidianURI']
			: modelName === 'Enhanced Cloze 2.1 v2'
				? ['Content', 'Note', 'ObsidianURI']
				: ['CardID', 'Title', 'Front', 'Back', 'ObsidianURL', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'OptionE', 'OptionF', 'OptionG', 'CorrectAnswer'];
	}
	async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> { return noteIds.flatMap((id) => this.noteInfoById.get(id) ?? []); }
	async addNote(note: AnkiNoteInput): Promise<number> { this.createdNotes.push(note); return 100; }
	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> { this.updatedNotes.push({ id: noteId, fields }); }
}

function basicInput(extra: { noteIdHint?: number; filePath?: string } = {}) {
	const card = parseCardBlock('Front\n?\nBack');
	if (card === null) throw new Error('Test card was not parsed.');
	return { card, uid: 'acl-1234abcd', title: 'Cards', vaultName: 'vault', filePath: 'cards.md', ...extra };
}

function note(noteId: number, modelName = 'Anki Card Link Basic', uri = 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd'): AnkiNoteInfo {
	return { noteId, modelName, tags: ['anki-card-link'], fields: { ObsidianURI: { order: 0, value: uri } } };
}

function service(client: FakeAnkiClient): CardSyncService {
	return new CardSyncService(client, { ...DEFAULT_SETTINGS, basicTitleField: 'Title', basicHintField: 'Hint' });
}

describe('card synchronization', () => {
	it('creates an unlinked card with a plugin-owned URI', async () => {
		const client = new FakeAnkiClient();
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.ObsidianURI).toContain('uid=acl-1234abcd');
	});

	it('updates only the linked note after the Obsidian file moves', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20, 'Anki Card Link Basic', 'obsidian://anki-card-link-open?v=2&vault=v&path=old.md&uid=acl-1234abcd'));
		await expect(service(client).sync(basicInput({ noteIdHint: 20, filePath: 'moved/cards.md' }))).resolves.toEqual({ status: 'updated', noteId: 20 });
		expect(client.updatedNotes[0]?.fields.ObsidianURI).toContain('filePath=moved%2Fcards.md');
	});

	it('does not use the deck when verifying an existing note', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(21, note(21));
		await expect(service(client).sync(basicInput({ noteIdHint: 21 }))).resolves.toEqual({ status: 'updated', noteId: 21 });
	});

	it('skips a verified note when every synchronized field is unchanged', async () => {
		const client = new FakeAnkiClient();
		await service(client).sync(basicInput());
		const created = client.createdNotes[0];
		if (created === undefined) throw new Error('Test note was not created.');
		client.noteInfoById.set(26, {
			noteId: 26,
			modelName: created.modelName,
			tags: created.tags,
			fields: Object.fromEntries(Object.entries(created.fields).map(([name, value], order) => [name, { order, value }])),
		});
		await expect(service(client).sync(basicInput({ noteIdHint: 26 }))).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('skips a missing linked note without creating a replacement', async () => {
		const client = new FakeAnkiClient();
		await expect(service(client).sync(basicInput({ noteIdHint: 22 }))).resolves.toEqual({ status: 'skipped', reason: 'NOTE_NOT_FOUND' });
		expect(client.createdNotes).toHaveLength(0);
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('skips a linked note with a different UID without writing', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(23, note(23, 'Anki Card Link Basic', 'obsidian://anki-card-link-open?v=2&uid=acl-87654321'));
		await expect(service(client).sync(basicInput({ noteIdHint: 23 }))).resolves.toEqual({ status: 'skipped', reason: 'URI_UID_MISMATCH' });
		expect(client.createdNotes).toHaveLength(0);
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('skips a linked note with a different note type without writing', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(24, note(24, 'Other'));
		await expect(service(client).sync(basicInput({ noteIdHint: 24 }))).resolves.toEqual({ status: 'skipped', reason: 'MODEL_MISMATCH' });
		expect(client.createdNotes).toHaveLength(0);
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('verifies the configured URI field for a choice note', async () => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock('### Question 【B】\n- A\n- B');
		if (card?.type !== 'choice') throw new Error('Choice card was not parsed.');
		client.noteInfoById.set(25, {
			noteId: 25,
			modelName: 'Multiple Choice',
			tags: [],
			fields: { ObsidianURL: { order: 0, value: 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd' } },
		});
		await expect(service(client).sync({ ...basicInput({ noteIdHint: 25 }), card })).resolves.toEqual({ status: 'updated', noteId: 25 });
		expect(client.updatedNotes[0]?.fields).toHaveProperty('ObsidianURL');
	});
});
