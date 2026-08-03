import { describe, expect, it } from 'vitest';
import { CardLocationIndex } from '../src/services/card-location-index';
import {
	ObsidianSourceLocator,
	type ObsidianSourceHost,
	type SourceEditor,
	type SourceFile,
} from '../src/services/obsidian-source-locator';
import { buildCardSyntax } from '../src/core/card-syntax';

class FakeHost implements ObsidianSourceHost {
	vaultName = '若冰的知识库';
	files = new Map<string, string>();
	opened: string[] = [];
	cursors: Array<{ line: number; ch: number }> = [];
	scrolls: number[] = [];
	provideEditor = true;

	getVaultName(): string { return this.vaultName; }
	getFile(path: string): SourceFile | undefined { return this.files.has(path) ? { path } : undefined; }
	async readFile(file: SourceFile): Promise<string> { return this.files.get(file.path) ?? ''; }
	async openFile(file: SourceFile): Promise<SourceEditor | undefined> {
		this.opened.push(file.path);
		if (!this.provideEditor) return undefined;
		return {
			setCursor: (position) => this.cursors.push(position),
			scrollIntoView: (range) => this.scrolls.push(range.from.line),
		};
	}
}

const markdown = '# 标题\n问题\n?\n答案\n\n[Open](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)';

describe('Obsidian source locator', () => {
	it('uses the URI path and positions the card start instead of the link', async () => {
		const host = new FakeHost();
		host.files.set('cards/a.md', markdown);
		const result = await new ObsidianSourceLocator(host, new CardLocationIndex()).open({ vaultName: host.vaultName, filePath: 'cards/a.md', uid: 'acl-1234abcd' });
		expect(result).toEqual({ path: 'cards/a.md', line: 1, positioned: true });
		expect(host.cursors).toEqual([{ line: 1, ch: 0 }]);
		expect(host.scrolls).toEqual([1]);
	});

	it('falls back to the local index when the URI path is stale', async () => {
		const host = new FakeHost();
		host.files.set('moved/a.md', markdown);
		const index = new CardLocationIndex({ 'acl-1234abcd': { path: 'moved/a.md', updatedAt: 1 } });
		await new ObsidianSourceLocator(host, index).open({ vaultName: host.vaultName, filePath: 'old/a.md', uid: 'acl-1234abcd' });
		expect(host.opened).toEqual(['moved/a.md']);
	});

	it('uses customized card syntax when positioning the source', async () => {
		const host = new FakeHost();
		host.files.set('a.md', '问题=>答案\n\n[Open](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)');
		const syntax = buildCardSyntax({ singleLineSeparators: '=>', multiLineSeparators: 'ANSWER' });
		await new ObsidianSourceLocator(host, new CardLocationIndex(), syntax)
			.open({ vaultName: host.vaultName, filePath: 'a.md', uid: 'acl-1234abcd' });
		expect(host.cursors).toEqual([{ line: 0, ch: 0 }]);
	});

	it('opens the file but degrades cleanly when an editor is unavailable', async () => {
		const host = new FakeHost();
		host.files.set('a.md', markdown);
		host.provideEditor = false;
		await expect(new ObsidianSourceLocator(host, new CardLocationIndex()).open({ vaultName: host.vaultName, filePath: 'a.md', uid: 'acl-1234abcd' })).resolves.toMatchObject({ positioned: false });
	});

	it('rejects vault mismatch, missing files, missing UID, and duplicate UID', async () => {
		const host = new FakeHost();
		const locator = new ObsidianSourceLocator(host, new CardLocationIndex());
		await expect(locator.open({ vaultName: '其他库', filePath: 'a.md', uid: 'acl-1234abcd' })).rejects.toMatchObject({ code: 'VAULT_MISMATCH' });
		await expect(locator.open({ vaultName: host.vaultName, filePath: 'a.md', uid: 'acl-1234abcd' })).rejects.toMatchObject({ code: 'SOURCE_FILE_NOT_FOUND' });
		host.files.set('a.md', '问题 :: 答案');
		await expect(locator.open({ vaultName: host.vaultName, filePath: 'a.md', uid: 'acl-1234abcd' })).rejects.toMatchObject({ code: 'CARD_UID_NOT_FOUND' });
		host.files.set('a.md', `${markdown}\n\n另一题 :: 答案\n\n[Open](obsidian://anki-card-link?type=nid&value=11&uid=acl-1234abcd&v=2)`);
		await expect(locator.open({ vaultName: host.vaultName, filePath: 'a.md', uid: 'acl-1234abcd' })).rejects.toMatchObject({ code: 'DUPLICATE_CARD_UID' });
	});
});
