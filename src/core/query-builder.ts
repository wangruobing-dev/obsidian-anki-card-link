import { AnkiCardLinkError, type SearchInput, type SearchType } from '../types';

const DIGITS_ONLY = /^\d+$/;

export function buildAnkiQuery(type: SearchType, rawValue: string): string {
	const value = rawValue.trim();

	if (value.length === 0) {
		throw new AnkiCardLinkError('EMPTY_VALUE', 'Search content cannot be empty.');
	}

	switch (type) {
		case 'nid':
			if (!DIGITS_ONLY.test(value)) {
				throw new AnkiCardLinkError('INVALID_NID', 'Note ID must contain digits only.');
			}
			return `nid:${value}`;
		case 'cid':
			if (!DIGITS_ONLY.test(value)) {
				throw new AnkiCardLinkError('INVALID_CID', 'Card ID must contain digits only.');
			}
			return `cid:${value}`;
		case 'text':
			return `"${escapeAnkiText(value)}"`;
		case 'query':
			return value;
	}
}

export function escapeAnkiText(value: string): string {
	return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function validateSearchInput(input: SearchInput): SearchInput {
	buildAnkiQuery(input.type, input.value);
	return { type: input.type, value: input.value.trim() };
}
