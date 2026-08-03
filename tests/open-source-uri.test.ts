import { describe, expect, it } from 'vitest';
import { buildOpenObsidianUri, parseOpenObsidianProtocolParams, parseOpenObsidianUri } from '../src/core/open-source-uri';

describe('Anki to Obsidian source URI', () => {
	it.each([
		['若冰的知识库', '测试/中文 文件.md'],
		['Vault #1 & 2%', 'folder/a#b&c%20.md'],
	])('round-trips vault %s and path %s', (vaultName, filePath) => {
		const uri = buildOpenObsidianUri({ vaultName, filePath, uid: 'acl-1234abcd' });
		expect(parseOpenObsidianUri(uri)).toEqual({ version: 2, vaultName, filePath, uid: 'acl-1234abcd' });
	});

	it('uses vault for cold-start routing and avoids Obsidian reserved path parameter', () => {
		const uri = buildOpenObsidianUri({ vaultName: '若冰的知识库', filePath: 'test/linux.md', uid: 'acl-1234abcd' });
		expect(uri).toContain('obsidian://anki-card-link-open?');
		expect(uri).toContain('vault=%E8%8B%A5%E5%86%B0%E7%9A%84%E7%9F%A5%E8%AF%86%E5%BA%93');
		expect(uri).toContain('filePath=test%2Flinux.md');
		expect(new URL(uri).searchParams.has('path')).toBe(false);
	});

	it('keeps parsing the intermediate vaultName and path parameters when they reach the plugin', () => {
		expect(parseOpenObsidianProtocolParams({
			v: '2', vaultName: '旧库', path: 'a.md', uid: 'acl-1234abcd',
		})).toMatchObject({ vaultName: '旧库' });
	});

	it.each([
		[{ v: '2', vault: 'v', filePath: 'a.md' }, /UID/u],
		[{ v: '2', vault: 'v', filePath: 'a.md', uid: 'bad' }, /UID/u],
		[{ v: '2', vault: 'v', uid: 'acl-1234abcd' }, /path/u],
		[{ v: '3', vault: 'v', filePath: 'a.md', uid: 'acl-1234abcd' }, /version/u],
		[{ v: '2', vault: 'v', filePath: '../a.md', uid: 'acl-1234abcd' }, /traversal/u],
	] as const)('rejects invalid params %#', (params, pattern) => {
		expect(() => parseOpenObsidianProtocolParams(params)).toThrow(pattern);
	});
});
