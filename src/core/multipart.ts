export interface MultipartTextPart {
	kind: 'text';
	name: string;
	value: string;
}

export interface MultipartFilePart {
	kind: 'file';
	name: string;
	filename: string;
	contentType: string;
	data: Uint8Array;
}

export type MultipartPart = MultipartTextPart | MultipartFilePart;

export interface MultipartBody {
	boundary: string;
	contentType: string;
	body: ArrayBuffer;
}

export function buildMultipartBody(parts: readonly MultipartPart[], boundary = createBoundary()): MultipartBody {
	validateToken(boundary, 'boundary');
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	for (const part of parts) {
		validateToken(part.name, 'field name');
		chunks.push(encoder.encode(`--${boundary}\r\n`));
		if (part.kind === 'text') {
			chunks.push(encoder.encode(`Content-Disposition: form-data; name="${part.name}"\r\n\r\n${part.value}\r\n`));
			continue;
		}
		validateHeaderValue(part.contentType, 'content type');
		const safeFilename = asciiFilename(part.filename);
		const encodedFilename = encodeURIComponent(part.filename);
		chunks.push(encoder.encode(
			`Content-Disposition: form-data; name="${part.name}"; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}\r\n`
			+ `Content-Type: ${part.contentType}\r\n\r\n`,
		));
		chunks.push(part.data);
		chunks.push(encoder.encode('\r\n'));
	}
	chunks.push(encoder.encode(`--${boundary}--\r\n`));
	const body = concatenate(chunks);
	const arrayBuffer = new ArrayBuffer(body.byteLength);
	new Uint8Array(arrayBuffer).set(body);
	return { boundary, contentType: `multipart/form-data; boundary=${boundary}`, body: arrayBuffer };
}

function createBoundary(): string {
	return `anki-card-link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function validateToken(value: string, label: string): void {
	if (!/^[\w.-]+$/u.test(value)) {
		throw new Error(`Invalid multipart ${label}.`);
	}
}

function validateHeaderValue(value: string, label: string): void {
	if (/[\r\n]/u.test(value)) {
		throw new Error(`Invalid multipart ${label}.`);
	}
}

function asciiFilename(value: string): string {
	validateHeaderValue(value, 'filename');
	const normalized = value.replace(/["\\]/gu, '_').replace(/[^\x20-\x7E]/gu, '_');
	return normalized.length === 0 ? 'file' : normalized;
}

function concatenate(chunks: readonly Uint8Array[]): Uint8Array {
	const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
	const result = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}
