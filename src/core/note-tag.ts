const FRONTMATTER_OPEN = /^---\r?\n/u;

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
		return `---${lineEnding}tags:${lineEnding}  - ${normalizedTag}${lineEnding}---${lineEnding}${lineEnding}${markdown}`;
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
	const escaped = tag.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	return new RegExp(`(^|\\s)#${escaped}(?=$|[\\s,.;!?，。；！？])`, 'mu').test(markdown);
}
