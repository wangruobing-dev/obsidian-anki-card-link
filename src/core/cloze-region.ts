import { getFencedLines } from './markdown-fence';
import type { ErrorCode } from '../types';

export const CLOZE_REGION_START = '<!-- anki-card-link:cloze:start -->';
export const CLOZE_REGION_END = '<!-- anki-card-link:cloze:end -->';
export const CLOZE_REGION_MARKER = '<!-- anki-card-link:cloze -->';

const START_MARKER = /^\s*<!--\s*anki-card-link:cloze:start\s*-->\s*$/u;
const END_MARKER = /^\s*<!--\s*anki-card-link:cloze:end\s*-->\s*$/u;
const REGION_MARKER = /^\s*<!--\s*anki-card-link:cloze\s*-->\s*$/u;
const CLOZE_TOKEN = /\{\{c([1-9]\d*)::([^{}]+?)(?:::[^{}]*?)?\}\}/gu;

export interface ClozeRegionMarker {
	kind: 'start' | 'end' | 'region';
	line: number;
}

export interface ClozeRegion {
	style: 'paired' | 'single';
	startLine: number;
	endLine: number;
	contentStartLine: number;
	contentEndLine: number;
	content: string;
}

export interface ClozeRegionIssue {
	code: Extract<ErrorCode,
		| 'CLOZE_REGION_UNMATCHED_START'
		| 'CLOZE_REGION_UNMATCHED_END'
		| 'CLOZE_REGION_NESTED'
		| 'CLOZE_REGION_EMPTY'
		| 'CLOZE_REGION_NO_CLOZE'>;
	startLine: number;
	endLine: number;
}

export interface ClozeRegionScan {
	explicitMode: boolean;
	markers: ClozeRegionMarker[];
	regions: ClozeRegion[];
	issues: ClozeRegionIssue[];
	protectedRanges: Array<{ startLine: number; endLine: number }>;
}

export interface ClozeScope {
	text: string;
	beforeCursor: string;
	startLine: number;
	endLine: number;
	explicitRegion: boolean;
}

export function findClozeRegionMarkers(markdown: string): ClozeRegionMarker[] {
	const lines = markdown.split(/\r?\n/u);
	const fencedLines = getFencedLines(lines);
	const markers: ClozeRegionMarker[] = [];
	for (let line = 0; line < lines.length; line += 1) {
		if (fencedLines.has(line)) {
			continue;
		}
		const value = lines[line] ?? '';
		if (START_MARKER.test(value)) {
			markers.push({ kind: 'start', line });
		} else if (END_MARKER.test(value)) {
			markers.push({ kind: 'end', line });
		} else if (REGION_MARKER.test(value)) {
			markers.push({ kind: 'region', line });
		}
	}
	return markers;
}

export function isClozeRegionMarkerLine(value: string): boolean {
	return START_MARKER.test(value) || END_MARKER.test(value) || REGION_MARKER.test(value);
}

