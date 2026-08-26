import { describe, expect, it } from 'vitest';
import { sha256Hex, utf8Bytes } from '../src/core/content-hash';

describe('content hash', () => {
	it('uses the standard SHA-256 digest in the non-browser fallback', async () => {
		await expect(sha256Hex([utf8Bytes('abc')])).resolves.toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
		);
	});
});
