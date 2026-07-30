export const SEARCH_TYPES = ['nid', 'cid', 'text', 'query'] as const;

export type SearchType = (typeof SEARCH_TYPES)[number];

export interface AnkiCardLinkSettings {
	ankiConnectUrl: string;
	defaultLinkText: string;
	defaultSearchType: SearchType;
	debugLogging: boolean;
	copyQueryOnFailure: boolean;
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
	| 'UNSUPPORTED_PLATFORM';

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
