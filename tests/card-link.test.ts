import { describe, expect, it } from 'vitest';
import { buildCardLink, ensureCardLink, parseCardLinkLine } from '../src/core/card-link';
import { parseCardBlock } from '../src/core/card-parser';

describe('card links in Markdown', () => {
	it.each(['打开对应 Anki 卡片', 'Open corresponding Anki card', '我的自定义按钮'])('recognizes a %s label from the URL', (label) => {
		const parsed = parseCardLinkLine(`[${label}](obsidian://anki-card-link?v=2&value=100&type=nid&uid=acl-1234abcd)`);
		expect(parsed).toMatchObject({ label, noteId: 100, uid: 'acl-1234abcd', version: 2 });
	});

	it('ignores ordinary links and invalid card-link parameters', () => {
		expect(parseCardLinkLine('[site](https://example.com)')).toBeUndefined();
		expect(parseCardLinkLine('[bad](obsidian://anki-card-link?type=cid&value=100&uid=acl-1234abcd&v=2)')).toBeUndefined();
	});

	it('builds the v2 link with UID and note ID', () => {
		expect(buildCardLink(100, 'acl-1234abcd', 'Open [card]')).toBe(
			'[Open \\[card\\]](obsidian://anki-card-link?type=nid&value=100&uid=acl-1234abcd&v=2)',
		);
	});

	it('inserts one link and remains byte-for-byte idempotent', () => {
		const source = 'Question :: Answer';
		const card = parseCardBlock(source)!;
		const linked = ensureCardLink(source, card, { uid: 'acl-1234abcd', noteId: 100 }, 'Open');
		expect(linked).toBe('Question :: Answer\n\n[Open](obsidian://anki-card-link?type=nid&value=100&uid=acl-1234abcd&v=2)');
		const linkedCard = parseCardBlock(linked)!;
		expect(ensureCardLink(linked, linkedCard, { uid: 'acl-1234abcd', noteId: 100 }, 'Open')).toBe(linked);
	});

	it('updates noteId while preserving UID and removes a standalone legacy ID', () => {
		const source = 'Question :: Answer\n^acl-1234abcd\n\n[Old](obsidian://anki-card-link?type=nid&value=10)';
		const updated = ensureCardLink(source, parseCardBlock(source)!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(updated).toBe('Question :: Answer\n\n[Open](obsidian://anki-card-link?type=nid&value=20&uid=acl-1234abcd&v=2)');
		expect(updated).not.toContain('^acl-');
	});

	it('removes only an exact inline legacy ID and preserves ordinary carets', () => {
		const source = '2 ^ 3 是什么？ :: 8 ^acl-1234abcd';
		const updated = ensureCardLink(source, parseCardBlock(source)!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(updated).toContain('2 ^ 3 是什么？ :: 8');
		expect(updated).not.toContain('^acl-1234abcd');
	});

	it('preserves CRLF and closes an unclosed fence before the link', () => {
		const source = '问题\r\n?\r\n```shell\r\nps -ef';
		const updated = ensureCardLink(source, parseCardBlock(source)!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(updated).toContain('ps -ef\r\n```\r\n\r\n[Open]');
		expect(updated.replaceAll('\r\n', '')).not.toContain('\n');
	});

	it('keeps exactly one v2 link for a choice card', () => {
		const source = '## 章节\n### 题目【B】。\n- A\n- B\n解析';
		const card = parseCardBlock(source)!;
		const linked = ensureCardLink(source, card, { uid: 'acl-1234abcd', noteId: 100 }, 'Open');
		expect(linked.match(/obsidian:\/\/anki-card-link/gu)).toHaveLength(1);
		const linkedCard = parseCardBlock(linked)!;
		expect(ensureCardLink(linked, linkedCard, { uid: 'acl-1234abcd', noteId: 100 }, 'Open')).toBe(linked);
	});
});
