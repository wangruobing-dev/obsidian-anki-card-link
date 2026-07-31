const OBSIDIAN_IMAGE_EMBED = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/gu;

/** 从卡片 Markdown 中提取 Obsidian 本地图片引用，保留首次出现的顺序。 */
export function extractObsidianImageReferences(markdown: string): string[] {
	const references: string[] = [];
	const seen = new Set<string>();
	for (const match of markdown.matchAll(OBSIDIAN_IMAGE_EMBED)) {
		const reference = match[1]?.trim();
		if (reference === undefined || reference.length === 0 || seen.has(reference)) {
			continue;
		}
		seen.add(reference);
		references.push(reference);
	}
	return references;
}

/** 将 Obsidian 附件路径映射为稳定的 Anki 媒体文件名，避免不同目录中的同名文件互相覆盖。 */
export function buildAnkiMediaFilename(vaultPath: string, extension: string): string {
	const normalizedExtension = extension.trim().toLowerCase();
	const suffix = normalizedExtension.length === 0 ? '' : `.${normalizedExtension}`;
	return `anki-card-link-${stablePathHash(vaultPath)}${suffix}`;
}

/** AnkiConnect 的 storeMediaFile 使用 Base64 字符串承载二进制文件。 */
export function encodeArrayBufferAsBase64(data: ArrayBuffer): string {
	const bytes = new Uint8Array(data);
	const chunkSize = 0x8000;
	let binary = '';
	for (let start = 0; start < bytes.length; start += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(start, start + chunkSize));
	}
	return btoa(binary);
}

function stablePathHash(value: string): string {
	let hash = 2_166_136_261;
	for (let index = 0; index < value.length; index += 1) {
		hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}
