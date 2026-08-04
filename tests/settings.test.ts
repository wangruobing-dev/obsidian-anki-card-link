import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, validateAnkiConnectUrl } from '../src/settings';

describe('default settings', () => {
	it('uses English until the user selects another language', () => {
		expect(DEFAULT_SETTINGS.language).toBe('en');
		expect(DEFAULT_SETTINGS.defaultLinkText).toBe('Open corresponding Anki card');
		expect(DEFAULT_SETTINGS.basicModelName).toBe('Anki Card Link Basic');
		expect(DEFAULT_SETTINGS.clozeContentField).toBe('Content');
		expect(DEFAULT_SETTINGS.clozeTitleField).toBe('Note');
		expect(DEFAULT_SETTINGS.clozeObsidianUriField).toBe('ObsidianURI');
		expect(DEFAULT_SETTINGS.choiceModelName).toBe('Multiple Choice');
		expect(DEFAULT_SETTINGS.choiceCardIdField).toBe('CardID');
		expect(DEFAULT_SETTINGS.choiceObsidianUrlField).toBe('ObsidianURL');
		expect(DEFAULT_SETTINGS.choiceCorrectAnswerField).toBe('CorrectAnswer');
		expect(DEFAULT_SETTINGS.useCurrentFolderAsDeck).toBe(true);
		expect(DEFAULT_SETTINGS.readingReviewEnabled).toBe(true);
		expect(DEFAULT_SETTINGS.readingReviewEdgeTapEnabled).toBe(false);
	});
});

describe('AnkiConnect URL validation', () => {
	it.each([
		'http://127.0.0.1:8765',
		'http://localhost:8765',
		'http://[::1]:8765',
	])('accepts a loopback URL: %s', (url) => {
		expect(validateAnkiConnectUrl(url)).toBe(url);
	});

	it.each([
		'https://example.com:8765',
		'file:///tmp/anki',
		'not-a-url',
	])('rejects a non-loopback or invalid URL: %s', (url) => {
		expect(() => validateAnkiConnectUrl(url)).toThrow(/localhost/u);
	});
});
