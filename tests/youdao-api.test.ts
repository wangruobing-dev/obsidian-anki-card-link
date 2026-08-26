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
		expect(requests[1]?.headers).toMatchObject({ 'X-API-Key': 'api-key' });
		expect(String(requests[1]?.headers?.Cookie)).toContain('YNOTE_SESS=session');
	});

	it('refreshes a session from a copied browser cookie header without YNOTE-PC', async () => {
		const requests: RequestUrlParam[] = [];
		const service = api((request) => {
			requests.push(request);
			if (request.url.includes('/login/acc/pe/getsess')) {
				return response({}, 200, { 'set-cookie': 'YNOTE_SESS=refreshed; Path=/, YNOTE_LOGIN=refreshed-login; Path=/' });
			}
			return response({ entries: [] });
		}, '', 'P_INFO=account; YNOTE_SESS=browser-session; YNOTE_LOGIN=browser-login; YNOTE_CSTK=cstk');

		await service.listFolder('0');

		expect(requests).toHaveLength(2);
		expect(requests[0]?.url).toContain('/login/acc/pe/getsess');
		expect(requests[0]?.headers?.['YNOTE-PC']).toBeUndefined();
		expect(String(requests[0]?.headers?.Cookie)).toContain('P_INFO=account');
		expect(String(requests[1]?.headers?.Cookie)).toContain('YNOTE_SESS=refreshed');
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
		const service = api((request) => {
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
	});
});

function api(
	request: (request: RequestUrlParam) => RequestUrlResponse | Promise<RequestUrlResponse>,
	sessionCookies = '',
	ynotePc = 'ynote-pc',
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
		now: () => 10,
	});
}

function response(payload: Record<string, unknown>, status = 200, headers: Record<string, string> = {}): RequestUrlResponse {
	const text = JSON.stringify(payload);
	return {
		status,
		headers,
		arrayBuffer: new TextEncoder().encode(text).buffer,
		json: payload,
		text,
	};
}
