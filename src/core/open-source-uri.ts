import { isCardUid } from './card-identity';
import { AnkiCardLinkError } from '../types';

export const OPEN_OBSIDIAN_PROTOCOL_ACTION = 'anki-card-link-open';
export const OPEN_SOURCE_URI_VERSION = 2 as const;
export const SOURCE_VAULT_PARAM = 'vault';
export const SOURCE_FILE_PARAM = 'filePath';

export interface OpenObsidianSourceParams {
	version: 2;
	vaultName: string;
	filePath: string;
	uid: string;
}

export interface BuildOpenObsidianUriInput {
	vaultName: string;
	filePath: string;
	uid: string;
}

export function buildOpenObsidianUri(input: BuildOpenObsidianUriInput): string {
	validateOpenSourceValues(input.vaultName, input.filePath, input.uid);
	const params = new URLSearchParams({
		v: String(OPEN_SOURCE_URI_VERSION),
		[SOURCE_VAULT_PARAM]: input.vaultName,
		[SOURCE_FILE_PARAM]: normalizeFilePath(input.filePath),
		uid: input.uid,
	});
	return `obsidian://${OPEN_OBSIDIAN_PROTOCOL_ACTION}?${params.toString()}`;
}

export function parseOpenObsidianProtocolParams(params: Record<string, string>): OpenObsidianSourceParams {
	const version = params.v;
	if (version !== String(OPEN_SOURCE_URI_VERSION)) {
		throw new AnkiCardLinkError(
			'UNSUPPORTED_SOURCE_URI_VERSION',
			`Unsupported source URI version: ${version ?? 'missing'}.`,
		);
	}
	// 保留 vault 让 Obsidian 在冷启动时先打开目标库；相对文件路径必须使用 filePath。
	// Obsidian 会把保留参数 path 当成磁盘绝对路径，并在插件收到请求前提前处理。
	const vaultName = params[SOURCE_VAULT_PARAM]?.trim() ?? params.vaultName?.trim() ?? '';
	const filePath = normalizeFilePath(params[SOURCE_FILE_PARAM]?.trim() ?? params.path?.trim() ?? '');
	const uid = params.uid?.trim() ?? '';
	validateOpenSourceValues(vaultName, filePath, uid);
	return { version: OPEN_SOURCE_URI_VERSION, vaultName, filePath, uid };
}

export function parseOpenObsidianUri(uri: string): OpenObsidianSourceParams {
	let parsed: URL;
	try {
		parsed = new URL(uri);
	} catch (error) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', 'The Obsidian source URI is invalid.', { cause: error });
	}
	if (parsed.protocol !== 'obsidian:' || parsed.hostname !== OPEN_OBSIDIAN_PROTOCOL_ACTION) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', 'The Obsidian source URI uses an invalid protocol action.');
	}
	return parseOpenObsidianProtocolParams(Object.fromEntries(parsed.searchParams.entries()));
}

function validateOpenSourceValues(vaultName: string, filePath: string, uid: string): void {
	if (vaultName.length === 0) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', 'Source URI vault name cannot be empty.');
	}
	if (filePath.length === 0) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', 'Source URI file path cannot be empty.');
	}
	if (filePath.split('/').some((segment) => segment === '..')) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', 'Source URI file path cannot contain parent traversal.');
	}
	if (!isCardUid(uid)) {
		throw new AnkiCardLinkError('INVALID_SOURCE_URI', `Invalid card UID: ${uid || 'missing'}.`);
	}
}

function normalizeFilePath(filePath: string): string {
	return filePath.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '');
}
