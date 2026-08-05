import { describe, expect, it } from 'vitest';
import { buildCardLink, ensureCardLink, parseCardLinkLine } from '../src/core/card-link';
import { parseCardBlock } from '../src/core/card-parser';
import { parseCards } from '../src/core/card-parser';
import { CLOZE_REGION_END, CLOZE_REGION_START } from '../src/core/cloze-region';

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

	it('updates an existing button to the newly configured label', () => {
		const source = 'Question :: Answer\n\n[Old label](obsidian://anki-card-link?type=nid&value=20&uid=acl-1234abcd&v=2)';
		const updated = ensureCardLink(source, parseCardBlock(source)!, { uid: 'acl-1234abcd', noteId: 20 }, 'Anki');
		expect(updated).toBe('Question :: Answer\n\n[Anki](obsidian://anki-card-link?type=nid&value=20&uid=acl-1234abcd&v=2)');
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

	it('writes an explicit Cloze button after the end marker without deleting either marker', () => {
		const source = `${CLOZE_REGION_START}\n\nJVM 是 {{c1::Java Virtual Machine}}。\n\n${CLOZE_REGION_END}`;
		const linked = ensureCardLink(source, parseCards(source)[0]!, { uid: 'acl-1234abcd', noteId: 100 }, 'Open');
		expect(linked).toBe(`${source}\n\n[Open](obsidian://anki-card-link?type=nid&value=100&uid=acl-1234abcd&v=2)`);
		expect(linked).toContain(CLOZE_REGION_START);
		expect(linked).toContain(CLOZE_REGION_END);
	});

	it('updates an explicit Cloze button idempotently and preserves edited body text', () => {
		const original = `${CLOZE_REGION_START}\n\n旧内容 {{c1::答案}}\n\n${CLOZE_REGION_END}\n\n[Old](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)`;
		const edited = original.replace('旧内容', '新内容');
		const updated = ensureCardLink(edited, parseCards(edited)[0]!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(updated).toContain('新内容 {{c1::答案}}');
		expect(updated.match(/anki-card-link:cloze:end/gu)).toHaveLength(1);
		expect(updated.match(/obsidian:\/\/anki-card-link/gu)).toHaveLength(1);
		expect(ensureCardLink(updated, parseCards(updated)[0]!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open')).toBe(updated);
	});

	it('recreates a deleted explicit Cloze button', () => {
		const source = `${CLOZE_REGION_START}\n{{c1::答案}}\n${CLOZE_REGION_END}`;
		const linked = ensureCardLink(source, parseCards(source)[0]!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(linked.endsWith('[Open](obsidian://anki-card-link?type=nid&value=20&uid=acl-1234abcd&v=2)')).toBe(true);
	});

	it('updates one of two explicit regions without modifying the other region', () => {
		const first = `${CLOZE_REGION_START}\n一 {{c1::甲}}\n${CLOZE_REGION_END}\n\n[One](obsidian://anki-card-link?type=nid&value=1&uid=acl-11111111&v=2)`;
		const second = `${CLOZE_REGION_START}\n二 {{c1::乙}}\n${CLOZE_REGION_END}\n\n[Two](obsidian://anki-card-link?type=nid&value=2&uid=acl-22222222&v=2)`;
		const source = `${first}\n\n${second}`;
		const cards = parseCards(source);
		const updated = ensureCardLink(source, cards[0]!, { uid: 'acl-11111111', noteId: 10 }, 'Updated');
		expect(updated).toContain('[Updated](obsidian://anki-card-link?type=nid&value=10&uid=acl-11111111&v=2)');
		expect(updated).toContain(second);
	});

	it('supports reverse-order whole-file writeback for two explicit regions', () => {
		const source = `${CLOZE_REGION_START}\n一 {{c1::甲}}\n${CLOZE_REGION_END}\n\n${CLOZE_REGION_START}\n二 {{c1::乙}}\n${CLOZE_REGION_END}`;
		const cards = parseCards(source);
		let updated = source;
		updated = ensureCardLink(updated, cards[1]!, { uid: 'acl-22222222', noteId: 2 }, 'Two');
		updated = ensureCardLink(updated, cards[0]!, { uid: 'acl-11111111', noteId: 1 }, 'One');
		expect(updated.match(/anki-card-link:cloze:end/gu)).toHaveLength(2);
		expect(updated.match(/obsidian:\/\/anki-card-link/gu)).toHaveLength(2);
		expect(parseCards(updated).map((card) => card.uid)).toEqual(['acl-11111111', 'acl-22222222']);
	});

	it('keeps an implicit whole-note Cloze button compatible', () => {
		const source = `# JVM\n\n{{c1::答案}}\n\n[Old](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)`;
		const updated = ensureCardLink(source, parseCards(source)[0]!, { uid: 'acl-1234abcd', noteId: 20 }, 'Open');
		expect(updated).toBe('# JVM\n\n{{c1::答案}}\n\n[Open](obsidian://anki-card-link?type=nid&value=20&uid=acl-1234abcd&v=2)');
	});
});
