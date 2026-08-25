import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { buildMultipartBody } from '../core/multipart';
import { AnkiCardLinkError, type FeishuShareMode } from '../types';

const OPEN_API_ORIGIN = 'https://open.feishu.cn';
const TOKEN_ERROR_CODES = new Set([99991661, 99991662, 99991663, 99991664]);

interface RequestUrlLike {
	(request: RequestUrlParam): Promise<RequestUrlResponse>;
}

export interface FeishuApiOptions {
	appId: string;
	appSecret: string;
	request?: RequestUrlLike;
	now?: () => number;
}

export interface FeishuDriveEntry {
	token: string;
	name: string;
	type: string;
	parentToken: string;
	url?: string;
}

export interface FeishuDocumentInfo {
	documentToken: string;
	title: string;
}

export interface FeishuImageUpload {
	reference: string;
	placeholder: string;
	fileName: string;
	mimeType: string;
	data: ArrayBuffer;
}

export interface FeishuSyncApi {
	testConnection(rootFolderToken: string): Promise<void>;
	listFolder(folderToken: string): Promise<FeishuDriveEntry[]>;
	createFolder(parentFolderToken: string, name: string): Promise<string>;
	getDocument(documentToken: string): Promise<FeishuDocumentInfo | undefined>;
	createDocument(title: string): Promise<string>;
	moveDocument(documentToken: string, folderToken: string): Promise<void>;
	updateDocumentTitle(documentToken: string, title: string): Promise<void>;
	replaceDocumentContent(documentToken: string, markdown: string, images: readonly FeishuImageUpload[]): Promise<void>;
	setSharePermission(documentToken: string, mode: FeishuShareMode): Promise<void>;
}

export class FeishuApiError extends AnkiCardLinkError {
	constructor(
		code: ConstructorParameters<typeof AnkiCardLinkError>[0],
		message: string,
		public readonly httpStatus?: number,
		public readonly apiCode?: number,
		options?: { cause?: unknown },
	) {
		super(code, message, options);
		this.name = 'FeishuApiError';
	}
}

export class FeishuApiService implements FeishuSyncApi {
	private readonly request: RequestUrlLike;
	private readonly now: () => number;
	private token?: { value: string; expiresAt: number };

	constructor(private readonly options: FeishuApiOptions) {
		this.request = options.request ?? requestUrl;
		this.now = options.now ?? Date.now;
	}

	async testConnection(rootFolderToken: string): Promise<void> {
		await this.listFolder(rootFolderToken);
		await this.convertMarkdown('Connection test');
	}

	async listFolder(folderToken: string): Promise<FeishuDriveEntry[]> {
		const entries: FeishuDriveEntry[] = [];
		let pageToken: string | undefined;
		do {
			const payload = await this.apiRequest('GET', '/open-apis/drive/v1/files', {
				query: { folder_token: folderToken, page_size: '200', page_token: pageToken },
			});
			const data = requireRecord(payload.data, 'folder list data');
			for (const item of requireArray(data.files, 'folder list files')) {
				const entry = requireRecord(item, 'folder list entry');
				entries.push({
					token: requireString(entry.token, 'file token'),
					name: requireString(entry.name, 'file name'),
					type: requireString(entry.type, 'file type'),
					parentToken: optionalString(entry.parent_token) ?? folderToken,
					url: optionalString(entry.url),
				});
			}
			pageToken = data.has_more === true ? requireString(data.next_page_token, 'next page token') : undefined;
		} while (pageToken !== undefined);
		return entries;
	}

	async createFolder(parentFolderToken: string, name: string): Promise<string> {
		try {
			const payload = await this.apiRequest('POST', '/open-apis/drive/v1/files/create_folder', {
				body: { name, folder_token: parentFolderToken },
			});
			return requireString(requireRecord(payload.data, 'folder data').token, 'folder token');
		} catch (error) {
			throw remapError(error, 'FEISHU_FOLDER_CREATE_FAILED', 'Feishu folder could not be created.');
		}
	}

