import type { FeishuBatchProgress } from '../services/feishu-batch-sync';
import { getStrings } from '../strings';
import type { Language } from '../types';

export class FeishuBatchProgressToast {
	private element?: HTMLButtonElement;

	constructor(private readonly onClick: () => void) {}

	update(progress: FeishuBatchProgress, language: Language): void {
		const text = getStrings(language).labels.feishuBatchBackgroundProgress(progress.completed, progress.total);
		const element = this.getOrCreateElement();
		element.textContent = text;
		element.setAttribute('aria-label', text);
	}

	dispose(): void {
		this.element?.remove();
		this.element = undefined;
	}

	private getOrCreateElement(): HTMLButtonElement {
		if (this.element !== undefined && this.element.isConnected) {
			return this.element;
		}
		const element = document.body.createEl('button', { cls: 'anki-card-link-feishu-batch-toast' });
		element.type = 'button';
		element.addEventListener('click', () => this.onClick());
		this.element = element;
		return element;
	}
}
