import type { TFile } from 'obsidian';

export interface CheckboxSelectionState {
	checked: boolean;
	indeterminate: boolean;
}

export function getSelectionState(
	files: readonly Pick<TFile, 'path'>[],
	selectedPaths: ReadonlySet<string>,
): CheckboxSelectionState {
	const selected = files.filter((file) => selectedPaths.has(file.path)).length;
	return {
		checked: files.length > 0 && selected === files.length,
		indeterminate: selected > 0 && selected < files.length,
	};
}

export function getNextCollapsedFolders(
	collapsedFolders: ReadonlySet<string>,
	folderPath: string,
): Set<string> {
	const next = new Set(collapsedFolders);
	if (next.has(folderPath)) {
		next.delete(folderPath);
	} else {
		next.add(folderPath);
	}
	return next;
}

export function isFolderExpanded(folderPath: string, collapsedFolders: ReadonlySet<string>): boolean {
	return !collapsedFolders.has(folderPath);
}