	async getDocument(documentToken: string): Promise<FeishuDocumentInfo | undefined> {
		try {
			const payload = await this.apiRequest('GET', `/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}`);
			const document = requireRecord(requireRecord(payload.data, 'document data').document, 'document');
			return {
				documentToken: requireString(document.document_id, 'document token'),
				title: requireString(document.title, 'document title'),
			};
		} catch (error) {
			if (isNotFound(error)) {
				return undefined;
			}
			throw error;
		}
	}

	async createDocument(title: string): Promise<string> {
		try {
			const payload = await this.apiRequest('POST', '/open-apis/docx/v1/documents', { body: { title } });
			const document = requireRecord(requireRecord(payload.data, 'document data').document, 'document');
			return requireString(document.document_id, 'document token');
		} catch (error) {
			throw remapError(error, 'FEISHU_DOCUMENT_CREATE_FAILED', 'Feishu document could not be created.');
		}
	}

	async moveDocument(documentToken: string, folderToken: string): Promise<void> {
		try {
			await this.apiRequest('POST', `/open-apis/drive/v1/files/${encodeURIComponent(documentToken)}/move`, {
				body: { type: 'docx', folder_token: folderToken },
			});
		} catch (error) {
			throw remapError(error, 'FEISHU_DOCUMENT_MOVE_FAILED', 'Feishu document could not be moved.');
		}
	}

	async updateDocumentTitle(documentToken: string, title: string): Promise<void> {
		try {
			await this.apiRequest('PATCH', `/open-apis/drive/v1/files/${encodeURIComponent(documentToken)}`, {
				query: { type: 'docx' },
				body: { new_title: title },
			});
		} catch (error) {
			throw remapError(error, 'FEISHU_DOCUMENT_UPDATE_FAILED', 'Feishu document title could not be updated.');
		}
	}

	async replaceDocumentContent(documentToken: string, markdown: string, images: readonly FeishuImageUpload[]): Promise<void> {
		try {
			const converted = await this.convertMarkdown(markdown.trim().length === 0 ? ' ' : markdown);
			const imageBlocksByUrl = new Map(converted.imageReferences.map((image) => [image.imageUrl, image.temporaryBlockId]));
			const imageTemporaryIds = images.map((image) => imageBlocksByUrl.get(image.placeholder));
			if (converted.imageReferences.length !== images.length || imageTemporaryIds.some((blockId) => blockId === undefined)) {
				throw new FeishuApiError('FEISHU_DOCUMENT_UPDATE_FAILED', 'Feishu Markdown conversion returned an unexpected image count.');
			}
			const childCount = await this.getRootChildCount(documentToken);
			if (childCount > 0) {
				await this.apiRequest(
					'DELETE',
					`/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks/${encodeURIComponent(documentToken)}/children/batch_delete`,
					{ query: { document_revision_id: '-1' }, body: { start_index: 0, end_index: childCount } },
				);
			}
			const relations = new Map<string, string>();
			for (const batch of partitionConvertedBlocks(converted)) {
				const createPayload = await this.apiRequest(
					'POST',
					`/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks/${encodeURIComponent(documentToken)}/descendant`,
					{
						query: { document_revision_id: '-1' },
						body: {
							children_id: batch.firstLevelBlockIds,
							index: -1,
							descendants: batch.blocks.map(stripReadOnlyBlockFields),
						},
					},
				);
				for (const [temporaryId, blockId] of parseBlockRelations(requireRecord(createPayload.data, 'created block data').block_id_relations)) {
					relations.set(temporaryId, blockId);
				}
			}
			const requests: Array<Record<string, unknown>> = [];
			for (let index = 0; index < images.length; index += 1) {
				const image = images[index];
				const temporaryId = imageTemporaryIds[index];
				if (image === undefined || temporaryId === undefined) {
					throw new FeishuApiError('FEISHU_MEDIA_UPLOAD_FAILED', 'Feishu image mapping is incomplete.');
				}
				const blockId = relations.get(temporaryId);
				if (blockId === undefined) {
					throw new FeishuApiError('FEISHU_MEDIA_UPLOAD_FAILED', 'Feishu did not return the created image block ID.');
				}
				const fileToken = await this.uploadImage(documentToken, blockId, image);
				requests.push({ block_id: blockId, replace_image: { token: fileToken } });
			}
			for (let start = 0; start < requests.length; start += 200) {
				await this.apiRequest('PATCH', `/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks/batch_update`, {
					query: { document_revision_id: '-1' },
					body: { requests: requests.slice(start, start + 200) },
				});
			}
		} catch (error) {
			if (error instanceof AnkiCardLinkError) {
				throw error;
			}
			throw remapError(error, 'FEISHU_DOCUMENT_UPDATE_FAILED', 'Feishu document content could not be updated.');
		}
	}

