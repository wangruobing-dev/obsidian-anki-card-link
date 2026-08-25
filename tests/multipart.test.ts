import { describe, expect, it } from 'vitest';
import { buildMultipartBody } from '../src/core/multipart';

describe('multipart body', () => {
	it('preserves binary bytes and encodes Chinese text and filename', () => {
		const binary = new Uint8Array([0, 137, 80, 78, 71, 255, 10, 13]);
		const result = buildMultipartBody([
			{ kind: 'text', name: 'title', value: '中文字段' },
			{ kind: 'text', name: 'size', value: String(binary.byteLength) },
			{ kind: 'file', name: 'file', filename: '图片.png', contentType: 'image/png', data: binary },
		], 'test-boundary');
		const bytes = new Uint8Array(result.body);
		const text = new TextDecoder().decode(bytes);
		expect(result.contentType).toBe('multipart/form-data; boundary=test-boundary');
		expect(text).toContain('name="title"\r\n\r\n中文字段');
		expect(text).toContain("filename*=UTF-8''%E5%9B%BE%E7%89%87.png");
		expect(text).toContain('Content-Type: image/png');
		expect(text.endsWith('--test-boundary--\r\n')).toBe(true);
		const header = new TextEncoder().encode('Content-Type: image/png\r\n\r\n');
		const start = findBytes(bytes, header) + header.byteLength;
		expect([...bytes.slice(start, start + binary.byteLength)]).toEqual([...binary]);
	});
});

function findBytes(haystack: Uint8Array, needle: Uint8Array): number {
	for (let index = 0; index <= haystack.length - needle.length; index += 1) {
		if (needle.every((value, offset) => haystack[index + offset] === value)) return index;
	}
	return -1;
}
