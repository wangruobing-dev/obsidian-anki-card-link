import {
	TFile,
	getAllTags,
	type App,
	type MarkdownPostProcessorContext,
} from 'obsidian';
import { buildCardSyntax } from '../core/card-syntax';
import { getStrings } from '../strings';
import type { AnkiCardLinkSettings } from '../types';
import { ReadingReviewControllerRegistry } from './controller';
import { buildReadingReviewModel, shouldProcessReadingReview } from './mask-model';

export interface ReadingReviewProcessorHost {
	app: App;
	settings: AnkiCardLinkSettings;
	resolveReadingReviewRoot(el: HTMLElement): HTMLElement | undefined;
}

export async function processReadingReviewSection(
	host: ReadingReviewProcessorHost,
	registry: ReadingReviewControllerRegistry,
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
): Promise<void> {
	if (!host.settings.readingReviewEnabled || el.closest('[data-acl-review-rendering="true"]') !== null) {
		return;
	}
	const file = host.app.vault.getAbstractFileByPath(ctx.sourcePath);
	if (!(file instanceof TFile)) {
		return;
	}
	const cache = host.app.metadataCache.getFileCache(file);
	if (!shouldProcessReadingReview(host.settings.readingReviewEnabled, getAllTags(cache ?? {}))) {
		return;
	}
	const section = ctx.getSectionInfo(el);
	const rootEl = host.resolveReadingReviewRoot(el) ?? el;
	const source = await host.app.vault.cachedRead(file);
	const model = buildReadingReviewModel(source, buildCardSyntax(host.settings));
	if (model.masks.length === 0) {
		return;
	}
	const strings = getStrings(host.settings.language);
	const controller = registry.getOrCreate(rootEl, {
		sourcePath: ctx.sourcePath,
		source,
		model,
		labels: {
			cloze: strings.labels.revealReadingCloze,
			back: strings.labels.revealReadingBack,
		},
		edgeTapEnabled: host.settings.readingReviewEdgeTapEnabled,
	});
	await controller.processElement(el, section);
}
