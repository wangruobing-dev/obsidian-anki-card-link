import { getClozeNumbers } from './card-parser';
import {
	buildClozeRegionWrapper,
	parseClozeRegions,
} from './cloze-region';

export type ClozeNumberMode = 'next' | 'current';

export function getClozeNumber(cardText: string, mode: ClozeNumberMode, beforeCursorText = cardText): number {
	const numbers = getClozeNumbers(mode === 'current' ? beforeCursorText : cardText);
	if (numbers.length === 0) {
		return 1;
	}
	if (mode === 'current') {
		return numbers[numbers.length - 1] ?? 1;
	}
	return Math.max(...numbers) + 1;
}

export type ClozeRegionInsertionFailure = 'inside-region' | 'overlap-region';

export type ClozeRegionInsertionResult = {
	ok: true;
	markdown: string;
	selectionStart: number;
	selectionEnd: number;
} | {
	ok: false;
	reason: ClozeRegionInsertionFailure;
};

export function insertClozeRegion(
	markdown: string,
	selectionStart: number,
	selectionEnd: number,
): ClozeRegionInsertionResult {
	const start = Math.max(0, Math.min(selectionStart, selectionEnd, markdown.length));
	const end = Math.max(start, Math.min(Math.max(selectionStart, selectionEnd), markdown.length));
	const scan = parseClozeRegions(markdown);
	const startLine = offsetToLine(markdown, start);
	const endLine = offsetToLine(markdown, Math.max(start, end - 1));
	if (start !== end && /(^|\r?\n)\s*<!--\s*anki-card-link:cloze:(?:start|end)\s*-->\s*(?=\r?\n|$)/u.test(markdown.slice(start, end))) {
		return { ok: false, reason: 'overlap-region' };
	}
	if (start === end) {
		if (scan.protectedRanges.some((range) => startLine >= range.startLine && startLine <= range.endLine)) {
			return { ok: false, reason: 'inside-region' };
		}
	} else if (scan.protectedRanges.some((range) => startLine <= range.endLine && range.startLine <= endLine)) {
		return { ok: false, reason: 'overlap-region' };
	}

	const lineEnding: '\n' | '\r\n' = markdown.includes('\r\n') ? '\r\n' : '\n';
	const selection = markdown.slice(start, end);
	const before = start > 0 && markdown[start - 1] !== '\n' ? lineEnding : '';
	const nextCharacter = markdown[end];
	const after = end < markdown.length && nextCharacter !== '\n' && nextCharacter !== '\r' ? lineEnding : '';
	const wrapper = buildClozeRegionWrapper(selection, lineEnding);
	const replacement = `${before}${wrapper}${after}`;
	const markerEnd = start + before.length + '<!-- anki-card-link:cloze:start -->'.length;
	const contentStart = markerEnd + (selection.length === 0 ? lineEnding.length : lineEnding.length * 2);
	const contentEnd = contentStart + selection.length;
	return {
		ok: true,
		markdown: `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`,
		selectionStart: contentStart,
		selectionEnd: contentEnd,
	};
}

export function buildClozeReplacement(selection: string, number: number): string {
	return `{{c${number}::${selection}}}`;
}

export function getClozeContentCursorOffset(number: number): number {
	return `{{c${number}::`.length;
}

function offsetToLine(markdown: string, offset: number): number {
	return markdown.slice(0, offset).split(/\r?\n/u).length - 1;
}
