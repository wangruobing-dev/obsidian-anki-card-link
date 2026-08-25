import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';
import { FeishuApiError, type FeishuDriveEntry, type FeishuDocumentInfo, type FeishuImageUpload, type FeishuSyncApi } from '../src/services/feishu-api';
import { FeishuSyncIndex } from '../src/services/feishu-sync-index';
import { FeishuSyncService, type FeishuSyncHost } from '../src/services/feishu-sync';
import { AnkiCardLinkError, type FeishuShareMode } from '../src/types';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));

describe('FeishuSyncService', () => {
	it('creates missing folders and a new document without matching by title', async () => {
		const api = new FakeFeishuApi();
		api.folderEntries.set('root', [{ token: 'stranger', name: 'IOC', type: 'docx', parentToken: 'root' }]);
		const index = new FeishuSyncIndex();
		const result = await service(api, index).syncNote('Java/Spring/IOC.md', '# IOC');
		expect(result.status).toBe('created');
		expect(api.createdFolders.map((item) => item.name)).toEqual(['Java', 'Spring']);
		expect(api.createdDocuments).toEqual(['IOC']);
		expect(api.moves).toEqual([{ documentToken: 'doc-created-1', folderToken: 'folder-2' }]);
		expect(index.getByPath('Java/Spring/IOC.md')?.documentToken).toBe('doc-created-1');
	});

	it('reuses a folder only when its name matches under the current parent', async () => {
		const api = new FakeFeishuApi();
		api.folderEntries.set('root', [{ token: 'java-folder', name: 'Java', type: 'folder', parentToken: 'root' }]);
		api.folderEntries.set('java-folder', [{ token: 'test-folder', name: 'Test', type: 'folder', parentToken: 'java-folder' }]);
		await service(api, new FeishuSyncIndex()).syncNote('Java/Test/note.md', 'content');
		expect(api.createdFolders).toEqual([]);
		expect(api.moves[0]?.folderToken).toBe('test-folder');
	});

	it('invalidates a cached folder only when Feishu reports that it is missing', async () => {
		const index = new FeishuSyncIndex();
		index.setFolder({ sourceFolderPath: 'Java', folderToken: 'deleted-folder', updatedAt: 1 });
		const api = new FakeFeishuApi();
		api.folderErrors.set('deleted-folder', new FeishuApiError('FEISHU_API_ERROR', 'missing', 404));
		await service(api, index).syncNote('Java/note.md', 'content');
		expect(api.createdFolders).toEqual([{ parent: 'root', name: 'Java' }]);
		expect(index.getFolder('Java')?.folderToken).toBe('folder-1');
	});

	it('does not hide permission errors while validating a cached folder', async () => {
		const index = new FeishuSyncIndex();
		index.setFolder({ sourceFolderPath: 'Java', folderToken: 'restricted-folder', updatedAt: 1 });
		const api = new FakeFeishuApi();
		api.folderErrors.set('restricted-folder', new FeishuApiError('FEISHU_PERMISSION_DENIED', 'denied', 403));
		await expect(service(api, index).syncNote('Java/note.md', 'content')).rejects.toMatchObject({ code: 'FEISHU_PERMISSION_DENIED' });
		expect(api.createdFolders).toEqual([]);
		expect(index.getFolder('Java')?.folderToken).toBe('restricted-folder');
	});

	it('updates a bound document and recreates it only when the remote document is deleted', async () => {
		const index = new FeishuSyncIndex();
		index.set(binding('Java/IOC.md', 'doc-existing', 'root'));
		const api = new FakeFeishuApi();
		api.documents.set('doc-existing', { documentToken: 'doc-existing', title: 'IOC' });
		const updated = await service(api, index).syncNote('Java/IOC.md', 'changed');
		expect(updated.status).toBe('updated');
		expect(api.createdDocuments).toEqual([]);
		expect(api.replaced.at(-1)?.documentToken).toBe('doc-existing');

		api.documents.delete('doc-existing');
		const recreated = await service(api, index).syncNote('Java/IOC.md', 'changed again');
		expect(recreated.status).toBe('created');
		expect(recreated.documentToken).toBe('doc-created-1');
	});

	it('keeps the document token when a file is renamed or moved', async () => {
		const index = new FeishuSyncIndex();
		index.set(binding('Java/IOC.md', 'doc-existing', 'folder-java'));
		index.renamePath('Java/IOC.md', 'Backend/Spring IOC.md');
		const api = new FakeFeishuApi();
		api.documents.set('doc-existing', { documentToken: 'doc-existing', title: 'IOC' });
		const result = await service(api, index).syncNote('Backend/Spring IOC.md', 'content');
		expect(result.documentToken).toBe('doc-existing');
		expect(api.createdDocuments).toEqual([]);
		expect(api.titles.at(-1)).toEqual({ documentToken: 'doc-existing', title: 'Spring IOC' });
		expect(api.moves.at(-1)?.documentToken).toBe('doc-existing');
	});

	it('uploads repeated local images in source order', async () => {
		const api = new FakeFeishuApi();
		const host = new FakeHost();
		const result = await service(api, new FeishuSyncIndex(), host).syncNote('note.md', '![[a.png]]\n![[b.png]]\n![[a.png]]');
		expect(result.status).toBe('created');
		expect(api.replaced[0]?.images.map((image) => image.reference)).toEqual(['a.png', 'b.png', 'a.png']);
		expect(api.replaced[0]?.images.map((image) => [...new Uint8Array(image.data)])).toEqual([[1], [2], [1]]);
	});

	it('returns a warning instead of failing when public sharing is rejected', async () => {
		const api = new FakeFeishuApi();
		api.shareError = new AnkiCardLinkError('FEISHU_SHARE_PERMISSION_FAILED', 'blocked by policy');
		const result = await service(api, new FeishuSyncIndex()).syncNote('note.md', 'content');
		expect(result.status).toBe('created');
		expect(result.shareWarning).toContain('synchronized');
	});

	it('fails before remote writes when a local image is missing or unsupported', async () => {
		const missingHost: FeishuSyncHost = { resolveImage: () => undefined, readBinary: async () => new ArrayBuffer(0) };
		const unsupportedHost: FeishuSyncHost = {
			resolveImage: () => ({ path: 'a.tiff', name: 'a.tiff', extension: 'tiff' }),
			readBinary: async () => new ArrayBuffer(0),
		};
		await expect(service(new FakeFeishuApi(), new FeishuSyncIndex(), missingHost).syncNote('note.md', '![[a.png]]')).rejects.toMatchObject({ code: 'IMAGE_NOT_FOUND' });
		await expect(service(new FakeFeishuApi(), new FeishuSyncIndex(), unsupportedHost).syncNote('note.md', '![[a.tiff]]')).rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE' });
	});
});

