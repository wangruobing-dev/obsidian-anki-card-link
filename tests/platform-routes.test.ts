import { describe, expect, it } from 'vitest';
import { buildAndroidUri } from '../src/platform/android-router';
import { buildIosUri } from '../src/platform/ios-router';

describe('mobile route builders', () => {
	it('builds the Android AnkiDroid browser URI', () => {
		expect(buildAndroidUri('nid:1667925274936')).toBe(
			'anki://x-callback-url/browser?search=nid%3A1667925274936',
		);
	});

	it('builds the iOS AnkiMobile search URI', () => {
		expect(buildIosUri('deck:软考')).toBe(
			'anki://x-callback-url/search?query=deck%3A%E8%BD%AF%E8%80%83',
		);
	});
});
