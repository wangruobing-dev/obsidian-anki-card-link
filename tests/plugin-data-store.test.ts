import { describe, expect, it } from 'vitest';
import { migratePluginData } from '../src/services/plugin-data-store';

describe('plugin data migration', () => {
	it('migrates flat settings without losing configured values', () => {
		const data = migratePluginData({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.version).toBe(3);
		expect(data.settings).toMatchObject({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.cardLocations).toEqual({});
		expect(data.feishuSync).toEqual({ notes: {}, folders: {} });
		expect(data.settings.singleLineSeparators).toBe('::\n：：');
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
		expect(data.version).toBe(3);
		expect(data.feishuSync).toEqual({ notes: {}, folders: {} });
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
		expect(data.cardLocations['acl-1234abcd']?.path).toBe('a.md');
		expect(data.feishuSync.notes['a.md']?.documentToken).toBe('doc-a');
		expect(data.feishuSync.notes['a.md']).toMatchObject({ contentHash: 'hash', shareMode: 'anyone_readable' });
	});

	it('falls back to tenant-only sharing for an invalid persisted mode', () => {
		const data = migratePluginData({ version: 3, settings: { feishuShareMode: 'invalid' }, cardLocations: {}, feishuSync: {} });
		expect(data.settings.feishuShareMode).toBe('tenant_readable');
	});
});
