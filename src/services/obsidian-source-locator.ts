import { findCardsByUid } from '../core/card-parser';
import type { CardLocationIndex } from './card-location-index';
import { AnkiCardLinkError } from '../types';
import { DEFAULT_CARD_SYNTAX, type CardSyntax } from '../core/card-syntax';

export interface OpenSourceRequest {
	vaultName: string;
	filePath: string;
	uid: string;
}

export interface SourceFile {
	path: string;
}

export interface SourceEditor {
	setCursor(position: { line: number; ch: number }): void;
	scrollIntoView(range: { from: { line: number; ch: number }; to: { line: number; ch: number } }, center?: boolean): void;
}

export interface ObsidianSourceHost {
	getVaultName(): string;
	getFile(path: string): SourceFile | undefined;
	readFile(file: SourceFile): Promise<string>;
	openFile(file: SourceFile): Promise<SourceEditor | undefined>;
}

export interface OpenSourceResult {
	path: string;
	line: number;
	positioned: boolean;
}

export class ObsidianSourceLocator {
	constructor(
		private readonly host: ObsidianSourceHost,
		private readonly index: CardLocationIndex,
		private readonly syntax: CardSyntax = DEFAULT_CARD_SYNTAX,
	) {}

	async open(request: OpenSourceRequest): Promise<OpenSourceResult> {
		const currentVault = this.host.getVaultName();
		if (currentVault !== request.vaultName) {
			throw new AnkiCardLinkError(
				'VAULT_MISMATCH',
				`Source URI requests vault "${request.vaultName}", but the current vault is "${currentVault}".`,
			);
		}
		const indexedPath = this.index.get(request.uid)?.path;
		const file = this.host.getFile(request.filePath)
			?? (indexedPath === undefined ? undefined : this.host.getFile(indexedPath));
		if (file === undefined) {
			throw new AnkiCardLinkError(
				'SOURCE_FILE_NOT_FOUND',
				'The source file was not found at the URI path or in the local card index.',
			);
		}
		const markdown = await this.host.readFile(file);
		const matches = findCardsByUid(markdown, request.uid, this.syntax);
		if (matches.length === 0) {
			throw new AnkiCardLinkError('CARD_UID_NOT_FOUND', `Card UID ${request.uid} was not found in ${file.path}.`);
		}
		if (matches.length > 1) {
			throw new AnkiCardLinkError('DUPLICATE_CARD_UID', `More than one card in ${file.path} uses UID ${request.uid}.`);
		}
		const card = matches[0];
		if (card === undefined) {
			throw new AnkiCardLinkError('SOURCE_POSITION_FAILED', 'The source card position could not be determined.');
		}
		const editor = await this.host.openFile(file);
		if (editor === undefined) {
			return { path: file.path, line: card.startLine, positioned: false };
		}
		try {
			const position = { line: card.startLine, ch: 0 };
			editor.setCursor(position);
			editor.scrollIntoView({ from: position, to: position }, true);
			return { path: file.path, line: card.startLine, positioned: true };
		} catch (error) {
			throw new AnkiCardLinkError('SOURCE_POSITION_FAILED', 'The file was opened, but the card position could not be shown.', { cause: error });
		}
	}
}
