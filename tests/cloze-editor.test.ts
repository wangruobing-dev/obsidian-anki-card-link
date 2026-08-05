import { describe, expect, it } from 'vitest';
import {
	buildClozeReplacement,
	getClozeNumber,
	getClozeContentCursorOffset,
	insertClozeRegion,
} from '../src/core/cloze-editor';
import { CLOZE_REGION_END, CLOZE_REGION_START, getClozeScopeAtOffset } from '../src/core/cloze-region';

describe('cloze editor helpers', () => {
	it('uses c1 when the current card has no cloze', () => {
		expect(getClozeNumber('普通文本', 'next')).toBe(1);
		expect(getClozeNumber('普通文本', 'current')).toBe(1);
	});

	it('uses the next maximum or the last existing number', () => {
		const card = '{{c1::甲}} {{c3::乙}} {{c1::丙}}';
		expect(getClozeNumber(card, 'next')).toBe(4);
		expect(getClozeNumber(card, 'current')).toBe(1);
	});

	it('wraps selected text without changing other text and has an empty cursor position', () => {
		expect(buildClozeReplacement('选中文字', 2)).toBe('{{c2::选中文字}}');
		expect(buildClozeReplacement('', 1)).toBe('{{c1::}}');
		expect(getClozeContentCursorOffset(1)).toBe(6);
	});

	it('wraps a selected line with standard independent marker lines', () => {
		const source = 'JVM 是 {{c1::Java Virtual Machine}}。';
		const result = insertClozeRegion(source, 0, source.length);
		expect(result).toMatchObject({
			ok: true,
			markdown: `${CLOZE_REGION_START}\n\n${source}\n\n${CLOZE_REGION_END}`,
		});
		if (result.ok) expect(result.markdown.slice(result.selectionStart, result.selectionEnd)).toBe(source);
	});

	it('inserts an empty region and places the cursor on the editable body line', () => {
		const result = insertClozeRegion('', 0, 0);
		expect(result).toMatchObject({ ok: true, markdown: `${CLOZE_REGION_START}\n\n${CLOZE_REGION_END}` });
		if (result.ok) expect(result.markdown.slice(0, result.selectionStart)).toBe(`${CLOZE_REGION_START}\n`);
	});

	it.each([
		['LF', '\n'],
		['CRLF', '\r\n'],
	] as const)('preserves %s line endings', (_name, eol) => {
		const source = `前${eol}正文${eol}后`;
		const start = source.indexOf('正文');
		const result = insertClozeRegion(source, start, start + 2);
		expect(result.ok && result.markdown.includes(`${CLOZE_REGION_START}${eol}${eol}正文${eol}${eol}${CLOZE_REGION_END}`)).toBe(true);
		if (result.ok && eol === '\r\n') expect(result.markdown.replaceAll('\r\n', '')).not.toContain('\n');
	});

	it('keeps text before and after a partial-line selection', () => {
		const source = '前缀选中文字后缀';
		const start = source.indexOf('选中');
		const end = start + '选中文字'.length;
		const result = insertClozeRegion(source, start, end);
		expect(result.ok && result.markdown).toBe(`前缀\n${CLOZE_REGION_START}\n\n选中文字\n\n${CLOZE_REGION_END}\n后缀`);
	});

	it('rejects a cursor inside an existing region', () => {
		const source = `${CLOZE_REGION_START}\n{{c1::答案}}\n${CLOZE_REGION_END}`;
		const offset = source.indexOf('答案');
		expect(insertClozeRegion(source, offset, offset)).toEqual({ ok: false, reason: 'inside-region' });
	});

	it.each([
		['contains a marker', (source: string) => [0, source.indexOf('{{c1')]],
		['partially overlaps a region', (source: string) => [source.indexOf('前'), source.indexOf('答案') + 2]],
		['fully covers a region', (source: string) => [0, source.length]],
	])('rejects a selection that %s', (_name, range) => {
		const source = `前\n${CLOZE_REGION_START}\n{{c1::答案}}\n${CLOZE_REGION_END}\n后`;
		const [start, end] = range(source);
		expect(insertClozeRegion(source, start ?? 0, end ?? 0)).toEqual({ ok: false, reason: 'overlap-region' });
	});

	it('rejects selected marker examples even when they are inside a code fence', () => {
		const source = `\`\`\`markdown\n${CLOZE_REGION_START}\n${CLOZE_REGION_END}\n\`\`\``;
		expect(insertClozeRegion(source, 0, source.length)).toEqual({ ok: false, reason: 'overlap-region' });
	});

	it('uses one explicit region as the cross-paragraph numbering scope', () => {
		const source = `${CLOZE_REGION_START}\nA {{c1::答案A}}。\n\nB 是选中文字。\n${CLOZE_REGION_END}`;
		const cursor = source.indexOf('选中文字');
		const scope = getClozeScopeAtOffset(source, cursor)!;
		expect(getClozeNumber(scope.text, 'next', scope.beforeCursor)).toBe(2);
		expect(getClozeNumber(scope.text, 'current', scope.beforeCursor)).toBe(1);
	});

	it('keeps numbering independent between two explicit regions', () => {
		const source = `${CLOZE_REGION_START}\n{{c5::第一}}\n${CLOZE_REGION_END}\n\n${CLOZE_REGION_START}\n{{c2::第二}} 光标\n${CLOZE_REGION_END}`;
		const scope = getClozeScopeAtOffset(source, source.indexOf('光标'))!;
		expect(getClozeNumber(scope.text, 'next', scope.beforeCursor)).toBe(3);
	});

	it('uses the whole implicit note across headings and the last number before the cursor', () => {
		const source = `# 标题\n{{c1::一}}\n\n## 小节\n{{c4::四}}\n\n光标\n\n{{c9::后面}}`;
		const scope = getClozeScopeAtOffset(source, source.indexOf('光标'))!;
		expect(getClozeNumber(scope.text, 'next', scope.beforeCursor)).toBe(10);
		expect(getClozeNumber(scope.text, 'current', scope.beforeCursor)).toBe(4);
	});

	it('uses c1 when the current region has no earlier number', () => {
		const source = `${CLOZE_REGION_START}\n光标 {{c3::后面}}\n${CLOZE_REGION_END}`;
		const scope = getClozeScopeAtOffset(source, source.indexOf('光标'))!;
		expect(getClozeNumber(scope.text, 'current', scope.beforeCursor)).toBe(1);
	});
});
