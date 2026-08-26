import { Notice } from 'obsidian';
import type { FeishuSyncResult } from '../services/feishu-sync';

export interface FeishuLinkNoticeStrings {
	title: (status: FeishuSyncResult['status'], copied: boolean) => string;
	copy: string;
	copied: string;
	copyFailed: string;
}

export function showFeishuLinkNotice(
	status: FeishuSyncResult['status'],
	url: string,
	copied: boolean,
	strings: FeishuLinkNoticeStrings,
	copyText: (text: string) => Promise<void> = (text) => navigator.clipboard.writeText(text),
): void {
	const fragment = new DocumentFragment();
	const root = document.body.createDiv({ cls: 'anki-card-link-feishu-link-notice' });
	root.createEl('strong', { text: strings.title(status, copied) });

	const input = root.createEl('input', {
		cls: 'anki-card-link-feishu-link-notice__url',
		type: 'text',
		value: url,
	});
	input.readOnly = true;
	input.addEventListener('focus', () => input.select());
	input.addEventListener('click', () => input.select());

	const message = root.createDiv({ cls: 'anki-card-link-feishu-link-notice__message' });
	if (!copied) {
		message.setText(strings.copyFailed);
	}
	const button = root.createEl('button', {
		cls: 'mod-cta',
		text: strings.copy,
		type: 'button',
	});
	button.addEventListener('click', () => {
		Promise.resolve()
			.then(() => copyText(url))
			.then(() => {
				button.textContent = strings.copied;
				message.setText('');
			})
			.catch(() => {
				message.setText(strings.copyFailed);
				input.focus();
				input.select();
			});
	});
	fragment.append(root);
	new Notice(fragment, 15000);
}
