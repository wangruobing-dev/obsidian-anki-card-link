import { describe, expect, it, vi } from 'vitest';
import { getCardTitle, parseCardBlock } from '../src/core/card-parser';
import { DEFAULT_SETTINGS } from '../src/settings';
import { CardSyncService, type AnkiSyncClient, type CardSyncInput } from '../src/services/card-sync';
import type { AnkiNoteInfo, AnkiNoteInput } from '../src/services/anki-connect';
import type { AnkiCardLinkSettings } from '../src/types';

class FakeAnkiClient implements AnkiSyncClient {
	modelList = ['Anki Card Link Basic', 'Enhanced Cloze 2.1 v2', 'Multiple Choice'];
	decks = ['Default'];
	createdNotes: AnkiNoteInput[] = [];
	updatedNotes: Array<{ id: number; fields: Record<string, string> }> = [];
	noteInfoById = new Map<number, AnkiNoteInfo>();
	deckByCard = new Map<number, string>();
	movedCards: Array<{ cards: number[]; deck: string }> = [];
	onUpdate?: (note: AnkiNoteInfo) => void;

	async testConnection(): Promise<void> {}
	async modelNames(): Promise<string[]> { return this.modelList; }
	async deckNames(): Promise<string[]> { return this.decks; }
	async createDeck(deck: string): Promise<number> { this.decks.push(deck); return 1; }
	async getDecks(cards: number[]): Promise<Record<string, number[]>> {
		const decks: Record<string, number[]> = {};
		for (const card of cards) {
			const deck = this.deckByCard.get(card) ?? 'Default';
			(decks[deck] ??= []).push(card);
		}
		return decks;
	}
	async changeDeck(cards: number[], deck: string): Promise<void> {
		if (!this.decks.includes(deck)) throw new Error('Target deck was not created.');
		this.movedCards.push({ cards: [...cards], deck });
		for (const card of cards) this.deckByCard.set(card, deck);
	}
	async modelFieldNames(modelName: string): Promise<string[]> {
		return modelName === 'Anki Card Link Basic'
			? ['Title', 'Front', 'Back', 'Hint', 'ObsidianURI']
			: modelName === 'Enhanced Cloze 2.1 v2'
				? ['Content', 'Note', 'ObsidianURI']
				: ['CardID', 'Title', 'Front', 'Back', 'ObsidianURL', 'OptionA', 'OptionB', 'OptionC', 'OptionD', 'OptionE', 'OptionF', 'OptionG', 'CorrectAnswer'];
	}
	async notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
		return structuredClone(noteIds.flatMap((id) => this.noteInfoById.get(id) ?? []));
	}
	async addNote(input: AnkiNoteInput): Promise<number> {
		const noteId = 100 + this.createdNotes.length;
		const cardId = noteId + 1000;
		this.createdNotes.push(input);
		this.noteInfoById.set(noteId, {
			noteId, cards: [cardId], modelName: input.modelName, tags: input.tags,
			fields: Object.fromEntries(Object.entries(input.fields).map(([name, value], order) => [name, { order, value }])),
		});
		this.deckByCard.set(cardId, input.deckName);
		return noteId;
	}
	async updateNoteFields(noteId: number, fields: Record<string, string>): Promise<void> {
		this.updatedNotes.push({ id: noteId, fields });
		const existing = this.noteInfoById.get(noteId);
		if (existing === undefined) throw new Error('Note does not exist.');
		for (const [name, value] of Object.entries(fields)) {
			existing.fields[name] = { order: existing.fields[name]?.order ?? 0, value };
		}
		this.onUpdate?.(existing);
	}
}

function basicInput(extra: Partial<CardSyncInput> = {}): CardSyncInput {
	const card = parseCardBlock('Front\n?\nBack');
	if (card === null) throw new Error('Test card was not parsed.');
	return { card, uid: 'acl-1234abcd', title: 'Cards', vaultName: 'vault', filePath: 'cards.md', ...extra };
}

function note(noteId: number, modelName = 'Anki Card Link Basic', uri = 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd'): AnkiNoteInfo {
	return { noteId, cards: [noteId + 1000], modelName, tags: ['anki-card-link'], fields: { ObsidianURI: { order: 0, value: uri } } };
}

