export const READING_REVIEW_COMMAND_IDS = [
	'reveal-next-reading-cloze',
	'toggle-all-reading-clozes',
	'reveal-next-reading-back',
	'toggle-all-reading-backs',
] as const;

export const LOCALIZED_COMMAND_IDS = [
	'insert-link',
	'open-link',
	'sync-current-card',
	'sync-current-file',
	'cloze-next-number',
	'cloze-current-number',
	'insert-cloze-region',
	'export-pdf',
	'export-word',
	'sync-current-note-to-feishu',
	...READING_REVIEW_COMMAND_IDS,
] as const;
