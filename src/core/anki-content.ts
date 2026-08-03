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
		.replace(/(?<!_)_([^_\n]+)_(?!_)/gu, '<em>$1</em>')
		.replaceAll('\n', '<br>');
	for (const [index, value] of atomicHtml.entries()) {
		html = html.replaceAll(`\u0000anki-card-link-${index}\u0000`, value);
	}
	return html;
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
