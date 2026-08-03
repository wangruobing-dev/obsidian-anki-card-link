import { buildAnkiQuery, validateSearchInput } from './query-builder';
import { AnkiCardLinkError, SEARCH_TYPES, type SearchInput, type SearchType } from '../types';

export const OPEN_ANKI_PROTOCOL_ACTION = 'anki-card-link';
export const OBSIDIAN_PROTOCOL_ACTION = OPEN_ANKI_PROTOCOL_ACTION;

export function isSearchType(value: string): value is SearchType {
	return SEARCH_TYPES.some((type) => type === value);
}

export function parseProtocolParams(params: Record<string, string>): SearchInput {
	const type = params.type;
	const value = params.value;

	if (type === undefined || !isSearchType(type)) {
		throw new AnkiCardLinkError(
			'EMPTY_VALUE',
			'Search type must be one of nid, cid, text, or query.',
		);
	}

	if (value === undefined) {
		throw new AnkiCardLinkError('EMPTY_VALUE', 'Search content cannot be empty.');
	}

	return validateSearchInput({ type, value });
}

export function buildObsidianUri(
	type: SearchType,
	value: string,
	extra?: { uid: string; version: 2 },
): string {
	const validated = validateSearchInput({ type, value });
	const params = [
		`type=${encodeURIComponent(validated.type)}`,
		`value=${encodeURIComponent(validated.value)}`,
	];
	if (extra !== undefined) {
		params.push(`uid=${encodeURIComponent(extra.uid)}`, `v=${encodeURIComponent(String(extra.version))}`);
	}
	return `obsidian://${OPEN_ANKI_PROTOCOL_ACTION}?${params.join('&')}`;
}

export function buildMarkdownLink(type: SearchType, value: string, label: string): string {
	buildAnkiQuery(type, value);
	const safeLabel = escapeMarkdownLabel(label.trim());
	if (safeLabel.length === 0) {
		throw new AnkiCardLinkError('EMPTY_VALUE', 'Link text cannot be empty.');
	}
	return `[${safeLabel}](${buildObsidianUri(type, value)})`;
}

function escapeMarkdownLabel(label: string): string {
	return label.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}
