import { findObsidianImageEmbeds } from './anki-media';

/** 将第一版支持的 Markdown 文本转换为安全、简单的 Anki HTML。 */
export function toAnkiHtml(markdown: string, imageMedia?: ReadonlyMap<string, string>): string {
	const lines = markdown.split(/\r?\n/u);
	const parts: string[] = [];
	const normalLines: string[] = [];
	let codeBlock: { marker: '`' | '~'; length: number; language?: string; lines: string[] } | undefined;

	const flushNormalLines = (): void => {
		if (normalLines.length > 0) {
			parts.push(renderNormalMarkdown(normalLines.join('\n'), imageMedia));
			normalLines.length = 0;
		}
	};

	for (const line of lines) {
		const fence = /^\s*(`{3,}|~{3,})\s*([^\s`]*)\s*$/u.exec(line);
		if (codeBlock === undefined) {
			if (fence?.[1] === undefined) {
				normalLines.push(line);
				continue;
			}
			const marker = fence[1][0];
			if (marker !== '`' && marker !== '~') {
				normalLines.push(line);
				continue;
			}
			flushNormalLines();
			const rawLanguage = fence[2]?.trim();
			codeBlock = {
				marker,
				length: fence[1].length,
				language: rawLanguage !== undefined && /^[a-zA-Z0-9_-]+$/u.test(rawLanguage) ? rawLanguage : undefined,
				lines: [],
			};
			continue;
		}

		if (fence?.[1] !== undefined && fence[1][0] === codeBlock.marker && fence[1].length >= codeBlock.length) {
			parts.push(renderCodeBlock(codeBlock));
			codeBlock = undefined;
			continue;
		}
		codeBlock.lines.push(line);
	}

	if (codeBlock !== undefined) {
		parts.push(renderCodeBlock(codeBlock));
	}
	flushNormalLines();
	return parts.join('');
}

