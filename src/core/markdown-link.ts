export interface MarkdownLink {
	index: number;
	length: number;
	label: string;
	/** 无有效目标时保留整段原文，避免把错误嵌套链接的内层误当成来源。 */
	destination?: string;
	title?: string;
}

const ESCAPED_PUNCTUATION = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/gu;

/** 扫描单行内联链接；用括号深度读取目标，避免截断带括号的 URL。 */
export function findMarkdownLinks(markdown: string): MarkdownLink[] {
	const links: MarkdownLink[] = [];
	for (let index = 0; index < markdown.length; index += 1) {
		if (isMarkdownEscape(markdown, index)) {
			index += 1;
			continue;
		}
		if (markdown[index] !== '[') continue;
		const labelEnd = findClosingDelimiter(markdown, index, '[', ']');
		if (labelEnd === undefined || markdown[labelEnd + 1] !== '(') continue;
		const target = readTarget(markdown, labelEnd + 2);
		if (target === undefined) continue;
		const label = markdown.slice(index + 1, labelEnd);
		links.push({
			index,
			length: target.end - index + 1,
			label,
			destination: findMarkdownLinks(label).some((inner) => label[inner.index - 1] !== '!')
				? undefined : toHttpDestination(target.destination),
			title: target.title === undefined ? undefined : unescapeMarkdownLinkText(target.title),
		});
		index = target.end;
	}
	return links;
}

export function unescapeMarkdownLinkText(value: string): string {
	return value.replace(ESCAPED_PUNCTUATION, '$1');
}

function isMarkdownEscape(value: string, index: number): boolean {
	return value[index] === '\\' && /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]$/u.test(value[index + 1] ?? '');
}

function findClosingDelimiter(value: string, start: number, open: string, close: string): number | undefined {
	let depth = 1;
	for (let index = start + 1; index < value.length; index += 1) {
		const character = value[index];
		if (character === '\n' || character === '\r') return undefined;
		if (isMarkdownEscape(value, index)) {
			index += 1;
		} else if (character === close) {
			depth -= 1;
			if (depth === 0) return index;
		} else if (character === open) {
			depth += 1;
		}
	}
	return undefined;
}

function readTarget(value: string, start: number): { destination: string; title?: string; end: number } | undefined {
	let index = skipSpaces(value, start);
	let destination: string;
	if (value[index] === '<') {
		const end = findClosingDelimiter(value, index, '<', '>');
		if (end === undefined) return undefined;
		destination = value.slice(index + 1, end);
		index = end + 1;
	} else {
		const destinationStart = index;
		let depth = 0;
		for (; index < value.length; index += 1) {
			const character = value[index] ?? '';
			if (isMarkdownEscape(value, index)) {
				index += 1;
			} else if (character === '(') {
				depth += 1;
			} else if (character === ')') {
				if (depth === 0) break;
				depth -= 1;
			} else if (/\s/u.test(character)) {
				break;
			}
		}
		if (depth !== 0) return undefined;
		destination = value.slice(destinationStart, index);
	}
	const afterDestination = index;
	index = skipSpaces(value, index);
	if (value[index] === ')') return { destination, end: index };
	const delimiter = value[index];
	if (index === afterDestination || (delimiter !== '"' && delimiter !== "'" && delimiter !== '(')) return undefined;
	const titleEnd = findClosingDelimiter(value, index, delimiter, delimiter === '(' ? ')' : delimiter);
	if (titleEnd === undefined) return undefined;
	const title = value.slice(index + 1, titleEnd);
	index = skipSpaces(value, titleEnd + 1);
	return value[index] === ')' ? { destination, title, end: index } : undefined;
}

function skipSpaces(value: string, start: number): number {
	let index = start;
	while (value[index] === ' ' || value[index] === '\t') index += 1;
	return index;
}

function toHttpDestination(raw: string): string | undefined {
	const destination = unescapeMarkdownLinkText(raw).replaceAll(' ', '%20');
	const hasControlCharacter = Array.from(destination).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
	if (!/^https?:\/\//iu.test(destination) || hasControlCharacter || /[<>]/u.test(destination)) return undefined;
	try {
		new URL(destination);
		return destination;
	} catch {
		return undefined;
	}
}
