import { DEFAULT_SETTINGS } from '../settings';
import type { AnkiCardLinkSettings } from '../types';
import type { CardLocationIndexData } from './card-location-index';

export interface PersistedPluginDataV2 {
	version: 2;
	settings: AnkiCardLinkSettings;
	cardLocations: CardLocationIndexData;
}

export function migratePluginData(value: unknown): PersistedPluginDataV2 {
	if (isRecord(value) && value.version === 2 && isRecord(value.settings)) {
		return {
			version: 2,
			settings: { ...DEFAULT_SETTINGS, ...pickSettings(value.settings) },
			cardLocations: parseCardLocations(value.cardLocations),
		};
	}
	return {
		version: 2,
		settings: { ...DEFAULT_SETTINGS, ...pickSettings(isRecord(value) ? value : {}) },
		cardLocations: {},
	};
}

function pickSettings(value: Record<string, unknown>): Partial<AnkiCardLinkSettings> {
	const settings: Partial<AnkiCardLinkSettings> = {};
	for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AnkiCardLinkSettings>) {
		const candidate = value[key];
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