function service(client: FakeAnkiClient, settings: Partial<AnkiCardLinkSettings> = {}): CardSyncService {
	return new CardSyncService(client, { ...DEFAULT_SETTINGS, basicTitleField: 'Title', basicHintField: 'Hint', ...settings });
}

describe('Markdown link synchronization', () => {
	it.each([
		['问题\n?\n[来源](https://example.com/?app_platform=ios&app_version=1)', 'Back'],
		['{{c1::答案}}\n\n[来源](https://example.com/?app_platform=ios&app_version=1)', 'Content'],
		['### 题目【B】\n- A\n- B\n[来源](https://example.com/?app_platform=ios&app_version=1)', 'Back'],
	])('creates clickable links and repairs old HTML on resync: %s', async (source, field) => {
		const client = new FakeAnkiClient();
		const sync = service(client);
		const card = parseCardBlock(source);
		if (card === null) throw new Error('Test card was not parsed.');
		const input = basicInput({ card });
		await expect(sync.sync(input)).resolves.toEqual({ status: 'created', noteId: 100 });
		const anchor = '<a href="https://example.com/?app_platform=ios&amp;app_version=1">来源</a>';
		expect(client.createdNotes[0]?.fields[field]).toContain(anchor);
		const existing = client.noteInfoById.get(100)!;
		const storedField = existing.fields[field]!;
		storedField.value = storedField.value.replace(anchor, '[来源](https://example.com/?app<em>platform=ios&amp;app</em>version=1)');
		const beforeCards = [...existing.cards];
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'updated', noteId: 100 });
		expect(existing.fields[field]?.value).toContain(anchor);
		expect(existing.cards).toEqual(beforeCards);
		expect(client.createdNotes).toHaveLength(1);
		expect(client.updatedNotes).toHaveLength(1);
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
		expect(client.updatedNotes).toHaveLength(1);
	});
});

