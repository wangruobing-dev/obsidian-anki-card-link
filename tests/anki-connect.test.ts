import { describe, expect, it } from 'vitest';
import { buildAnkiConnectRequestBody } from '../src/services/anki-connect-request';

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