function service(api: FakeFeishuApi, index: FeishuSyncIndex, host: FeishuSyncHost = new FakeHost()) {
	return new FeishuSyncService({
		host,
		api,
		index,
		settings: {
			...DEFAULT_SETTINGS,
			feishuAppId: 'app-id',
			feishuAppSecret: 'secret',
			feishuRootFolderUrl: 'https://tenant.feishu.cn/drive/folder/root',
		},
		now: () => 10,
	});
}

function binding(sourcePath: string, documentToken: string, parentFolderToken: string) {
	return { sourcePath, documentToken, parentFolderToken, shareUrl: `https://tenant.feishu.cn/docx/${documentToken}`, title: 'IOC', updatedAt: 1 };
}

class FakeHost implements FeishuSyncHost {
	resolveImage(reference: string) {
		return { path: reference, name: reference, extension: 'png' };
	}

	async readBinary(path: string): Promise<ArrayBuffer> {
		return new Uint8Array([path.startsWith('a') ? 1 : 2]).buffer;
	}
}

class FakeFeishuApi implements FeishuSyncApi {
	readonly documents = new Map<string, FeishuDocumentInfo>();
	readonly folderEntries = new Map<string, FeishuDriveEntry[]>();
	readonly folderErrors = new Map<string, Error>();
	readonly createdFolders: Array<{ parent: string; name: string }> = [];
	readonly createdDocuments: string[] = [];
	readonly moves: Array<{ documentToken: string; folderToken: string }> = [];
	readonly titles: Array<{ documentToken: string; title: string }> = [];
	readonly replaced: Array<{ documentToken: string; markdown: string; images: readonly FeishuImageUpload[] }> = [];
	shareError?: Error;

	async testConnection(): Promise<void> {}
	async listFolder(token: string): Promise<FeishuDriveEntry[]> {
		const error = this.folderErrors.get(token);
		if (error !== undefined) throw error;
		return this.folderEntries.get(token) ?? [];
	}
	async createFolder(parent: string, name: string): Promise<string> {
		this.createdFolders.push({ parent, name });
		return `folder-${this.createdFolders.length}`;
	}
	async getDocument(token: string): Promise<FeishuDocumentInfo | undefined> { return this.documents.get(token); }
	async createDocument(title: string): Promise<string> {
		this.createdDocuments.push(title);
		const token = `doc-created-${this.createdDocuments.length}`;
		this.documents.set(token, { documentToken: token, title });
		return token;
	}
	async moveDocument(documentToken: string, folderToken: string): Promise<void> { this.moves.push({ documentToken, folderToken }); }
	async updateDocumentTitle(documentToken: string, title: string): Promise<void> { this.titles.push({ documentToken, title }); }
	async replaceDocumentContent(documentToken: string, markdown: string, images: readonly FeishuImageUpload[]): Promise<void> {
		this.replaced.push({ documentToken, markdown, images });
	}
	async setSharePermission(_documentToken: string, _mode: FeishuShareMode): Promise<void> {
		if (this.shareError !== undefined) throw this.shareError;
	}
}
