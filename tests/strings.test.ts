import { describe, expect, it } from 'vitest';
import { getLocalizedErrorMessage, getStrings } from '../src/strings';
import { AnkiCardLinkError } from '../src/types';

describe('localized strings', () => {
	it('provides English and Simplified Chinese interface text', () => {
		expect(getStrings('en').settings.language).toBe('Language');
		expect(getStrings('zh-CN').settings.language).toBe('界面语言');
		expect(getStrings('zh-CN').searchTypes.nid).toBe('笔记 ID');
		expect(getStrings('zh-CN').settings.choiceConfiguration).toBe('选择题卡片');
		expect(getStrings('en').commands.revealNextReadingCloze).toBe('Reading review: Reveal next cloze');
		expect(getStrings('zh-CN').commands.toggleAllReadingBacks).toBe('阅读复习：显示或隐藏全部背面');
		expect(getStrings('zh-CN').settings.readingReviewEnabled).toBe('隐藏阅读模式中的答案');
		expect(getStrings('en').commands.insertClozeRegion).toBe('Cloze: Insert note region');
		expect(getStrings('zh-CN').commands.insertClozeRegion).toBe('Cloze：插入笔记区域');
		expect(getStrings('en').commands.exportPdf).toBe('Export current note to PDF (show answers)');
		expect(getStrings('zh-CN').commands.exportPdf).toBe('导出当前文档为 PDF（显示挖空答案）');
		expect(getStrings('en').commands.exportWord).toBe('Export current note to Word (.docx)');
		expect(getStrings('zh-CN').commands.exportWord).toBe('导出当前文档为 Word（.docx）');
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
		expect(getLocalizedErrorMessage(
			new AnkiCardLinkError('CLOZE_REGION_UNMATCHED_START', 'Cloze start marker is missing its matching end marker.'),
			'zh-CN',
		)).toBe('Cloze 开始标签缺少对应的结束标签。');
	});
});
