import { isCardUid } from './card-identity';
import { parseCardLinkLine, type ParsedCardLink } from './card-link';
import { hasUnclosedCodeFence } from './markdown-fence';
import { AnkiCardLinkError } from '../types';
import { DEFAULT_CARD_SYNTAX, type CardSyntax } from './card-syntax';

export type ChoiceOptionId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type ParsedCardType = 'basic' | 'cloze' | 'choice';

interface ParsedCardBase {
	startLine: number;
	endLine: number;
	contentEndLine: number;
	uid?: string;
	noteId?: number;
	linkLine?: number;
	legacyBlockId?: string;
	legacyBlockIdInline?: boolean;
}

export interface ParsedBasicCard extends ParsedCardBase {
	type: 'basic';
	front: string;
	back: string;
	separatorLine?: number;
	separatorStartColumn?: number;
	separatorEndColumn?: number;
	backStartLine?: number;
	backStartColumn?: number;
}

export interface ParsedClozeCard extends ParsedCardBase {
	type: 'cloze';
	content: string;
}

export interface ParsedChoiceCard extends ParsedCardBase {
	type: 'choice';
	front: string;
	back: string;
	options: string[];
	correctAnswers: ChoiceOptionId[];
	answerStartColumn?: number;
	answerEndColumn?: number;
	lastOptionLine?: number;
	backStartLine?: number;
}

export type ParsedCard = ParsedBasicCard | ParsedClozeCard | ParsedChoiceCard;

export interface CardParseCandidate {
	startLine: number;
	endLine: number;
	card?: ParsedCard;
	error?: AnkiCardLinkError;
}

interface LineBlock {
	startLine: number;
	endLine: number;
}

interface BlockContent {
	lines: string[];
	contentEndLine: number;
	legacyBlockId?: string;
	legacyBlockIdInline?: boolean;
}

