import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { AnkiCardLinkError, type AnkiCardLinkSettings } from '../types';
import { normalizeYoudaoCredentialInput } from './youdao-auth';

const YOUDAO_ORIGIN = 'https://note.youdao.com';

interface RequestUrlLike {
	(request: RequestUrlParam): Promise<RequestUrlResponse>;
}

export interface YoudaoApiOptions {
	settings: AnkiCardLinkSettings;
	request?: RequestUrlLike;
	now?: () => number;
	onSessionChanged?: () => void;
}

export interface YoudaoDriveEntry {
	id: string;
	name: string;
	dir: boolean;
	parentId?: string;
	version?: number;
	shareUrl?: string;
	shareKey?: string;
	deleted?: boolean;
}

export interface YoudaoNoteInfo {
	fileId: string;
	title: string;
	parentId?: string;
	version?: number;
	shareUrl?: string;
	shareKey?: string;
	deleted?: boolean;
}

export interface YoudaoImageUpload {
	reference: string;
	placeholder: string;
	fileName: string;
	mimeType: string;
	data: ArrayBuffer;
}

export interface YoudaoUploadedResource {
	resourceId: string;
	version: string;
	remoteUrl: string;
	fileName: string;
	mimeType: string;
}

export interface YoudaoPublishedShare {
	shareUrl: string;
	shareKey?: string;
}

export interface YoudaoSyncApi {
	testConnection(): Promise<void>;
	getRootFolderId(): Promise<string>;
	listFolder(folderId: string): Promise<YoudaoDriveEntry[]>;
	createFolder(parentFolderId: string, name: string): Promise<string>;
	getNote(fileId: string): Promise<YoudaoNoteInfo | undefined>;
	createNote(title: string, parentFolderId: string, markdown: string, resources?: readonly YoudaoUploadedResource[]): Promise<string>;
	updateNoteContent(fileId: string, title: string, markdown: string, resources?: readonly YoudaoUploadedResource[]): Promise<void>;
	updateNoteTitle(fileId: string, title: string): Promise<void>;
	moveNote(fileId: string, targetParentId: string): Promise<void>;
	uploadImage(image: YoudaoImageUpload): Promise<YoudaoUploadedResource>;
	publishNote(fileId: string): Promise<YoudaoPublishedShare>;
}

export class YoudaoApiError extends AnkiCardLinkError {
	constructor(
		code: ConstructorParameters<typeof AnkiCardLinkError>[0],
		message: string,
		public readonly httpStatus?: number,
		options?: { cause?: unknown },
	) {
		super(code, message, options);
		this.name = 'YoudaoApiError';
	}
}

export class YoudaoApiService implements YoudaoSyncApi {
	private readonly request: RequestUrlLike;
	private readonly now: () => number;
	private sessionRefresh?: Promise<void>;
	private rootFolderId?: Promise<string>;

	constructor(private readonly options: YoudaoApiOptions) {
		this.request = options.request ?? requestUrl;
		this.now = options.now ?? Date.now;
		const credentials = normalizeYoudaoCredentialInput(options.settings.youdaoYnNotePc);
		if (credentials.isCookieHeader) {
			options.settings.youdaoYnNotePc = credentials.ynotePc;
			if (credentials.sessionCookies.length > 0) {
				options.settings.youdaoSessionCookies = credentials.sessionCookies;
			}
			options.onSessionChanged?.();
		}
	}

	async testConnection(): Promise<void> {
		this.requireConfig();
		await this.listFolder(await this.getRootFolderId());
	}

	async getRootFolderId(): Promise<string> {
		this.rootFolderId ??= this.loadRootFolderId().catch((error) => {
			this.rootFolderId = undefined;
			throw error;
		});
		return this.rootFolderId;
	}

	async listFolder(folderId: string): Promise<YoudaoDriveEntry[]> {
		const payload = await this.webRequest('GET', `/yws/api/personal/file/${encodeURIComponent(folderId)}`, {
			query: {
				method: 'listPageByParentId',
				all: 'true',
				f: 'true',
				len: '1000',
				sort: '1',
				isReverse: 'false',
			},
		});
		const source = optionalArray(payload.entries) ?? optionalArray(payload.children) ?? optionalArray(payload.files) ?? [];
		return source.map((item) => mapDriveEntry(requireRecord(item, 'Youdao folder entry'), folderId));
	}

