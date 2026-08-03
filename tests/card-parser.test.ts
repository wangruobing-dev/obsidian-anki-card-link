import { describe, expect, it } from 'vitest';
import {
	findCardAtLine,
	getCardTitle,
	getClozeNumbers,
	parseCardBlock,
	parseCardCandidates,
	parseCards,
} from '../src/core/card-parser';
import { generateCardUid } from '../src/core/card-identity';
import { buildCardSyntax } from '../src/core/card-syntax';

describe('card parser', () => {
	it('parses a new single-line card and excludes its link from Back', () => {
		const source = '什么是 JVM？ :: Java 虚拟机。\n\n[自定义文字](obsidian://anki-card-link?v=2&uid=acl-1234abcd&value=123&type=nid)';
		expect(parseCardBlock(source)).toMatchObject({
			type: 'basic', front: '什么是 JVM？', back: 'Java 虚拟机。', uid: 'acl-1234abcd', noteId: 123, linkLine: 2,
		});
		expect(findCardAtLine(source, 2)?.startLine).toBe(0);
	});

	it('parses new multi-line basic and Cloze cards', () => {
		const basic = parseCardBlock('问题\n?\n答案\n\n[Open](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)');
		expect(basic).toMatchObject({ type: 'basic', front: '问题', back: '答案', uid: 'acl-1234abcd' });
		const cloze = parseCardBlock('{{c1::甲}}\n{{c2::乙}}\n\n[Open](obsidian://anki-card-link?type=nid&value=11&uid=acl-87654321&v=2)');
		expect(cloze).toMatchObject({ type: 'cloze', content: '{{c1::甲}}\n{{c2::乙}}', uid: 'acl-87654321' });
	});

	it('supports English and Chinese separators without requiring spaces', () => {
		expect(parseCardBlock('英文问题::英文答案')).toMatchObject({ front: '英文问题', back: '英文答案' });
		expect(parseCardBlock('中文问题：：中文答案')).toMatchObject({ front: '中文问题', back: '中文答案' });
		expect(parseCardBlock('多行问题\n？\n多行答案')).toMatchObject({ front: '多行问题', back: '多行答案' });
	});

	it('supports customized single-line and multi-line separators', () => {
		const syntax = buildCardSyntax({ singleLineSeparators: '=>\n→', multiLineSeparators: 'ANSWER\n答' });
		expect(parseCardBlock('Question=>Answer', syntax)).toMatchObject({ front: 'Question', back: 'Answer' });
		expect(parseCardBlock('问题\n答\n答案', syntax)).toMatchObject({ front: '问题', back: '答案' });
		expect(parseCardBlock('问题::答案', syntax)).toBeNull();
	});

	it('supports legacy standalone and inline block IDs', () => {
		expect(parseCardBlock('问题 :: 答案\n^acl-1234abcd')).toMatchObject({ uid: 'acl-1234abcd', legacyBlockId: 'acl-1234abcd' });
		expect(parseCardBlock('问题 :: 答案 ^acl-87654321')).toMatchObject({ uid: 'acl-87654321', legacyBlockIdInline: true });
	});

	it('supports a legacy block ID followed by an old link', () => {
		const card = parseCardBlock('问题 :: 答案\n^acl-1234abcd\n\n[旧按钮](obsidian://anki-card-link?type=nid&value=99)');
		expect(card).toMatchObject({ uid: 'acl-1234abcd', legacyBlockId: 'acl-1234abcd', noteId: 99, linkLine: 3 });
	});

	it('recognizes a link directly after content and ignores a similar link inside a code fence', () => {
		expect(parseCardBlock('问题 :: 答案\n[Open](obsidian://anki-card-link?type=nid&value=12&uid=acl-1234abcd&v=2)')).toMatchObject({ uid: 'acl-1234abcd' });
		const source = '问题\n?\n```text\n[Open](obsidian://anki-card-link?type=nid&value=12&uid=acl-1234abcd&v=2)\n```';
		const card = parseCardBlock(source);
		expect(card?.uid).toBeUndefined();
		expect(card?.back).toContain('obsidian://anki-card-link');
	});

	it('keeps blank lines inside fenced code blocks', () => {
		const card = parseCardBlock('问题\n?\n```shell\necho one\n\necho two\n```');
		expect(card?.back).toContain('echo one\n\necho two');
	});

	it('rejects empty fields, invalid Cloze, and duplicate UIDs', () => {
		expect(() => parseCardBlock(' :: Back')).toThrow(/front cannot be empty/u);
		expect(() => parseCardBlock('Java {{c1::}}')).toThrow(/valid cloze/u);
		const candidates = parseCardCandidates('One :: A\n\n[Open](obsidian://anki-card-link?type=nid&value=1&uid=acl-1234abcd&v=2)\n\nTwo :: B\n\n[Open](obsidian://anki-card-link?type=nid&value=2&uid=acl-1234abcd&v=2)');
		expect(candidates.filter((candidate) => candidate.error?.code === 'DUPLICATE_CARD_UID')).toHaveLength(2);
	});

	it('generates a stable UID and resolves the nearest heading title', () => {
		const generated = generateCardUid(() => 'ABCDEF12-0000-0000-0000-000000000000');
		expect(generated).toBe('acl-abcdef12');
		const source = '# 标题\nFront :: Back';
		const card = findCardAtLine(source, 1);
		expect(getCardTitle(source, card!, 'other.md')).toBe('标题');
	});

	it('keeps Cloze number behavior', () => {
		const card = parseCardBlock('Java 的 {{c1::垃圾回收器::提示}} :: {{c1::自动}} {{c3::内存}}');
		expect(card).toMatchObject({ type: 'cloze' });
		expect(getClozeNumbers(card?.content ?? '')).toEqual([1, 1, 3]);
		expect(parseCards('普通问题？\n继续说明。')).toHaveLength(0);
	});
});
