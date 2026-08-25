import { describe, expect, it, vi } from 'vitest';
import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { FeishuApiService } from '../src/services/feishu-api';

vi.mock('obsidian', () => ({ requestUrl: vi.fn() }));

describe('FeishuApiService', () => {
	it('uses requestUrl-compatible REST calls and caches tenant access tokens', async () => {
		let authCalls = 0;
		const requests: RequestUrlParam[] = [];
		const service = new FeishuApiService({
			appId: 'app-id',
			appSecret: 'app-secret',
			request: async (request) => {
				requests.push(request);
				if (request.url.includes('/auth/')) {
					authCalls += 1;
					return response({ code: 0, tenant_access_token: 'token', expire: 7200 });
				}
				return response({ code: 0, data: { token: `folder-${requests.length}` } });
			},
			now: () => 1_000,
		});
		await service.createFolder('root', 'Java');
		await service.createFolder('root', 'Spring');
		expect(authCalls).toBe(1);
		expect(requests[1]?.url).toBe('https://open.feishu.cn/open-apis/drive/v1/files/create_folder');
		expect(requests[1]?.method).toBe('POST');
	});

	it('refreshes once and retries when Feishu rejects the cached token', async () => {
		let authCalls = 0;
		let folderCalls = 0;
		const service = new FeishuApiService({
			appId: 'app-id',
			appSecret: 'app-secret',
			request: async (request) => {
				if (request.url.includes('/auth/')) {
					authCalls += 1;
					return response({ code: 0, tenant_access_token: `token-${authCalls}`, expire: 7200 });
				}
				folderCalls += 1;
				return folderCalls === 1
					? response({ code: 99991663, msg: 'token invalid' })
					: response({ code: 0, data: { token: 'folder-ok' } });
			},
		});
		expect(await service.createFolder('root', 'Java')).toBe('folder-ok');
		expect(authCalls).toBe(2);
		expect(folderCalls).toBe(2);
	});

	it('sends media as an ArrayBuffer multipart body without exposing credentials in errors', async () => {
		const bodies: Array<string | ArrayBuffer | undefined> = [];
		const service = new FeishuApiService({
			appId: 'app-id',
			appSecret: 'highly-secret',
			request: async (request) => {
				bodies.push(request.body);
				return response({ code: 10003, msg: 'bad app credentials' }, 400);
			},
		});
		await expect(service.createDocument('test')).rejects.not.toThrow(/highly-secret|Authorization|Bearer/u);
		expect(typeof bodies[0]).toBe('string');
	});

	it('maps converted image blocks by placeholder URL before uploading and replacing them', async () => {
		const requests: RequestUrlParam[] = [];
		const placeholders = ['https://anki-card-link.invalid/local-image/0', 'https://anki-card-link.invalid/local-image/1'] as const;
		const service = new FeishuApiService({
			appId: 'app-id',
			appSecret: 'app-secret',
			request: async (request) => {
				requests.push(request);
				if (request.url.includes('/auth/')) return response({ code: 0, tenant_access_token: 'token', expire: 7200 });
				if (request.url.endsWith('/blocks/convert')) {
					return response({ code: 0, data: {
						first_level_block_ids: ['temp-1', 'temp-2'],
						blocks: [
							{ block_id: 'temp-2', block_type: 27, image: {} },
							{ block_id: 'temp-1', block_type: 27, image: {} },
						],
						block_id_to_image_urls: [
							{ block_id: 'temp-2', image_url: placeholders[1] },
							{ block_id: 'temp-1', image_url: placeholders[0] },
						],
					} });
				}
				if (request.method === 'GET' && request.url.includes('/blocks?')) {
					return response({ code: 0, data: { items: [{ block_id: 'doc', block_type: 1, children: [] }], has_more: false } });
				}
				if (request.url.includes('/descendant')) {
					return response({ code: 0, data: { block_id_relations: [
						{ temporary_block_id: 'temp-1', block_id: 'real-1' },
						{ temporary_block_id: 'temp-2', block_id: 'real-2' },
					] } });
				}
				if (request.url.includes('/medias/upload_all')) {
					const uploadNumber = requests.filter((item) => item.url.includes('/medias/upload_all')).length;
					return response({ code: 0, data: { file_token: `media-${uploadNumber}` } });
				}
				return response({ code: 0, data: {} });
			},
		});
		await service.replaceDocumentContent('doc', '![one](placeholder-1)\n![two](placeholder-2)', [
			image('one.png', placeholders[0], 1),
			image('two.png', placeholders[1], 2),
		]);
		const uploads = requests.filter((request) => request.url.includes('/medias/upload_all'));
		expect(uploads).toHaveLength(2);
		expect(uploads.every((request) => request.body instanceof ArrayBuffer)).toBe(true);
		const update = requests.find((request) => request.url.includes('/blocks/batch_update'));
		const updateBody = typeof update?.body === 'string' ? update.body : '';
		expect(JSON.parse(updateBody)).toEqual({ requests: [
			{ block_id: 'real-1', replace_image: { token: 'media-1' } },
			{ block_id: 'real-2', replace_image: { token: 'media-2' } },
		] });
	});
});

function image(fileName: string, placeholder: string, value: number) {
	return { reference: fileName, placeholder, fileName, mimeType: 'image/png', data: new Uint8Array([value]).buffer };
}

function response(payload: Record<string, unknown>, status = 200): RequestUrlResponse {
	const text = JSON.stringify(payload);
	return {
		status,
		headers: {},
		arrayBuffer: new TextEncoder().encode(text).buffer,
		json: payload,
		text,
	};
}