	async createFolder(parentFolderId: string, name: string): Promise<string> {
		const now = this.webTimestamp();
		const fileId = createWebFileId();
		const payload = await this.webRequest('POST', '/yws/api/personal/sync?method=push', {
			body: {
				fileId,
				parentId: parentFolderId,
				name,
				domain: 1,
				rootVersion: -1,
				sessionId: '',
				dir: true,
				createTime: now,
				modifyTime: now,
				transactionId: createUuid(),
				transactionTime: now,
				editorVersion: 1,
				bodyString: '',
			},
		});
		return firstString(payload, ['id', 'fileId']) ?? fileId;
	}

	async getNote(fileId: string): Promise<YoudaoNoteInfo | undefined> {
		try {
			const payload = await this.webRequest('POST', `/yws/api/personal/file/${encodeURIComponent(fileId)}?method=getById`, {
				body: { fileId, entire: false, purge: false },
			});
			const entry = unwrapEntry(payload);
			if (entry === undefined || entry.deleted === true || entry.del === true) {
				return undefined;
			}
			const mapped = mapDriveEntry(entry);
			if (mapped.dir) return undefined;
			return {
				fileId: mapped.id,
				title: mapped.name,
				parentId: mapped.parentId,
				version: mapped.version,
				shareUrl: mapped.shareUrl,
				shareKey: mapped.shareKey,
				deleted: mapped.deleted,
			};
		} catch (error) {
			if (isNotFound(error)) {
				return undefined;
			}
			throw error;
		}
	}

	async createNote(title: string, parentFolderId: string, markdown: string, resources: readonly YoudaoUploadedResource[] = []): Promise<string> {
		const now = this.webTimestampSeconds();
		const fileId = createWebFileId();
		const payload = await this.webRequest('POST', '/yws/api/personal/sync?method=push', {
			body: {
				fileId,
				parentId: parentFolderId,
				name: title,
				domain: 1,
				entryType: 0,
				rootVersion: -1,
				sessionId: '',
				dir: false,
				del: false,
				createTime: now,
				modifyTime: now,
				transactionId: createUuid(),
				transactionTime: now,
				bodyString: markdown,
				orgEditorType: 0,
				entryProps: webEntryProps(),
				isMyKeep: false,
				myKeepAuthor: '',
				stickyTime: this.webTimestamp(),
				tags: '',
				...resourcePayload(resources),
			},
		});
		return firstString(payload, ['id', 'fileId']) ?? fileId;
	}

	async updateNoteContent(fileId: string, title: string, markdown: string, resources: readonly YoudaoUploadedResource[] = []): Promise<void> {
		const info = await this.getNote(fileId);
		if (info === undefined) {
			throw new YoudaoApiError('YOUDAO_NOTE_NOT_FOUND', 'Youdao note was not found.', 404);
		}
		const now = this.webTimestampSeconds();
		const parentId = info.parentId ?? await this.getRootFolderId();
		await this.webRequest('POST', '/yws/api/personal/sync?method=push', {
			body: {
				fileId,
				parentId,
				name: title,
				domain: 1,
				entryType: 0,
				rootVersion: -1,
				sessionId: '',
				dir: false,
				del: false,
				createTime: now,
				modifyTime: now,
				bodyString: markdown,
				transactionId: createUuid(),
				transactionTime: now,
				orgEditorType: 0,
				entryProps: webEntryProps(),
				isMyKeep: false,
				myKeepAuthor: '',
				stickyTime: this.webTimestamp(),
				tags: '',
				...resourcePayload(resources),
			},
		});
	}

	async updateNoteTitle(fileId: string, title: string): Promise<void> {
		const info = await this.getNote(fileId);
		if (info === undefined) {
			throw new YoudaoApiError('YOUDAO_NOTE_NOT_FOUND', 'Youdao note was not found.', 404);
		}
		await this.updateNoteLocation(fileId, title, info.parentId ?? await this.getRootFolderId());
	}

	async moveNote(fileId: string, targetParentId: string): Promise<void> {
		const info = await this.getNote(fileId);
		if (info === undefined) {
			throw new YoudaoApiError('YOUDAO_NOTE_NOT_FOUND', 'Youdao note was not found.', 404);
		}
		await this.updateNoteLocation(fileId, info.title, targetParentId);
	}

