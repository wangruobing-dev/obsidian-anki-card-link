import { AnkiCardLinkError, type AnkiCardLinkSettings } from './types';

export const DEFAULT_SETTINGS: AnkiCardLinkSettings = {
	language: 'en',
	ankiConnectUrl: 'http://127.0.0.1:8765',
	defaultLinkText: 'Open corresponding Anki card',
	defaultSearchType: 'nid',
	debugLogging: false,
	copyQueryOnFailure: true,
};

export function normalizeAnkiConnectUrl(value: string): string {
	return value.trim().replace(/\/+$/, '');
}

export function validateAnkiConnectUrl(value: string): string {
	const normalized = normalizeAnkiConnectUrl(value);
	let parsed: URL;

	try {
		parsed = new URL(normalized);
	} catch (error) {
		throw new AnkiCardLinkError(
			'ANKICONNECT_UNAVAILABLE',
			'AnkiConnect address must be a valid localhost URL.',
			{ cause: error },
		);
	}

	const allowedHosts = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
	if (!['http:', 'https:'].includes(parsed.protocol) || !allowedHosts.has(parsed.hostname)) {
		throw new AnkiCardLinkError(
			'ANKICONNECT_UNAVAILABLE',
			'AnkiConnect address must use HTTP or HTTPS on localhost.',
		);
	}

	return normalized;
}
