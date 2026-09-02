import { describe, expect, it } from 'vitest';
import { migratePluginData } from '../src/services/plugin-data-store';

describe('plugin data migration', () => {
	it.each([2, 3, 4])('adds the automatic vault name default to V%s settings and preserves a custom name', (version) => {
		const old = migratePluginData({ version, settings: { defaultDeckName: '软考', useCurrentFolderAsDeck: false } });
		expect(old.settings).toMatchObject({ vaultDeckName: '', defaultDeckName: '软考', useCurrentFolderAsDeck: false });
		const custom = migratePluginData({ version, settings: { vaultDeckName: '我的知识库' } });
		expect(custom.version).toBe(4);
		expect(custom.settings.vaultDeckName).toBe('我的知识库');
	});

	it('keeps automatic naming for an invalid persisted vault name', () => {
		expect(migratePluginData({ version: 4, settings: { vaultDeckName: 42 } }).settings.vaultDeckName).toBe('');
	});

	it('migrates flat settings without losing configured values', () => {
		const data = migratePluginData({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.version).toBe(4);
		expect(data.settings).toMatchObject({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.cardLocations).toEqual({});
		expect(data.feishuSync).toEqual({ notes: {}, folders: {} });
		expect(data.youdaoSync).toEqual({ notes: {}, folders: {} });
		expect(data.settings.singleLineSeparators).toBe('::\n：：');
		expect(data.settings.vaultDeckName).toBe('');
		expect(data.settings.multiLineSeparators).toBe('?\n？');
		expect(data.settings.choiceModelName).toBe('Multiple Choice');
		expect(data.settings.choiceOptionGField).toBe('OptionG');
		expect(data.settings.readingReviewEnabled).toBe(true);
		expect(data.settings.readingReviewEdgeTapEnabled).toBe(false);
	});

	it('loads V2 settings and index together', () => {
		const data = migratePluginData({ version: 2, settings: { language: 'zh-CN' }, cardLocations: { 'acl-1234abcd': { path: 'a.md', updatedAt: 1 } } });
		expect(data.settings.language).toBe('zh-CN');
		expect(data.cardLocations['acl-1234abcd']?.path).toBe('a.md');
		expect(data.version).toBe(4);
		expect(data.feishuSync).toEqual({ notes: {}, folders: {} });
		expect(data.youdaoSync).toEqual({ notes: {}, folders: {} });
	});

	it('loads V3 Feishu bindings without losing V2 data', () => {
		const data = migratePluginData({
			version: 3,
			settings: { language: 'zh-CN', feishuAppId: 'app-id' },
			cardLocations: { 'acl-1234abcd': { path: 'a.md', updatedAt: 1 } },
			feishuSync: {
				notes: { 'a.md': { sourcePath: 'a.md', documentToken: 'doc-a', parentFolderToken: 'root', shareUrl: 'https://tenant.feishu.cn/docx/doc-a', title: 'a', contentHash: 'hash', shareMode: 'anyone_readable', updatedAt: 2 } },
				folders: {},
			},
		});
		expect(data.settings.feishuAppId).toBe('app-id');
		expect(data.version).toBe(4);
		expect(data.cardLocations['acl-1234abcd']?.path).toBe('a.md');
		expect(data.feishuSync.notes['a.md']?.documentToken).toBe('doc-a');
		expect(data.feishuSync.notes['a.md']).toMatchObject({ contentHash: 'hash', shareMode: 'anyone_readable' });
		expect(data.youdaoSync).toEqual({ notes: {}, folders: {} });
	});

	it('loads V4 Youdao bindings without losing existing data', () => {
		const data = migratePluginData({
			version: 4,
			settings: { language: 'zh-CN', youdaoApiKey: 'key' },
			cardLocations: { 'acl-1234abcd': { path: 'a.md', updatedAt: 1 } },
			feishuSync: {
				notes: { 'a.md': { sourcePath: 'a.md', documentToken: 'doc-a', parentFolderToken: 'root', shareUrl: 'https://tenant.feishu.cn/docx/doc-a', title: 'a', contentHash: 'hash', shareMode: 'anyone_readable', updatedAt: 2 } },
				folders: {},
			},
			youdaoSync: {
				notes: { 'a.md': { sourcePath: 'a.md', fileId: 'youdao-a', parentFolderId: 'folder-a', shareUrl: 'https://share.note.youdao.com/share-a', title: 'a.md', contentHash: 'hash', shareKey: 'share-a', updatedAt: 3 } },
				folders: { Obsidian: { sourceFolderPath: 'Obsidian', folderId: 'folder-obsidian', updatedAt: 3 } },
			},
		});
		expect(data.settings.youdaoApiKey).toBe('key');
		expect(data.cardLocations['acl-1234abcd']?.path).toBe('a.md');
		expect(data.feishuSync.notes['a.md']?.documentToken).toBe('doc-a');
		expect(data.youdaoSync.notes['a.md']).toMatchObject({ fileId: 'youdao-a', shareKey: 'share-a' });
		expect(data.youdaoSync.folders.Obsidian?.folderId).toBe('folder-obsidian');
	});

	it('normalizes a copied Youdao browser cookie header', () => {
		const data = migratePluginData({
			version: 4,
			settings: { youdaoYnNotePc: 'YNOTE-PC=pc; YNOTE_SESS=session; YNOTE_LOGIN=login' },
			cardLocations: {},
			feishuSync: {},
			youdaoSync: {},
		});
		expect(data.settings.youdaoYnNotePc).toBe('pc');
		expect(data.settings.youdaoSessionCookies).toBe('YNOTE_SESS=session; YNOTE_LOGIN=login');
	});

	it('falls back to tenant-only sharing for an invalid persisted mode', () => {
		const data = migratePluginData({ version: 3, settings: { feishuShareMode: 'invalid' }, cardLocations: {}, feishuSync: {} });
		expect(data.settings.feishuShareMode).toBe('tenant_readable');
	});
});