	async uploadImage(image: YoudaoImageUpload): Promise<YoudaoUploadedResource> {
		try {
			const transmitId = await this.uploadRawBytes(new Uint8Array(image.data));
			const resourceId = `WEBRESOURCE${createUuid().replaceAll('-', '')}`;
			const now = String(this.webTimestampSeconds());
			const response = await this.webRequestWithHeaders('POST', '/yws/api/personal/sync', {
				query: {
					method: 'putResource',
					resourceId,
					resourceName: image.fileName,
					rootVersion: '-1',
					sessionId: '',
					transmitId,
					genIcon: 'true',
					createTime: now,
					modifyTime: now,
				},
				contentType: 'application/ynote-stream;charset=UTF-8',
				body: {},
				headers: {
					'parameters-length': '0',
					YNOTE_STREAM_REQUEST: 'true',
				},
			});
			const remoteUrl = response.headers.url ?? response.headers.Url ?? firstString(response.body, ['url', 'resourceUrl']);
			if (remoteUrl === undefined) {
				throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao image upload did not return a resource URL.');
			}
			const identity = resourceIdentityFromUrl(remoteUrl);
			if (identity === undefined || identity.resourceId !== resourceId) {
				throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao image upload returned an invalid resource identity.');
			}
			return {
				resourceId,
				version: identity.version,
				remoteUrl,
				fileName: image.fileName,
				mimeType: image.mimeType,
			};
		} catch (error) {
			if (error instanceof AnkiCardLinkError) {
				throw error;
			}
			throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', `Youdao image upload failed for ${image.reference}.`, undefined, { cause: error });
		}
	}

	async publishNote(fileId: string): Promise<YoudaoPublishedShare> {
		await this.ensureSessionReady(true);
		const info = await this.getNote(fileId);
		const payload = await this.webRequest('POST', '/yws/api/personal/share', {
			body: {
				method: 'publish',
				fileId,
				version: info?.version,
				passwordEnable: false,
				collabEnable: false,
				markEnable: true,
				searchEnable: true,
				commentEnable: false,
			},
		});
		const shareUrl = firstString(payload, ['url', 'shareUrl', 'public_link']);
		const shareKey = firstString(payload, ['shareKey', 'public_key', 'id']);
		if (shareUrl === undefined || !/^https:\/\/share\.note\.youdao\.com\//u.test(shareUrl)) {
			throw new YoudaoApiError('YOUDAO_SHARE_PERMISSION_FAILED', 'Youdao share API did not return a public share URL.');
		}
		return { shareUrl, shareKey };
	}

	private async updateNoteLocation(fileId: string, title: string, parentId: string): Promise<void> {
		const now = this.webTimestampSeconds();
		await this.webRequest('POST', '/yws/api/personal/sync?method=push', {
			body: {
				fileId,
				domain: 1,
				del: false,
				dir: false,
				name: title,
				parentId,
				modifyTime: now,
				createTime: now,
				entryType: 0,
				transactionTime: now,
				transactionId: fileId,
				entryProps: webEntryProps(),
				tags: '',
				orgEditorType: 0,
				stickyTime: this.webTimestamp(),
				isMyKeep: false,
				myKeepAuthor: '',
				rootVersion: -1,
				sessionId: '',
			},
		});
	}

	private async loadRootFolderId(): Promise<string> {
		const payload = await this.webRequest('POST', '/yws/api/personal/file?method=getByPath', {
			body: { path: '/', entire: false, purge: false },
		});
		const root = unwrapEntry(payload);
		const rootId = root === undefined ? undefined : firstString(root, ['id', 'fileId']);
		if (rootId === undefined) {
			throw new YoudaoApiError('YOUDAO_API_ERROR', 'Youdao Cloud Note did not return the account root folder.');
		}
		return rootId;
	}

	private async webRequest(
		method: string,
		path: string,
		options: {
			query?: Record<string, string | undefined>;
			body?: Record<string, unknown>;
			contentType?: string;
			headers?: Record<string, string>;
		} = {},
		retrySession = true,
	): Promise<Record<string, unknown>> {
		return (await this.webRequestWithHeaders(method, path, options, retrySession)).body;
	}

