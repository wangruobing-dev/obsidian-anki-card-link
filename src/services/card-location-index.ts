export interface CardLocationRecord {
	path: string;
	updatedAt: number;
}

export type CardLocationIndexData = Record<string, CardLocationRecord>;

export class CardLocationIndex {
	private readonly records: CardLocationIndexData;

	constructor(data: CardLocationIndexData = {}) {
		this.records = structuredClone(data);
	}

	get(uid: string): CardLocationRecord | undefined {
		const record = this.records[uid];
		return record === undefined ? undefined : { ...record };
	}

	set(uid: string, path: string, updatedAt = Date.now()): void {
		this.records[uid] = { path, updatedAt };
	}

	renamePath(oldPath: string, newPath: string, updatedAt = Date.now()): number {
		const oldPrefix = `${oldPath.replace(/\/$/u, '')}/`;
		let changed = 0;
		for (const record of Object.values(this.records)) {
			if (record.path === oldPath) {
				record.path = newPath;
				record.updatedAt = updatedAt;
				changed += 1;
			} else if (record.path.startsWith(oldPrefix)) {
				record.path = `${newPath.replace(/\/$/u, '')}/${record.path.slice(oldPrefix.length)}`;
				record.updatedAt = updatedAt;
				changed += 1;
			}
		}
		return changed;
	}

	removePath(path: string): number {
		const prefix = `${path.replace(/\/$/u, '')}/`;
		let removed = 0;
		for (const [uid, record] of Object.entries(this.records)) {
			if (record.path === path || record.path.startsWith(prefix)) {
				delete this.records[uid];
				removed += 1;
			}
		}
		return removed;
	}

	toJSON(): CardLocationIndexData {
		return structuredClone(this.records);
	}
}
