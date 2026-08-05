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
	const parts: string[] = [];
	let offset = 0;
	for (const match of markdown.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|(`+)([^\n]*?)\2/gu)) {
		const matchIndex = match.index;
		if (matchIndex === undefined) {
			continue;
		}
		parts.push(markdown.slice(offset, matchIndex));
		const source = match[1]?.trim();
		if (source !== undefined) {
			const mediaFilename = imageMedia?.get(source);
			parts.push(mediaFilename === undefined ? match[0] : placeholder(`<img src="${escapeHtml(mediaFilename)}">`));
		} else {
			parts.push(placeholder(`<code>${escapeHtml(match[3] ?? '')}</code>`));
		}
		offset = matchIndex + match[0].length;
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

function renderMarkdownBlocks(markdown: string): string {
	if (markdown.length === 0) {
		return '';
	}
	const lines = markdown.split('\n');
	const result: string[] = [];
	let index = 0;
	while (index < lines.length) {
		const line = lines[index] ?? '';
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
		while (index < lines.length && !isMarkdownBlockStart(lines[index] ?? '')) {
			paragraph.push(lines[index] ?? '');
			index += 1;
		}
		result.push(paragraph.join('<br>'));
	}
	return result.join('');
}

function isMarkdownBlockStart(line: string): boolean {
	return line.length === 0
		|| /^\s{0,3}#{1,6}[ \t]+/u.test(line)
		|| /^\s{0,3}[-*_](?:\s*[-*_]){2,}\s*$/u.test(line)
		|| /^\s{0,3}[-+*][ \t]+/u.test(line)
		|| /^\s{0,3}\d+[.)][ \t]+/u.test(line)
		|| /^\s{0,3}&gt;(?:[ \t]|$)/u.test(line);
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
