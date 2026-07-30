import type { PlatformRouter } from '../types';
import type { AnkiConnectService } from '../services/anki-connect';

export class DesktopRouter implements PlatformRouter {
	constructor(private readonly ankiConnect: AnkiConnectService) {}

	async open(query: string): Promise<void> {
		await this.ankiConnect.guiBrowse(query);
	}
}
