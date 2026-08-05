import { describe, expect, it } from 'vitest';
import { buildCardSyntax, DEFAULT_CARD_SYNTAX } from '../src/core/card-syntax';
import { LOCALIZED_COMMAND_IDS, READING_REVIEW_COMMAND_IDS } from '../src/reading-review/command-ids';
import { CLOZE_REGION_END, CLOZE_REGION_START } from '../src/core/cloze-region';
import {
	buildReadingReviewModel,
	createMaskStates,
	hasAnkiCardLinkTag,
	revealNextMask,
	shouldProcessReadingReview,
	toggleAllMasks,
} from '../src/reading-review/mask-model';

describe('reading review model', () => {
	it('does not process an untagged note', () => {
		expect(shouldProcessReadingReview(true, ['#other'])).toBe(false);
	});

	it('accepts a YAML scalar tag returned by MetadataCache', () => {
		expect(hasAnkiCardLinkTag(['#anki-card-link'])).toBe(true);
	});

	it('accepts a YAML tag array returned by MetadataCache', () => {
		expect(hasAnkiCardLinkTag(['#study', '#anki-card-link'])).toBe(true);
	});

	it('accepts an inline tag returned by MetadataCache', () => {
		expect(hasAnkiCardLinkTag(['#anki-card-link', '#inline'])).toBe(true);
	});

	it('describes an English single-line Basic back', () => {
		const model = buildReadingReviewModel('Question :: Answer', DEFAULT_CARD_SYNTAX);
		expect(model.masks).toMatchObject([{ kind: 'back', answer: 'Answer', startLine: 0 }]);
	});

	it('describes a Chinese single-line Basic back', () => {
		const model = buildReadingReviewModel('问题 ：： 答案', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]?.answer).toBe('答案');
	});

	it('keeps exact Basic positions when separators have no spaces', () => {
		const model = buildReadingReviewModel('问题::答案', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]).toMatchObject({ startColumn: 4, endColumn: 6 });
	});

	it('uses customized Basic separators', () => {
		const syntax = buildCardSyntax({ singleLineSeparators: '=>', multiLineSeparators: 'ANSWER' });
		expect(buildReadingReviewModel('Q=>A', syntax).masks[0]?.answer).toBe('A');
	});

	it('describes a multi-line Basic back', () => {
		const model = buildReadingReviewModel('Front\n?\nBack', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]).toMatchObject({ startLine: 2, endLine: 2, kind: 'back' });
	});

	it('keeps a multi-line Basic back as one mask', () => {
		const model = buildReadingReviewModel('Front\n?\nFirst line\nSecond line', DEFAULT_CARD_SYNTAX);
		expect(model.masks).toHaveLength(1);
		expect(model.masks[0]?.answer).toBe('First line\nSecond line');
	});

	it('keeps fenced code inside a Basic back', () => {
		const model = buildReadingReviewModel('Front\n?\n```ts\nconst x = 1;\n```', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]?.answer).toContain('const x = 1;');
	});

	it('keeps image Markdown inside a Basic back', () => {
		const model = buildReadingReviewModel('Front\n?\n![[image.png]]', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]?.answer).toBe('![[image.png]]');
	});

	it('describes one Cloze token', () => {
		const model = buildReadingReviewModel('Java uses {{c1::GC}}.', DEFAULT_CARD_SYNTAX);
		expect(model.masks).toMatchObject([{ kind: 'cloze', answer: 'GC' }]);
	});

	it('describes multiple Cloze tokens in DOM order', () => {
		const model = buildReadingReviewModel('{{c1::A}} {{c2::B}}', DEFAULT_CARD_SYNTAX);
		expect(model.masks.map((mask) => mask.answer)).toEqual(['A', 'B']);
	});

	it('keeps same-number Cloze tokens independent', () => {
		const model = buildReadingReviewModel('{{c1::A}} and {{c1::B}}', DEFAULT_CARD_SYNTAX);
		expect(new Set(model.masks.map((mask) => mask.id)).size).toBe(2);
	});

	it('exposes a Cloze hint without changing the answer', () => {
		const model = buildReadingReviewModel('{{c1::垃圾回收器::内存管理}}', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]).toMatchObject({ answer: '垃圾回收器', hint: '内存管理' });
	});

	it('ignores Cloze-looking text inside a code fence', () => {
		const source = '{{c1::real}}\n```md\n{{c2::example}}\n```';
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => mask.answer)).toEqual(['real']);
	});

	it('describes a single-choice answer marker', () => {
		const model = buildReadingReviewModel('### Question【B】\n- A\n- B', DEFAULT_CARD_SYNTAX);
		expect(model.masks).toMatchObject([{ kind: 'cloze', cardType: 'choice', answer: 'B' }]);
	});

	it('describes a multiple-choice answer marker', () => {
		const model = buildReadingReviewModel('### Question【A、C、D】\n- A\n- B\n- C\n- D', DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]?.answer).toBe('A、C、D');
	});

	it('describes a choice explanation as one back mask', () => {
		const source = '### Question【A】\n- A\n- B\n**Explanation:**\nBecause A.';
		const model = buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX);
		expect(model.masks).toMatchObject([
			{ kind: 'cloze' },
			{ kind: 'back', answer: '**Explanation:**\nBecause A.' },
		]);
	});

	it('keeps a synchronized button outside the back mask', () => {
		const source = 'Front :: Back\n\n[Anki](obsidian://anki-card-link?type=nid&value=1&uid=acl-1234abcd&v=2)';
		const model = buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX);
		expect(model.masks[0]?.endLine).toBe(0);
		expect(model.masks[0]?.answer).not.toContain('obsidian://');
	});

	it('reveals the next hidden mask without looping', () => {
		const model = buildReadingReviewModel('{{c1::A}} {{c2::B}}', DEFAULT_CARD_SYNTAX);
		const once = revealNextMask(createMaskStates(model.masks), 'cloze');
		const twice = revealNextMask(once, 'cloze');
		const finished = revealNextMask(twice, 'cloze');
		expect(finished.map((state) => state.revealed)).toEqual([true, true]);
	});

	it('toggle all reveals hidden masks and then hides all', () => {
		const model = buildReadingReviewModel('{{c1::A}} {{c2::B}}', DEFAULT_CARD_SYNTAX);
		const shown = toggleAllMasks(createMaskStates(model.masks), 'cloze');
		expect(shown.every((state) => state.revealed)).toBe(true);
		expect(toggleAllMasks(shown, 'cloze').every((state) => !state.revealed)).toBe(true);
	});

	it('does not build a model when the setting is disabled', () => {
		expect(buildReadingReviewModel('Q :: A', DEFAULT_CARD_SYNTAX, false)).toEqual({ cards: [], masks: [] });
	});

	it('uses one implicit Cloze card when an unmarked file also contains Basic syntax', () => {
		const source = 'Q1 :: A1\n\nQ2 {{c1::A2}}';
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => mask.answer)).toEqual(['A2']);
	});

	it('supports Chinese emoji and mixed characters', () => {
		const model = buildReadingReviewModel('状态 {{c1::正常✅}} and {{c2::ready就绪}}', DEFAULT_CARD_SYNTAX);
		expect(model.masks.map((mask) => mask.answer)).toEqual(['正常✅', 'ready就绪']);
	});

	it('does not create an empty choice back mask', () => {
		const model = buildReadingReviewModel('### Question【A】\n- A\n- B', DEFAULT_CARD_SYNTAX);
		expect(model.masks.filter((mask) => mask.kind === 'back')).toHaveLength(0);
	});

	it('keeps localized command IDs unique across language re-registration', () => {
		expect(new Set(LOCALIZED_COMMAND_IDS).size).toBe(LOCALIZED_COMMAND_IDS.length);
		expect(LOCALIZED_COMMAND_IDS.slice(-4)).toEqual(READING_REVIEW_COMMAND_IDS);
		expect(LOCALIZED_COMMAND_IDS).toContain('insert-cloze-region');
	});

	it('masks only Cloze tokens inside explicit regions', () => {
		const source = `外部 {{c9::不遮挡}}\n\n${CLOZE_REGION_START}\n内部 {{c1::遮挡}}\n${CLOZE_REGION_END}`;
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => mask.answer)).toEqual(['遮挡']);
	});

	it('keeps multiple explicit regions in document reveal order', () => {
		const source = `${CLOZE_REGION_START}\n{{c1::一}} {{c2::二}}\n${CLOZE_REGION_END}\n\n${CLOZE_REGION_START}\n{{c1::三}}\n${CLOZE_REGION_END}`;
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => mask.answer)).toEqual(['一', '二', '三']);
	});

	it('does not mask fenced-code Cloze inside an explicit region', () => {
		const source = `${CLOZE_REGION_START}\n\`\`\`markdown\n{{c9::示例}}\n\`\`\`\n真实 {{c1::答案}}\n${CLOZE_REGION_END}`;
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => mask.answer)).toEqual(['答案']);
	});

	it('keeps Basic and Choice review behavior outside explicit regions', () => {
		const source = `${CLOZE_REGION_START}\n{{c1::填空}}\n${CLOZE_REGION_END}\n\n问题::答案\n\n### 题目【B】\n- A\n- B\n解析`;
		expect(buildReadingReviewModel(source, DEFAULT_CARD_SYNTAX).masks.map((mask) => [mask.cardType, mask.answer])).toEqual([
			['cloze', '填空'],
			['basic', '答案'],
			['choice', 'B'],
			['choice', '解析'],
		]);
	});
});
