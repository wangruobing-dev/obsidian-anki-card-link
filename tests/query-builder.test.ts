import { describe, expect, it } from 'vitest';
import { buildAnkiQuery } from '../src/core/query-builder';

describe('buildAnkiQuery', () => {
	it('builds a note ID query', () => {
		expect(buildAnkiQuery('nid', '1667925274936')).toBe('nid:1667925274936');
	});

	it('builds a card ID query', () => {
		expect(buildAnkiQuery('cid', '1667925275040')).toBe('cid:1667925275040');
	});

	it('quotes and escapes ordinary text', () => {
		expect(buildAnkiQuery('text', 'path\\name "quoted"')).toBe(
			'"path\\\\name \\"quoted\\""',
		);
	});

	it('preserves a custom query after trimming outer whitespace', () => {
		expect(buildAnkiQuery('query', '  deck:软考 tag:数据结构  ')).toBe(
			'deck:软考 tag:数据结构',
		);
	});

	it.each([
		['nid', 'abc'],
		['cid', '123x'],
	] as const)('rejects a non-numeric %s', (type, value) => {
		expect(() => buildAnkiQuery(type, value)).toThrow(/digits only/u);
	});

	it.each(['nid', 'cid', 'text', 'query'] as const)('rejects an empty %s value', (type) => {
		expect(() => buildAnkiQuery(type, '   ')).toThrow(/cannot be empty/u);
	});
});