const BLOCK_ID = /^\^?(acl-[a-z0-9]{8})$/u;
const INLINE_BLOCK_ID = /\s+\^(acl-[a-z0-9]{8})$/u;
const CLOZE_TOKEN = /\{\{c([1-9]\d*)::([^{}]+?)(?:::[^{}]*?)?\}\}/gu;
const CLOZE_MARKER = /\{\{c\d+::/u;
const CHOICE_HEADING = /^\s{0,3}###\s+(.+?)\s*【([^】]*)】([。.!！?？]?)\s*$/u;
const CHOICE_OPTION = /^\s{0,3}-[ \t]+(.+)$/u;
const CHOICE_OPTION_PREFIX = /^\s{0,3}-[ \t]*(.*)$/u;
const TASK_LIST_OPTION = /^\s{0,3}-[ \t]+\[[ xX]\](?:[ \t]+|$)/u;
const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+/u;
const CHOICE_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export function parseCards(markdown: string, syntax: CardSyntax = DEFAULT_CARD_SYNTAX): ParsedCard[] {
	return parseCardCandidates(markdown, syntax).flatMap((candidate) =>
		candidate.card === undefined ? [] : [candidate.card],
	);
}

export function parseCardCandidates(markdown: string, syntax: CardSyntax = DEFAULT_CARD_SYNTAX): CardParseCandidate[] {
	return parseCardCandidatesInternal(markdown, true, syntax);
}

function parseCardCandidatesInternal(markdown: string, rejectDuplicateUids: boolean, syntax: CardSyntax): CardParseCandidate[] {
	const lines = markdown.split(/\r?\n/u);
	const choiceCandidates = findChoiceCandidates(lines);
	const choiceRanges = choiceCandidates.map(({ startLine, endLine }) => ({ startLine, endLine }));
	const blocks = findLineBlocks(lines);
	const candidates: CardParseCandidate[] = [...choiceCandidates];

	for (let index = 0; index < blocks.length; index += 1) {
		const originalBlock = blocks[index];
		if (originalBlock === undefined) {
			continue;
		}
		let block = originalBlock;
		if (choiceRanges.some((range) => rangesOverlap(originalBlock, range))) {
			continue;
		}
		if (getStandaloneCardLink(lines, block) !== undefined) {
			continue;
		}

		const inlineFollowingLink = block.startLine < block.endLine && !hasUnclosedCodeFence(lines, block.startLine, block.endLine)
			? parseCardLinkLine(lines[block.endLine] ?? '', block.endLine)
			: undefined;
		if (inlineFollowingLink !== undefined) {
			block = { startLine: block.startLine, endLine: block.endLine - 1 };
		}
		const nextBlock = blocks[index + 1];
		const link = nextBlock === undefined ? undefined : getStandaloneCardLink(lines, nextBlock);
		const separateLink = link !== undefined && nextBlock !== undefined && nextBlock.startLine - block.endLine <= 2
			? link
			: undefined;
		const attachedLink = inlineFollowingLink ?? separateLink;
		try {
			const card = parseBlock(lines, block, attachedLink, syntax);
			candidates.push(card === null
				? { ...block }
				: { startLine: card.startLine, endLine: card.endLine, card });
		} catch (error) {
			if (error instanceof AnkiCardLinkError) {
				candidates.push({ ...block, error });
				continue;
			}
			throw error;
		}
	}

	if (rejectDuplicateUids) {
		candidates.sort((left, right) => left.startLine - right.startLine);
		markDuplicateUids(candidates);
	}
	return candidates;
}

export function normalizeChoiceAnswers(rawAnswer: string): ChoiceOptionId[] {
	const upper = rawAnswer.toUpperCase();
	const compact = upper.replace(/[\s,，、;；/\\]+/gu, '');
	if (compact.length === 0) {
		throw new AnkiCardLinkError('CHOICE_EMPTY_ANSWER', 'Multiple-choice correct answer cannot be empty.');
	}
	if (/[^A-G]/u.test(compact)) {
		throw new AnkiCardLinkError('CHOICE_INVALID_ANSWER', 'Multiple-choice correct answer can contain only A-G and supported separators.');
	}
	const answers = [...compact] as ChoiceOptionId[];
	if (new Set(answers).size !== answers.length) {
		throw new AnkiCardLinkError('CHOICE_DUPLICATE_ANSWER', 'Multiple-choice correct answer contains a duplicate option.');
	}
	return answers.sort((left, right) => CHOICE_IDS.indexOf(left) - CHOICE_IDS.indexOf(right));
}

export function findCardAtLine(markdown: string, line: number, syntax: CardSyntax = DEFAULT_CARD_SYNTAX): ParsedCard | undefined {
	return parseCards(markdown, syntax).find((card) => line >= card.startLine && line <= card.endLine);
}

export function findCardsByUid(markdown: string, uid: string, syntax: CardSyntax = DEFAULT_CARD_SYNTAX): ParsedCard[] {
	return parseCardCandidatesInternal(markdown, false, syntax).flatMap((candidate) =>
		candidate.card?.uid === uid ? [candidate.card] : [],
	);
}

export function parseCardBlock(markdown: string, syntax: CardSyntax = DEFAULT_CARD_SYNTAX): ParsedCard | null {
	const candidates = parseCardCandidates(markdown, syntax);
	if (candidates.length !== 1) {
		return null;
	}
	const candidate = candidates[0];
	if (candidate?.error !== undefined) {
		throw candidate.error;
	}
	return candidate?.card ?? null;
}

export function hasValidCloze(value: string): boolean {
	CLOZE_TOKEN.lastIndex = 0;
	return CLOZE_TOKEN.test(value);
}

export function getClozeNumbers(value: string): number[] {
	const numbers: number[] = [];
	CLOZE_TOKEN.lastIndex = 0;
	for (const match of value.matchAll(CLOZE_TOKEN)) {
		const number = Number(match[1]);
		if (Number.isSafeInteger(number)) {
			numbers.push(number);
		}
	}
	return numbers;
}

export function getCardTitle(filePath: string): string {
	return filePath.replaceAll('\\', '/').replace(/^\/+|\.md$/giu, '').trim();
}

export { hasUnclosedCodeFence } from './markdown-fence';

function findChoiceCandidates(lines: string[]): CardParseCandidate[] {
	const candidates: CardParseCandidate[] = [];
	const fencedLines = getFencedLines(lines);
	for (let startLine = 0; startLine < lines.length; startLine += 1) {
		if (fencedLines.has(startLine)) {
			continue;
		}
		const heading = CHOICE_HEADING.exec(lines[startLine] ?? '');
		if (heading === null) {
			continue;
		}
		const candidate = parseChoiceCandidate(lines, startLine, heading);
		candidates.push(candidate);
		startLine = candidate.endLine;
	}
	return candidates;
}

function parseChoiceCandidate(lines: string[], startLine: number, heading: RegExpExecArray): CardParseCandidate {
	let optionLine = startLine + 1;
	if ((lines[optionLine] ?? '').trim().length === 0) {
		optionLine += 1;
	}
	const options: string[] = [];
	let emptyOption = false;
	let cursor = optionLine;
	while (cursor < lines.length) {
		const line = lines[cursor] ?? '';
		if (TASK_LIST_OPTION.test(line)) {
			break;
		}
		const option = CHOICE_OPTION.exec(line);
		if (option?.[1] !== undefined) {
			const value = option[1].trim();
			if (value.length === 0) {
				emptyOption = true;
				cursor += 1;
				break;
			}
			options.push(value);
			cursor += 1;
			continue;
		}
		const optionPrefix = CHOICE_OPTION_PREFIX.exec(line);
		if (optionPrefix !== null && (optionPrefix[1] ?? '').trim().length === 0) {
			emptyOption = true;
			cursor += 1;
		}
		break;
	}

	const lastOptionLine = Math.max(startLine, cursor - 1);
	let contentEndLine = lastOptionLine;
	while (cursor < lines.length) {
		const line = lines[cursor] ?? '';
		if (line.trim().length === 0 || MARKDOWN_HEADING.test(line) || parseCardLinkLine(line, cursor) !== undefined) {
			break;
		}
		contentEndLine = cursor;
		cursor += 1;
	}
	const link = findAttachedChoiceLink(lines, contentEndLine + 1);
	const endLine = link?.line ?? contentEndLine;

	try {
		if (emptyOption) {
			throw new AnkiCardLinkError('CHOICE_EMPTY_OPTION', 'Multiple-choice option content cannot be empty.');
		}
		if (options.length < 2) {
			throw new AnkiCardLinkError('CHOICE_TOO_FEW_OPTIONS', 'Multiple-choice card must contain at least 2 options.');
		}
		if (options.length > 7) {
			throw new AnkiCardLinkError('CHOICE_TOO_MANY_OPTIONS', 'Multiple-choice card cannot contain more than 7 options.');
		}
		const correctAnswers = normalizeChoiceAnswers(heading[2] ?? '');
		const highestAnswer = Math.max(...correctAnswers.map((answer) => CHOICE_IDS.indexOf(answer)));
		if (highestAnswer >= options.length) {
			throw new AnkiCardLinkError('CHOICE_ANSWER_OUT_OF_RANGE', 'Multiple-choice correct answer is outside the available option range.');
		}
		const question = (heading[1] ?? '').trim();
		const punctuation = heading[3] ?? '';
		const backStartLine = lastOptionLine + 1;
		const back = contentEndLine >= backStartLine
			? lines.slice(backStartLine, contentEndLine + 1).join('\n').trim()
			: '';
		const card: ParsedChoiceCard = {
			type: 'choice',
			startLine,
			endLine,
			contentEndLine,
			front: `${question}【\u3000】${punctuation}`,
			back,
			options,
			correctAnswers,
			answerStartColumn: heading[0].indexOf('【') + 1,
			answerEndColumn: heading[0].indexOf('】'),
			lastOptionLine,
			backStartLine: back.length > 0 ? backStartLine : undefined,
			uid: link?.uid,
			noteId: link?.noteId,
			linkLine: link?.line,
		};
		return { startLine, endLine, card };
	} catch (error) {
		if (error instanceof AnkiCardLinkError) {
			return { startLine, endLine, error };
		}
		throw error;
	}
}

function findAttachedChoiceLink(lines: string[], startLine: number): ParsedCardLink | undefined {
	const direct = parseCardLinkLine(lines[startLine] ?? '', startLine);
	if (direct !== undefined) {
		return direct;
	}
	if ((lines[startLine] ?? '').trim().length === 0) {
		return parseCardLinkLine(lines[startLine + 1] ?? '', startLine + 1);
	}
	return undefined;
}

function getFencedLines(lines: string[]): Set<number> {
	const fenced = new Set<number>();
	let openingFence: { marker: '`' | '~'; length: number } | undefined;
	for (let index = 0; index < lines.length; index += 1) {
		const match = /^\s*(`{3,}|~{3,})/u.exec(lines[index] ?? '');
		if (openingFence !== undefined) {
			fenced.add(index);
		}
		if (match?.[1] === undefined) {
			continue;
		}
		const marker = match[1][0];
		if (marker !== '`' && marker !== '~') {
			continue;
		}
		if (openingFence === undefined) {
			openingFence = { marker, length: match[1].length };
			fenced.add(index);
		} else if (marker === openingFence.marker && match[1].length >= openingFence.length) {
			openingFence = undefined;
		}
	}
	return fenced;
}

function rangesOverlap(left: LineBlock, right: LineBlock): boolean {
	return left.startLine <= right.endLine && right.startLine <= left.endLine;
}

function findLineBlocks(lines: string[]): LineBlock[] {
	const blocks: LineBlock[] = [];
	let startLine: number | undefined;
	let fence: { marker: '`' | '~'; length: number } | undefined;

	for (let index = 0; index <= lines.length; index += 1) {
		const line = lines[index] ?? '';
		const fenceMatch = /^\s*(`{3,}|~{3,})/u.exec(line);
		const wasInsideFence = fence !== undefined;
		if (fenceMatch?.[1] !== undefined) {
			const marker = fenceMatch[1][0];
			if (marker === '`' || marker === '~') {
				if (fence === undefined) {
					fence = { marker, length: fenceMatch[1].length };
				} else if (marker === fence.marker && fenceMatch[1].length >= fence.length) {
					fence = undefined;
				}
			}
		}
		const isBoundary = index === lines.length || (!wasInsideFence && fence === undefined && (
			line.trim().length === 0 || /^#{1,6}\s+/u.test(line)
		));
		if (!isBoundary) {
			startLine ??= index;
			continue;
		}
		if (startLine !== undefined) {
			blocks.push({ startLine, endLine: index - 1 });
			startLine = undefined;
		}
	}
	return blocks;
}

function getStandaloneCardLink(lines: string[], block: LineBlock): ParsedCardLink | undefined {
	if (block.startLine !== block.endLine) {
		return undefined;
	}
	return parseCardLinkLine(lines[block.startLine] ?? '', block.startLine);
}

function parseBlock(lines: string[], block: LineBlock, link: ParsedCardLink | undefined, syntax: CardSyntax): ParsedCard | null {
	const details = getBlockContent(lines, block);
	const content = details.lines.join('\n').trim();
	if (content.length === 0) {
		return null;
	}
	if (link?.uid !== undefined && details.legacyBlockId !== undefined && link.uid !== details.legacyBlockId) {
		throw new AnkiCardLinkError('INVALID_CARD', 'Card link UID does not match the legacy block ID.');
	}
	const identity = {
		uid: link?.uid ?? details.legacyBlockId,
		noteId: link?.noteId,
		linkLine: link?.line,
		legacyBlockId: details.legacyBlockId,
		legacyBlockIdInline: details.legacyBlockIdInline,
	};
	const endLine = link?.line ?? block.endLine;

	if (CLOZE_MARKER.test(content)) {
		if (!hasValidCloze(content)) {
			throw new AnkiCardLinkError('INVALID_CLOZE', 'Cloze card does not contain a valid cloze deletion.');
		}
		return { type: 'cloze', startLine: block.startLine, endLine, contentEndLine: details.contentEndLine, content, ...identity };
	}

	const separatorLines = details.lines
		.map((line, index) => (syntax.multiLineSeparators.includes(line.trim()) ? index : -1))
		.filter((index) => index >= 0);
	if (separatorLines.length === 1) {
		const separator = separatorLines[0];
		if (separator === undefined) {
			return null;
		}
		const front = details.lines.slice(0, separator).join('\n').trim();
		const back = details.lines.slice(separator + 1).join('\n').trim();
		validateBasicFields(front, back);
		return {
			type: 'basic',
			startLine: block.startLine,
			endLine,
			contentEndLine: details.contentEndLine,
			front,
			back,
			separatorLine: block.startLine + separator,
			separatorStartColumn: 0,
			separatorEndColumn: details.lines[separator]?.length ?? 0,
			backStartLine: block.startLine + separator + 1,
			backStartColumn: 0,
			...identity,
		};
	}

	const firstLine = details.lines[0] ?? '';
	const separator = findSingleLineSeparator(firstLine, syntax.singleLineSeparators);
	if (separator === undefined) {
		return null;
	}
	const front = firstLine.slice(0, separator.index).trim();
	const rawFirstBackLine = firstLine.slice(separator.index + separator.value.length);
	const back = [rawFirstBackLine, ...details.lines.slice(1)].join('\n').trim();
	const leadingBackWhitespace = rawFirstBackLine.length - rawFirstBackLine.trimStart().length;
	validateBasicFields(front, back);
	return {
		type: 'basic',
		startLine: block.startLine,
		endLine,
		contentEndLine: details.contentEndLine,
		front,
		back,
		separatorLine: block.startLine,
		separatorStartColumn: separator.index,
		separatorEndColumn: separator.index + separator.value.length,
		backStartLine: block.startLine,
		backStartColumn: separator.index + separator.value.length + leadingBackWhitespace,
		...identity,
	};
}

function findSingleLineSeparator(line: string, separators: readonly string[]): { index: number; value: string } | undefined {
	let result: { index: number; value: string } | undefined;
	for (const value of separators) {
		const index = line.indexOf(value);
		if (index >= 0 && (result === undefined || index < result.index || (index === result.index && value.length > result.value.length))) {
			result = { index, value };
		}
	}
	return result;
}

function getBlockContent(lines: string[], block: LineBlock): BlockContent {
	const blockLines = lines.slice(block.startLine, block.endLine + 1);
	const finalIndex = blockLines.length - 1;
	const finalLine = blockLines[finalIndex] ?? '';
	const standaloneId = BLOCK_ID.exec(finalLine.trim());
	if (standaloneId?.[1] !== undefined && isCardUid(standaloneId[1])) {
		return {
			lines: blockLines.slice(0, -1),
			contentEndLine: block.endLine - 1,
			legacyBlockId: standaloneId[1],
			legacyBlockIdInline: false,
		};
	}
	const inlineId = INLINE_BLOCK_ID.exec(finalLine);
	if (inlineId?.[1] !== undefined && isCardUid(inlineId[1])) {
		blockLines[finalIndex] = finalLine.slice(0, inlineId.index).trimEnd();
		return {
			lines: blockLines,
			contentEndLine: block.endLine,
			legacyBlockId: inlineId[1],
			legacyBlockIdInline: true,
		};
	}
	return { lines: blockLines, contentEndLine: block.endLine };
}

function validateBasicFields(front: string, back: string): void {
	if (front.length === 0) {
		throw new AnkiCardLinkError('EMPTY_FRONT', 'Card front cannot be empty.');
	}
	if (back.length === 0) {
		throw new AnkiCardLinkError('EMPTY_BACK', 'Card back cannot be empty.');
	}
}

function markDuplicateUids(candidates: CardParseCandidate[]): void {
	const counts = new Map<string, number>();
	for (const candidate of candidates) {
		const uid = candidate.card?.uid;
		if (uid !== undefined) {
			counts.set(uid, (counts.get(uid) ?? 0) + 1);
		}
	}
	for (const candidate of candidates) {
		const uid = candidate.card?.uid;
		if (uid !== undefined && (counts.get(uid) ?? 0) > 1) {
			candidate.card = undefined;
			candidate.error = new AnkiCardLinkError('DUPLICATE_CARD_UID', `More than one card in this file uses UID ${uid}.`);
		}
	}
}