function renderNormalMarkdown(markdown: string, imageMedia?: ReadonlyMap<string, string>): string {
	const atomicHtml: string[] = [];
	const placeholder = (html: string): string => {
		const index = atomicHtml.push(html) - 1;
		return `\u0000anki-card-link-${index}\u0000`;
	};
	const tokens: Array<
		| { type: 'image'; index: number; length: number; reference: string }
		| { type: 'code'; index: number; length: number; content: string }
		| { type: 'math'; index: number; length: number; content: string }
	> = findObsidianImageEmbeds(markdown).map((embed) => ({ type: 'image', ...embed }));
	for (const match of markdown.matchAll(/(`+)([^\n]*?)\1/gu)) {
		if (match.index !== undefined) {
			tokens.push({ type: 'code', index: match.index, length: match[0].length, content: match[2] ?? '' });
		}
	}
	for (const match of markdown.matchAll(/\$\$([\s\S]*?)\$\$/gu)) {
		if (match.index !== undefined && !isOverlappingToken(tokens, match.index, match[0].length)) {
			tokens.push({ type: 'math', index: match.index, length: match[0].length, content: renderMath(match[1] ?? '', true) });
		}
	}
	for (const match of markdown.matchAll(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/gu)) {
		if (match.index !== undefined && isLikelyInlineMath(match[1] ?? '') && !isOverlappingToken(tokens, match.index, match[0].length)) {
			tokens.push({ type: 'math', index: match.index, length: match[0].length, content: renderMath(match[1] ?? '', false) });
		}
	}
	tokens.sort((left, right) => left.index - right.index || right.length - left.length);

	const parts: string[] = [];
	let offset = 0;
	for (const token of tokens) {
		if (token.index < offset) {
			continue;
		}
		parts.push(markdown.slice(offset, token.index));
		if (token.type === 'image') {
			const mediaFilename = imageMedia?.get(token.reference);
			parts.push(mediaFilename === undefined
				? markdown.slice(token.index, token.index + token.length)
				: placeholder(`<img src="${escapeHtml(mediaFilename)}">`));
		} else if (token.type === 'code') {
			parts.push(placeholder(`<code>${escapeHtml(token.content)}</code>`));
		} else {
			parts.push(placeholder(token.content));
		}
		offset = token.index + token.length;
	}
	parts.push(markdown.slice(offset));

	let html = escapeHtml(parts.join(''))
		.replace(/\*\*([^*\n]+)\*\*/gu, '<strong>$1</strong>')
		.replace(/__([^_\n]+)__/gu, '<strong>$1</strong>')
		.replace(/~~([^~\n]+)~~/gu, '<s>$1</s>')
		.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/gu, '<em>$1</em>')
		.replace(/(?<!_)_([^_\n]+)_(?!_)/gu, '<em>$1</em>');
	html = renderMarkdownBlocks(html);
	for (const [index, value] of atomicHtml.entries()) {
		html = html.replaceAll(`\u0000anki-card-link-${index}\u0000`, value);
	}
	return html;
}

function isOverlappingToken(tokens: Array<{ index: number; length: number }>, index: number, length: number): boolean {
	return tokens.some((token) => index < token.index + token.length && token.index < index + length);
}

/** Convert Markdown math delimiters to delimiters recognized by Anki's MathJax. */
function renderMath(content: string, display: boolean): string {
	const trimmed = content.trim();
	const open = display ? '\\[' : '\\('; 
	const close = display ? '\\]' : '\\)';
	const cloze = /^\{\{c(\d+)::([\s\S]*?)\}\}$/u.exec(trimmed);
	if (cloze?.[1] !== undefined && cloze[2] !== undefined) {
		const separator = cloze[2].indexOf('::');
		const answer = separator === -1 ? cloze[2] : cloze[2].slice(0, separator);
		const hint = separator === -1 ? '' : cloze[2].slice(separator + 2);
		return `{{c${cloze[1]}::${open}${answer.trim()}${close}${hint.length > 0 ? `::${hint}` : ''}}}`;
	}
	return `${open}${trimmed}${close}`;
}

function isLikelyInlineMath(content: string): boolean {
	const trimmed = content.trim();
	return trimmed.length > 0 && (/\\[a-zA-Z]+/u.test(trimmed) || /[=^_{}]/u.test(trimmed) || /^[a-zA-Z](?:\s*[+*/-]\s*[a-zA-Z0-9])?$/u.test(trimmed));
}

function renderMarkdownBlocks(markdown: string): string {
	if (markdown.length === 0) {
		return '';
	}
	const lines = markdown.split('\n');
	const result: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index] ?? '';
		const table = parseMarkdownTable(lines, index);
		if (table !== undefined) {
			result.push(renderTable(table));
			index = table.endIndex;
			continue;
		}
		const heading = /^\s{0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?\s*$/u.exec(line);
		if (heading?.[1] !== undefined && heading[2] !== undefined) {
			const level = heading[1].length;
			result.push(`<h${level}>${heading[2]}</h${level}>`);
			index += 1;
			continue;
		}
		if (/^\s{0,3}[-*_](?:\s*[-*_]){2,}\s*$/u.test(line)) {
			result.push('<hr>');
			index += 1;
			continue;
		}
		const unordered = /^\s{0,3}[-+*][ \t]+(.+)$/u.exec(line);
		if (unordered !== null) {
			const items: string[] = [];
			while (index < lines.length) {
				const item = /^\s{0,3}[-+*][ \t]+(.+)$/u.exec(lines[index] ?? '');
				if (item?.[1] === undefined) break;
				items.push(`<li>${item[1]}</li>`);
				index += 1;
			}
			result.push(`<ul>${items.join('')}</ul>`);
			continue;
		}
		const ordered = /^\s{0,3}\d+[.)][ \t]+(.+)$/u.exec(line);
		if (ordered !== null) {
			const items: string[] = [];
			while (index < lines.length) {
				const item = /^\s{0,3}\d+[.)][ \t]+(.+)$/u.exec(lines[index] ?? '');
				if (item?.[1] === undefined) break;
				items.push(`<li>${item[1]}</li>`);
				index += 1;
			}
			result.push(`<ol>${items.join('')}</ol>`);
			continue;
		}
		const quote = /^\s{0,3}&gt;[ \t]?(.*)$/u.exec(line);
		if (quote !== null) {
			const quoteLines: string[] = [];
			while (index < lines.length) {
				const quoted = /^\s{0,3}&gt;[ \t]?(.*)$/u.exec(lines[index] ?? '');
				if (quoted?.[1] === undefined) break;
				quoteLines.push(quoted[1]);
				index += 1;
			}
			result.push(`<blockquote>${quoteLines.join('<br>')}</blockquote>`);
			continue;
		}
		if (line.length === 0) {
			result.push('<br>');
			index += 1;
			continue;
		}

		const paragraph: string[] = [];
		while (index < lines.length
			&& !isMarkdownBlockStart(lines[index] ?? '')
			&& parseMarkdownTable(lines, index) === undefined) {
			paragraph.push(lines[index] ?? '');
			index += 1;
		}
		result.push(paragraph.join('<br>'));
	}
	return result.join('');
}

function isMarkdownBlockStart(line: string): boolean {
	return line.length === 0
		|| parseTableSeparator(line) !== undefined
		|| /^\s{0,3}#{1,6}[ \t]+/u.test(line)
		|| /^\s{0,3}[-*_](?:\s*[-*_]){2,}\s*$/u.test(line)
		|| /^\s{0,3}[-+*][ \t]+/u.test(line)
		|| /^\s{0,3}\d+[.)][ \t]+/u.test(line)
		|| /^\s{0,3}&gt;(?:[ \t]|$)/u.test(line);
}

interface MarkdownTable {
	header: string[];
	alignments: Array<'left' | 'center' | 'right' | undefined>;
	rows: string[][];
	endIndex: number;
}

function parseMarkdownTable(lines: string[], startIndex: number): MarkdownTable | undefined {
	const header = splitTableRow(lines[startIndex] ?? '');
	const alignments = parseTableSeparator(lines[startIndex + 1] ?? '');
	if (header === undefined || alignments === undefined || header.length !== alignments.length) {
		return undefined;
	}

	const rows: string[][] = [];
	let index = startIndex + 2;
	while (index < lines.length) {
		const row = splitTableRow(lines[index] ?? '');
		if (row === undefined) {
			break;
		}
		rows.push(normalizeTableRow(row, header.length));
		index += 1;
	}
	return { header, alignments, rows, endIndex: index };
}

function parseTableSeparator(line: string): Array<'left' | 'center' | 'right' | undefined> | undefined {
	const cells = splitTableRow(line);
	if (cells === undefined || cells.some((cell) => !/^:?-{3,}:?$/u.test(cell.trim()))) {
		return undefined;
	}
	return cells.map((cell) => {
		const trimmed = cell.trim();
		if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
		if (trimmed.endsWith(':')) return 'right';
		if (trimmed.startsWith(':')) return 'left';
		return undefined;
	});
}

function splitTableRow(line: string): string[] | undefined {
	const trimmed = line.trim();
	if (!trimmed.includes('|')) {
		return undefined;
	}
	const content = trimmed.replace(/^\|/u, '').replace(/\|$/u, '');
	const cells: string[] = [];
	let cell = '';
	for (let index = 0; index < content.length; index += 1) {
		const character = content[index] ?? '';
		if (character === '\\' && content[index + 1] === '|') {
			cell += '|';
			index += 1;
			continue;
		}
		if (character === '|') {
			cells.push(cell.trim());
			cell = '';
			continue;
		}
		cell += character;
	}
	cells.push(cell.trim());
	return cells.length >= 2 ? cells : undefined;
}

function normalizeTableRow(row: string[], columnCount: number): string[] {
	return Array.from({ length: columnCount }, (_, index) => row[index] ?? '');
}

function renderTable(table: MarkdownTable): string {
	const tableStyle = 'border-collapse: collapse; margin: 0.5em auto;';
	const cellStyle = (index: number): string => {
		const alignment = table.alignments[index];
		const textAlign = alignment === undefined ? '' : ` text-align: ${alignment};`;
		return `border: 1px solid currentColor; padding: 0.35em 0.6em;${textAlign}`;
	};
	const header = table.header.map((cell, index) => `<th style="${cellStyle(index)}">${cell}</th>`).join('');
	const body = table.rows
		.map((row) => `<tr>${row.map((cell, index) => `<td style="${cellStyle(index)}">${cell}</td>`).join('')}</tr>`)
		.join('');
	return `<table style="${tableStyle}"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function renderCodeBlock(codeBlock: { language?: string; lines: string[] }): string {
	const languageClass = codeBlock.language === undefined ? '' : ` class="language-${codeBlock.language}"`;
	return `<div style="text-align: center;"><pre style="display: inline-block; text-align: left;"><code${languageClass}>${escapeHtml(codeBlock.lines.join('\n'))}</code></pre></div>`;
}

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