	async setSharePermission(documentToken: string, mode: FeishuShareMode): Promise<void> {
		try {
			await this.apiRequest('PATCH', `/open-apis/drive/v2/permissions/${encodeURIComponent(documentToken)}/public`, {
				query: { type: 'docx' },
				body: mode === 'anyone_readable'
					? { external_access_entity: 'open', link_share_entity: 'anyone_readable' }
					: { external_access_entity: 'closed', link_share_entity: 'tenant_readable' },
			});
		} catch (error) {
			throw remapError(error, 'FEISHU_SHARE_PERMISSION_FAILED', 'Feishu share permission could not be updated.');
		}
	}

	private async getRootChildCount(documentToken: string): Promise<number> {
		const payload = await this.apiRequest('GET', `/open-apis/docx/v1/documents/${encodeURIComponent(documentToken)}/blocks`, {
			query: { page_size: '500', document_revision_id: '-1' },
		});
		const items = requireArray(requireRecord(payload.data, 'block list data').items, 'document blocks');
		const root = items.map((item) => requireRecord(item, 'document block'))
			.find((item) => item.block_id === documentToken);
		return root === undefined ? 0 : optionalArray(root.children)?.length ?? 0;
	}

	private async convertMarkdown(markdown: string): Promise<ConvertedMarkdown> {
		const payload = await this.apiRequest('POST', '/open-apis/docx/v1/documents/blocks/convert', {
			body: { content_type: 'markdown', content: markdown },
		});
		const data = requireRecord(payload.data, 'converted Markdown data');
		return {
			firstLevelBlockIds: requireArray(data.first_level_block_ids, 'first-level block IDs')
				.map((id) => requireString(id, 'first-level block ID')),
			blocks: requireArray(data.blocks, 'converted blocks').map((block) => requireRecord(block, 'converted block')),
			imageReferences: (optionalArray(data.block_id_to_image_urls) ?? []).map((item) => {
				const reference = requireRecord(item, 'converted image reference');
				return {
					temporaryBlockId: requireString(reference.block_id, 'temporary image block ID'),
					imageUrl: requireString(reference.image_url, 'converted image URL'),
				};
			}),
		};
	}

	private async uploadImage(documentToken: string, blockId: string, image: FeishuImageUpload): Promise<string> {
		try {
			const multipart = buildMultipartBody([
				{ kind: 'text', name: 'file_name', value: image.fileName },
				{ kind: 'text', name: 'parent_type', value: 'docx_image' },
				{ kind: 'text', name: 'parent_node', value: blockId },
				{ kind: 'text', name: 'size', value: String(image.data.byteLength) },
				{ kind: 'text', name: 'extra', value: JSON.stringify({ drive_route_token: documentToken }) },
				{ kind: 'file', name: 'file', filename: image.fileName, contentType: image.mimeType, data: new Uint8Array(image.data) },
			]);
			const payload = await this.apiRequest('POST', '/open-apis/drive/v1/medias/upload_all', { multipart });
			return requireString(requireRecord(payload.data, 'media data').file_token, 'media token');
		} catch (error) {
			throw remapError(error, 'FEISHU_MEDIA_UPLOAD_FAILED', `Feishu image upload failed for ${image.reference}.`);
		}
	}