	private async webRequestWithHeaders(
		method: string,
		path: string,
		options: {
			query?: Record<string, string | undefined>;
			body?: Record<string, unknown>;
			contentType?: string;
			headers?: Record<string, string>;
		} = {},
		retrySession = true,
	): Promise<{ body: Record<string, unknown>; headers: Record<string, string> }> {
		this.requireConfig();
		await this.ensureSessionReady(false);
		let response: RequestUrlResponse;
		try {
			response = await this.request({
				url: `${YOUDAO_ORIGIN}${path}${buildQuery(options.query)}`,
				method,
				contentType: method === 'GET' ? undefined : options.contentType ?? 'application/x-www-form-urlencoded;charset=UTF-8',
				body: method === 'GET' || options.body === undefined ? undefined : formBody({ ...options.body, cstk: this.cstk() }),
				headers: {
					Accept: '*/*',
					Cookie: this.cookieHeader(),
					'X-API-Key': this.options.settings.youdaoApiKey.trim(),
					...options.headers,
				},
				throw: false,
			});
		} catch {
			throw new YoudaoApiError('YOUDAO_API_ERROR', 'Could not reach Youdao Cloud Note.');
		}
		const payload = parseJsonResponse(response);
		if (retrySession && isAuthResponse(response, payload)) {
			this.clearSession();
			await this.ensureSessionReady(true);
			return this.webRequestWithHeaders(method, path, options, false);
		}
		if (response.status < 200 || response.status >= 300 || isApiErrorPayload(payload)) {
			throw buildApiError(response.status, payload);
		}
		return { body: payload, headers: response.headers };
	}

	private async uploadRawBytes(bytes: Uint8Array): Promise<string> {
		const initialized = await this.webRequest('POST', '/yws/api/personal/sync/upload', {
			body: { md5: md5Hex(bytes) },
			headers: { 'File-Size': String(bytes.byteLength) },
		});
		const init = uploadInitResponse(initialized);
		const chunks = splitUploadChunks(bytes, init.multiPartsCount, init.lastPartLength);
		for (const chunk of chunks) {
			await this.rawRequest(`/yws/api/personal/sync/upload/${encodeURIComponent(init.transmitId)}`, chunk);
		}
		return init.transmitId;
	}

	private async rawRequest(path: string, bytes: Uint8Array): Promise<void> {
		this.requireConfig();
		await this.ensureSessionReady(false);
		const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
		let response: RequestUrlResponse;
		try {
			response = await this.request({
				url: `${YOUDAO_ORIGIN}${path}`,
				method: 'POST',
				contentType: 'application/ynote-stream;charset=utf-8',
				body,
				headers: {
					Accept: '*/*',
					Cookie: this.cookieHeader(),
					'X-API-Key': this.options.settings.youdaoApiKey.trim(),
					'X-Content-Length': String(bytes.byteLength),
					'parameters-length': '0',
				},
				throw: false,
			});
		} catch {
			throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Could not upload bytes to Youdao Cloud Note.');
		}
		const payload = parseJsonResponse(response);
		if (response.status < 200 || response.status >= 300 || isApiErrorPayload(payload)) {
			throw buildApiError(response.status, payload);
		}
	}

	private async ensureSessionReady(force: boolean): Promise<void> {
		if (!force && this.hasUsableSession()) {
			return;
		}
		this.sessionRefresh ??= this.refreshSession().finally(() => {
			this.sessionRefresh = undefined;
		});
		await this.sessionRefresh;
	}

	private async refreshSession(): Promise<void> {
		const ynotePc = this.options.settings.youdaoYnNotePc.trim();
		const cstk = this.cstk();
		const headers: Record<string, string> = {
			Accept: '*/*',
			'User-Agent': 'YNote',
			Cookie: this.cookieHeader(),
		};
		if (ynotePc.length > 0) {
			headers['YNOTE-PC'] = ynotePc;
		}
		let response: RequestUrlResponse;
		try {
			response = await this.request({
				url: `${YOUDAO_ORIGIN}/login/acc/pe/getsess${buildQuery({ product: 'YNOTE', cstk })}`,
				method: 'GET',
				headers,
				throw: false,
			});
		} catch {
			throw new YoudaoApiError('YOUDAO_AUTH_FAILED', 'Could not refresh Youdao session from YNOTE-PC.');
		}
		if (response.status < 200 || response.status >= 300) {
			throw new YoudaoApiError('YOUDAO_AUTH_FAILED', 'YNOTE-PC was rejected by Youdao Cloud Note.', response.status);
		}
		const cookies = parseSetCookieHeader(response.headers);
		if (!cookies.some((cookie) => cookie.startsWith('YNOTE_SESS='))) {
			throw new YoudaoApiError('YOUDAO_AUTH_FAILED', 'YNOTE-PC session refresh did not return YNOTE_SESS.');
		}
		const persistent = this.sessionCookies().filter((cookie) => !/^(?:YNOTE_SESS|YNOTE_LOGIN|JSESSIONID)=/u.test(cookie));
		this.options.settings.youdaoSessionCookies = [...persistent, ...cookies].join('; ');
		this.options.settings.youdaoSessionUpdatedAt = this.now();
		this.options.onSessionChanged?.();
	}

