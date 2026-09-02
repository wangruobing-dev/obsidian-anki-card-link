import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAnkiConnectRequestBody } from '../src/services/anki-connect-request';
import { AnkiConnectService } from '../src/services/anki-connect';

describe('AnkiConnect deck operations', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('sends card IDs and the target deck through API version 6', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const requests: unknown[] = [];
		const client = new AnkiConnectService({
			url: 'http://127.0.0.1:8765',
			request: async (input) => {
				if (typeof input === 'string' || typeof input.body !== 'string') throw new Error('Missing request body.');
				requests.push(JSON.parse(input.body));
				const json = { result: requests.length === 1 ? { '生活::百科知识': [101, 102] } : null, error: null };
				return { status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), text: JSON.stringify(json), json };
			},
		});
		await expect(client.getDecks([101, 102])).resolves.toEqual({ '生活::百科知识': [101, 102] });
		await expect(client.changeDeck([101, 102], 'Obsidian::生活::百科知识')).resolves.toBeUndefined();
		expect(requests).toEqual([
			{ action: 'getDecks', version: 6, params: { cards: [101, 102] } },
			{ action: 'changeDeck', version: 6, params: { cards: [101, 102], deck: 'Obsidian::生活::百科知识' } },
		]);
	});

	it('propagates AnkiConnect move errors to the sync service', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		const client = new AnkiConnectService({
			url: 'http://127.0.0.1:8765',
			request: async () => ({
				status: 200, headers: {}, arrayBuffer: new ArrayBuffer(0), text: '',
				json: { result: null, error: 'Deck is unavailable' },
			}),
		});
		await expect(client.changeDeck([101], 'Obsidian')).rejects.toThrow('AnkiConnect returned an error: Deck is unavailable');
	});
});

describe('AnkiConnect requests', () => {
	it('builds a guiBrowse request body using API version 6', () => {
		expect(buildAnkiConnectRequestBody('guiBrowse', { query: 'nid:1667925274936' })).toEqual({
			action: 'guiBrowse',
			version: 6,
			params: { query: 'nid:1667925274936' },
		});
	});

	it('builds an updateNote request body with the note ID and updated fields', () => {
		expect(
			buildAnkiConnectRequestBody('updateNote', {
				note: { id: 1785500123229, fields: { Front: '更新后的正面', Back: '更新后的背面' } },
			}),
		).toEqual({
			action: 'updateNote',
			version: 6,
			params: {
				note: {
					id: 1785500123229,
					fields: { Front: '更新后的正面', Back: '更新后的背面' },
				},
			},
		});
	});

	it('builds a removeTags request body with a space-separated legacy tag', () => {
		expect(
			buildAnkiConnectRequestBody('removeTags', {
				notes: [1785500123229],
				tags: 'anki-card-link::acl-85c4020c',
			}),
		).toEqual({
			action: 'removeTags',
			version: 6,
			params: {
				notes: [1785500123229],
				tags: 'anki-card-link::acl-85c4020c',
			},
		});
	});

	it('builds a storeMediaFile request body with Base64 data', () => {
		expect(
			buildAnkiConnectRequestBody('storeMediaFile', {
				filename: 'anki-card-link-12345678.png',
				data: 'AP/A',
			}),
		).toEqual({
			action: 'storeMediaFile',
			version: 6,
			params: { filename: 'anki-card-link-12345678.png', data: 'AP/A' },
		});
	});
});
