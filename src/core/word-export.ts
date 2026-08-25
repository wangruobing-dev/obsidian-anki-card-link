import { encodeArrayBufferAsBase64 } from './anki-media';

const WORD_IMAGE_MIME_TYPES: Readonly<Record<string, string>> = {
	apng: 'image/apng',
	avif: 'image/avif',
	bmp: 'image/bmp',
	gif: 'image/gif',
	jpeg: 'image/jpeg',
	jpg: 'image/jpeg',
	png: 'image/png',
	svg: 'image/svg+xml',
	webp: 'image/webp',
};

export function buildWordFileName(title: string): string {
	const safeTitle = title.replace(/[\\/:*?"<>|]+/gu, '-').replace(/\s+/gu, ' ').trim().replace(/[.\- ]+$/gu, '');
	return `${safeTitle.length === 0 ? 'note' : safeTitle}.docx`;
}

export function buildWordImageDataUrl(data: ArrayBuffer, extension: string): string {
	const normalizedExtension = extension.trim().toLowerCase();
	const mimeType = WORD_IMAGE_MIME_TYPES[normalizedExtension];
	if (mimeType === undefined) {
		throw new Error(`Unsupported Word export image format: ${extension || 'unknown'}.`);
	}
	return `data:${mimeType};base64,${encodeArrayBufferAsBase64(data)}`;
}
