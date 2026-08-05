import { describe, expect, it } from 'vitest';
import {
	findCardAtLine,
	getCardTitle,
	getClozeNumbers,
	normalizeChoiceAnswers,
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
		expect(card?.type === 'basic' ? card.back : '').toContain('obsidian://anki-card-link');
	});

	it('keeps blank lines inside fenced code blocks', () => {
		const card = parseCardBlock('问题\n?\n```shell\necho one\n\necho two\n```');
		expect(card?.type === 'basic' ? card.back : '').toContain('echo one\n\necho two');
	});

	it('rejects empty fields, invalid Cloze, and duplicate UIDs', () => {
		expect(() => parseCardBlock(' :: Back')).toThrow(/front cannot be empty/u);
		expect(() => parseCardBlock('Java {{c1::}}')).toThrow(/valid cloze/u);
		const candidates = parseCardCandidates('One :: A\n\n[Open](obsidian://anki-card-link?type=nid&value=1&uid=acl-1234abcd&v=2)\n\nTwo :: B\n\n[Open](obsidian://anki-card-link?type=nid&value=2&uid=acl-1234abcd&v=2)');
		expect(candidates.filter((candidate) => candidate.error?.code === 'DUPLICATE_CARD_UID')).toHaveLength(2);
	});

	it('generates a stable UID and uses the file path as the title', () => {
		const generated = generateCardUid(() => 'ABCDEF12-0000-0000-0000-000000000000');
		expect(generated).toBe('acl-abcdef12');
		expect(getCardTitle('test/Calculation.md')).toBe('test/Calculation');
		expect(getCardTitle('Calculation.md')).toBe('Calculation');
		expect(getCardTitle('test\\Calculation.md')).toBe('test/Calculation');
	});

	it('keeps Cloze number behavior', () => {
		const card = parseCardBlock('Java 的 {{c1::垃圾回收器::提示}} :: {{c1::自动}} {{c3::内存}}');
		expect(card).toMatchObject({ type: 'cloze' });
		expect(getClozeNumbers(card?.type === 'cloze' ? card.content : '')).toEqual([1, 1, 3]);
		expect(parseCards('普通问题？\n继续说明。')).toHaveLength(0);
	});

	it('parses single-choice and multiple-choice cards without exposing the answer', () => {
		const single = parseCardBlock('## 线性表\n### 顺序表按序号查找的复杂度是【B】。\n- O(n)\n- O(1)\n**解析：**\n顺序表支持随机访问。');
		expect(single).toMatchObject({
			type: 'choice',
			front: '顺序表按序号查找的复杂度是【　】。',
			back: '**解析：**\n顺序表支持随机访问。',
			options: ['O(n)', 'O(1)'],
			correctAnswers: ['B'],
		});
		if (single === null) throw new Error('Choice card was not parsed.');
		expect(getCardTitle('软考/线性表.md')).toBe('软考/线性表');

		const multiple = parseCardBlock('### 正确的选项有【A,C,D】。\n- A\n- B\n- C\n- D');
		expect(multiple).toMatchObject({ type: 'choice', back: '', correctAnswers: ['A', 'C', 'D'] });

		expect(getCardTitle('章节/文件.md')).toBe('章节/文件');
	});

	it.each([
		['A,C,D', ['A', 'C', 'D']],
		['ACD', ['A', 'C', 'D']],
		['A C D', ['A', 'C', 'D']],
		['A、C、D', ['A', 'C', 'D']],
		['d，a/c', ['A', 'C', 'D']],
	])('normalizes choice answers written as %s', (source, expected) => {
		expect(normalizeChoiceAnswers(source)).toEqual(expected);
	});

	it('supports exactly two or seven choice options', () => {
		expect(parseCardBlock('### 两项【B】\n- 一\n- 二')).toMatchObject({ type: 'choice', options: ['一', '二'] });
		const seven = parseCardBlock('### 七项【G】\n- A\n- B\n- C\n- D\n- E\n- F\n- G');
		expect(seven).toMatchObject({ type: 'choice', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] });
	});

	it('stops choice Back at a blank line and associates the existing button', () => {
		const source = '### 题目【A】？\n- 甲\n- 乙\n解析第一行\n解析第二行\n\n[Open](obsidian://anki-card-link?type=nid&value=12&uid=acl-1234abcd&v=2)\n\n后续内容';
		const card = parseCards(source)[0];
		expect(card).toMatchObject({ type: 'choice', back: '解析第一行\n解析第二行', uid: 'acl-1234abcd', linkLine: 6, endLine: 6 });
		expect(findCardAtLine(source, 1)?.type).toBe('choice');
		expect(findCardAtLine(source, 3)?.type).toBe('choice');
		expect(findCardAtLine(source, 6)?.type).toBe('choice');
	});

	it.each([
		['### 太少【A】\n- 只有一个', 'CHOICE_TOO_FEW_OPTIONS'],
		['### 太多【A】\n- A\n- B\n- C\n- D\n- E\n- F\n- G\n- H', 'CHOICE_TOO_MANY_OPTIONS'],
		['### 空答案【】\n- A\n- B', 'CHOICE_EMPTY_ANSWER'],
		['### 非法答案【H】\n- A\n- B', 'CHOICE_INVALID_ANSWER'],
		['### 重复答案【A,A】\n- A\n- B', 'CHOICE_DUPLICATE_ANSWER'],
		['### 超范围【C】\n- A\n- B', 'CHOICE_ANSWER_OUT_OF_RANGE'],
		['### 空选项【A】\n- A\n-   ', 'CHOICE_EMPTY_OPTION'],
	])('returns a parse error for malformed choice syntax: %s', (source, code) => {
		const error = parseCardCandidates(source).find((candidate) => candidate.error !== undefined)?.error;
		expect(error?.code).toBe(code);
	});

	it('ignores choice-like text in code fences and ordinary level-three headings', () => {
		const fenced = '```markdown\n### 示例【B】\n- A\n- B\n```';
		expect(parseCards(fenced)).toHaveLength(0);
		expect(parseCards('### 普通标题\n- A\n- B')).toHaveLength(0);
		expect(parseCards('### 任务列表【A】\n- [ ] A\n- [x] B')).toHaveLength(0);
	});

	it('gives an implicit whole-note Cloze priority when no boundary markers exist', () => {
		const source = '前面 :: 正常\n\n### 错题【D】\n- A\n- B\n\n后面 {{c1::正常}}';
		const candidates = parseCardCandidates(source);
		expect(candidates.filter((candidate) => candidate.card !== undefined).map((candidate) => candidate.card?.type)).toEqual(['cloze']);
		expect(candidates.filter((candidate) => candidate.error !== undefined)).toHaveLength(0);
	});
});