describe('vault deck synchronization', () => {
	it.each([
		['生活/百科知识/区划代码.md', '', 'Obsidian::生活::百科知识'],
		['生活/百科知识/区划代码.md', ' 我的知识库 ', '我的知识库::生活::百科知识'],
		['生活/百科知识/区划代码.md', '   ', 'Obsidian::生活::百科知识'],
		['首页.md', '', 'Obsidian'],
		['首页.md', ' 我的知识库 ', '我的知识库'],
		['Obsidian/首页.md', '', 'Obsidian::Obsidian'],
	])('creates %s with custom name "%s" in %s', async (filePath, vaultDeckName, deckName) => {
		const client = new FakeAnkiClient();
		await service(client, { vaultDeckName }).sync(basicInput({ filePath, vaultName: 'Obsidian' }));
		expect(client.createdNotes[0]?.deckName).toBe(deckName);
		expect(client.decks).toContain(deckName);
		const uri = new URL(client.createdNotes[0]?.fields.ObsidianURI ?? '');
		expect(uri.searchParams.get('vault')).toBe('Obsidian');
		expect(uri.searchParams.get('filePath')).toBe(filePath);
	});

	it('moves unchanged content and skips the next identical sync without recreating a note', async () => {
		const client = new FakeAnkiClient();
		const input = basicInput({ vaultName: 'Obsidian', filePath: '生活/百科知识/区划代码.md' });
		await service(client, { useCurrentFolderAsDeck: false, defaultDeckName: '生活::百科知识' }).sync(input);
		const sync = service(client);
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'updated', noteId: 100 });
		expect(client.updatedNotes).toHaveLength(0);
		expect(client.movedCards).toEqual([{ cards: [1100], deck: 'Obsidian::生活::百科知识' }]);
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
		expect(client.movedCards).toHaveLength(1);
		expect(client.createdNotes).toHaveLength(1);
		expect(client.noteInfoById.get(100)?.cards).toEqual([1100]);
	});

	it('moves every misplaced sibling card without moving unrelated cards or cards already in the target deck', async () => {
		const client = new FakeAnkiClient();
		await service(client).sync(basicInput());
		const existing = client.noteInfoById.get(100)!;
		existing.cards = [1100, 1101, 1102];
		client.deckByCard.set(1101, 'Manually moved');
		client.deckByCard.set(1102, 'Old deck');
		client.deckByCard.set(9999, 'Old deck');
		await expect(service(client).sync(basicInput({ noteIdHint: 100 }))).resolves.toEqual({ status: 'updated', noteId: 100 });
		expect(client.movedCards).toEqual([{ cards: [1101, 1102], deck: 'vault' }]);
		expect(client.deckByCard.get(9999)).toBe('Old deck');
		expect(existing.cards).toEqual([1100, 1101, 1102]);
	});

	it('refreshes note information after an update so newly generated cloze cards move too', async () => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock('{{c1::one}} and {{c2::two}}');
		if (card?.type !== 'cloze') throw new Error('Cloze card was not parsed.');
		client.noteInfoById.set(20, {
			...note(20, 'Enhanced Cloze 2.1 v2'),
			cards: [1020, 1021],
		});
		client.onUpdate = (updated) => updated.cards.push(1022);
		const notesInfo = vi.spyOn(client, 'notesInfo');
		await expect(service(client).sync(basicInput({ noteIdHint: 20, card }))).resolves.toEqual({ status: 'updated', noteId: 20 });
		expect(notesInfo).toHaveBeenCalledTimes(2);
		expect(client.updatedNotes).toHaveLength(1);
		expect(client.movedCards).toEqual([{ cards: [1020, 1021, 1022], deck: 'vault' }]);
	});

	it('follows custom names, vault renames and source moves without changing note identity', async () => {
		const client = new FakeAnkiClient();
		await service(client).sync(basicInput());
		await service(client, { vaultDeckName: 'My library' }).sync(basicInput({ noteIdHint: 100 }));
		await service(client).sync(basicInput({ noteIdHint: 100, vaultName: 'Renamed', filePath: 'Moved/cards.md' }));
		expect(client.movedCards).toEqual([
			{ cards: [1100], deck: 'My library' },
			{ cards: [1100], deck: 'Renamed::Moved' },
		]);
		expect(client.createdNotes).toHaveLength(1);
		const uri = new URL(client.noteInfoById.get(100)?.fields.ObsidianURI?.value ?? '');
		expect(uri.searchParams.get('vault')).toBe('Renamed');
		expect(uri.searchParams.get('filePath')).toBe('Moved/cards.md');
	});

	it('uses the default deck for new cards and never moves existing cards when folder mapping is off', async () => {
		const client = new FakeAnkiClient();
		const sync = service(client, { useCurrentFolderAsDeck: false, vaultDeckName: 'Ignored', defaultDeckName: ' Custom default ' });
		const input = basicInput({ filePath: '生活/百科知识/区划代码.md' });
		await sync.sync(input);
		expect(client.createdNotes[0]?.deckName).toBe('Custom default');
		client.deckByCard.set(1100, 'Manually moved');
		const getDecks = vi.spyOn(client, 'getDecks');
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
		await expect(sync.sync({ ...input, noteIdHint: 100, title: 'Changed title' })).resolves.toEqual({ status: 'updated', noteId: 100 });
		expect(getDecks).not.toHaveBeenCalled();
		expect(client.movedCards).toHaveLength(0);
		expect(client.deckByCard.get(1100)).toBe('Manually moved');
	});

	it('does not require an unused default deck during configuration checks or root-level sync', async () => {
		const client = new FakeAnkiClient();
		const sync = service(client, { defaultDeckName: '' });
		await expect(sync.testConfiguration()).resolves.toHaveProperty('basicModelFields');
		expect(client.decks).toEqual(['Default']);
		await expect(sync.sync(basicInput())).resolves.toHaveProperty('status', 'created');
		await expect(service(client, { useCurrentFolderAsDeck: false, defaultDeckName: '' }).testConfiguration()).rejects.toThrow('Default deck name cannot be empty.');
	});

	it.each(['getDecks', 'createDeck', 'changeDeck'] as const)('reports %s failures and retries a move even after the content update succeeded', async (action) => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20));
		vi.spyOn(client, action).mockRejectedValueOnce(new Error('Temporary failure'));
		const sync = service(client);
		const input = basicInput({ noteIdHint: 20 });
		await expect(sync.sync(input)).rejects.toThrow('Temporary failure');
		expect(client.updatedNotes).toHaveLength(1);
		expect(client.movedCards).toHaveLength(0);
		await expect(sync.sync(input)).resolves.toEqual({ status: 'updated', noteId: 20 });
		expect(client.updatedNotes).toHaveLength(1);
		expect(client.movedCards).toEqual([{ cards: [1020], deck: 'vault' }]);
		expect(client.createdNotes).toHaveLength(0);
		await expect(sync.sync(input)).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
	});

	it('stops before moving cards when updating content fails', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20));
		vi.spyOn(client, 'updateNoteFields').mockRejectedValueOnce(new Error('Update failed'));
		await expect(service(client).sync(basicInput({ noteIdHint: 20 }))).rejects.toThrow('Update failed');
		expect(client.movedCards).toHaveLength(0);
	});

	it('reports a failure instead of moving cards when the refreshed note no longer matches', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20));
		client.onUpdate = (updated) => { updated.modelName = 'Other'; };
		await expect(service(client).sync(basicInput({ noteIdHint: 20 }))).rejects.toThrow('Anki note could not be verified');
		expect(client.movedCards).toHaveLength(0);
	});

	it.each([
		[undefined, 'NOTE_NOT_FOUND'],
		[note(20, 'Other'), 'MODEL_MISMATCH'],
		[note(20, 'Anki Card Link Basic', 'obsidian://anki-card-link-open?uid=other'), 'URI_UID_MISMATCH'],
	] as const)('does not inspect or move decks when note verification fails: %s', async (existing, reason) => {
		const client = new FakeAnkiClient();
		if (existing !== undefined) client.noteInfoById.set(20, existing);
		const getDecks = vi.spyOn(client, 'getDecks');
		await expect(service(client).sync(basicInput({ noteIdHint: 20 }))).resolves.toEqual({ status: 'skipped', reason });
		expect(getDecks).not.toHaveBeenCalled();
		expect(client.updatedNotes).toHaveLength(0);
		expect(client.movedCards).toHaveLength(0);
		expect(client.decks).toEqual(['Default']);
	});

	it('rejects incomplete deck information without moving cards', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20));
		vi.spyOn(client, 'getDecks').mockResolvedValueOnce({ vault: [] });
		await expect(service(client).sync(basicInput({ noteIdHint: 20 }))).rejects.toThrow('incomplete card deck information');
		expect(client.movedCards).toHaveLength(0);
	});
});

