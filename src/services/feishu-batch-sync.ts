import type { FeishuSyncResult } from './feishu-sync';

export interface FeishuBatchFailure {
	path: string;
	reason: string;
}

export interface FeishuBatchProgress {
	total: number;
	completed: number;
	currentPath?: string;
	created: number;
	updated: number;
	unchanged: number;
	failed: number;
	cancelled: boolean;
	failures: readonly FeishuBatchFailure[];
}

export interface FeishuBatchSyncOptions<File> {
	files: readonly File[];
	pathOf: (file: File) => string;
	syncFile: (file: File) => Promise<FeishuSyncResult>;
	onProgress?: (progress: FeishuBatchProgress) => void;
}

/**
 * 按顺序同步，取消时让正在执行的笔记安全结束，再停止后续笔记。
 */
export class FeishuBatchSyncTask<File> {
	private cancelled = false;
	private readonly progress: FeishuBatchProgress;

	constructor(private readonly options: FeishuBatchSyncOptions<File>) {
		this.progress = {
			total: options.files.length,
			completed: 0,
			created: 0,
			updated: 0,
			unchanged: 0,
			failed: 0,
			cancelled: false,
			failures: [],
		};
	}

	requestCancel(): void {
		this.cancelled = true;
	}

	getProgress(): FeishuBatchProgress {
		return { ...this.progress, failures: [...this.progress.failures] };
	}

	async run(): Promise<FeishuBatchProgress> {
		this.emitProgress();
		for (const file of this.options.files) {
			if (this.cancelled) {
				break;
			}
			this.progress.currentPath = this.options.pathOf(file);
			this.emitProgress();
			try {
				const result = await this.options.syncFile(file);
				this.progress[result.status] += 1;
			} catch (error) {
				this.progress.failed += 1;
				this.progress.failures = [...this.progress.failures, {
					path: this.options.pathOf(file),
					reason: error instanceof Error ? error.message : String(error),
				}];
			}
			this.progress.completed += 1;
			this.emitProgress();
		}
		this.progress.currentPath = undefined;
		this.progress.cancelled = this.cancelled;
		this.emitProgress();
		return this.getProgress();
	}

	private emitProgress(): void {
		this.options.onProgress?.(this.getProgress());
	}
}
