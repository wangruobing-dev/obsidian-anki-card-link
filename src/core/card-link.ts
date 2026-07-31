import { buildMarkdownLink } from './uri-parser';
import { hasUnclosedCodeFence, type ParsedCard } from './card-parser';

const ANKI_NOTE_LINK = /^\[[^\]]+\]\(obsidian:\/\/anki-card-link\?type=nid&value=\d+\)$/u;

/**
 * 在卡片块后保留一条到 Anki 笔记的链接。已有链接会更新，不会重复追加。
 */
export function ensureAnkiNoteLink(
	markdown: string,
	card: ParsedCard,
	noteId: number,
	label: string,
): string {
	const lines = markdown.split(/\r?\n/u);
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n';
	const link = buildMarkdownLink('nid', String(noteId), label);
	let cardEndLine = card.endLine;
	if (hasUnclosedCodeFence(lines, card.startLine, card.endLine)) {
		lines.splice(cardEndLine, 0, '```');
		cardEndLine += 1;
	}
	const firstLineAfterCard = cardEndLine + 1;
	const possibleLinkLine = cardEndLine + 2;

	if (ANKI_NOTE_LINK.test(lines[firstLineAfterCard] ?? '')) {
		lines.splice(firstLineAfterCard, 0, '');
		lines[possibleLinkLine] = link;
		return lines.join(lineEnding);
	}

	if (lines[firstLineAfterCard]?.trim().length === 0 && ANKI_NOTE_LINK.test(lines[possibleLinkLine] ?? '')) {
		lines[possibleLinkLine] = link;
		return lines.join(lineEnding);
	}

	lines.splice(firstLineAfterCard, 0, '', link);
	return lines.join(lineEnding);
}
