import type { FeishuBatchProgress } from '../services/feishu-batch-sync';

export type FeishuBatchViewStatus = 'running' | 'completed' | 'cancelled';

export function getFeishuBatchViewStatus(progress: Pick<FeishuBatchProgress, 'cancelled' | 'completed' | 'total'>): FeishuBatchViewStatus {
	if (progress.cancelled) return 'cancelled';
	if (progress.completed >= progress.total) return 'completed';
	return 'running';
}
