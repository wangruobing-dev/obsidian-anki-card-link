import { describe, expect, it } from 'vitest';
import { getFeishuBatchViewStatus } from '../src/ui/feishu-batch-progress-state';

describe('FeishuBatchProgressModal state helpers', () => {
	it('separates running, completed, and cancelled progress states', () => {
		expect(getFeishuBatchViewStatus({ cancelled: false, completed: 2, total: 3 })).toBe('running');
		expect(getFeishuBatchViewStatus({ cancelled: false, completed: 3, total: 3 })).toBe('completed');
		expect(getFeishuBatchViewStatus({ cancelled: true, completed: 1, total: 3 })).toBe('cancelled');
	});
});
