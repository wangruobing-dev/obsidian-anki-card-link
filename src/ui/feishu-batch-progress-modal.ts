import { Modal, Setting, type App } from 'obsidian';
import type { Language } from '../types';
import { getStrings } from '../strings';
import type { FeishuBatchProgress } from '../services/feishu-batch-sync';
import { getFeishuBatchViewStatus, type FeishuBatchViewStatus } from './feishu-batch-progress-state';

export class FeishuBatchProgressModal extends Modal {
	private progress?: FeishuBatchProgress;
	private failuresVisible = false;

	constructor(
		app: App,
		private readonly language: Language,
		private readonly onCancel: () => void,
		private readonly onHidden: () => void,
	) {
		super(app);
		this.contentEl.addClass('anki-card-link-modal', 'anki-card-link-feishu-progress');
	}

	update(progress: FeishuBatchProgress): void {
		this.progress = progress;
		if (this.modalEl.isConnected) this.render();
	}

	isVisible(): boolean {
		return this.modalEl.isConnected;
	}

	override onOpen(): void {
		this.render();
	}

	override onClose(): void {
		this.contentEl.empty();
		this.onHidden();
	}

	private render(): void {
		const strings = getStrings(this.language);
		const progress = this.progress;
		if (progress === undefined) return;
		const status = getFeishuBatchViewStatus(progress);
		this.contentEl.empty();
		this.setTitle(status === 'cancelled'
			? strings.titles.feishuBatchCancelled
			: status === 'completed'
				? strings.titles.feishuBatchCompleted
				: strings.titles.feishuBatchProgress);
		this.contentEl.createDiv({ text: getCurrentText(progress, status, this.language), cls: 'anki-card-link-feishu-progress__current' });
		this.contentEl.createDiv({ text: strings.labels.feishuBatchProcessed(progress.completed, progress.total) });
		const percent = progress.total === 0 ? 0 : Math.round(progress.completed / progress.total * 100);
		const meter = this.contentEl.createEl('progress', { cls: 'anki-card-link-feishu-progress__meter' });
		meter.max = 100;
		meter.value = percent;
		this.contentEl.createDiv({ text: `${percent}%` });
		this.contentEl.createDiv({ text: `${getProgressLabel(this.language, 'created')}: ${progress.created}` });
		this.contentEl.createDiv({ text: `${getProgressLabel(this.language, 'updated')}: ${progress.updated}` });
		this.contentEl.createDiv({ text: `${getUnchangedLabel(this.language)}: ${progress.unchanged}` });
		this.contentEl.createDiv({ text: `${getProgressLabel(this.language, 'failed')}: ${progress.failed}` });
		const controls = new Setting(this.contentEl);
		if (status === 'running') {
			controls
				.addButton((button) => button.setButtonText(strings.labels.hide).onClick(() => this.close()))
				.addButton((button) => button
					.setButtonText(strings.labels.cancelSync)
					.onClick(() => this.onCancel()));
		} else {
			controls.addButton((button) => button.setButtonText(strings.labels.close).onClick(() => this.close()));
		}
		if (progress.failures.length > 0) {
			new Setting(this.contentEl).addButton((button) => button
				.setButtonText(this.failuresVisible ? strings.labels.hideFailures : strings.labels.viewFailures)
				.onClick(() => {
					this.failuresVisible = !this.failuresVisible;
					this.render();
				}));
		} else {
			this.failuresVisible = false;
		}
		if (this.failuresVisible) {
			this.showFailures();
		}
	}

	private showFailures(): void {
		if (this.progress === undefined) return;
		const strings = getStrings(this.language);
		const failures = this.contentEl.createDiv({ cls: 'anki-card-link-feishu-progress__failures' });
		failures.createEl('strong', { text: strings.titles.feishuBatchFailures });
		const list = failures.createEl('ul');
		for (const failure of this.progress.failures) {
			list.createEl('li', { text: `${failure.path}: ${failure.reason}` });
		}
	}
}

function getCurrentText(progress: FeishuBatchProgress, status: FeishuBatchViewStatus, language: Language): string {
	if (status === 'running') {
		return progress.currentPath ?? (language === 'zh-CN' ? '准备同步...' : 'Preparing sync...');
	}
	if (status === 'cancelled') {
		return language === 'zh-CN' ? '同步已取消。' : 'Sync was cancelled.';
	}
	return language === 'zh-CN' ? '同步已完成。' : 'Sync completed.';
}

function getUnchangedLabel(language: Language): string {
	return language === 'zh-CN' ? '无变化' : 'Unchanged';
}

function getProgressLabel(language: Language, status: 'created' | 'updated' | 'failed'): string {
	if (language === 'zh-CN') {
		return status === 'created' ? '已创建' : status === 'updated' ? '已更新' : '失败';
	}
	return status === 'created' ? 'Created' : status === 'updated' ? 'Updated' : 'Failed';
}
