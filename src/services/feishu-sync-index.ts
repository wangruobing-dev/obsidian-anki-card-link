import type { FeishuShareMode } from '../types';

export interface FeishuNoteBinding {
	sourcePath: string;
	documentToken: string;
	parentFolderToken: string;
	shareUrl: string;
	title: string;
	contentHash?: string;
	shareMode?: FeishuShareMode;
	updatedAt: number;
}

export interface FeishuFolderBinding {
	sourceFolderPath: string;
	folderToken: string;
	updatedAt: number;
}

export interface FeishuSyncIndexData {
	notes: Record<string, FeishuNoteBinding>;
	folders: Record<string, FeishuFolderBinding>;
}

export const EMPTY_FEISHU_SYNC_INDEX: FeishuSyncIndexData = { notes: {}, folders: {} };

export class FeishuSyncIndex {
	private readonly notes: Record<string, FeishuNoteBinding>;
	private readonly folders: Record<string, FeishuFolderBinding>;

	constructor(data: FeishuSyncIndexData = EMPTY_FEISHU_SYNC_INDEX) {
		this.notes = clone(data.notes);
		this.folders = clone(data.folders);
	}

	getByPath(path: string): FeishuNoteBinding | undefined {
		const binding = this.notes[normalizeVaultPath(path)];
		return binding === undefined ? undefined : { ...binding };
	}

	getFolder(path: string): FeishuFolderBinding | undefined {
		const binding = this.folders[normalizeFolderPath(path)];
		return binding === undefined ? undefined : { ...binding };
	}

	set(binding: FeishuNoteBinding): void {
		const sourcePath = normalizeVaultPath(binding.sourcePath);
		this.notes[sourcePath] = { ...binding, sourcePath };
	}

	setFolder(binding: FeishuFolderBinding): void {
		const sourceFolderPath = normalizeFolderPath(binding.sourceFolderPath);
		this.folders[sourceFolderPath] = { ...binding, sourceFolderPath };
	}

	removePath(path: string): number {
		const normalized = normalizeVaultPath(path);
		const prefix = `${normalized}/`;
		let removed = 0;
		for (const key of Object.keys(this.notes)) {
			if (key === normalized || key.startsWith(prefix)) {
				delete this.notes[key];
				removed += 1;
			}
		}
		return removed;
	}

	renamePath(oldPath: string, newPath: string, updatedAt = Date.now()): number {
		const oldNormalized = normalizeVaultPath(oldPath);
		const newNormalized = normalizeVaultPath(newPath);
		const oldPrefix = `${oldNormalized}/`;
		let changed = 0;
		for (const [key, binding] of Object.entries({ ...this.notes })) {
			if (key !== oldNormalized && !key.startsWith(oldPrefix)) {
				continue;
			}
			const suffix = key === oldNormalized ? '' : key.slice(oldPrefix.length);
			const nextPath = suffix.length === 0 ? newNormalized : `${newNormalized}/${suffix}`;
			delete this.notes[key];
			this.notes[nextPath] = { ...binding, sourcePath: nextPath, updatedAt };
			changed += 1;
		}
		return changed;
	}

	renamePathPrefix(oldPath: string, newPath: string, updatedAt = Date.now()): number {
		const changedNotes = this.renamePath(oldPath, newPath, updatedAt);
		const invalidatedFolders = this.invalidateFolderPrefix(oldPath) + this.invalidateFolderPrefix(newPath);
		return changedNotes + invalidatedFolders;
	}

	invalidateFolderPrefix(path: string): number {
		const normalized = normalizeFolderPath(path);
		const prefix = normalized.length === 0 ? '' : `${normalized}/`;
		let removed = 0;
		for (const key of Object.keys(this.folders)) {
			if (key === normalized || key.startsWith(prefix)) {
				delete this.folders[key];
				removed += 1;
			}
		}
		return removed;
	}

	toJSON(): FeishuSyncIndexData {
		return { notes: clone(this.notes), folders: clone(this.folders) };
	}
}

export function normalizeVaultPath(path: string): string {
	return path.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '').replace(/\/{2,}/gu, '/');
}

function normalizeFolderPath(path: string): string {
	return normalizeVaultPath(path);
}

function clone<T>(value: T): T {
	if (typeof structuredClone === 'function') {
		return structuredClone(value);
	}
	return JSON.parse(JSON.stringify(value)) as T;
}
