import { describe, expect, it } from 'vitest';
import {
	buildMarkdownLink,
	buildObsidianUri,
	parseProtocolParams,
} from '../src/core/uri-parser';

describe('Obsidian URI handling', () => {
	it('parses valid protocol parameters', () => {
		expect(parseProtocolParams({ type: 'nid', value: '1667925274936', uid: 'acl-1234abcd', v: '2' })).toEqual({
			type: 'nid',
			value: '1667925274936',
		});
	});

	it('rejects an unsupported type', () => {
		expect(() => parseProtocolParams({ type: 'deck', value: 'x' })).toThrow(
			/type must be one of/u,
		);
	});

	it('rejects a missing value', () => {
		expect(() => parseProtocolParams({ type: 'query' })).toThrow(/cannot be empty/u);
	});

	it('encodes every external URI parameter', () => {
		expect(buildObsidianUri('query', 'deck:软考 tag:数据结构')).toBe(
			'obsidian://anki-card-link?type=query&value=deck%3A%E8%BD%AF%E8%80%83%20tag%3A%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84',
		);
	});

	it('builds a Markdown link only after validation', () => {
		expect(buildMarkdownLink('cid', '1667925275040', 'Open [card]')).toBe(
			'[Open \\[card\\]](obsidian://anki-card-link?type=cid&value=1667925275040)',
		);
	});
});
