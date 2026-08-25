const OBSIDIAN_IMAGE_EMBED = /!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|!\[(?:\\.|[^\]\\\n])*\]\(\s*(?:<((?:\\.|[^>\\\n])*)>|((?:\\.|[^\s()\\])+))(?:\s+(?:"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\((?:\\.|[^)\\\n])*\)))?\s*\)/gu;
const EXTERNAL_IMAGE_REFERENCE = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu;
const MARKDOWN_ESCAPED_PUNCTUATION = /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/gu;

export interface ObsidianImageEmbed {
	index: number;
	length: number;
	reference: string;
}

/** 查找 Obsidian 支持的 Wiki 图片嵌入和标准 Markdown 图片嵌入。 */
export function findObsidianImageEmbeds(markdown: string): ObsidianImageEmbed[] {
	const embeds: ObsidianImageEmbed[] = [];
	for (const match of markdown.matchAll(OBSIDIAN_IMAGE_EMBED)) {
		const index = match.index;
		const rawReference = match[1] ?? match[2] ?? match[3];
		if (index === undefined || rawReference === undefined) {
			continue;
		}
		const reference = normalizeImageReference(rawReference);
		if (reference.length === 0) {
			continue;
		}
		embeds.push({ index, length: match[0].length, reference });
	}
	return embeds;
}

/** 从卡片 Markdown 中提取 Obsidian 本地图片引用，兼容 Wiki 与标准 Markdown 语法。 */
export function extractObsidianImageReferences(markdown: string): string[] {
	const references: string[] = [];
	const seen = new Set<string>();
	for (const reference of extractObsidianImageReferencesInOrder(markdown)) {
		if (seen.has(reference)) {
			continue;
		}
		seen.add(reference);
		references.push(reference);
	}
	return references;
}

/** 按 Markdown 中的出现顺序返回本地图片引用，保留重复项以便和渲染后的图片逐一对应。 */
export function extractObsidianImageReferencesInOrder(markdown: string): string[] {
	return findObsidianImageEmbeds(markdown)
		.map(({ reference }) => reference)
		.filter((reference) => !EXTERNAL_IMAGE_REFERENCE.test(reference));
}

function normalizeImageReference(value: string): string {
	const unescaped = value.trim().replace(MARKDOWN_ESCAPED_PUNCTUATION, '$1');
	try {
		return decodeURIComponent(unescaped);
	} catch {
		return unescaped;
	}
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
