/** 将 Obsidian 的 Vault 相对父目录转换为 Anki 的层级牌组名称。 */
export function buildFolderDeckName(filePath: string): string | undefined {
	const pathParts = filePath.split('/').filter((part) => part.trim().length > 0);
	pathParts.pop();
	return pathParts.length > 0 ? pathParts.join('::') : undefined;
}
