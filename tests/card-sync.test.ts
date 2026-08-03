import { describe, expect, it } from 'vitest';
import { parseCardBlock } from '../src/core/card-parser';
import { DEFAULT_SETTINGS } from '../src/settings';
import { CardSyncService, type AnkiSyncClient } from '../src/services/card-sync';
import type { AnkiNoteInfo, AnkiNoteInput } from '../src/services/anki-connect';

class FakeAnkiClient implements AnkiSyncClient {
	modelList = ['Anki Card Link Basic', 'Enhanced Cloze 2.1 v2', 'Multiple Choice'];
	decks = ['Default'];
	createdDecks: string[] = [];
	fields = new Map<string, string[]>([
		['Anki Card Link Basic', ['标题', 'Front', 'Back', '提示', 'ObsidianURI', 'Other']],
		['Enhanced Cloze 2.1 v2', ['Content', 'Note', 'Mnemonics', 'Extra', 'Cloze99', 'ObsidianURI']],
		['Multiple Choice', ['CardID', 'Title', 'Front', 'Back', 'ObsidianURL', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'OptionE', 'OptionF', 'OptionG', 'CorrectAnswer']],
	]);
	matchingNotesByQuery = new Map<string, number[]>();
	noteInfoById = new Map<number, AnkiNoteInfo>();
	createdNotes: AnkiNoteInput[] = [];
	updatedNotes: Array<{ id: number; fields: Record<string, string> }> = [];
	removedTags: Array<{ noteIds: number[]; tags: string[] }> = [];
	findQueries: string[] = [];
	notesInfoCalls: number[][] = [];
	connectionError?: Error;

	async testConnection(): Promise<void> { if (this.connectionError !== undefined) throw this.connectionError; }
	async modelNames(): Promise<string[]> { return this.modelList; }
	async deckNames(): Promise<string[]> { return this.decks; }
	async createDeck(deck: string): Promise<number> { this.createdDecks.push(deck); this.decks.push(deck); return 1; }
	async modelFieldNames(modelName: string): Promise<string[]> { return this.fields.get(modelName) ?? []; }
	async findNotes(query: string): Promise<number[]> { this.findQueries.push(query); return this.matchingNotesByQuery.get(query) ?? []; }
	async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
		this.notesInfoCalls.push(noteIds);
		return noteIds.flatMap((id) => this.noteInfoById.get(id) ?? []);
	}
	async addNote(note: AnkiNoteInput): Promise<number> { this.createdNotes.push(note); return 100; }
	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> { this.updatedNotes.push({ id: noteId, fields }); }
	async removeTags(noteIds: number[], tags: string[]): Promise<void> { this.removedTags.push({ noteIds, tags }); }
}

function note(noteId: number, uri: string, tags = ['anki-card-link']): AnkiNoteInfo {
	return { noteId, modelName: 'Anki Card Link Basic', tags, fields: { ObsidianURI: { order: 4, value: uri } } };
}

function basicInput(extra: { noteIdHint?: number } = {}) {
	const card = parseCardBlock('Front & <tag>\n?\nBack\nline');
	if (card === null) throw new Error('Test card was not parsed.');
	return { card, uid: 'acl-1234abcd', title: '章节', vaultName: '我的库', filePath: 'cards.md', ...extra };
}

function service(client: FakeAnkiClient): CardSyncService {
	return new CardSyncService(client, { ...DEFAULT_SETTINGS });
}

function choiceInput(source = '### 正确选项是【A,C,D】。\n- 选项A\n- 选项B\n- 选项C\n- 选项D\n解析') {
	const card = parseCardBlock(source);
	if (card?.type !== 'choice') throw new Error('Test choice card was not parsed.');
	return { card, uid: 'acl-1234abcd', title: '选择题章节', vaultName: '我的库', filePath: 'choice.md' };
}

