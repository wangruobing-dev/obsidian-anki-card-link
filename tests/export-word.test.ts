import { describe, expect, it } from 'vitest';
import { buildWordFileName, buildWordImageDataUrl } from '../src/core/word-export';

describe('word export', () => {
	it('builds a safe docx file name from the note title', () => {
		expect(buildWordFileName('Cards / Notes: Intro?')).toBe('Cards - Notes- Intro.docx');
		expect(buildWordFileName('  trailing dot.  ')).toBe('trailing dot.docx');
		expect(buildWordFileName('')).toBe('note.docx');
	});

	it('builds a valid image data URL from attachment bytes', () => {
		expect(buildWordImageDataUrl(new Uint8Array([0, 255, 192]).buffer, 'PNG'))
			.toBe('data:image/png;base64,AP/A');
		expect(() => buildWordImageDataUrl(new ArrayBuffer(0), 'tiff'))
			.toThrow('Unsupported Word export image format: tiff.');
	});
});
