import { describe, expect, it } from 'vitest';
import { buildWordFileName } from '../src/core/word-export';

describe('word export', () => {
	it('builds a safe docx file name from the note title', () => {
		expect(buildWordFileName('Cards / Notes: Intro?')).toBe('Cards - Notes- Intro.docx');
		expect(buildWordFileName('  trailing dot.  ')).toBe('trailing dot.docx');
		expect(buildWordFileName('')).toBe('note.docx');
	});
});
