import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings';
import { YoudaoApiError, type YoudaoDriveEntry, type YoudaoImageUpload, type YoudaoNoteInfo, type YoudaoPublishedShare, type YoudaoSyncApi, type YoudaoUploadedResource } from '../src/services/youdao-api';
import { YoudaoSyncIndex } from '../src/services/youdao-sync-index';
import { YoudaoSyncService, type YoudaoSyncHost } from '../src/services/youdao-sync';

vi.mock('obsidian', () => ({ TFile: class TFile {} }));

describe('YoudaoSyncService', () => {
	it('creates the Obsidian root folder, mirrors nested folders, and creates a shared note without title matching', async () => {
		const api = new FakeYoudaoApi();
		api.folderEntries.set('root-folder', [{ id: 'stranger', name: 'IOC.md', dir: false, parentId: 'root-folder' }]);
		const index = new YoudaoSyncIndex();
		const result = await service(api, index).syncNote('Java/Spring/IOC.md', '# IOC');

		expect(result.status).toBe('created');
		expect(api.createdFolders.map((item) => item.name)).toEqual(['Obsidian', 'Java', 'Spring']);
		expect(api.createdNotes).toEqual([{ title: 'IOC.md', parentFolderId: 'folder-3', markdown: '# IOC', resources: [] }]);
		expect(api.published).toEqual(['note-created-1']);
		expect(index.getByPath('Java/Spring/IOC.md')?.fileId).toBe('note-created-1');
		expect(index.getByPath('Java/Spring/IOC.md')?.shareUrl).toBe('https://share.note.youdao.com/share/note-created-1');
	});

	it('allows sync with a browser Cookie session when YNOTE-PC is unavailable', async () => {
		const api = new FakeYoudaoApi();
		const sync = new YoudaoSyncService({
			host: new FakeHost(),
			settings: { ...DEFAULT_SETTINGS, youdaoApiKey: 'api-key', youdaoSessionCookies: 'P_INFO=account; YNOTE_SESS=session' },
			index: new YoudaoSyncIndex(),
			api,
			now: () => 10,
		});

		await expect(sync.testConnection()).resolves.toBeUndefined();
	});

	it('reuses an existing folder only under the current parent', async () => {
		const api = new FakeYoudaoApi();
		api.folderEntries.set('root-folder', [{ id: 'obsidian-folder', name: 'Obsidian', dir: true, parentId: 'root-folder' }]);
		api.folderEntries.set('obsidian-folder', [{ id: 'java-folder', name: 'Java', dir: true, parentId: 'obsidian-folder' }]);
		api.folderEntries.set('java-folder', [{ id: 'test-folder', name: 'Test', dir: true, parentId: 'java-folder' }]);

		await service(api, new YoudaoSyncIndex()).syncNote('Java/Test/note.md', 'content');

		expect(api.createdFolders).toEqual([]);
		expect(api.createdNotes[0]?.parentFolderId).toBe('test-folder');
	});

	it('invalidates a cached folder only when Youdao reports it is missing', async () => {
		const index = new YoudaoSyncIndex();
		index.setFolder({ sourceFolderPath: 'Obsidian/Java', folderId: 'deleted-folder', updatedAt: 1 });
		const api = new FakeYoudaoApi();
		api.folderEntries.set('root-folder', [{ id: 'obsidian-folder', name: 'Obsidian', dir: true, parentId: 'root-folder' }]);
		api.folderErrors.set('deleted-folder', new YoudaoApiError('YOUDAO_NOTE_NOT_FOUND', 'missing', 404));

		await service(api, index).syncNote('Java/note.md', 'content');

		expect(api.createdFolders).toEqual([{ parent: 'obsidian-folder', name: 'Java' }]);
		expect(index.getFolder('Obsidian/Java')?.folderId).toBe('folder-1');
	});

	it('does not write remotely when title, content, images, folder, and share link are unchanged', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		await sync.syncNote('note.md', 'content');
		const before = api.writeCounts();

		const result = await sync.syncNote('note.md', 'content');

		expect(result.status).toBe('unchanged');
		expect(api.writeCounts()).toEqual(before);
	});

	it('ignores frontmatter changes when deciding whether content changed', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		await sync.syncNote('note.md', 'content');
		const before = api.writeCounts();

		const result = await sync.syncNote('note.md', '---\nyoudao: ""\nfeishu: ""\n---\ncontent');

		expect(result.status).toBe('unchanged');
		expect(api.writeCounts()).toEqual(before);
	});

	it('updates only the note body when Markdown content changes', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		await sync.syncNote('note.md', 'content');
		const before = api.writeCounts();

		const result = await sync.syncNote('note.md', 'changed');

		expect(result.status).toBe('updated');
		expect(api.writeCounts()).toMatchObject({ titles: before.titles, moves: before.moves, updates: before.updates + 1, shares: before.shares });
		expect(api.updatedNotes.at(-1)?.fileId).toBe('note-created-1');
	});

	it('updates content when image bytes change at the same path', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const host = new FakeHost();
		const sync = service(api, index, host);
		await sync.syncNote('note.md', '![[a.png]]');
		host.imageBytes.set('a.png', 9);
		const before = api.writeCounts();

		const result = await sync.syncNote('note.md', '![[a.png]]');

		expect(result.status).toBe('updated');
		expect(api.writeCounts()).toMatchObject({ titles: before.titles, moves: before.moves, updates: before.updates + 1, shares: before.shares });
	});

	it('performs only the title update after a file rename', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		await sync.syncNote('IOC.md', 'content');
		index.renamePath('IOC.md', 'Spring IOC.md');
		const before = api.writeCounts();

		const result = await sync.syncNote('Spring IOC.md', 'content');

		expect(result.status).toBe('updated');
		expect(api.writeCounts()).toMatchObject({ titles: before.titles + 1, moves: before.moves, updates: before.updates, shares: before.shares });
		expect(api.titles.at(-1)).toEqual({ fileId: 'note-created-1', title: 'Spring IOC.md' });
	});

	it('performs only the note move after a folder change', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		await sync.syncNote('Java/note.md', 'content');
		index.renamePath('Java/note.md', 'Backend/note.md');
		const before = api.writeCounts();

		const result = await sync.syncNote('Backend/note.md', 'content');

		expect(result.status).toBe('updated');
		expect(api.writeCounts()).toMatchObject({ titles: before.titles, moves: before.moves + 1, updates: before.updates, shares: before.shares });
		expect(api.moves.at(-1)?.fileId).toBe('note-created-1');
	});

	it('recreates a deleted remote note even when the content hash is unchanged', async () => {
		const api = new FakeYoudaoApi();
		const index = new YoudaoSyncIndex();
		const sync = service(api, index);
		const first = await sync.syncNote('note.md', 'content');
		api.notes.delete(first.fileId);

		const result = await sync.syncNote('note.md', 'content');

		expect(result.status).toBe('created');
		expect(result.fileId).not.toBe(first.fileId);
		expect(api.published).toEqual(['note-created-1', 'note-created-2']);
	});

	it('uploads local images and attaches resources to the note', async () => {
		const api = new FakeYoudaoApi();
		const host = new FakeHost();

		await service(api, new YoudaoSyncIndex(), host).syncNote('note.md', '![[a.png]]\n![[b.png]]');

		expect(api.uploadedImages.map((image) => image.reference)).toEqual(['a.png', 'b.png']);
		expect(api.createdNotes[0]?.resources.map((resource) => resource.resourceId)).toEqual(['resource-1', 'resource-2']);
		expect(api.createdNotes[0]?.markdown).toContain('https://note.youdao.com/yws/res/v1/resource-1');
	});

	it('fails before remote writes when a local image is missing or unsupported', async () => {
		const missingHost: YoudaoSyncHost = { resolveImage: () => undefined, readBinary: async () => new ArrayBuffer(0) };
		const unsupportedHost: YoudaoSyncHost = {
			resolveImage: () => ({ path: 'a.tiff', name: 'a.tiff', extension: 'tiff' }),
			readBinary: async () => new ArrayBuffer(0),
		};

		await expect(service(new FakeYoudaoApi(), new YoudaoSyncIndex(), missingHost).syncNote('note.md', '![[a.png]]')).rejects.toMatchObject({ code: 'IMAGE_NOT_FOUND' });
		await expect(service(new FakeYoudaoApi(), new YoudaoSyncIndex(), unsupportedHost).syncNote('note.md', '![[a.tiff]]')).rejects.toMatchObject({ code: 'UNSUPPORTED_IMAGE' });
	});
});

