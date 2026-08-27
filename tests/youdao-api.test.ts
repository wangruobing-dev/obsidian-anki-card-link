import { describe, expect, it, vi } from 'vitest';
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { DEFAULT_SETTINGS } from '../src/settings';
import { YoudaoApiService } from '../src/services/youdao-api';

vi.mock('obsidian', () => ({ requestUrl: vi.fn() }));

describe('YoudaoApiService', () => {
	it('refreshes a short session from YNOTE-PC before Web API requests', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('/login/acc/pe/getsess')) {
				return response({}, 200, { 'set-cookie': 'YNOTE_SESS=session; Path=/, YNOTE_LOGIN=login; Path=/' });
			}
			return response({ entries: [] });
		});

		await service.listFolder('0');

		expect(requests[0]?.url).toContain('/login/acc/pe/getsess?product=YNOTE&cstk=');
		expect(requests[0]?.headers).toMatchObject({ 'YNOTE-PC': 'ynote-pc' });
		expect(requests[1]?.headers).not.toHaveProperty('X-API-Key');
		expect(requests[1]?.headers).toMatchObject({ 'User-Agent': 'YNote' });
		expect(String(requests[1]?.headers?.Cookie)).toContain('YNOTE_SESS=session');
	});

	it('uses a copied browser session cookie without YNOTE-PC', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			return response({ entries: [] });
		}, '', 'P_INFO=account; YNOTE_SESS=browser-session; YNOTE_LOGIN=browser-login; YNOTE_CSTK=cstk');

		await service.listFolder('0');

		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).not.toContain('/login/acc/pe/getsess');
		expect(requests[0]?.headers?.['YNOTE-PC']).toBeUndefined();
		expect(String(requests[0]?.headers?.Cookie)).toContain('P_INFO=account');
		expect(String(requests[0]?.headers?.Cookie)).toContain('YNOTE_SESS=browser-session');
	});

	it('maps folder entries wrapped in fileEntry objects', async () => {
		const service = api((request) => {
			if (request.url.includes('/login/acc/pe/getsess')) {
				return response({}, 200, { 'set-cookie': 'YNOTE_SESS=session; Path=/' });
			}
			return response({ entries: [{ fileEntry: { id: 'note-1', name: 'note.md', dir: false } }] });
		}, '', 'YNOTE-PC=pc');

		await expect(service.listFolder('root')).resolves.toEqual([
			{ id: 'note-1', name: 'note.md', dir: false, parentId: 'root' },
	]);
	});

	it('uses second-based timestamps when creating folders', async () => {
		let createRequest: RequestUrlParam | undefined;
		const service = api((request) => {
			if (request.url.includes('/yws/api/personal/sync?method=push')) {
				createRequest = request;
			}
			return response({ id: 'folder-1' });
		}, 'YNOTE_CSTK=cstk; YNOTE_SESS=session', 'ynote-pc', 10000);

		await service.createFolder('root', 'Obsidian');

		const requestBody = createRequest?.body;
		if (typeof requestBody !== 'string') {
			throw new Error('Expected the Youdao folder request body to be URL-encoded text.');
		}
		const body = new URLSearchParams(requestBody);
		expect(Number(body.get('createTime'))).toBe(10);
		expect(Number(body.get('modifyTime'))).toBe(10);
	});

	it('does not refresh a valid session for a non-auth 403 response', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			return response({ message: 'Sharing is disabled for this account.' }, 403);
		}, 'YNOTE_CSTK=cstk; YNOTE_SESS=session');

		await expect(service.listFolder('root')).rejects.toMatchObject({ code: 'YOUDAO_AUTH_FAILED', httpStatus: 403 });
		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).not.toContain('/login/acc/pe/getsess');
	});

	it('accepts array Set-Cookie headers returned by Obsidian requestUrl', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('/login/acc/pe/getsess')) {
				return response({}, 200, {
					'set-cookie': [
						'YNOTE_SESS=array-session; Path=/',
						'YNOTE_LOGIN=array-login; Path=/',
					],
				});
			}
			return response({ entries: [] });
		});

		await service.listFolder('0');

		expect(String(requests[1]?.headers?.Cookie)).toContain('YNOTE_SESS=array-session');
		expect(String(requests[1]?.headers?.Cookie)).toContain('YNOTE_LOGIN=array-login');
	});

	it('discovers the account root folder instead of assuming file ID 0', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('method=getByPath')) {
				return response({ id: 'account-root', name: 'ROOT', dir: true });
			}
			return response({ entries: [] });
		}, 'YNOTE_CSTK=cstk; YNOTE_SESS=session');

		await service.testConnection();

		expect(requests[0]?.url).toContain('/yws/api/personal/file?method=getByPath');
		expect(requests[0]?.body).toContain('path=%2F');
		expect(requests[1]?.url).toContain('/yws/api/personal/file/account-root?');
	});

	it('uploads an image through raw upload and putResource', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('/sync/upload/') && request.method === 'POST') {
				return response({ code: 0, data: { transmitId: 'tx-1' } });
			}
			if (request.url.includes('/sync/upload')) {
				return response({ transmitId: 'tx-1', multiPartsCount: 1, lastPartLength: 3 });
			}
			if (request.url.includes('method=putResource')) {
				const resourceId = new URL(request.url).searchParams.get('resourceId') ?? '';
				return response({}, 200, { url: `https://note.youdao.com/yws/res/v1/${resourceId}` });
			}
			return response({});
		}, 'YNOTE_CSTK=cstk; YNOTE_SESS=session');

		const uploaded = await service.uploadImage({
			reference: 'a.png',
			placeholder: 'placeholder',
			fileName: 'a.png',
			mimeType: 'image/png',
			data: new TextEncoder().encode('abc').buffer,
		});

		const init = requests.find((request) => request.url.endsWith('/yws/api/personal/sync/upload'));
		expect(init?.body).toBe('md5=900150983cd24fb0d6963f7d28e17f72&cstk=cstk');
		const raw = requests.find((request) => request.url.includes('/sync/upload/tx-1'));
		expect(raw?.body).toBeInstanceOf(ArrayBuffer);
		expect(uploaded.remoteUrl).toMatch(/^https:\/\/note\.youdao\.com\/yws\/res\/v1\/WEBRESOURCE/u);
		expect(uploaded.version).toBe('v1');
	});

	it('uses the public share URL returned by Youdao instead of constructing one', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('/login/acc/pe/getsess')) {
				return response({}, 200, { 'set-cookie': 'YNOTE_SESS=session; Path=/' });
			}
			if (request.url.includes('method=getById')) {
				return response({ fileEntry: { id: 'note-1', name: 'note.md', dir: false, version: 5 } });
			}
			return response({ url: 'https://share.note.youdao.com/public-returned', id: 'note-1', shareKey: 'share-key' });
		}, 'YNOTE_CSTK=cstk; YNOTE_SESS=session');

		const share = await service.publishNote('note-1');

		expect(share.shareUrl).toBe('https://share.note.youdao.com/public-returned');
		expect(share.shareKey).toBe('share-key');
		const publishRequest = requests.find((request) => request.url.endsWith('/yws/api/personal/share'));
		const publishBody = publishRequest?.body;
		if (typeof publishBody !== 'string') {
			throw new Error('Expected the Youdao share request body to be URL-encoded text.');
		}
		const publishParams = new URLSearchParams(publishBody);
		expect(publishParams.has('version')).toBe(false);
		expect(publishParams.has('passwordEnable')).toBe(false);
		expect(requests.some((request) => request.url.includes('/login/acc/pe/getsess'))).toBe(false);
	});
});

function api(
	request: (request: RequestUrlParam) => RequestUrlResponse | Promise<RequestUrlResponse>,
	sessionCookies = '',
	ynotePc = 'ynote-pc',
	now = 10,
): YoudaoApiService {
	return new YoudaoApiService({
		settings: {
			...DEFAULT_SETTINGS,
			youdaoApiKey: 'api-key',
			youdaoYnNotePc: ynotePc,
			youdaoSessionCookies: sessionCookies,
			youdaoSessionUpdatedAt: sessionCookies.length > 0 ? 10 : 0,
		},
		request: async (input) => request(input),
			now: () => now,
	});
}

function response(payload: Record<string, unknown>, status = 200, headers: Record<string, unknown> = {}): RequestUrlResponse {
	const text = JSON.stringify(payload);
	return {
		status,
		headers: headers as Record<string, string>,
		arrayBuffer: new TextEncoder().encode(text).buffer,
		json: payload,
		text,
	};
}
