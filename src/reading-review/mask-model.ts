import { parseCardsForReadingReview, type ParsedCard } from '../core/card-parser';
import type { CardSyntax } from '../core/card-syntax';
import { getFencedLines } from '../core/markdown-fence';

export type ReadingReviewMaskKind = 'cloze' | 'back';

export interface ReadingReviewMask {
	id: string;
	kind: ReadingReviewMaskKind;
	display: 'inline' | 'block';
	cardType: ParsedCard['type'];
	startLine: number;
	endLine: number;
	startColumn: number;
	endColumn: number;
	answer: string;
	matchText: string;
	hint?: string;
	renderAsCode?: boolean;
}

export interface ReadingReviewModel {
	cards: ParsedCard[];
	masks: ReadingReviewMask[];
}

export interface ReadingReviewMaskState {
	id: string;
	kind: ReadingReviewMaskKind;
	revealed: boolean;
}

const CLOZE_TOKEN = /\{\{c([1-9]\d*)::([^{}]+?)(?:::([^{}]*?))?\}\}/gu;

export function hasAnkiCardLinkTag(tags: readonly string[] | null | undefined): boolean {
	return tags?.some((tag) => tag.replace(/^#/u, '').toLowerCase() === 'anki-card-link') ?? false;
}

export function shouldProcessReadingReview(
	enabled: boolean,
	tags: readonly string[] | null | undefined,
): boolean {
	return enabled && hasAnkiCardLinkTag(tags);
}

export function buildReadingReviewModel(
	markdown: string,
	syntax: CardSyntax,
	enabled = true,
): ReadingReviewModel {
	if (!enabled) {
		return { cards: [], masks: [] };
	}
	const cards = parseCardsForReadingReview(markdown, syntax);
	const masks = cards
		.flatMap((card, cardIndex) => buildCardMasks(markdown, card, cardIndex))
		.sort((left, right) => left.startLine - right.startLine || left.startColumn - right.startColumn);
	return { cards, masks };
}

export function createMaskStates(masks: readonly ReadingReviewMask[]): ReadingReviewMaskState[] {
	return masks.map(({ id, kind }) => ({ id, kind, revealed: false }));
}

export function revealNextMask(
	states: readonly ReadingReviewMaskState[],
	kind: ReadingReviewMaskKind,
): ReadingReviewMaskState[] {
	const index = states.findIndex((state) => state.kind === kind && !state.revealed);
	return states.map((state, stateIndex) => stateIndex === index ? { ...state, revealed: true } : state);
}

export function toggleAllMasks(
	states: readonly ReadingReviewMaskState[],
	kind: ReadingReviewMaskKind,
): ReadingReviewMaskState[] {
	const matching = states.filter((state) => state.kind === kind);
	const reveal = matching.some((state) => !state.revealed);
	return states.map((state) => state.kind === kind ? { ...state, revealed: reveal } : state);
}

function buildCardMasks(markdown: string, card: ParsedCard, cardIndex: number): ReadingReviewMask[] {
	if (card.type === 'cloze') {
		return buildClozeMasks(markdown, card, cardIndex);
	}
	if (card.type === 'choice') {
		const masks: ReadingReviewMask[] = [];
		const heading = getLine(markdown, card.startLine);
		const startColumn = card.answerStartColumn ?? Math.max(0, heading.indexOf('【') + 1);
		const endColumn = card.answerEndColumn ?? heading.indexOf('】', startColumn);
		if (endColumn >= startColumn) {
			masks.push({
				id: `card-${cardIndex}-choice-answer`,
				kind: 'cloze',
				display: 'inline',
				cardType: 'choice',
				startLine: card.startLine,
				endLine: card.startLine,
				startColumn,
				endColumn,
				answer: heading.slice(startColumn, endColumn),
				matchText: `【${heading.slice(startColumn, endColumn)}】`,
			});
		}
		if (card.back.length > 0 && card.backStartLine !== undefined) {
			masks.push(buildBackMask(card, cardIndex, card.backStartLine, 0));
		}
		return masks;
	}
	if (card.backStartLine === undefined || card.backStartColumn === undefined) {
		return [];
	}
	return [buildBackMask(card, cardIndex, card.backStartLine, card.backStartColumn)];
}

function buildBackMask(
	card: Exclude<ParsedCard, { type: 'cloze' }>,
	cardIndex: number,
	startLine: number,
	startColumn: number,
): ReadingReviewMask {
	const lines = card.back.split('\n');
	return {
		id: `card-${cardIndex}-back`,
		kind: 'back',
		display: card.type === 'basic' && startLine === card.startLine ? 'inline' : 'block',
		cardType: card.type,
		startLine,
		endLine: card.contentEndLine,
		startColumn,
		endColumn: lines.length === 1 ? startColumn + (lines[0]?.length ?? 0) : (lines.at(-1)?.length ?? 0),
		answer: card.back,
		matchText: card.back,
	};
}

function buildClozeMasks(markdown: string, card: Extract<ParsedCard, { type: 'cloze' }>, cardIndex: number): ReadingReviewMask[] {
	const lines = markdown.split(/\r?\n/u);
	const fencedLines = getFencedLines(lines);
	const content = lines.slice(card.contentStartLine, card.contentEndLine + 1).join('\n');
	const masks: ReadingReviewMask[] = [];
	CLOZE_TOKEN.lastIndex = 0;
	for (const match of content.matchAll(CLOZE_TOKEN)) {
		const raw = match[0];
		const answer = match[2];
		if (answer === undefined) {
			continue;
		}
		const start = getPositionAtOffset(content, match.index);
		const end = getPositionAtOffset(content, match.index + raw.length);
		const startLine = card.contentStartLine + start.line;
		const endLine = card.contentStartLine + end.line;
		masks.push({
			id: `card-${cardIndex}-cloze-${masks.length}`,
			kind: 'cloze',
			display: startLine === endLine ? 'inline' : 'block',
			cardType: 'cloze',
			startLine,
			endLine,
			startColumn: start.column,
			endColumn: end.column,
			answer,
			matchText: raw,
			hint: match[3]?.trim() || undefined,
			renderAsCode: fencedLines.has(startLine) || undefined,
		});
	}
	return masks;
}

function getPositionAtOffset(value: string, offset: number): { line: number; column: number } {
	const before = value.slice(0, offset);
	const line = before.split('\n').length - 1;
	const lastBreak = before.lastIndexOf('\n');
	return { line, column: offset - lastBreak - 1 };
}

function getLine(markdown: string, line: number): string {
	return markdown.split(/\r?\n/u)[line] ?? '';
}
