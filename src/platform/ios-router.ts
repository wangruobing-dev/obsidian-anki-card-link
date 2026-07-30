import { AnkiCardLinkError, type PlatformRouter } from '../types';
import { openExternalUri } from './open-external-uri';

export function buildIosUri(query: string): string {
	return `anki://x-callback-url/search?query=${encodeURIComponent(query)}`;
}

export class IosRouter implements PlatformRouter {
	async open(query: string): Promise<void> {
		try {
			await openExternalUri(buildIosUri(query));
		} catch (error) {
			throw new AnkiCardLinkError(
				'ANKIMOBILE_NOT_INSTALLED',
				'Could not open AnkiMobile. Make sure AnkiMobile is installed.',
				{ cause: error },
			);
		}
	}
}