describe('card synchronization', () => {
	it('creates a note with the plugin-owned Obsidian URI', async () => {
		const client = new FakeAnkiClient();
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]).toMatchObject({
			deckName: 'Default', modelName: 'Anki Card Link Basic', tags: ['anki-card-link'],
			fields: { 标题: '章节', Front: 'Front &amp; &lt;tag&gt;', Back: 'Back<br>line', 提示: '' },
		});
		expect(client.createdNotes[0]?.fields.ObsidianURI).toContain('obsidian://anki-card-link-open?');
		expect(client.createdNotes[0]?.fields.ObsidianURI).toContain('uid=acl-1234abcd');
		expect(client.createdNotes[0]?.fields.ObsidianURI).not.toContain('advanced-uri');
	});

	it('uses a valid noteId hint without scanning all synchronized notes', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(200, note(200, 'obsidian://anki-card-link-open?v=2&vault=v&path=a.md&uid=acl-1234abcd'));
		await expect(service(client).sync(basicInput({ noteIdHint: 200 }))).resolves.toEqual({ status: 'updated', noteId: 200 });
		expect(client.notesInfoCalls[0]).toEqual([200]);
		expect(client.findQueries).toEqual([]);
	});

	it('falls back by UID when the noteId is missing or belongs to another UID', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(200, note(200, 'obsidian://anki-card-link-open?v=2&vault=v&path=a.md&uid=acl-87654321'));
		client.matchingNotesByQuery.set('tag:anki-card-link', [300]);
		client.noteInfoById.set(300, note(300, 'obsidian://anki-card-link-open?v=2&vault=v&path=a.md&uid=acl-1234abcd'));
		await expect(service(client).sync(basicInput({ noteIdHint: 200 }))).resolves.toEqual({ status: 'updated', noteId: 300 });
		expect(client.findQueries).toEqual(['tag:anki-card-link::acl-1234abcd', 'tag:anki-card-link']);
	});

	it('finds legacy UID tags and removes the tag after updating', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link::acl-1234abcd', [400]);
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'updated', noteId: 400 });
		expect(client.removedTags).toEqual([{ noteIds: [400], tags: ['anki-card-link::acl-1234abcd'] }]);
	});

	it('finds an old Advanced URI block during fallback and rewrites it', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link', [500]);
		client.noteInfoById.set(500, note(500, 'obsidian://advanced-uri?vault=old&filepath=old.md&block=acl-1234abcd'));
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'updated', noteId: 500 });
		expect(client.updatedNotes[0]?.fields.ObsidianURI).toContain('anki-card-link-open');
	});

	it('stops when fallback finds duplicate UIDs', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link', [1, 2]);
		client.noteInfoById.set(1, note(1, 'obsidian://anki-card-link-open?v=2&vault=v&path=a&uid=acl-1234abcd'));
		client.noteInfoById.set(2, note(2, 'obsidian://advanced-uri?block=acl-1234abcd'));
		await expect(service(client).sync(basicInput())).rejects.toThrow(/More than one/u);
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('uses folder decks and creates only a missing deck', async () => {
		const client = new FakeAnkiClient();
		await service(client).sync({ ...basicInput(), folderDeckName: '知识库::软考' });
		expect(client.createdDecks).toEqual(['知识库::软考']);
		expect(client.createdNotes[0]?.deckName).toBe('知识库::软考');
	});

	it('updates Cloze fields without overwriting unmapped fields', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link::acl-1234abcd', [600]);
		const card = parseCardBlock('Java {{c1::自动管理}} 内存')!;
		await service(client).sync({ ...basicInput(), card });
		expect(client.updatedNotes[0]?.fields).toMatchObject({ Content: 'Java {{c1::自动管理}} 内存', Note: '章节' });
		expect(client.updatedNotes[0]?.fields.ObsidianURI).toContain('anki-card-link-open');
		expect(client.updatedNotes[0]?.fields).not.toHaveProperty('Extra');
	});

	it('propagates validation and connection failures without writing', async () => {
		const client = new FakeAnkiClient();
		client.connectionError = new Error('connection refused');
		await expect(service(client).sync(basicInput())).rejects.toThrow(/connection refused/u);
		expect(client.createdNotes).toHaveLength(0);
	});

	it('creates a choice note with stable UID, original option order, and all mapped fields', async () => {
		const client = new FakeAnkiClient();
		await expect(service(client).sync(choiceInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]).toMatchObject({
			modelName: 'Multiple Choice',
			tags: ['anki-card-link'],
			fields: {
				CardID: 'acl-1234abcd',
				Title: '选择题章节',
				Front: '正确选项是【　】。',
				Back: '解析',
				OptionA: '选项A',
				OptionB: '选项B',
				OptionC: '选项C',
				OptionD: '选项D',
				OptionE: '',
				OptionF: '',
				OptionG: '',
				CorrectAnswer: 'A,C,D',
			},
		});
		expect(client.createdNotes[0]?.fields.ObsidianURL).toContain('uid=acl-1234abcd');
	});

	it('updates a choice note and clears OptionE through OptionG', async () => {
		const client = new FakeAnkiClient();
		client.matchingNotesByQuery.set('tag:anki-card-link', [700]);
		client.noteInfoById.set(700, {
			noteId: 700,
			modelName: 'Multiple Choice',
			tags: ['anki-card-link'],
			fields: { ObsidianURL: { order: 4, value: 'obsidian://anki-card-link-open?v=2&vault=v&path=a&uid=acl-1234abcd' } },
		});
		await expect(service(client).sync(choiceInput('### 四项【B】\n- A\n- B\n- C\n- D'))).resolves.toEqual({ status: 'updated', noteId: 700 });
		expect(client.updatedNotes[0]?.fields).toMatchObject({ CardID: 'acl-1234abcd', OptionA: 'A', OptionD: 'D', OptionE: '', OptionF: '', OptionG: '', CorrectAnswer: 'B' });
		expect(client.updatedNotes[0]?.fields).not.toHaveProperty('ObsidianURI');
	});

	it('validates a choice noteId hint through ObsidianURL instead of the Basic URI field', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(701, {
			noteId: 701,
			modelName: 'Multiple Choice',
			tags: ['anki-card-link'],
			fields: {
				ObsidianURI: { order: 4, value: 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd' },
				ObsidianURL: { order: 5, value: 'obsidian://anki-card-link-open?v=2&uid=acl-87654321' },
			},
		});
		client.matchingNotesByQuery.set('tag:anki-card-link', [702]);
		client.noteInfoById.set(702, {
			noteId: 702,
			modelName: 'Multiple Choice',
			tags: ['anki-card-link'],
			fields: { ObsidianURL: { order: 5, value: 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd' } },
		});
		await expect(service(client).sync({ ...choiceInput(), noteIdHint: 701 })).resolves.toEqual({ status: 'updated', noteId: 702 });
	});

	it('converts an image option using uploaded Anki media', async () => {
		const client = new FakeAnkiClient();
		const input = choiceInput('### 图片题【A】\n- ![[choice.png]]\n- 文本');
		await service(client).sync({ ...input, imageMedia: new Map([['choice.png', 'anki-card-link-image.png']]) });
		expect(client.createdNotes[0]?.fields.OptionA).toBe('<img src="anki-card-link-image.png">');
	});

	it('keeps Basic and Cloze usable when the optional choice model is missing', async () => {
		const client = new FakeAnkiClient();
		client.modelList = client.modelList.filter((model) => model !== 'Multiple Choice');
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		const configuration = await service(client).testConfiguration();
		expect(configuration.basicModelFields).toContain('Front');
		expect(configuration.clozeModelFields).toContain('Content');
		expect(configuration.choiceWarning?.code).toBe('CHOICE_MODEL_NOT_FOUND');
	});

	it('reports a missing required choice field without writing', async () => {
		const client = new FakeAnkiClient();
		client.fields.set('Multiple Choice', client.fields.get('Multiple Choice')!.filter((field) => field !== 'CorrectAnswer'));
		await expect(service(client).sync(choiceInput())).rejects.toMatchObject({ code: 'CHOICE_FIELD_NOT_FOUND' });
		expect(client.createdNotes).toHaveLength(0);
	});
});
