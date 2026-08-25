import { describe, expect, it } from 'vitest';
import { CardLocationIndex } from '../src/services/card-location-index';

describe('card location index', () => {
	it('records locations and updates file and folder renames', () => {
		const index = new CardLocationIndex();
		index.set('acl-11111111', 'folder/a.md', 1);
		index.set('acl-22222222', 'folder/sub/b.md', 1);
		expect(index.renamePath('folder/a.md', 'folder/a2.md', 2)).toBe(1);
		expect(index.renamePath('folder', 'moved', 3)).toBe(2);
		expect(index.get('acl-11111111')?.path).toBe('moved/a2.md');
		expect(index.get('acl-22222222')?.path).toBe('moved/sub/b.md');
	});

	it('removes exact files and folder descendants', () => {
		const index = new CardLocationIndex({
			'acl-11111111': { path: 'folder/a.md', updatedAt: 1 },
			'acl-22222222': { path: 'other.md', updatedAt: 1 },
		});
		expect(index.removePath('folder')).toBe(1);
		expect(index.get('acl-11111111')).toBeUndefined();
		expect(index.get('acl-22222222')).toBeDefined();
	});

	it('still clones safely when structuredClone is unavailable', () => {
		const globalScope = globalThis as { structuredClone?: typeof structuredClone };
		const original = globalScope.structuredClone;
		globalScope.structuredClone = undefined;
		try {
			const index = new CardLocationIndex({
				'acl-33333333': { path: 'folder/a.md', updatedAt: 1 },
			});
			index.set('acl-44444444', 'folder/b.md', 2);
			expect(index.get('acl-33333333')).toEqual({ path: 'folder/a.md', updatedAt: 1 });
			expect(index.toJSON()).toEqual({
				'acl-33333333': { path: 'folder/a.md', updatedAt: 1 },
				'acl-44444444': { path: 'folder/b.md', updatedAt: 2 },
			});
		} finally {
			globalScope.structuredClone = original;
		}
	});
});