function service(api: FakeYoudaoApi, index: YoudaoSyncIndex, host: YoudaoSyncHost = new FakeHost()) {
	return new YoudaoSyncService({
		host,
		api,
		index,
		settings: {
			...DEFAULT_SETTINGS,
			youdaoApiKey: 'api-key',
			youdaoYnNotePc: 'ynote-pc',
		},
		now: () => 10,
	});
}

class FakeHost implements YoudaoSyncHost {
	readonly imageBytes = new Map<string, number>([['a.png', 1], ['b.png', 2]]);

	resolveImage(reference: string) {
		return { path: reference, name: reference, extension: reference.split('.').pop() ?? '' };
	}

	async readBinary(path: string): Promise<ArrayBuffer> {
		return new Uint8Array([this.imageBytes.get(path) ?? 2]).buffer;
	}
}

class FakeYoudaoApi implements YoudaoSyncApi {
	readonly notes = new Map<string, YoudaoNoteInfo>();
	readonly folderEntries = new Map<string, YoudaoDriveEntry[]>();
	readonly folderErrors = new Map<string, Error>();
	readonly createdFolders: Array<{ parent: string; name: string }> = [];
	readonly createdNotes: Array<{ title: string; parentFolderId: string; markdown: string; resources: readonly YoudaoUploadedResource[] }> = [];
	readonly updatedNotes: Array<{ fileId: string; title: string; markdown: string; resources: readonly YoudaoUploadedResource[] }> = [];
	readonly titles: Array<{ fileId: string; title: string }> = [];
	readonly moves: Array<{ fileId: string; targetParentId: string }> = [];
	readonly uploadedImages: YoudaoImageUpload[] = [];
	readonly published: string[] = [];

