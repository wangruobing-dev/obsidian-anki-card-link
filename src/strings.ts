import type { SearchType } from './types';

export const STRINGS = {
	commands: {
		insertLink: 'Insert link',
		openLink: 'Open link',
	},
	titles: {
		insertLink: 'Insert Anki link',
		openLink: 'Open Anki search',
	},
	labels: {
		searchType: 'Search type',
		value: 'Search value',
		linkText: 'Link text',
		insert: 'Insert',
		open: 'Open',
		cancel: 'Cancel',
	},
	searchTypes: {
		nid: 'Note ID',
		cid: 'Card ID',
		text: 'Note content',
		query: 'Custom query',
	} satisfies Record<SearchType, string>,
	notices: {
		linkInserted: 'Anki link inserted.',
		queryCopied: 'The Anki search query was copied to the clipboard.',
		clipboardFailed: 'The search failed, and the query could not be copied to the clipboard.',
		connectionOk: 'Connected to AnkiConnect.',
	},
} as const;