export function parseClozeRegions(markdown: string): ClozeRegionScan {
	const lines = markdown.split(/\r?\n/u);
	const fencedLines = getFencedLines(lines);
	const markers = findClozeRegionMarkers(markdown);
	const regions: ClozeRegion[] = [];
	const issues: ClozeRegionIssue[] = [];
	const protectedRanges: Array<{ startLine: number; endLine: number }> = [];
	let openLine: number | undefined;
	let nested = false;

	for (const marker of markers.filter((item) => item.kind !== 'region')) {
		if (marker.kind === 'start') {
			if (openLine === undefined) {
				openLine = marker.line;
				nested = false;
			} else {
				nested = true;
			}
			continue;
		}

		if (openLine === undefined) {
			issues.push({ code: 'CLOZE_REGION_UNMATCHED_END', startLine: marker.line, endLine: marker.line });
			protectedRanges.push({ startLine: marker.line, endLine: marker.line });
			continue;
		}

		const range = { startLine: openLine, endLine: marker.line };
		protectedRanges.push(range);
		if (nested) {
			issues.push({ code: 'CLOZE_REGION_NESTED', ...range });
		} else {
			const contentRange = trimLineRange(lines, openLine + 1, marker.line - 1);
			if (contentRange === undefined) {
				issues.push({ code: 'CLOZE_REGION_EMPTY', ...range });
			} else if (!hasValidClozeInRange(lines, contentRange.startLine, contentRange.endLine, fencedLines)) {
				issues.push({ code: 'CLOZE_REGION_NO_CLOZE', ...range });
			} else {
				regions.push({
					style: 'paired',
					...range,
					contentStartLine: contentRange.startLine,
					contentEndLine: contentRange.endLine,
					content: lines.slice(contentRange.startLine, contentRange.endLine + 1).join('\n'),
				});
			}
		}
		openLine = undefined;
		nested = false;
	}

	if (openLine !== undefined) {
		const range = { startLine: openLine, endLine: Math.max(openLine, lines.length - 1) };
		protectedRanges.push(range);
		issues.push({ code: nested ? 'CLOZE_REGION_NESTED' : 'CLOZE_REGION_UNMATCHED_START', ...range });
	}

	const pairedRanges = [...protectedRanges];
	const singleMarkers = markers.filter((marker) =>
		marker.kind === 'region'
		&& !pairedRanges.some((range) => marker.line >= range.startLine && marker.line <= range.endLine),
	);
	if (singleMarkers.length > 0) {
		const body = getMarkdownBodyRange(lines);
		if (body !== undefined) {
			const excludedLines = new Set(singleMarkers.map((marker) => marker.line));
			for (const range of pairedRanges) {
				for (let line = range.startLine; line <= range.endLine; line += 1) {
					excludedLines.add(line);
				}
			}

			let segmentStart = body.startLine;
			for (let line = body.startLine; line <= body.endLine + 1; line += 1) {
				const boundary = line > body.endLine || excludedLines.has(line);
				if (!boundary) {
					continue;
				}
				addSingleMarkerSegment(lines, fencedLines, segmentStart, line - 1, regions, protectedRanges);
				segmentStart = line + 1;
			}
		}
		for (const marker of singleMarkers) {
			protectedRanges.push({ startLine: marker.line, endLine: marker.line });
		}
	}
	regions.sort((left, right) => left.startLine - right.startLine);
	issues.sort((left, right) => left.startLine - right.startLine);
	protectedRanges.sort((left, right) => left.startLine - right.startLine);

	return {
		explicitMode: markers.length > 0,
		markers,
		regions,
		issues,
		protectedRanges,
	};
}

function addSingleMarkerSegment(
	lines: readonly string[],
	fencedLines: ReadonlySet<number>,
	startLine: number,
	endLine: number,
	regions: ClozeRegion[],
	protectedRanges: Array<{ startLine: number; endLine: number }>,
): void {
	const contentRange = trimLineRange(lines, startLine, endLine);
	if (contentRange === undefined
		|| !hasValidClozeInRange(lines, contentRange.startLine, contentRange.endLine, fencedLines)) {
		return;
	}
	const range = { startLine: contentRange.startLine, endLine: contentRange.endLine };
	protectedRanges.push(range);
	regions.push({
		style: 'single',
		...range,
		contentStartLine: contentRange.startLine,
		contentEndLine: contentRange.endLine,
		content: lines.slice(contentRange.startLine, contentRange.endLine + 1).join('\n'),
	});
}

export function findClozeRegionAtLine(markdown: string, line: number): ClozeRegion | undefined {
	return parseClozeRegions(markdown).regions.find((region) => line >= region.startLine && line <= region.endLine);
}

export function buildClozeRegionWrapper(selection: string, lineEnding: '\n' | '\r\n'): string {
	if (selection.length === 0) {
		return `${CLOZE_REGION_MARKER}${lineEnding}`;
	}
	return `${CLOZE_REGION_MARKER}${lineEnding}${lineEnding}${selection}`;
}