	private hasUsableSession(): boolean {
		return this.options.settings.youdaoSessionUpdatedAt > 0
			&& this.sessionCookies().some((cookie) => cookie.startsWith('YNOTE_SESS='));
	}

	private clearSession(): void {
		this.options.settings.youdaoSessionCookies = this.sessionCookies()
			.filter((cookie) => !/^(?:YNOTE_SESS|YNOTE_LOGIN|JSESSIONID)=/u.test(cookie))
			.join('; ');
	}

	private cookieHeader(): string {
		const ynotePc = this.options.settings.youdaoYnNotePc.trim();
		return [
			...(ynotePc.length > 0 ? [`YNOTE-PC=${ynotePc}`] : []),
			`YNOTE_CSTK=${this.cstk()}`,
			...this.sessionCookies().filter((cookie) => !cookie.startsWith('YNOTE_CSTK=')),
		].join('; ');
	}

	private sessionCookies(): string[] {
		return this.options.settings.youdaoSessionCookies
			.split(';')
			.map((cookie) => cookie.trim())
			.filter((cookie) => cookie.length > 0);
	}

	private cstk(): string {
		const existing = this.sessionCookies().find((cookie) => cookie.startsWith('YNOTE_CSTK='))?.slice('YNOTE_CSTK='.length);
		if (existing !== undefined && existing.length > 0) {
			return existing;
		}
		const cstk = createUuid().replaceAll('-', '');
		this.options.settings.youdaoSessionCookies = [`YNOTE_CSTK=${cstk}`, ...this.sessionCookies()].join('; ');
		return cstk;
	}

	private requireConfig(): void {
		if (this.options.settings.youdaoApiKey.trim().length === 0
			|| (this.options.settings.youdaoYnNotePc.trim().length === 0 && this.sessionCookies().length === 0)) {
			throw new AnkiCardLinkError('YOUDAO_NOT_CONFIGURED', 'Youdao API Key and a Youdao browser Cookie or YNOTE-PC are required.');
		}
	}

	private webTimestamp(): number {
		return this.now();
	}

	private webTimestampSeconds(): number {
		return Math.floor(this.now() / 1000);
	}
}

function mapDriveEntry(entry: Record<string, unknown>, parentId?: string): YoudaoDriveEntry {
	const id = firstString(entry, ['id', 'fileId']);
	if (id === undefined) {
		throw invalidResponse('entry ID');
	}
	const props = isRecord(entry.entryProps) ? entry.entryProps : {};
	return {
		id,
		name: firstString(entry, ['name', 'title', 'fileName']) ?? '',
		dir: firstBoolean(entry, ['dir', 'isFolder']) ?? false,
		parentId: firstString(entry, ['parentId', 'parent_id']) ?? parentId,
		version: firstNumber(entry, ['version', 'fileVersion']),
		shareUrl: firstString(props, ['public_link']) ?? firstString(entry, ['public_link', 'shareUrl']),
		shareKey: firstString(props, ['public_key']) ?? firstString(entry, ['public_key', 'shareKey']),
		deleted: firstBoolean(entry, ['deleted', 'del']),
	};
}

function unwrapEntry(payload: Record<string, unknown>): Record<string, unknown> | undefined {
	for (const key of ['fileEntry', 'entry', 'file']) {
		if (isRecord(payload[key])) return payload[key];
	}
	return isRecord(payload.id) ? undefined : payload;
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

function formBody(body: Record<string, unknown>): string {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(body)) {
		const serialized = formValue(value);
		if (serialized !== undefined) params.set(key, serialized);
	}
	return params.toString();
}

function formValue(value: unknown): string | undefined {
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	return undefined;
}

function parseJsonResponse(response: RequestUrlResponse): Record<string, unknown> {
	try {
		const value: unknown = response.text.trim().length === 0 ? {} : JSON.parse(response.text);
		return requireRecord(value, 'Youdao response');
	} catch (error) {
		throw new YoudaoApiError('YOUDAO_API_ERROR', `Youdao returned an invalid response (HTTP ${response.status}).`, response.status, { cause: error });
	}
}

function parseSetCookieHeader(headers: Record<string, string>): string[] {
	const combined = headers['set-cookie'] ?? headers['Set-Cookie'] ?? '';
	return combined
		.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/u)
		.map((value) => value.split(';', 1)[0]?.trim() ?? '')
		.filter((cookie) => /^(?:YNOTE_SESS|YNOTE_LOGIN|JSESSIONID)=/u.test(cookie));
}

