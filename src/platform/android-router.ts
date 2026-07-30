import { AnkiCardLinkError, type PlatformRouter } from '../types';
import { openExternalUri } from './open-external-uri';

export function buildAndroidUri(query: string): string {
	return `anki://x-callback-url/browser?search=${encodeURIComponent(query)}`;
}

export class AndroidRouter implements PlatformRouter {
	async open(query: string): Promise<void> {
		try {
			await openExternalUri(buildAndroidUri(query));
		} catch (error) {
			throw new AnkiCardLinkError(
				'ANKIDROID_NOT_INSTALLED',
				'Could not open AnkiDroid. Make sure AnkiDroid is installed.',
				{ cause: error },
			);
		}
	}
}
