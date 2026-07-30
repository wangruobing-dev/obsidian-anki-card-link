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
});
