import { describe, expect, it } from 'vitest';
import { FeishuSyncIndex } from '../src/services/feishu-sync-index';

describe('FeishuSyncIndex', () => {
	it('keeps same-name notes in different folders independent', () => {
		const index = new FeishuSyncIndex();
		index.set(binding('A/IOC.md', 'doc-a'));
		index.set(binding('B/IOC.md', 'doc-b'));
		expect(index.getByPath('A/IOC.md')?.documentToken).toBe('doc-a');
		expect(index.getByPath('B/IOC.md')?.documentToken).toBe('doc-b');
	});

	it('renames files and folder prefixes while invalidating folder cache', () => {
		const index = new FeishuSyncIndex();
		index.set(binding('Java/IOC.md', 'doc-a'));
		index.set(binding('Java/Spring/A.md', 'doc-b'));
		index.setFolder({ sourceFolderPath: 'Java', folderToken: 'folder-a', updatedAt: 1 });
		expect(index.renamePath('Java/IOC.md', 'Java/Spring IOC.md', 2)).toBe(1);
		expect(index.renamePathPrefix('Java', 'Backend', 3)).toBe(3);
		expect(index.getByPath('Backend/Spring IOC.md')?.documentToken).toBe('doc-a');
		expect(index.getByPath('Backend/Spring/A.md')?.documentToken).toBe('doc-b');
		expect(index.getFolder('Java')).toBeUndefined();
	});

	it('reports invalidated folder-only cache entries so callers persist the change', () => {
		const index = new FeishuSyncIndex();
		index.setFolder({ sourceFolderPath: 'Java/Spring', folderToken: 'folder-a', updatedAt: 1 });
		expect(index.renamePathPrefix('Java', 'Backend', 2)).toBe(1);
		expect(index.getFolder('Java/Spring')).toBeUndefined();
	});

	it('removes a file binding without deleting unrelated bindings', () => {
		const index = new FeishuSyncIndex();
		index.set(binding('A/a.md', 'doc-a'));
		index.set(binding('B/b.md', 'doc-b'));
		expect(index.removePath('A')).toBe(1);
		expect(index.getByPath('A/a.md')).toBeUndefined();
		expect(index.getByPath('B/b.md')).toBeDefined();
	});
});

function binding(sourcePath: string, documentToken: string) {
	return { sourcePath, documentToken, parentFolderToken: 'root', shareUrl: `https://tenant.feishu.cn/docx/${documentToken}`, title: 'note', updatedAt: 1 };
}
