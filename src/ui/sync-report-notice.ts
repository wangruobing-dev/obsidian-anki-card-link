import { Notice } from 'obsidian';
import type { CardSyncSkipReason, CardSyncStatus } from '../services/card-sync';
import { createSyncReportLifetime } from './sync-report-lifetime';

export type SyncReportEntry = {
	status: CardSyncStatus | 'failed';
	card: string;
	noteId?: number;
	reason?: string;
};

export interface SyncReportStrings {
	title: string;
	created: string;
	updated: string;
	skipped: string;
	failed: string;
	noteId: (noteId: number) => string;
	skipReason: (reason: CardSyncSkipReason) => string;
}

export function showSyncReport(entries: SyncReportEntry[], strings: SyncReportStrings): void {
	const fragment = new DocumentFragment();
	const root = document.body.createDiv({ cls: 'anki-card-link-sync-report' });
	root.createEl('strong', { text: strings.title });

	for (const status of ['created', 'updated', 'skipped', 'failed'] as const) {
		const group = entries.filter((entry) => entry.status === status);
		if (group.length === 0) {
			continue;
		}
		root.createDiv({
			cls: 'anki-card-link-sync-report__heading',
			text: `${getStatusLabel(status, strings)} (${group.length})`,
		});
		const list = root.createEl('ul');
		for (const entry of group) {
			const detail = entry.noteId === undefined
				? entry.reason === undefined
					? ''
					: getReason(entry, strings)
				: strings.noteId(entry.noteId);
			list.createEl('li', { text: detail.length === 0 ? entry.card : `${entry.card}: ${detail}` });
		}
		root.append(list);
	}
	fragment.append(root);

	const notice = new Notice(fragment, 0);
	const lifetime = createSyncReportLifetime(() => notice.hide());
	notice.containerEl.addEventListener('mouseenter', lifetime.pause);
	notice.containerEl.addEventListener('mouseleave', lifetime.start);
	notice.containerEl.addEventListener('click', lifetime.dismiss);
	lifetime.start();
}

function getStatusLabel(status: SyncReportEntry['status'], strings: SyncReportStrings): string {
	return status === 'created'
		? strings.created
		: status === 'updated'
			? strings.updated
			: status === 'skipped'
				? strings.skipped
				: strings.failed;
}

function getReason(entry: SyncReportEntry, strings: SyncReportStrings): string {
	if (entry.status === 'skipped') {
		return strings.skipReason(entry.reason as CardSyncSkipReason);
	}
	return entry.reason ?? '';
}
