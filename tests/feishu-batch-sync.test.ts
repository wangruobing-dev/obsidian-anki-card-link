import { describe, expect, it } from 'vitest';
import { FeishuBatchSyncTask } from '../src/services/feishu-batch-sync';

describe('FeishuBatchSyncTask', () => {
	it('continues after an individual file fails', async () => {
		const processed: string[] = [];
		const task = new FeishuBatchSyncTask({
			files: ['A.md', 'B.md', 'C.md'],
			pathOf: (file) => file,
			syncFile: async (file) => {
				processed.push(file);
				if (file === 'B.md') throw new Error('missing image');
				return { status: file === 'A.md' ? 'created' : 'unchanged', documentToken: file, shareUrl: file, binding: {} as never };
			},
		});
		const progress = await task.run();
		expect(processed).toEqual(['A.md', 'B.md', 'C.md']);
		expect(progress).toMatchObject({ completed: 3, created: 1, unchanged: 1, failed: 1 });
		expect(progress.failures[0]).toMatchObject({ path: 'B.md', reason: 'missing image' });
	});

	it('stops starting later files after cancellation while keeping the current result', async () => {
		const processed: string[] = [];
		let task: FeishuBatchSyncTask<string>;
		task = new FeishuBatchSyncTask({
			files: ['A.md', 'B.md', 'C.md'],
			pathOf: (file) => file,
			syncFile: async (file) => {
				processed.push(file);
				if (file === 'A.md') task.requestCancel();
				return { status: 'updated', documentToken: file, shareUrl: file, binding: {} as never };
			},
		});
		const progress = await task.run();
		expect(processed).toEqual(['A.md']);
		expect(progress).toMatchObject({ cancelled: true, completed: 1, updated: 1 });
	});
});
