import { Platform } from 'obsidian';
import { describe, expect, it } from 'vitest';

const FEISHU_FILES = [
	'src/core/share-markdown.ts',
	'src/core/content-hash.ts',
	'src/core/multipart.ts',
	'src/services/feishu-api.ts',
	'src/services/feishu-sync-index.ts',
	'src/services/feishu-sync.ts',
	'src/services/feishu-batch-sync.ts',
	'src/services/feishu-batch-selection.ts',
	'src/ui/feishu-file-picker-state.ts',
	'src/ui/feishu-file-picker-modal.ts',
	'src/ui/feishu-batch-progress-state.ts',
	'src/ui/feishu-batch-progress-modal.ts',
	'src/ui/feishu-batch-progress-toast.ts',
];

describe('Feishu platform compatibility', () => {
	it('uses browser and Obsidian APIs without Node or Electron runtime dependencies', async () => {
		if (!Platform.isDesktopApp) return;
		const { readFileSync } = await import('node:fs');
		const source = FEISHU_FILES.map((path) => readFileSync(path, 'utf8')).join('\n');
		expect(source).not.toMatch(/from ['"]node:|require\(['"]node:|from ['"]electron|require\(['"]electron|\bBuffer\b|\bprocess\.platform\b|\bFormData\b/u);
		expect(source).toContain('requestUrl');
		expect(source).toContain('readBinary');
		expect(source).toContain('Uint8Array');
	});
});