describe('card synchronization', () => {
	it('creates an unlinked card with a plugin-owned URI', async () => {
		const client = new FakeAnkiClient();
		await expect(service(client).sync(basicInput())).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.ObsidianURI).toContain('uid=acl-1234abcd');
	});

	it.each([
		['你好\n?\n哈哈', '你好'],
		// 顶格标题是现有解析器的卡片边界；缩进标题属于题面，验证它仍正常渲染。
		[' # 特特\n你好\n?\n哈哈', '<h1>特特</h1>你好'],
	])('syncs the original basic front and keeps the relative path title: %s', async (source, front) => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock(source);
		if (card?.type !== 'basic') throw new Error('Basic card was not parsed.');
		const filePath = 'test/特特.md';
		await expect(service(client).sync(basicInput({ card, filePath, title: getCardTitle(filePath) }))).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.Title).toBe('test/特特');
		expect(client.createdNotes[0]?.fields.Front).toBe(front);
		expect(client.createdNotes[0]?.fields.Back).toBe('哈哈');
	});

	it('updates only the linked note after the Obsidian file moves', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(20, note(20, 'Anki Card Link Basic', 'obsidian://anki-card-link-open?v=2&vault=v&path=old.md&uid=acl-1234abcd'));
		await expect(service(client).sync(basicInput({ noteIdHint: 20, filePath: 'moved/cards.md' }))).resolves.toEqual({ status: 'updated', noteId: 20 });
		expect(client.updatedNotes[0]?.fields.ObsidianURI).toContain('filePath=moved%2Fcards.md');
	});

	it('verifies an existing note independently of its deck and then moves it', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(21, note(21));
		await expect(service(client).sync(basicInput({ noteIdHint: 21 }))).resolves.toEqual({ status: 'updated', noteId: 21 });
		expect(client.movedCards).toEqual([{ cards: [1021], deck: 'vault' }]);
	});

	it('updates a linked note when Anki HTML-escapes the URI query separators', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(27, note(
			27,
			'Anki Card Link Basic',
			'obsidian://anki-card-link-open?v=2&amp;vault=vault&amp;filePath=cards.md&amp;uid=acl-1234abcd',
		));
		await expect(service(client).sync(basicInput({ noteIdHint: 27 }))).resolves.toEqual({ status: 'updated', noteId: 27 });
		expect(client.updatedNotes[0]?.fields.ObsidianURI).toContain('&uid=acl-1234abcd');
		expect(client.updatedNotes[0]?.fields.ObsidianURI).not.toContain('&amp;');
	});

	it('accepts the legacy block UID when Anki HTML-escapes the URI query separators', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(28, note(
			28,
			'Anki Card Link Basic',
			'obsidian://anki-card-link-open?v=1&amp;vault=vault&amp;path=cards.md&amp;block=acl-1234abcd',
		));
		await expect(service(client).sync(basicInput({ noteIdHint: 28 }))).resolves.toEqual({ status: 'updated', noteId: 28 });
	});

	it('skips a verified note when every synchronized field is unchanged', async () => {
		const client = new FakeAnkiClient();
		await service(client).sync(basicInput());
		const created = client.createdNotes[0];
		if (created === undefined) throw new Error('Test note was not created.');
		client.noteInfoById.set(26, {
			noteId: 26,
			cards: [1026],
			modelName: created.modelName,
			tags: created.tags,
			fields: Object.fromEntries(Object.entries(created.fields).map(([name, value], order) => [name, { order, value }])),
		});
		client.deckByCard.set(1026, created.deckName);
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

	it('skips an HTML-escaped linked note with a different UID without writing', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(29, note(
			29,
			'Anki Card Link Basic',
			'obsidian://anki-card-link-open?v=2&amp;vault=vault&amp;filePath=cards.md&amp;uid=acl-87654321',
		));
		await expect(service(client).sync(basicInput({ noteIdHint: 29 }))).resolves.toEqual({ status: 'skipped', reason: 'URI_UID_MISMATCH' });
		expect(client.updatedNotes).toHaveLength(0);
	});

	it('skips an invalid linked URI without writing', async () => {
		const client = new FakeAnkiClient();
		client.noteInfoById.set(30, note(30, 'Anki Card Link Basic', 'not a URI'));
		await expect(service(client).sync(basicInput({ noteIdHint: 30 }))).resolves.toEqual({ status: 'skipped', reason: 'URI_UID_MISMATCH' });
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
			cards: [1025],
			modelName: 'Multiple Choice',
			tags: [],
			fields: { ObsidianURL: { order: 0, value: 'obsidian://anki-card-link-open?v=2&uid=acl-1234abcd' } },
		});
		await expect(service(client).sync({ ...basicInput({ noteIdHint: 25 }), card })).resolves.toEqual({ status: 'updated', noteId: 25 });
		expect(client.updatedNotes[0]?.fields).toHaveProperty('ObsidianURL');
	});

	it.each(['B', 'A,B'])('syncs the original choice question with answers %s and keeps the relative path title', async (answers) => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock(`### Question 【${answers}】\n- A\n- B\n解析`);
		if (card?.type !== 'choice') throw new Error('Choice card was not parsed.');
		const filePath = 'test/多选题.md';
		await expect(service(client).sync({
			...basicInput({ filePath, title: getCardTitle(filePath) }),
			card,
		})).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.Title).toBe('test/多选题');
		expect(client.createdNotes[0]?.fields.Front).toBe('Question【　】');
		expect(client.createdNotes[0]?.fields.CorrectAnswer).toBe(answers);
		expect(client.createdNotes[0]?.fields.OptionA).toBe('A');
		expect(client.createdNotes[0]?.fields.OptionB).toBe('B');
		expect(client.createdNotes[0]?.fields.Back).toBe('解析');
	});

	it.each([
		[' # 卡片\n你好\n?\n哈哈', '<h1>卡片</h1>你好'],
		['### Question 【B】\n- A\n- B\n解析', 'Question【　】'],
		['### Question 【A,B】\n- A\n- B\n解析', 'Question【　】'],
	])('removes only the automatic heading on resync and skips the next identical sync: %s', async (source, front) => {
		const client = new FakeAnkiClient();
		const sync = service(client);
		const card = parseCardBlock(source);
		if (card === null) throw new Error('Test card was not parsed.');
		const filePath = 'test/卡片.md';
		const input = basicInput({ card, filePath, title: getCardTitle(filePath) });
		await sync.sync(input);
		const existing = client.noteInfoById.get(100)!;
		existing.fields.Front!.value = `<h1>卡片</h1>${front}`;
		const beforeCards = [...existing.cards];
		const otherFields = Object.fromEntries(Object.entries(existing.fields).filter(([name]) => name !== 'Front'));
		const beforeFields = structuredClone(otherFields);
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'updated', noteId: 100 });
		expect(existing.fields.Front?.value).toBe(front);
		expect(Object.fromEntries(Object.entries(existing.fields).filter(([name]) => name !== 'Front'))).toEqual(beforeFields);
		expect(existing.cards).toEqual(beforeCards);
		expect(client.createdNotes).toHaveLength(1);
		expect(client.updatedNotes).toHaveLength(1);
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'skipped', reason: 'NO_CHANGES' });
		expect(client.updatedNotes).toHaveLength(1);
	});

	it.each(['NOTE_NOT_FOUND', 'MODEL_MISMATCH', 'URI_UID_MISMATCH'] as const)('does not remove a legacy choice heading when verification fails: %s', async (reason) => {
		const client = new FakeAnkiClient();
		const sync = service(client);
		const card = parseCardBlock('### Question 【A,B】\n- A\n- B');
		if (card?.type !== 'choice') throw new Error('Choice card was not parsed.');
		const input = basicInput({ card });
		await sync.sync(input);
		const existing = client.noteInfoById.get(100)!;
		const front = '<h1>cards</h1>Question【　】';
		existing.fields.Front!.value = front;
		if (reason === 'NOTE_NOT_FOUND') client.noteInfoById.delete(100);
		if (reason === 'MODEL_MISMATCH') existing.modelName = 'Other';
		if (reason === 'URI_UID_MISMATCH') existing.fields.ObsidianURL!.value = 'obsidian://anki-card-link-open?uid=other';
		await expect(sync.sync({ ...input, noteIdHint: 100 })).resolves.toEqual({ status: 'skipped', reason });
		expect(existing.fields.Front?.value).toBe(front);
		expect(client.createdNotes).toHaveLength(1);
		expect(client.updatedNotes).toHaveLength(0);
		expect(client.movedCards).toHaveLength(0);
	});

	it('syncs a standard Markdown image in a choice back as Anki HTML', async () => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock('### Question 【B】\n- A\n- B\n![](<image.png>)');
		if (card?.type !== 'choice') throw new Error('Choice card was not parsed.');
		await expect(service(client).sync({
			...basicInput(),
			card,
			imageMedia: new Map([['image.png', 'anki-card-link-12345678.png']]),
		})).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.Back).toBe('<img src="anki-card-link-12345678.png">');
	});

	it('syncs a Cloze Markdown table as HTML instead of raw pipe text', async () => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock('| 灯神 | 发森森扥撒扥 |\n| --- | --- |\n| 发森森{{c1::扥撒扥}} | 是扥是扥收到 |');
		if (card?.type !== 'cloze') throw new Error('Cloze table was not parsed.');
		await expect(service(client).sync({ ...basicInput(), card })).resolves.toEqual({ status: 'created', noteId: 100 });
		const content = client.createdNotes[0]?.fields.Content;
		expect(content).toContain('<table');
		expect(content).toContain('<td style=');
		expect(content).toContain('{{c1::扥撒扥}}');
		expect(content).not.toContain('| --- |');
	});

	it('prepends the file name heading to cloze content', async () => {
		const client = new FakeAnkiClient();
		const card = parseCardBlock('{{c1::答案}}\n\n更多说明');
		if (card?.type !== 'cloze') throw new Error('Cloze card was not parsed.');
		await expect(service(client).sync({
			...basicInput({ filePath: 'nested/Cloze card.md', title: 'Cloze Title' }),
			card,
		})).resolves.toEqual({ status: 'created', noteId: 100 });
		expect(client.createdNotes[0]?.fields.Note).toBe('Cloze Title');
		expect(client.createdNotes[0]?.fields.Content).toMatch(/^<h1>Cloze card<\/h1>/u);
		expect(client.createdNotes[0]?.fields.Content).toContain('{{c1::答案}}');
	});
});
