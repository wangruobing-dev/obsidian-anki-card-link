import { Platform } from 'obsidian';
import type { AnkiConnectService } from '../services/anki-connect';
import { AnkiCardLinkError, type PlatformRouter } from '../types';
import { AndroidRouter } from './android-router';
import { DesktopRouter } from './desktop-router';
import { IosRouter } from './ios-router';

export function createPlatformRouter(ankiConnect: AnkiConnectService): PlatformRouter {
	if (Platform.isDesktopApp) {
		return new DesktopRouter(ankiConnect);
	}
	if (Platform.isAndroidApp) {
		return new AndroidRouter();
	}
	if (Platform.isIosApp) {
		return new IosRouter();
	}

	throw new AnkiCardLinkError(
		'UNSUPPORTED_PLATFORM',
		'This platform is not currently supported.',
	);
}
