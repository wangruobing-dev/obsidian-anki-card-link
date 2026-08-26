import { describe, expect, it } from 'vitest';
import { ensureObsidianProperty, ensureObsidianTag } from '../src/core/note-tag';

describe('Obsidian note tag', () => {
	it('creates frontmatter and adds the tag once', () => {
		const tagged = ensureObsidianTag('问题::答案', 'anki-card-link');
		expect(tagged).toBe('---\ntags:\n  - anki-card-link\n---\n\n问题::答案');
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
