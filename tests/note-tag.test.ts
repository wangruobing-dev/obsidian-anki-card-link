import { describe, expect, it } from 'vitest';
import { ensureObsidianProperty, ensureObsidianTag } from '../src/core/note-tag';
import { ensureCardLink } from '../src/core/card-link';
import { parseCardBlock } from '../src/core/card-parser';

describe('Obsidian note tag', () => {
	it('creates frontmatter and adds the tag once', () => {
		const tagged = ensureObsidianTag('问题::答案', 'anki-card-link');
		expect(tagged).toBe('---\ntags:\n  - anki-card-link\n---\n问题::答案');
		expect(ensureObsidianTag(tagged, 'anki-card-link')).toBe(tagged);
	});

	it('preserves existing block and inline frontmatter tags', () => {
		expect(ensureObsidianTag('---\ntags:\n  - java\n---\n问题::答案', 'anki-card-link'))
			.toContain('tags:\n  - anki-card-link\n  - java');
		expect(ensureObsidianTag('---\ntags: [java]\n---\n问题::答案', 'anki-card-link'))
			.toContain('tags: [java, anki-card-link]');
	});

	it('does not duplicate an existing inline tag', () => {
		const source = '#anki-card-link\n\n问题::答案';
		expect(ensureObsidianTag(source, 'anki-card-link')).toBe(source);
	});

	it.each(['\n', '\r\n'])('preserves original leading whitespace with %j line endings', (eol) => {
		const source = `${eol}${eol}  正文${eol}下一行${eol}`;
		const tagged = ensureObsidianTag(source, 'anki-card-link');
		expect(tagged).toBe(`---${eol}tags:${eol}  - anki-card-link${eol}---${eol}${source}`);
		expect(ensureObsidianTag(tagged, 'anki-card-link')).toBe(tagged);
	});

	it.each(['\n', '\r\n'])('preserves spacing below existing frontmatter with %j line endings', (eol) => {
		for (const gap of ['', eol, eol + eol]) {
			const source = `---${eol}title: 示例${eol}---${eol}${gap}  正文${eol}`;
			expect(ensureObsidianTag(source, 'anki-card-link'))
				.toBe(`---${eol}title: 示例${eol}tags:${eol}  - anki-card-link${eol}---${eol}${gap}  正文${eol}`);
		}
	});

	it.each(['\n', '\r\n'])('writes a first-sync Cloze link and tag without adding a leading blank line with %j line endings', (eol) => {
		const source = `二天堂{{c1::1}}${eol}`;
		const identity = { uid: 'acl-1234abcd', noteId: 100 };
		const linked = ensureCardLink(source, parseCardBlock(source)!, identity, 'Anki');
		const tagged = ensureObsidianTag(linked, 'anki-card-link');
		expect(tagged).toBe(`---${eol}tags:${eol}  - anki-card-link${eol}---${eol}${linked}`);
		expect(tagged).toContain(`---${eol}二天堂{{c1::1}}`);
		expect(ensureObsidianTag(ensureCardLink(tagged, parseCardBlock(tagged)!, identity, 'Anki'), 'anki-card-link')).toBe(tagged);
	});
});

describe('Obsidian note property', () => {
	it('creates frontmatter and writes the property', () => {
		expect(ensureObsidianProperty('问题::答案', 'feishu', 'https://tenant.feishu.cn/docx/doc1'))
			.toBe('---\nfeishu: "https://tenant.feishu.cn/docx/doc1"\n---\n\n问题::答案');
	});

	it('appends the property to existing frontmatter', () => {
		const source = '---\ntags:\n  - java\ntitle: IOC\n---\n正文';
		expect(ensureObsidianProperty(source, 'feishu', 'https://tenant.feishu.cn/docx/doc1'))
			.toBe('---\ntags:\n  - java\ntitle: IOC\nfeishu: "https://tenant.feishu.cn/docx/doc1"\n---\n正文');
	});

	it('overwrites an existing property with the latest link', () => {
		const source = '---\nfeishu: "https://old.example/doc"\ntags: [java]\n---\n正文';
		expect(ensureObsidianProperty(source, 'feishu', 'https://tenant.feishu.cn/docx/doc2'))
			.toBe('---\nfeishu: "https://tenant.feishu.cn/docx/doc2"\ntags: [java]\n---\n正文');
	});

	it('replaces multi-line property values without changing the body', () => {
		const source = '---\ntags:\n  - java\nfeishu:\n  old: value\nsource: obsidian\n---\n\n正文';
		expect(ensureObsidianProperty(source, 'feishu', 'https://tenant.feishu.cn/docx/doc3'))
			.toBe('---\ntags:\n  - java\nfeishu: "https://tenant.feishu.cn/docx/doc3"\nsource: obsidian\n---\n\n正文');
	});
});
