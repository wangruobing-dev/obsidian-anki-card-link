import { describe, expect, it } from 'vitest';
import { getLocalizedErrorMessage, getStrings } from '../src/strings';
import { AnkiCardLinkError } from '../src/types';

describe('localized strings', () => {
	it('provides English and Simplified Chinese interface text', () => {
		expect(getStrings('en').settings.language).toBe('Language');
		expect(getStrings('zh-CN').settings.language).toBe('界面语言');
		expect(getStrings('zh-CN').searchTypes.nid).toBe('笔记 ID');
		expect(getStrings('zh-CN').settings.choiceConfiguration).toBe('选择题卡片');
	});

	it('localizes known errors while preserving dynamic details', () => {
		const validationError = new AnkiCardLinkError(
			'INVALID_NID',
			'Note ID must contain digits only.',
		);
		expect(getLocalizedErrorMessage(validationError, 'zh-CN')).toBe('笔记 ID 只能包含数字。');

		const connectError = new AnkiCardLinkError(
			'ANKICONNECT_ERROR',
			'AnkiConnect returned an error: invalid query',
		);
		expect(getLocalizedErrorMessage(connectError, 'zh-CN')).toBe(
			'AnkiConnect 返回错误：invalid query',
		);
		expect(getLocalizedErrorMessage(
			new AnkiCardLinkError('CHOICE_ANSWER_OUT_OF_RANGE', 'Multiple-choice correct answer is outside the available option range.'),
			'zh-CN',
		)).toBe('选择题正确答案超出了现有选项范围。');
	});
});