export function getClozeScopeAtOffset(markdown: string, offset: number): ClozeScope | undefined {
	const lines = markdown.split(/\r?\n/u);
	const line = offsetToLine(markdown, offset);
	const scan = parseClozeRegions(markdown);
	if (scan.explicitMode) {
		const region = scan.regions.find((item) => line >= item.contentStartLine && line <= item.contentEndLine);
		if (region === undefined) {
			return undefined;
		}
		return buildScope(markdown, lines, region.contentStartLine, region.contentEndLine, offset, true);
	}
	const body = getMarkdownBodyRange(lines);
	if (body === undefined) {
		return undefined;
	}
	return buildScope(markdown, lines, body.startLine, body.endLine, offset, false);
}

export function hasValidClozeOutsideFences(lines: readonly string[], startLine = 0, endLine = lines.length - 1): boolean {
	return hasValidClozeInRange(lines, startLine, endLine, getFencedLines(lines));
}

export function getMarkdownBodyRange(lines: readonly string[]): { startLine: number; endLine: number } | undefined {
	let startLine = 0;
	if ((lines[0] ?? '').trim() === '---') {
		const closing = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/u.test(line));
		if (closing >= 0) {
			startLine = closing + 1;
		}
	}
	return trimLineRange(lines, startLine, lines.length - 1);
}

export function stripFencedLines(value: string): string {
	const lines = value.split(/\r?\n/u);
	const fencedLines = getFencedLines(lines);
	return lines.map((line, index) => fencedLines.has(index) ? '' : line).join('\n');
}

function buildScope(
	markdown: string,
	lines: readonly string[],
	startLine: number,
	endLine: number,
	offset: number,
	explicitRegion: boolean,
): ClozeScope {
	const startOffset = lineStartOffset(markdown, startLine);
	const endOffset = lineEndOffset(markdown, endLine);
	const safeOffset = Math.max(startOffset, Math.min(offset, endOffset));
	return {
		text: stripFencedLines(lines.slice(startLine, endLine + 1).join('\n')),
		beforeCursor: stripFencedLines(markdown.slice(startOffset, safeOffset)),
		startLine,
		endLine,
		explicitRegion,
	};
}

function hasValidClozeInRange(
	lines: readonly string[],
	startLine: number,
	endLine: number,
	fencedLines: ReadonlySet<number>,
): boolean {
	for (let line = startLine; line <= endLine; line += 1) {
		if (fencedLines.has(line)) {
			continue;
		}
		CLOZE_TOKEN.lastIndex = 0;
		if (CLOZE_TOKEN.test(lines[line] ?? '')) {
			return true;
		}
	}
	return false;
}

function trimLineRange(
	lines: readonly string[],
	startLine: number,
	endLine: number,
): { startLine: number; endLine: number } | undefined {
	let start = startLine;
	let end = endLine;
	while (start <= end && (lines[start] ?? '').trim().length === 0) start += 1;
	while (end >= start && (lines[end] ?? '').trim().length === 0) end -= 1;
	return start <= end ? { startLine: start, endLine: end } : undefined;
}

function offsetToLine(markdown: string, offset: number): number {
	return markdown.slice(0, Math.max(0, Math.min(offset, markdown.length))).split(/\r?\n/u).length - 1;
}

function lineStartOffset(markdown: string, line: number): number {
	let offset = 0;
	for (let index = 0; index < line; index += 1) {
		const next = markdown.indexOf('\n', offset);
		if (next < 0) return markdown.length;
		offset = next + 1;
	}
	return offset;
}

function lineEndOffset(markdown: string, line: number): number {
	const start = lineStartOffset(markdown, line);
	const next = markdown.indexOf('\n', start);
	return next < 0 ? markdown.length : next;
}
