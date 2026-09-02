import { describe, expect, it } from 'vitest';
import { buildFolderDeckName } from '../src/core/deck-name';

describe('folder deck names', () => {
	it('turns every relative parent folder into an Anki deck hierarchy', () => {
		expect(buildFolderDeckName('若冰的知识库/test/test111.md')).toBe('若冰的知识库::test');
		expect(buildFolderDeckName('软考/数据结构/线性表.md')).toBe('软考::数据结构');
	});

	it('has no relative folder component for a note at the vault root', () => {
		expect(buildFolderDeckName('首页.md')).toBeUndefined();
	});
});
