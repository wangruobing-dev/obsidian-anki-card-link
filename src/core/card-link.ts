import { isCardUid } from './card-identity';
import type { ParsedCard } from './card-parser';
import { hasUnclosedCodeFence } from './markdown-fence';
import { buildObsidianUri, OPEN_ANKI_PROTOCOL_ACTION } from './uri-parser';
import { AnkiCardLinkError } from '../types';

export interface ParsedCardLink {
	line: number;
	label: string;
	noteId: number;
	uid?: string;
	version?: number;
	url: string;
}

export function parseCardLinkLine(line: string, lineNumber = 0): ParsedCardLink | undefined {
	const markdownLink = /^\s*\[((?:\\.|[^\]])*)\]\((.+)\)\s*$/u.exec(line);
	if (markdownLink?.[1] === undefined || markdownLink[2] === undefined) {
		return undefined;
	}
	let url: URL;
	try {
		url = new URL(markdownLink[2].trim());
	} catch {
		return undefined;
	}
	if (url.protocol !== 'obsidian:' || url.hostname !== OPEN_ANKI_PROTOCOL_ACTION) {
		return undefined;
	}
	if (url.searchParams.get('type') !== 'nid') {
		return undefined;
	}
	const rawNoteId = url.searchParams.get('value');
	if (rawNoteId === null || !/^\d+$/u.test(rawNoteId)) {
		return undefined;
	}
	const rawUid = url.searchParams.get('uid');
	if (rawUid !== null && !isCardUid(rawUid)) {
		return undefined;
	}
	const rawVersion = url.searchParams.get('v');
	return {
		line: lineNumber,
		label: markdownLink[1].replaceAll('\\[', '[').replaceAll('\\]', ']'),
		noteId: Number(rawNoteId),
		uid: rawUid ?? undefined,
		version: rawVersion === null ? undefined : Number(rawVersion),
		url: markdownLink[2].trim(),
	};
}

export function buildCardLink(noteId: number, uid: string, label: string): string {
	if (!Number.isSafeInteger(noteId) || noteId <= 0) {
		throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', `Invalid Anki note ID: ${noteId}.`);
	}
	if (!isCardUid(uid)) {
		throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', `Invalid card UID: ${uid}.`);
	}
	const safeLabel = label.trim().replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
	if (safeLabel.length === 0) {
		throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', 'Card link label cannot be empty.');
	}
	return `[${safeLabel}](${buildObsidianUri('nid', String(noteId), { uid, version: 2 })})`;
}

export function ensureCardLink(
	markdown: string,
	card: ParsedCard,
	identity: { uid: string; noteId: number },
	label: string,
): string {
	const lines = markdown.split(/\r?\n/u);
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n';
	const contentLines = card.type === 'cloze' && card.explicitRegion
		? lines.slice(card.startLine, (card.clozeRegionEndLine ?? card.contentEndLine) + 1)
		: card.type === 'cloze'
			? card.content.split('\n')
			: lines.slice(card.startLine, card.contentEndLine + 1);
	if (card.legacyBlockIdInline && card.legacyBlockId !== undefined) {
		const lastIndex = contentLines.length - 1;
		contentLines[lastIndex] = (contentLines[lastIndex] ?? '').replace(
			new RegExp(`\\s+\\^${escapeRegExp(card.legacyBlockId)}$`, 'u'),
			'',
		);
	}
	if (card.type !== 'cloze' && hasUnclosedCodeFence(contentLines, 0, contentLines.length)) {
		contentLines.push('```');
	}
	const replacement = [...contentLines, '', buildCardLink(identity.noteId, identity.uid, label)];
	lines.splice(card.startLine, card.endLine - card.startLine + 1, ...replacement);
	return lines.join(lineEnding);
}

/** @deprecated 使用 ensureCardLink。 */
export function ensureAnkiNoteLink(markdown: string, card: ParsedCard, noteId: number, label: string): string {
	const uid = card.uid ?? card.legacyBlockId;
	if (uid === undefined) {
		throw new AnkiCardLinkError('CARD_LINK_WRITE_FAILED', 'Card UID is missing.');
	}
	return ensureCardLink(markdown, card, { uid, noteId }, label);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
