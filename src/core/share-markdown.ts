import { findObsidianImageEmbeds } from './anki-media';
import { getFencedLines } from './markdown-fence';

const CLOZE = /\{\{c[1-9]\d*::([^{}]+?)(?:::[^{}]*?)?\}\}/gu;
const CLOZE_REGION_MARKER = /^\s*<!--\s*anki-card-link:cloze(?::(?:start|end))?\s*-->\s*$/u;
const ANKI_MARKDOWN_LINK = /!?\[(?:\\.|[^\]\\])*\]\(\s*<?obsidian:\/\/anki-card-link(?:-open)?\?[^)\s>]+>?\s*\)/giu;
const ANKI_RAW_URI = /<?obsidian:\/\/anki-card-link(?:-open)?\?[^\s>]+>?/giu;
const EXTERNAL_REFERENCE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu;

export interface ShareImageReference {
	reference: string;
	placeholder: string;
}

export interface ShareMarkdownResult {
	markdown: string;
	images: ShareImageReference[];
}

export function prepareMarkdownForSharing(markdown: string): ShareMarkdownResult {
	const withoutFrontmatter = stripYamlFrontmatter(markdown);
	const lines = withoutFrontmatter.split(/\r?\n/u);
	const fencedLines = getFencedLines(lines);
	const images: ShareImageReference[] = [];
	const prepared = lines.map((line, lineNumber) => {
		if (fencedLines.has(lineNumber)) {
			return line;
		}
		if (CLOZE_REGION_MARKER.test(line)) {
			return '';
		}
		let value = replaceLocalImages(line, images);
		value = value.replace(CLOZE, '$1');
		value = value.replace(ANKI_MARKDOWN_LINK, '');
		value = value.replace(ANKI_RAW_URI, '');
		return value.replace(/[ \t]+$/gu, '');
	});
	return { markdown: collapseRemovedLines(prepared).trim(), images };
}

function stripYamlFrontmatter(markdown: string): string {
	const lines = markdown.split(/\r?\n/u);
	if ((lines[0] ?? '').trim() !== '---') {
		return markdown;
	}
	const closing = lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/u.test(line));
	return closing < 0 ? markdown : lines.slice(closing + 1).join('\n');
}

function replaceLocalImages(line: string, images: ShareImageReference[]): string {
	let result = line;
	const replacements = findObsidianImageEmbeds(line).map((embed) => {
		if (EXTERNAL_REFERENCE.test(embed.reference)) {
			const raw = line.slice(embed.index, embed.index + embed.length);
			return { ...embed, replacement: raw.startsWith('![') && !raw.startsWith('![[') ? raw.slice(1) : `[external image](${embed.reference})` };
		}
		const index = images.length;
		const placeholder = `https://anki-card-link.invalid/local-image/${index}`;
		images.push({ reference: embed.reference, placeholder });
		return { ...embed, replacement: `![local image ${index + 1}](${placeholder})` };
	});
	for (const embed of replacements.reverse()) {
		result = `${result.slice(0, embed.index)}${embed.replacement}${result.slice(embed.index + embed.length)}`;
	}
	return result;
}

function collapseRemovedLines(lines: readonly string[]): string {
	const output: string[] = [];
	for (const line of lines) {
		if (line.length === 0 && output[output.length - 1] === '') {
			continue;
		}
		output.push(line);
	}
	return output.join('\n');
}
