import { describe, expect, it } from 'vitest';
import { buildClozeReplacement, getClozeNumber, getClozeContentCursorOffset } from '../src/core/cloze-editor';

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
});
