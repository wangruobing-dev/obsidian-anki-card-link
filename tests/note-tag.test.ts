import { describe, expect, it } from 'vitest';
import { ensureObsidianTag } from '../src/core/note-tag';

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
