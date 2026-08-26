import { DEFAULT_SETTINGS } from '../settings';
import type { AnkiCardLinkSettings } from '../types';
import type { CardLocationIndexData } from './card-location-index';
import { EMPTY_FEISHU_SYNC_INDEX, type FeishuSyncIndexData } from './feishu-sync-index';
import { EMPTY_YOUDAO_SYNC_INDEX, type YoudaoSyncIndexData } from './youdao-sync-index';
import { normalizeYoudaoCredentialInput } from './youdao-auth';

export interface PersistedPluginDataV4 {
	version: 4;
	settings: AnkiCardLinkSettings;
	cardLocations: CardLocationIndexData;
	feishuSync: FeishuSyncIndexData;
	youdaoSync: YoudaoSyncIndexData;
}

export function migratePluginData(value: unknown): PersistedPluginDataV4 {
	if (isRecord(value) && (value.version === 2 || value.version === 3 || value.version === 4) && isRecord(value.settings)) {
		return {
			version: 4,
			settings: normalizeYoudaoSettings({ ...DEFAULT_SETTINGS, ...pickSettings(value.settings) }),
			cardLocations: parseCardLocations(value.cardLocations),
			feishuSync: value.version === 3 || value.version === 4 ? parseFeishuSync(value.feishuSync) : { ...EMPTY_FEISHU_SYNC_INDEX },
			youdaoSync: value.version === 4 ? parseYoudaoSync(value.youdaoSync) : { ...EMPTY_YOUDAO_SYNC_INDEX },
		};
	}
	return {
		version: 4,
		settings: normalizeYoudaoSettings({ ...DEFAULT_SETTINGS, ...pickSettings(isRecord(value) ? value : {}) }),
		cardLocations: {},
		feishuSync: { notes: {}, folders: {} },
		youdaoSync: { notes: {}, folders: {} },
	};
}

function normalizeYoudaoSettings(settings: AnkiCardLinkSettings): AnkiCardLinkSettings {
	const credentials = normalizeYoudaoCredentialInput(settings.youdaoYnNotePc);
	if (!credentials.isCookieHeader) {
		return settings;
	}
	return {
		...settings,
		youdaoYnNotePc: credentials.ynotePc,
		youdaoSessionCookies: credentials.sessionCookies.length > 0 ? credentials.sessionCookies : settings.youdaoSessionCookies,
	};
}

function pickSettings(value: Record<string, unknown>): Partial<AnkiCardLinkSettings> {
	const settings: Partial<AnkiCardLinkSettings> = {};
	for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AnkiCardLinkSettings>) {
		const candidate = value[key];
		if (key === 'feishuShareMode') {
			if (candidate === 'tenant_readable' || candidate === 'anyone_readable') {
				Object.assign(settings, { [key]: candidate });
			}
			continue;
		}
		if (typeof DEFAULT_SETTINGS[key] === typeof candidate) {
			Object.assign(settings, { [key]: candidate });
		}
	}
	return settings;
}

function parseCardLocations(value: unknown): CardLocationIndexData {
	if (!isRecord(value)) {
		return {};
	}
	const records: CardLocationIndexData = {};
	for (const [uid, candidate] of Object.entries(value)) {
		if (!isRecord(candidate) || typeof candidate.path !== 'string' || typeof candidate.updatedAt !== 'number') {
			continue;
		}
		records[uid] = { path: candidate.path, updatedAt: candidate.updatedAt };
	}
	return records;
}

function parseFeishuSync(value: unknown): FeishuSyncIndexData {
	if (!isRecord(value)) {
		return { notes: {}, folders: {} };
	}
	const notes: FeishuSyncIndexData['notes'] = {};
	if (isRecord(value.notes)) {
		for (const [path, candidate] of Object.entries(value.notes)) {
			if (!isRecord(candidate)
				|| typeof candidate.sourcePath !== 'string'
				|| typeof candidate.documentToken !== 'string'
				|| typeof candidate.parentFolderToken !== 'string'
				|| typeof candidate.shareUrl !== 'string'
				|| typeof candidate.title !== 'string'
				|| typeof candidate.updatedAt !== 'number') {
				continue;
			}
			notes[path] = {
				sourcePath: candidate.sourcePath,
				documentToken: candidate.documentToken,
				parentFolderToken: candidate.parentFolderToken,
				shareUrl: candidate.shareUrl,
				title: candidate.title,
				contentHash: typeof candidate.contentHash === 'string' ? candidate.contentHash : undefined,
				shareMode: candidate.shareMode === 'tenant_readable' || candidate.shareMode === 'anyone_readable'
					? candidate.shareMode
					: undefined,
				updatedAt: candidate.updatedAt,
			};
		}
	}
	const folders: FeishuSyncIndexData['folders'] = {};
	if (isRecord(value.folders)) {
		for (const [path, candidate] of Object.entries(value.folders)) {
			if (!isRecord(candidate)
				|| typeof candidate.sourceFolderPath !== 'string'
				|| typeof candidate.folderToken !== 'string'
				|| typeof candidate.updatedAt !== 'number') {
				continue;
			}
			folders[path] = {
				sourceFolderPath: candidate.sourceFolderPath,
				folderToken: candidate.folderToken,
				updatedAt: candidate.updatedAt,
			};
		}
	}
	return { notes, folders };
}

function parseYoudaoSync(value: unknown): YoudaoSyncIndexData {
	if (!isRecord(value)) {
		return { notes: {}, folders: {} };
	}
	const notes: YoudaoSyncIndexData['notes'] = {};
	if (isRecord(value.notes)) {
		for (const [path, candidate] of Object.entries(value.notes)) {
			if (!isRecord(candidate)
				|| typeof candidate.sourcePath !== 'string'
				|| typeof candidate.fileId !== 'string'
				|| typeof candidate.parentFolderId !== 'string'
				|| typeof candidate.shareUrl !== 'string'
				|| typeof candidate.title !== 'string'
				|| typeof candidate.updatedAt !== 'number') {
				continue;
			}
			notes[path] = {
				sourcePath: candidate.sourcePath,
				fileId: candidate.fileId,
				parentFolderId: candidate.parentFolderId,
				shareUrl: candidate.shareUrl,
				title: candidate.title,
				contentHash: typeof candidate.contentHash === 'string' ? candidate.contentHash : undefined,
				shareKey: typeof candidate.shareKey === 'string' ? candidate.shareKey : undefined,
				updatedAt: candidate.updatedAt,
			};
		}
	}
	const folders: YoudaoSyncIndexData['folders'] = {};
	if (isRecord(value.folders)) {
		for (const [path, candidate] of Object.entries(value.folders)) {
			if (!isRecord(candidate)
				|| typeof candidate.sourceFolderPath !== 'string'
				|| typeof candidate.folderId !== 'string'
				|| typeof candidate.updatedAt !== 'number') {
				continue;
			}
			folders[path] = {
				sourceFolderPath: candidate.sourceFolderPath,
				folderId: candidate.folderId,
				updatedAt: candidate.updatedAt,
			};
		}
	}
	return { notes, folders };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
