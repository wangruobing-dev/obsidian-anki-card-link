export const SEARCH_TYPES = ['nid', 'cid', 'text', 'query'] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export const LANGUAGES = ['en', 'zh-CN'] as const;

export type Language = (typeof LANGUAGES)[number];

export interface AnkiCardLinkSettings {
	language: Language;
	ankiConnectUrl: string;
	defaultLinkText: string;
	defaultSearchType: SearchType;
	debugLogging: boolean;
	copyQueryOnFailure: boolean;
	defaultDeckName: string;
	useCurrentFolderAsDeck: boolean;
	singleLineSeparators: string;
	multiLineSeparators: string;
	basicModelName: string;
	basicTitleField: string;
	basicFrontField: string;
	basicBackField: string;
	basicHintField: string;
	basicObsidianUriField: string;
	clozeModelName: string;
	clozeContentField: string;
	clozeTitleField: string;
	clozeObsidianUriField: string;
}

export interface SearchInput {
	type: SearchType;
	value: string;
}

export interface PlatformRouter {
	open(query: string): Promise<void>;
}

export type ErrorCode =
	| 'INVALID_NID'
	| 'INVALID_CID'
	| 'EMPTY_VALUE'
	| 'ANKI_NOT_RUNNING'
	| 'ANKICONNECT_UNAVAILABLE'
	| 'ANKICONNECT_ERROR'
	| 'ANKIDROID_NOT_INSTALLED'
	| 'ANKIMOBILE_NOT_INSTALLED'
	| 'UNSUPPORTED_PLATFORM'
	| 'CURRENT_CARD_NOT_FOUND'
	| 'NO_SYNCABLE_CARDS'
	| 'INVALID_CARD'
	| 'EMPTY_FRONT'
	| 'EMPTY_BACK'
	| 'INVALID_CLOZE'
	| 'MODEL_NOT_FOUND'
	| 'FIELD_NOT_FOUND'
	| 'EMPTY_DECK'
	| 'DUPLICATE_UID'
	| 'IMAGE_NOT_FOUND'
	| 'UNSUPPORTED_IMAGE'
	| 'MOBILE_SYNC_UNSUPPORTED'
	| 'INVALID_SOURCE_URI'
	| 'UNSUPPORTED_SOURCE_URI_VERSION'
	| 'VAULT_MISMATCH'
	| 'SOURCE_FILE_NOT_FOUND'
	| 'CARD_UID_NOT_FOUND'
	| 'DUPLICATE_CARD_UID'
	| 'MARKDOWN_VIEW_UNAVAILABLE'
	| 'SOURCE_POSITION_FAILED'
	| 'CARD_LINK_WRITE_FAILED'
	| 'PLUGIN_DATA_MIGRATION_FAILED';

export class AnkiCardLinkError extends Error {
	readonly cause?: unknown;

	constructor(
		public readonly code: ErrorCode,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message);
		this.name = 'AnkiCardLinkError';
		this.cause = options?.cause;
	}
}
