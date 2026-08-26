import { normalizeVaultPath } from './feishu-sync-index';

export interface FeishuBatchFileLike {
	path: string;
	extension: string;
}

export function collectSelectedMarkdownFiles<File extends FeishuBatchFileLike>(
	files: readonly File[],
	selectedPaths: ReadonlySet<string>,
): File[] {
	const normalizedSelected = new Set([...selectedPaths].map(normalizeVaultPath));
	const unique = new Map<string, File>();
	for (const file of files) {
		if (file.extension.toLowerCase() !== 'md') {
			continue;
		}
		const path = normalizeVaultPath(file.path);
		if (normalizedSelected.has(path) || [...normalizedSelected].some((folderPath) => folderPath.length === 0 || path.startsWith(`${folderPath}/`))) {
			unique.set(path, file);
		}
	}
	return [...unique.values()].sort((left, right) => normalizeVaultPath(left.path).localeCompare(normalizeVaultPath(right.path)));
}
