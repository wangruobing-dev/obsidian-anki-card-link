import { AnkiCardLinkError } from '../types';

export type ParsedCardType = 'basic' | 'cloze';

export interface ParsedCard {
	type: ParsedCardType;
	startLine: number;
	endLine: number;
	contentEndLine: number;
	blockId?: string;
	front?: string;
	back?: string;
	content?: string;
}

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

const BLOCK_ID = /^\^?(acl-[a-z0-9]{8})$/u;
const INLINE_BLOCK_ID = /\s+\^(acl-[a-z0-9]{8})$/u;
const ANKI_NOTE_LINK = /^\[[^\]]+\]\(obsidian:\/\/anki-card-link\?type=nid&value=\d+\)$/u;
const CLOZE_TOKEN = /\{\{c([1-9]\d*)::([^{}]+?)(?:::[^{}]*?)?\}\}/gu;
const CLOZE_MARKER = /\{\{c\d+::/u;

/**
 * 从 Markdown 中找出第一版支持的卡片。空行是多行卡片的边界。
 */
export function parseCards(markdown: string): ParsedCard[] {
	return parseCardCandidates(markdown).flatMap((candidate) =>
		candidate.card === undefined ? [] : [candidate.card],
	);
}

/**
 * 返回可同步卡片及其格式错误，让“同步全部”可以继续处理其他卡片。
 */
export function parseCardCandidates(markdown: string): CardParseCandidate[] {
	const lines = markdown.split(/\r?\n/u);
	return findLineBlocks(lines)
		.map((block) => {
			try {
				const card = parseBlock(lines, block);
				return card === null ? { ...block } : { ...block, card };
			} catch (error) {
				if (error instanceof AnkiCardLinkError) {
					return { ...block, error };
				}
				throw error;
			}
		});
}

export function findCardAtLine(markdown: string, line: number): ParsedCard | undefined {
	return parseCards(markdown).find((card) => line >= card.startLine && line <= card.endLine);
}

export function parseCardBlock(markdown: string): ParsedCard | null {
	const candidates = parseCardCandidates(markdown);
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

export function generateBlockId(randomUuid: () => string = () => crypto.randomUUID()): string {
	const compact = randomUuid().toLowerCase().replaceAll(/[^a-z0-9]/gu, '');
	if (compact.length < 8) {
		throw new AnkiCardLinkError('BLOCK_ID_WRITE_FAILED', 'Could not generate a stable card block ID.');
	}
	return `acl-${compact.slice(0, 8)}`;
}

export function addBlockId(markdown: string, card: ParsedCard, blockId = generateBlockId()): string {
	if (card.blockId !== undefined) {
		return markdown;
	}
	const lines = markdown.split(/\r?\n/u);
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n';
	const insertionLine = card.contentEndLine + 1;
	const insertion = [`^${blockId}`];
	if (hasUnclosedCodeFence(lines, card.startLine, insertionLine)) {
		insertion.unshift('```');
	}
	lines.splice(insertionLine, 0, ...insertion);
	return lines.join(lineEnding);
}

/** 判断卡片内容末尾是否仍位于 Markdown 围栏代码块中。 */
export function hasUnclosedCodeFence(lines: string[], startLine: number, endExclusive: number): boolean {
	let openingFence: { marker: '`' | '~'; length: number } | undefined;
	for (let index = startLine; index < endExclusive; index += 1) {
		const match = /^\s*(`{3,}|~{3,})/u.exec(lines[index] ?? '');
		if (match?.[1] === undefined) {
			continue;
		}
		const marker = match[1][0];
		if (marker !== '`' && marker !== '~') {
			continue;
		}
		if (openingFence === undefined) {
			openingFence = { marker, length: match[1].length };
			continue;
		}
		if (marker === openingFence.marker && match[1].length >= openingFence.length) {
			openingFence = undefined;
		}
	}
	return openingFence !== undefined;
}

export function getCardTitle(markdown: string, card: ParsedCard, fileName: string): string {
	const lines = markdown.split(/\r?\n/u);
	for (let index = card.startLine - 1; index >= 0; index -= 1) {
		const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/u.exec(lines[index] ?? '');
		if (heading?.[2] !== undefined) {
			return heading[2].trim();
		}
	}
	return fileName.replace(/\.md$/iu, '').trim();
}

function findLineBlocks(lines: string[]): LineBlock[] {
	const blocks: LineBlock[] = [];
	let startLine: number | undefined;

	for (let index = 0; index <= lines.length; index += 1) {
		const line = lines[index] ?? '';
		const isBoundary =
			index === lines.length ||
			line.trim().length === 0 ||
			/^#{1,6}\s+/u.test(line);
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

function parseBlock(lines: string[], block: LineBlock): ParsedCard | null {
	const details = getBlockContent(lines, block);
	const content = details.lines.join('\n').trim();
	if (content.length === 0) {
		return null;
	}

	if (CLOZE_MARKER.test(content)) {
		if (!hasValidCloze(content)) {
			throw new AnkiCardLinkError('INVALID_CLOZE', 'Cloze card does not contain a valid cloze deletion.');
		}
		return {
			type: 'cloze',
			startLine: block.startLine,
			endLine: details.cardEndLine,
			contentEndLine: details.contentEndLine,
			blockId: details.blockId,
			content,
		};
	}

	const separatorLines = details.lines
		.map((line, index) => (line.trim() === '?' ? index : -1))
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
			endLine: details.cardEndLine,
			contentEndLine: details.contentEndLine,
			blockId: details.blockId,
			front,
			back,
		};
	}

	const line = details.lines[0] ?? '';
	const separator = /(^|\s)::(?=\s)/u.exec(line);
	if (separator === null) {
		return null;
	}
	const offset = separator.index + (separator[1] ?? '').length;
	const front = line.slice(0, offset).trim();
	const back = [line.slice(offset + 2), ...details.lines.slice(1)].join('\n').trim();
	validateBasicFields(front, back);
	return {
		type: 'basic',
		startLine: block.startLine,
		endLine: details.cardEndLine,
		contentEndLine: details.contentEndLine,
		blockId: details.blockId,
		front,
		back,
	};
}

function getBlockContent(lines: string[], block: LineBlock): {
	lines: string[];
	contentEndLine: number;
	cardEndLine: number;
	blockId?: string;
} {
	const blockLines = lines.slice(block.startLine, block.endLine + 1);
	const finalIndex = blockLines.length - 1;
	const finalLine = blockLines[finalIndex] ?? '';
	const previousLine = blockLines[finalIndex - 1] ?? '';
	const blockIdBeforeLink = BLOCK_ID.exec(previousLine.trim());
	if (ANKI_NOTE_LINK.test(finalLine.trim()) && blockIdBeforeLink?.[1] !== undefined) {
		return {
			lines: blockLines.slice(0, -2),
			contentEndLine: block.endLine - 2,
			cardEndLine: block.endLine - 1,
			blockId: blockIdBeforeLink[1],
		};
	}
	const standaloneId = BLOCK_ID.exec(finalLine.trim());
	if (standaloneId?.[1] !== undefined) {
		return {
			lines: blockLines.slice(0, -1),
			contentEndLine: block.endLine - 1,
			cardEndLine: block.endLine,
			blockId: standaloneId[1],
		};
	}
	const inlineId = INLINE_BLOCK_ID.exec(finalLine);
	if (inlineId?.[1] !== undefined) {
		blockLines[finalIndex] = finalLine.slice(0, inlineId.index).trimEnd();
		return { lines: blockLines, contentEndLine: block.endLine, cardEndLine: block.endLine, blockId: inlineId[1] };
	}
	return { lines: blockLines, contentEndLine: block.endLine, cardEndLine: block.endLine };
}

function validateBasicFields(front: string, back: string): void {
	if (front.length === 0) {
		throw new AnkiCardLinkError('EMPTY_FRONT', 'Card front cannot be empty.');
	}
	if (back.length === 0) {
		throw new AnkiCardLinkError('EMPTY_BACK', 'Card back cannot be empty.');
	}
}
