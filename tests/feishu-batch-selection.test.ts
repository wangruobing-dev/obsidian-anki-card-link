import { describe, expect, it } from 'vitest';
import { collectSelectedMarkdownFiles } from '../src/services/feishu-batch-selection';

const files = [
	{ path: 'Java/JVM.md', extension: 'md' },
	{ path: 'Java/Spring/MVC.md', extension: 'md' },
	{ path: 'Finance/Gold.md', extension: 'md' },
	{ path: 'assets/image.png', extension: 'png' },
];

describe('Feishu batch selection', () => {
	it('returns a single selected file', () => {
		expect(paths(new Set(['Java/JVM.md']))).toEqual(['Java/JVM.md']);
	});

	it('returns multiple selected files', () => {
		expect(paths(new Set(['Java/JVM.md', 'Finance/Gold.md']))).toEqual(['Finance/Gold.md', 'Java/JVM.md']);
	});

	it('expands a selected folder recursively', () => {
		expect(paths(new Set(['Java']))).toEqual(['Java/JVM.md', 'Java/Spring/MVC.md']);
	});

	it('combines folders and individual files', () => {
		expect(paths(new Set(['Java', 'Finance/Gold.md']))).toEqual(['Finance/Gold.md', 'Java/JVM.md', 'Java/Spring/MVC.md']);
	});

	it('filters non-Markdown files', () => {
		expect(paths(new Set(['assets/image.png']))).toEqual([]);
	});

	it('keeps every Markdown file when the whole vault is selected', () => {
		expect(paths(new Set(['']))).toEqual([
		'Finance/Gold.md', 'Java/JVM.md', 'Java/Spring/MVC.md',
	]);
	});

	it('deduplicates a file selected through overlapping folder choices', () => {
		expect(paths(new Set(['Java', 'Java/JVM.md']))).toEqual([
		'Java/JVM.md', 'Java/Spring/MVC.md',
	]);
	});
});

function paths(selected: Set<string>): string[] {
	return collectSelectedMarkdownFiles(files, selected).map((file) => file.path);
}
