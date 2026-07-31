import { describe, expect, it } from 'vitest';
import {
	buildAnkiMediaFilename,
	encodeArrayBufferAsBase64,
	extractObsidianImageReferences,
} from '../src/core/anki-media';

describe('Anki media helpers', () => {
	it('extracts unique Obsidian image references and ignores display-size aliases', () => {
		expect(
			extractObsidianImageReferences('前 ![[one.png|320]] 后 ![[folder/two.jpg]] 再次 ![[one.png]]'),
		).toEqual(['one.png', 'folder/two.jpg']);
	});

	it('uses a stable media filename and Base64-encodes image bytes', () => {
		expect(buildAnkiMediaFilename('附件/Pasted image.png', 'png')).toBe(buildAnkiMediaFilename('附件/Pasted image.png', 'PNG'));
		expect(encodeArrayBufferAsBase64(new Uint8Array([0, 255, 192]).buffer)).toBe('AP/A');
	});
});