	async testConnection(): Promise<void> {}

	async getRootFolderId(): Promise<string> {
		return 'root-folder';
	}

	async listFolder(folderId: string): Promise<YoudaoDriveEntry[]> {
		const error = this.folderErrors.get(folderId);
		if (error !== undefined) throw error;
		return this.folderEntries.get(folderId) ?? [];
	}

	async createFolder(parent: string, name: string): Promise<string> {
		this.createdFolders.push({ parent, name });
		return `folder-${this.createdFolders.length}`;
	}

	async getNote(fileId: string): Promise<YoudaoNoteInfo | undefined> {
		return this.notes.get(fileId);
	}

	async createNote(title: string, parentFolderId: string, markdown: string, resources: readonly YoudaoUploadedResource[] = []): Promise<string> {
		this.createdNotes.push({ title, parentFolderId, markdown, resources });
		const fileId = `note-created-${this.createdNotes.length}`;
		this.notes.set(fileId, { fileId, title, parentId: parentFolderId, version: this.createdNotes.length });
		return fileId;
	}

	async updateNoteContent(fileId: string, title: string, markdown: string, resources: readonly YoudaoUploadedResource[] = []): Promise<void> {
		this.updatedNotes.push({ fileId, title, markdown, resources });
		const note = this.notes.get(fileId);
		if (note !== undefined) {
			this.notes.set(fileId, { ...note, title });
		}
	}

	async updateNoteTitle(fileId: string, title: string): Promise<void> {
		this.titles.push({ fileId, title });
		const note = this.notes.get(fileId);
		if (note !== undefined) {
			this.notes.set(fileId, { ...note, title });
		}
	}

	async moveNote(fileId: string, targetParentId: string): Promise<void> {
		this.moves.push({ fileId, targetParentId });
		const note = this.notes.get(fileId);
		if (note !== undefined) {
			this.notes.set(fileId, { ...note, parentId: targetParentId });
		}
	}

	async uploadImage(image: YoudaoImageUpload): Promise<YoudaoUploadedResource> {
		this.uploadedImages.push(image);
		const resourceId = `resource-${this.uploadedImages.length}`;
		return {
			resourceId,
			version: 'v1',
			remoteUrl: `https://note.youdao.com/yws/res/v1/${resourceId}`,
			fileName: image.fileName,
			mimeType: image.mimeType,
		};
	}

	async publishNote(fileId: string): Promise<YoudaoPublishedShare> {
		this.published.push(fileId);
		const shareUrl = `https://share.note.youdao.com/share/${fileId}`;
		const note = this.notes.get(fileId);
		if (note !== undefined) {
			this.notes.set(fileId, { ...note, shareUrl, shareKey: `share-${fileId}` });
		}
		return { shareUrl, shareKey: `share-${fileId}` };
	}

	writeCounts() {
		return { titles: this.titles.length, moves: this.moves.length, updates: this.updatedNotes.length, shares: this.published.length };
	}
}