function isAuthResponse(response: RequestUrlResponse, payload: Record<string, unknown>): boolean {
	const message = firstString(payload, ['message', 'msg', 'desc']) ?? '';
	return response.status === 401
		|| response.status === 403
		|| payload.code === 401
		|| payload.code === 403
		|| /未登录|登录.*过期|authentication failed|login expired|not\s*login/iu.test(message);
}

function isApiErrorPayload(payload: Record<string, unknown>): boolean {
	const code = payload.code ?? payload.error;
	return code !== undefined && code !== null && code !== 0 && code !== '0';
}

function buildApiError(status: number, payload: Record<string, unknown>): YoudaoApiError {
	const message = firstString(payload, ['message', 'msg', 'desc']) ?? `HTTP ${status}`;
	if (status === 404 || payload.error === 404 || payload.code === 404) {
		return new YoudaoApiError('YOUDAO_NOTE_NOT_FOUND', 'Youdao note was not found.', status);
	}
	if (status === 401 || status === 403 || payload.code === 401 || payload.code === 403) {
		return new YoudaoApiError('YOUDAO_AUTH_FAILED', 'Youdao authentication failed.', status);
	}
	return new YoudaoApiError('YOUDAO_API_ERROR', `Youdao API request failed: ${message.slice(0, 300)}`, status);
}

function isNotFound(error: unknown): boolean {
	return error instanceof YoudaoApiError && (error.httpStatus === 404 || error.code === 'YOUDAO_NOTE_NOT_FOUND');
}

function webEntryProps(): string {
	return JSON.stringify({
		encrypted: 'false',
		bgImageId: '',
		orgEditorType: 0,
		multiDevicesEnable: 'false',
	});
}

function resourcePayload(resources: readonly YoudaoUploadedResource[]): Record<string, string> {
	return resources.length === 0
		? {}
		: { resources: `${resources.map((resource) => `${resource.resourceId}:${resource.version}`).join(';')};` };
}

function resourceIdentityFromUrl(value: string): { resourceId: string; version: string } | undefined {
	try {
		const path = new URL(value, YOUDAO_ORIGIN).pathname;
		const match = /^\/yws\/res\/([^/]+)\/([A-Za-z0-9_]+)/u.exec(path);
		return match?.[1] !== undefined && match[2] !== undefined
			? { version: match[1], resourceId: match[2] }
			: undefined;
	} catch {
		return undefined;
	}
}

function uploadInitResponse(raw: Record<string, unknown>): {
	transmitId: string;
	multiPartsCount: number;
	lastPartLength: number;
} {
	const transmitId = firstString(raw, ['transmitId']);
	const multiPartsCount = firstNumber(raw, ['multiPartsCount']);
	const lastPartLength = firstNumber(raw, ['lastPartLength']);
	if (transmitId === undefined
		|| multiPartsCount === undefined
		|| lastPartLength === undefined
		|| !Number.isInteger(multiPartsCount)
		|| multiPartsCount < 1
		|| !Number.isInteger(lastPartLength)
		|| lastPartLength < 0) {
		throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao upload initialization returned invalid chunk metadata.');
	}
	return { transmitId, multiPartsCount, lastPartLength };
}

function splitUploadChunks(bytes: Uint8Array, multiPartsCount: number, lastPartLength: number): Uint8Array[] {
	if (multiPartsCount === 1) {
		if (lastPartLength !== bytes.byteLength) {
			throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao upload chunk metadata does not match the image size.');
		}
		return [bytes];
	}
	const regularBytes = bytes.byteLength - lastPartLength;
	const regularPartLength = regularBytes / (multiPartsCount - 1);
	if (!Number.isInteger(regularPartLength) || regularPartLength <= 0) {
		throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao upload returned unsupported chunk metadata.');
	}
	const chunks: Uint8Array[] = [];
	let offset = 0;
	for (let index = 0; index < multiPartsCount - 1; index += 1) {
		chunks.push(bytes.slice(offset, offset + regularPartLength));
		offset += regularPartLength;
	}
	chunks.push(bytes.slice(offset));
	if (chunks.at(-1)?.byteLength !== lastPartLength) {
		throw new YoudaoApiError('YOUDAO_MEDIA_UPLOAD_FAILED', 'Youdao upload last chunk length does not match the server response.');
	}
	return chunks;
}

function createWebFileId(): string {
	return `WEB${createUuid().replaceAll('-', '')}`;
}

function createUuid(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
	bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
	return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
}

