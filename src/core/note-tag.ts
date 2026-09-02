const FRONTMATTER_OPEN = /^---\r?\n/u;
const YAML_KEY = /^[A-Za-z0-9_-]+\s*:/u;

/**
 * 同步成功后给源笔记增加标签。只修改 frontmatter，不重复写入已有标签。
 */
export function ensureObsidianTag(markdown: string, tag: string): string {
	const normalizedTag = tag.trim().replace(/^#+/u, '');
	if (normalizedTag.length === 0 || hasInlineTag(markdown, normalizedTag)) {
		return markdown;
	}
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n';
	if (!FRONTMATTER_OPEN.test(markdown)) {
		return `---${lineEnding}tags:${lineEnding}  - ${normalizedTag}${lineEnding}---${lineEnding}${markdown}`;
	}

	const lines = markdown.split(/\r?\n/u);
	const closingIndex = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/u.test(line));
	if (closingIndex < 0) {
		return markdown;
	}
	const tagsIndex = lines.slice(1, closingIndex).findIndex((line) => /^tags\s*:/u.test(line)) + 1;
	if (tagsIndex === 0) {
		lines.splice(closingIndex, 0, 'tags:', `  - ${normalizedTag}`);
		return lines.join(lineEnding);
	}

	const tagsLine = lines[tagsIndex] ?? '';
	const value = tagsLine.replace(/^tags\s*:\s*/u, '').trim();
	if (frontmatterTagsContain(lines, tagsIndex, closingIndex, normalizedTag)) {
		return markdown;
	}
	if (value.length === 0) {
		lines.splice(tagsIndex + 1, 0, `  - ${normalizedTag}`);
	} else if (value.startsWith('[') && value.endsWith(']')) {
		const inner = value.slice(1, -1).trim();
		lines[tagsIndex] = `tags: [${inner}${inner.length === 0 ? '' : ', '}${normalizedTag}]`;
	} else {
		lines.splice(tagsIndex, 1, 'tags:', `  - ${value}`, `  - ${normalizedTag}`);
	}
	return lines.join(lineEnding);
}

/**
 * 同步成功后写入源笔记属性。只处理 YAML 顶层标量属性，不改正文。
 */
export function ensureObsidianProperty(markdown: string, key: string, value: string): string {
	const normalizedKey = key.trim();
	if (!/^[A-Za-z0-9_-]+$/u.test(normalizedKey)) {
		return markdown;
	}
	const lineEnding = markdown.includes('\r\n') ? '\r\n' : '\n';
	const propertyLine = `${normalizedKey}: ${quoteYamlString(value)}`;
	if (!FRONTMATTER_OPEN.test(markdown)) {
		return `---${lineEnding}${propertyLine}${lineEnding}---${lineEnding}${lineEnding}${markdown}`;
	}

	const lines = markdown.split(/\r?\n/u);
	const closingIndex = lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)\s*$/u.test(line));
	if (closingIndex < 0) {
		return markdown;
	}
	const existing = findTopLevelPropertyRange(lines, normalizedKey, closingIndex);
	if (existing === undefined) {
		lines.splice(closingIndex, 0, propertyLine);
	} else {
		lines.splice(existing.start, existing.end - existing.start + 1, propertyLine);
	}
	return lines.join(lineEnding);
}

function findTopLevelPropertyRange(
	lines: readonly string[],
	key: string,
	closingIndex: number,
): { start: number; end: number } | undefined {
	const property = new RegExp(`^${escapeRegExp(key)}\\s*:`, 'u');
	for (let index = 1; index < closingIndex; index += 1) {
		if (!property.test(lines[index] ?? '')) {
			continue;
		}
		let end = index;
		for (let cursor = index + 1; cursor < closingIndex; cursor += 1) {
			const line = lines[cursor] ?? '';
			if (YAML_KEY.test(line)) {
				break;
			}
			end = cursor;
		}
		return { start: index, end };
	}
	return undefined;
}

function quoteYamlString(value: string): string {
	return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function frontmatterTagsContain(lines: string[], tagsIndex: number, closingIndex: number, tag: string): boolean {
	const values = [lines[tagsIndex] ?? ''];
	for (let index = tagsIndex + 1; index < closingIndex; index += 1) {
		const line = lines[index] ?? '';
		if (/^[^\s#-][^:]*:/u.test(line)) {
			break;
		}
		values.push(line);
	}
	return values.some((value) => tokenizeTags(value).includes(tag));
}

function tokenizeTags(value: string): string[] {
	return value
		.replace(/^tags\s*:\s*/u, '')
		.replaceAll('[', '')
		.replaceAll(']', '')
		.split(/[\s,]+/u)
		.map((item) => item.replace(/^[-#'"]+|['"]+$/gu, ''))
		.filter((item) => item.length > 0);
}

function hasInlineTag(markdown: string, tag: string): boolean {
	const escaped = escapeRegExp(tag);
	return new RegExp(`(^|\\s)#${escaped}(?=$|[\\s,.;!?，。；！？])`, 'mu').test(markdown);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
