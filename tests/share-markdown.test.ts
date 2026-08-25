import { describe, expect, it } from 'vitest';
import { prepareMarkdownForSharing } from '../src/core/share-markdown';

describe('prepareMarkdownForSharing', () => {
	it('removes YAML, Cloze syntax, region markers, and generated Anki links', () => {
		const result = prepareMarkdownForSharing(`---
tags:
  - anki-card-link
---

# ATP

ATP 是 {{c1::三磷酸腺苷::中文名称}}，{{c2::储存能量}}。

<!-- anki-card-link:cloze -->

[打开 Anki](obsidian://anki-card-link?type=nid&value=1)
[返回原文](obsidian://anki-card-link-open?v=2&uid=acl-12345678)`);
		expect(result.markdown).toBe('# ATP\n\nATP 是 三磷酸腺苷，储存能量。');
	});

	it('preserves Cloze-like text and markers inside fenced code', () => {
		const markdown = '正文 {{c1::答案}}\n\n```text\n{{c1::example}}\n<!-- anki-card-link:cloze -->\n```';
		expect(prepareMarkdownForSharing(markdown).markdown).toBe(
			'正文 答案\n\n```text\n{{c1::example}}\n<!-- anki-card-link:cloze -->\n```',
		);
	});

	it('replaces local images in source order and retains duplicates', () => {
		const result = prepareMarkdownForSharing('![[a.png]] then ![B](b.png) then ![[a.png|200]]');
		expect(result.images.map((image) => image.reference)).toEqual(['a.png', 'b.png', 'a.png']);
		expect(result.markdown).toContain('local-image/0');
		expect(result.markdown).toContain('local-image/1');
		expect(result.markdown).toContain('local-image/2');
	});

	it('keeps external images as links instead of unresolved upload blocks', () => {
		const result = prepareMarkdownForSharing('![logo](https://example.com/logo.png)');
		expect(result.images).toEqual([]);
		expect(result.markdown).toBe('[logo](https://example.com/logo.png)');
	});
});