function md5Hex(input: Uint8Array): string {
	const words: number[] = [];
	for (let index = 0; index < input.length; index += 1) {
		words[index >> 2] = (words[index >> 2] ?? 0) | ((input[index] ?? 0) << ((index % 4) * 8));
	}
	const bitLength = input.length * 8;
	words[bitLength >> 5] = (words[bitLength >> 5] ?? 0) | (0x80 << (bitLength % 32));
	words[(((bitLength + 64) >>> 9) << 4) + 14] = bitLength;

	let a = 0x67452301;
	let b = 0xefcdab89;
	let c = 0x98badcfe;
	let d = 0x10325476;

	for (let index = 0; index < words.length; index += 16) {
		const oldA = a;
		const oldB = b;
		const oldC = c;
		const oldD = d;

		a = md5F(a, b, c, d, words[index] ?? 0, 7, 0xd76aa478);
		d = md5F(d, a, b, c, words[index + 1] ?? 0, 12, 0xe8c7b756);
		c = md5F(c, d, a, b, words[index + 2] ?? 0, 17, 0x242070db);
		b = md5F(b, c, d, a, words[index + 3] ?? 0, 22, 0xc1bdceee);
		a = md5F(a, b, c, d, words[index + 4] ?? 0, 7, 0xf57c0faf);
		d = md5F(d, a, b, c, words[index + 5] ?? 0, 12, 0x4787c62a);
		c = md5F(c, d, a, b, words[index + 6] ?? 0, 17, 0xa8304613);
		b = md5F(b, c, d, a, words[index + 7] ?? 0, 22, 0xfd469501);
		a = md5F(a, b, c, d, words[index + 8] ?? 0, 7, 0x698098d8);
		d = md5F(d, a, b, c, words[index + 9] ?? 0, 12, 0x8b44f7af);
		c = md5F(c, d, a, b, words[index + 10] ?? 0, 17, 0xffff5bb1);
		b = md5F(b, c, d, a, words[index + 11] ?? 0, 22, 0x895cd7be);
		a = md5F(a, b, c, d, words[index + 12] ?? 0, 7, 0x6b901122);
		d = md5F(d, a, b, c, words[index + 13] ?? 0, 12, 0xfd987193);
		c = md5F(c, d, a, b, words[index + 14] ?? 0, 17, 0xa679438e);
		b = md5F(b, c, d, a, words[index + 15] ?? 0, 22, 0x49b40821);

		a = md5G(a, b, c, d, words[index + 1] ?? 0, 5, 0xf61e2562);
		d = md5G(d, a, b, c, words[index + 6] ?? 0, 9, 0xc040b340);
		c = md5G(c, d, a, b, words[index + 11] ?? 0, 14, 0x265e5a51);
		b = md5G(b, c, d, a, words[index] ?? 0, 20, 0xe9b6c7aa);
		a = md5G(a, b, c, d, words[index + 5] ?? 0, 5, 0xd62f105d);
		d = md5G(d, a, b, c, words[index + 10] ?? 0, 9, 0x02441453);
		c = md5G(c, d, a, b, words[index + 15] ?? 0, 14, 0xd8a1e681);
		b = md5G(b, c, d, a, words[index + 4] ?? 0, 20, 0xe7d3fbc8);
		a = md5G(a, b, c, d, words[index + 9] ?? 0, 5, 0x21e1cde6);
		d = md5G(d, a, b, c, words[index + 14] ?? 0, 9, 0xc33707d6);
		c = md5G(c, d, a, b, words[index + 3] ?? 0, 14, 0xf4d50d87);
		b = md5G(b, c, d, a, words[index + 8] ?? 0, 20, 0x455a14ed);
		a = md5G(a, b, c, d, words[index + 13] ?? 0, 5, 0xa9e3e905);
		d = md5G(d, a, b, c, words[index + 2] ?? 0, 9, 0xfcefa3f8);
		c = md5G(c, d, a, b, words[index + 7] ?? 0, 14, 0x676f02d9);
		b = md5G(b, c, d, a, words[index + 12] ?? 0, 20, 0x8d2a4c8a);

		a = md5H(a, b, c, d, words[index + 5] ?? 0, 4, 0xfffa3942);
		d = md5H(d, a, b, c, words[index + 8] ?? 0, 11, 0x8771f681);
		c = md5H(c, d, a, b, words[index + 11] ?? 0, 16, 0x6d9d6122);
		b = md5H(b, c, d, a, words[index + 14] ?? 0, 23, 0xfde5380c);
		a = md5H(a, b, c, d, words[index + 1] ?? 0, 4, 0xa4beea44);
		d = md5H(d, a, b, c, words[index + 4] ?? 0, 11, 0x4bdecfa9);
		c = md5H(c, d, a, b, words[index + 7] ?? 0, 16, 0xf6bb4b60);
		b = md5H(b, c, d, a, words[index + 10] ?? 0, 23, 0xbebfbc70);
		a = md5H(a, b, c, d, words[index + 13] ?? 0, 4, 0x289b7ec6);
		d = md5H(d, a, b, c, words[index] ?? 0, 11, 0xeaa127fa);
		c = md5H(c, d, a, b, words[index + 3] ?? 0, 16, 0xd4ef3085);
		b = md5H(b, c, d, a, words[index + 6] ?? 0, 23, 0x04881d05);
		a = md5H(a, b, c, d, words[index + 9] ?? 0, 4, 0xd9d4d039);
		d = md5H(d, a, b, c, words[index + 12] ?? 0, 11, 0xe6db99e5);
		c = md5H(c, d, a, b, words[index + 15] ?? 0, 16, 0x1fa27cf8);
		b = md5H(b, c, d, a, words[index + 2] ?? 0, 23, 0xc4ac5665);

		a = md5I(a, b, c, d, words[index] ?? 0, 6, 0xf4292244);
		d = md5I(d, a, b, c, words[index + 7] ?? 0, 10, 0x432aff97);
		c = md5I(c, d, a, b, words[index + 14] ?? 0, 15, 0xab9423a7);
		b = md5I(b, c, d, a, words[index + 5] ?? 0, 21, 0xfc93a039);
		a = md5I(a, b, c, d, words[index + 12] ?? 0, 6, 0x655b59c3);
		d = md5I(d, a, b, c, words[index + 3] ?? 0, 10, 0x8f0ccc92);
		c = md5I(c, d, a, b, words[index + 10] ?? 0, 15, 0xffeff47d);
		b = md5I(b, c, d, a, words[index + 1] ?? 0, 21, 0x85845dd1);
		a = md5I(a, b, c, d, words[index + 8] ?? 0, 6, 0x6fa87e4f);
		d = md5I(d, a, b, c, words[index + 15] ?? 0, 10, 0xfe2ce6e0);
		c = md5I(c, d, a, b, words[index + 6] ?? 0, 15, 0xa3014314);
		b = md5I(b, c, d, a, words[index + 13] ?? 0, 21, 0x4e0811a1);
		a = md5I(a, b, c, d, words[index + 4] ?? 0, 6, 0xf7537e82);
		d = md5I(d, a, b, c, words[index + 11] ?? 0, 10, 0xbd3af235);
		c = md5I(c, d, a, b, words[index + 2] ?? 0, 15, 0x2ad7d2bb);
		b = md5I(b, c, d, a, words[index + 9] ?? 0, 21, 0xeb86d391);

		a = add32(a, oldA);
		b = add32(b, oldB);
		c = add32(c, oldC);
		d = add32(d, oldD);
	}

	return [a, b, c, d].map(wordToHex).join('');
}