	private async apiRequest(
		method: string,
		path: string,
		options: {
			query?: Record<string, string | undefined>;
			body?: Record<string, unknown>;
			multipart?: { contentType: string; body: ArrayBuffer };
		} = {},
		retryToken = true,
	): Promise<Record<string, unknown>> {
		const token = await this.getTenantAccessToken();
		let response: RequestUrlResponse;
		try {
			response = await this.request({
				url: `${OPEN_API_ORIGIN}${path}${buildQuery(options.query)}`,
				method,
				contentType: options.multipart?.contentType ?? 'application/json',
				body: options.multipart?.body ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
				headers: { Authorization: `Bearer ${token}` },
				throw: false,
			});
		} catch {
			throw new FeishuApiError('FEISHU_API_ERROR', 'Could not reach the Feishu OpenAPI.');
		}
		const payload = parseJsonResponse(response);
		const apiCode = typeof payload.code === 'number' ? payload.code : undefined;
		if (retryToken && (response.status === 401 || (apiCode !== undefined && TOKEN_ERROR_CODES.has(apiCode)))) {
			this.token = undefined;
			return this.apiRequest(method, path, options, false);
		}
		if (response.status < 200 || response.status >= 300 || apiCode !== 0) {
			throw buildApiError(response.status, apiCode, optionalString(payload.msg));
		}
		return payload;
	}

	private async getTenantAccessToken(): Promise<string> {
		if (this.token !== undefined && this.token.expiresAt > this.now()) {
			return this.token.value;
		}
		if (this.options.appId.trim().length === 0 || this.options.appSecret.trim().length === 0) {
			throw new AnkiCardLinkError('FEISHU_NOT_CONFIGURED', 'Feishu App ID and App Secret are required.');
		}
		let response: RequestUrlResponse;
		try {
			response = await this.request({
				url: `${OPEN_API_ORIGIN}/open-apis/auth/v3/tenant_access_token/internal`,
				method: 'POST',
				contentType: 'application/json',
				body: JSON.stringify({ app_id: this.options.appId.trim(), app_secret: this.options.appSecret }),
				throw: false,
			});
		} catch {
			throw new AnkiCardLinkError('FEISHU_AUTH_FAILED', 'Could not reach Feishu authentication.');
		}
		const payload = parseJsonResponse(response);
		if (response.status < 200 || response.status >= 300 || payload.code !== 0) {
			throw new AnkiCardLinkError('FEISHU_AUTH_FAILED', 'Feishu App ID or App Secret was rejected.');
		}
		const value = requireString(payload.tenant_access_token, 'tenant access token');
		const expireSeconds = requireNumber(payload.expire, 'tenant access token expiry');
		this.token = { value, expiresAt: this.now() + Math.max(0, expireSeconds - 60) * 1000 };
		return value;
	}
}

interface ConvertedMarkdown {
	firstLevelBlockIds: string[];
	blocks: Array<Record<string, unknown>>;
	imageReferences: Array<{ temporaryBlockId: string; imageUrl: string }>;
}

function partitionConvertedBlocks(converted: ConvertedMarkdown): ConvertedMarkdown[] {
	const byId = new Map<string, Record<string, unknown>>();
	for (const block of converted.blocks) {
		byId.set(requireString(block.block_id, 'converted block ID'), block);
	}
	const batches: ConvertedMarkdown[] = [];
	let currentRoots: string[] = [];
	let currentBlocks: Array<Record<string, unknown>> = [];
	for (const rootId of converted.firstLevelBlockIds) {
		const subtree = collectSubtree(rootId, byId);
		if (subtree.length > 1000) {
			throw new FeishuApiError('FEISHU_DOCUMENT_UPDATE_FAILED', 'One Feishu block subtree exceeds the 1000-block API limit.');
		}
		if (currentBlocks.length > 0 && currentBlocks.length + subtree.length > 1000) {
			batches.push({ firstLevelBlockIds: currentRoots, blocks: currentBlocks, imageReferences: [] });
			currentRoots = [];
			currentBlocks = [];
		}
		currentRoots.push(rootId);
		currentBlocks.push(...subtree);
	}
	if (currentBlocks.length > 0) {
		batches.push({ firstLevelBlockIds: currentRoots, blocks: currentBlocks, imageReferences: [] });
	}
	return batches;
}

