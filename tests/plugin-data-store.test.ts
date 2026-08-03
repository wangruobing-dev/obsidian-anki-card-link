import { describe, expect, it } from 'vitest';
import { migratePluginData } from '../src/services/plugin-data-store';

describe('plugin data migration', () => {
	it('migrates flat settings without losing configured values', () => {
		const data = migratePluginData({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.version).toBe(2);
		expect(data.settings).toMatchObject({ language: 'zh-CN', ankiConnectUrl: 'http://localhost:8765', defaultDeckName: '软考', debugLogging: true });
		expect(data.cardLocations).toEqual({});
		expect(data.settings.singleLineSeparators).toBe('::\n：：');
		expect(data.settings.multiLineSeparators).toBe('?\n？');
		expect(data.settings.choiceModelName).toBe('Multiple Choice');
		expect(data.settings.choiceOptionGField).toBe('OptionG');
	});

	it('loads V2 settings and index together', () => {
		const data = migratePluginData({ version: 2, settings: { language: 'zh-CN' }, cardLocations: { 'acl-1234abcd': { path: 'a.md', updatedAt: 1 } } });
		expect(data.settings.language).toBe('zh-CN');
		expect(data.cardLocations['acl-1234abcd']?.path).toBe('a.md');
	});
});