function md5F(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return md5Round((b & c) | (~b & d), a, b, x, s, t);
}

function md5G(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return md5Round((b & d) | (c & ~d), a, b, x, s, t);
}

function md5H(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return md5Round(b ^ c ^ d, a, b, x, s, t);
}

function md5I(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
	return md5Round(c ^ (b | ~d), a, b, x, s, t);
}

function md5Round(q: number, a: number, b: number, x: number, s: number, t: number): number {
	const value = add32(add32(a, q), add32(x, t));
	return add32((value << s) | (value >>> (32 - s)), b);
}

function add32(a: number, b: number): number {
	return (a + b) | 0;
}

function wordToHex(word: number): string {
	let output = '';
	for (let index = 0; index < 4; index += 1) {
		output += ((word >>> (index * 8)) & 0xff).toString(16).padStart(2, '0');
	}
	return output;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
	if (!isRecord(value)) throw invalidResponse(label);
	return value;
}

function optionalArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
	for (const key of keys) {
		if (typeof record[key] === 'string') return record[key];
	}
	return undefined;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
	for (const key of keys) {
		if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
	}
	return undefined;
}

function firstBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
	for (const key of keys) {
		if (typeof record[key] === 'boolean') return record[key];
	}
	return undefined;
}

function invalidResponse(label: string): YoudaoApiError {
	return new YoudaoApiError('YOUDAO_API_ERROR', `Youdao returned invalid ${label}.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