function collectSubtree(rootId: string, byId: ReadonlyMap<string, Record<string, unknown>>): Array<Record<string, unknown>> {
	const collected: Array<Record<string, unknown>> = [];
	const pending = [rootId];
	const seen = new Set<string>();
	while (pending.length > 0) {
		const blockId = pending.shift();
		if (blockId === undefined || seen.has(blockId)) continue;
		seen.add(blockId);
		const block = byId.get(blockId);
		if (block === undefined) throw invalidResponse('converted block hierarchy');
		collected.push(block);
		for (const child of optionalArray(block.children) ?? []) {
			pending.push(requireString(child, 'converted child block ID'));
		}
	}
	return collected;
}

function buildQuery(query?: Record<string, string | undefined>): string {
	if (query === undefined) return '';
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) params.set(key, value);
	}
	const encoded = params.toString();
	return encoded.length === 0 ? '' : `?${encoded}`;
}

function parseJsonResponse(response: RequestUrlResponse): Record<string, unknown> {
	try {
		const value: unknown = JSON.parse(response.text);
		return requireRecord(value, 'Feishu response');
	} catch (error) {
		throw new FeishuApiError('FEISHU_API_ERROR', `Feishu returned an invalid response (HTTP ${response.status}).`, response.status, undefined, { cause: error });
	}
}

function buildApiError(status: number, apiCode?: number, message?: string): FeishuApiError {
	const suffix = apiCode === undefined ? `HTTP ${status}` : `code ${apiCode}`;
	const safeMessage = message === undefined ? '' : `: ${message.slice(0, 300)}`;
	if (status === 403 || apiCode === 99991672 || apiCode === 1061004 || apiCode === 1063002 || apiCode === 1063004) {
		return new FeishuApiError('FEISHU_PERMISSION_DENIED', `Feishu denied access (${suffix})${safeMessage}`, status, apiCode);
	}
	return new FeishuApiError('FEISHU_API_ERROR', `Feishu API request failed (${suffix})${safeMessage}`, status, apiCode);
}

function remapError(error: unknown, code: ConstructorParameters<typeof AnkiCardLinkError>[0], message: string): AnkiCardLinkError {
	if (error instanceof FeishuApiError && error.code === 'FEISHU_PERMISSION_DENIED') {
		return error;
	}
	return new AnkiCardLinkError(code, message, { cause: error });
}

function isNotFound(error: unknown): boolean {
	return error instanceof FeishuApiError
		&& (error.httpStatus === 404 || error.apiCode === 1770002 || error.apiCode === 1770003 || error.apiCode === 1061007);
}

function stripReadOnlyBlockFields(block: Record<string, unknown>): Record<string, unknown> {
	const cloned = cloneJson(block);
	removeKeyRecursively(cloned, 'merge_info');
	return cloned;
}

function cloneJson(value: Record<string, unknown>): Record<string, unknown> {
	const cloned: unknown = JSON.parse(JSON.stringify(value));
	return requireRecord(cloned, 'converted block clone');
}

function removeKeyRecursively(value: unknown, key: string): void {
	if (Array.isArray(value)) {
		for (const item of value) removeKeyRecursively(item, key);
		return;
	}
	if (!isRecord(value)) return;
	delete value[key];
	for (const child of Object.values(value)) removeKeyRecursively(child, key);
}

function parseBlockRelations(value: unknown): Map<string, string> {
	const result = new Map<string, string>();
	for (const item of requireArray(value, 'block ID relations')) {
		const relation = requireRecord(item, 'block ID relation');
		result.set(
			requireString(relation.temporary_block_id, 'temporary block ID'),
			requireString(relation.block_id, 'block ID'),
		);
	}
	return result;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) throw invalidResponse(label);
	return value;
}

function requireArray(value: unknown, label: string): unknown[] {
	if (!Array.isArray(value)) throw invalidResponse(label);
	return value;
}

function optionalArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function requireString(value: unknown, label: string): string {
	if (typeof value !== 'string') throw invalidResponse(label);
	return value;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function requireNumber(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) throw invalidResponse(label);
	return value;
}

function invalidResponse(label: string): FeishuApiError {
	return new FeishuApiError('FEISHU_API_ERROR', `Feishu returned invalid ${label}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
