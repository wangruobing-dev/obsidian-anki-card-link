import { Component, Platform, type App, type MarkdownSectionInformation } from 'obsidian';
import { replaceTextWithMask, setMaskRevealed, wrapRenderedTextWithMask, type ReadingReviewMaskLabels } from './mask-dom';
import type { ReadingReviewMaskKind, ReadingReviewModel } from './mask-model';

export interface ReadingReviewControllerOptions {
	sourcePath: string;
	source: string;
	model: ReadingReviewModel;
	labels: ReadingReviewMaskLabels;
	edgeTapEnabled: boolean;
}

export class ReadingReviewController extends Component {
	private options: ReadingReviewControllerOptions;
	private pointerStart?: { id: number; x: number; y: number; target: Element | null };

	constructor(
		private readonly app: App,
		readonly rootEl: HTMLElement,
		options: ReadingReviewControllerOptions,
	) {
		super();
		this.options = options;
		this.rootEl.classList.add('acl-review-root');
	}

	override onload(): void {
		this.registerDomEvent(this.rootEl, 'click', (event) => this.handleMaskActivation(event));
		this.registerDomEvent(this.rootEl, 'keydown', (event) => this.handleMaskActivation(event));
		this.registerDomEvent(this.rootEl, 'pointerdown', (event) => this.handlePointerDown(event));
		this.registerDomEvent(this.rootEl, 'pointerup', (event) => this.handlePointerUp(event));
		this.registerDomEvent(this.rootEl, 'pointercancel', () => {
			this.pointerStart = undefined;
		});
	}

	override onunload(): void {
		this.rootEl.classList.remove('acl-review-root');
	}

	updateOptions(options: ReadingReviewControllerOptions): void {
		const changed = this.options.sourcePath !== options.sourcePath || this.options.source !== options.source;
		this.options = options;
		if (changed) this.rootEl.querySelectorAll('[data-acl-review-processed]').forEach((element) => {
			delete (element as HTMLElement).dataset.aclReviewProcessed;
		});
	}

	async processElement(el: HTMLElement, section: MarkdownSectionInformation | null): Promise<void> {
		if (el.dataset.aclReviewProcessed === 'true') {
			return;
		}
		const masks = section === null
			? this.options.model.masks
			: this.options.model.masks.filter((mask) => mask.startLine >= section.lineStart && mask.endLine <= section.lineEnd);
		for (const mask of masks) {
			if (this.rootEl.querySelector(`[data-acl-review-mask-id="${mask.id}"]`) !== null) {
				continue;
			}
			if (mask.kind === 'back') {
				wrapRenderedTextWithMask(el, mask, this.options.labels);
				continue;
			}
			await replaceTextWithMask(
				this.app,
				el,
				mask.matchText,
				mask,
				this.options.sourcePath,
				this,
				this.options.labels,
			);
		}
		el.dataset.aclReviewProcessed = 'true';
	}

	revealNext(kind: ReadingReviewMaskKind): boolean {
		const next = this.getMasks(kind).find((element) => !element.classList.contains('acl-review-mask--revealed'));
		if (next === undefined) {
			return false;
		}
		this.revealMask(next.dataset.aclReviewMaskId ?? '');
		return true;
	}

	toggleAll(kind: ReadingReviewMaskKind): boolean {
		const masks = this.getMasks(kind);
		if (masks.length === 0) {
			return false;
		}
		const reveal = masks.some((element) => !element.classList.contains('acl-review-mask--revealed'));
		for (const element of masks) {
			setMaskRevealed(element, reveal);
		}
		return true;
	}

	revealMask(maskId: string): void {
		if (maskId.length === 0) {
			return;
		}
		for (const element of Array.from(this.getScopeEl().querySelectorAll<HTMLElement>('.acl-review-mask'))) {
			if (element.dataset.aclReviewMaskId === maskId) {
				setMaskRevealed(element, true);
			}
		}
	}

	toggleMask(maskId: string): void {
		if (maskId.length === 0) {
			return;
		}
		const masks = Array.from(this.getScopeEl().querySelectorAll<HTMLElement>('.acl-review-mask'))
			.filter((element) => element.dataset.aclReviewMaskId === maskId);
		const reveal = masks.some((element) => !element.classList.contains('acl-review-mask--revealed'));
		for (const element of masks) {
			setMaskRevealed(element, reveal);
		}
	}

	private getMasks(kind: ReadingReviewMaskKind): HTMLElement[] {
		return Array.from(this.getScopeEl().querySelectorAll<HTMLElement>(`.acl-review-mask[data-acl-review-kind="${kind}"]`));
	}

	private getScopeEl(): HTMLElement {
		return this.rootEl.closest<HTMLElement>(
			'.markdown-preview-view, .markdown-reading-view, .workspace-leaf-content, .view-content',
		) ?? this.rootEl;
	}

	private handlePointerDown(event: PointerEvent): void {
		if (!Platform.isMobile || !this.options.edgeTapEnabled || event.pointerType === 'mouse') {
			return;
		}
		this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, target: event.target as Element | null };
	}

	private handleMaskActivation(event: MouseEvent | KeyboardEvent): void {
		if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') {
			return;
		}
		const target = event.target as Element | null;
		const mask = target?.closest<HTMLElement>('.acl-review-mask');
		if (mask === undefined || mask === null || !this.rootEl.contains(mask)) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		this.toggleMask(mask.dataset.aclReviewMaskId ?? '');
	}

	private handlePointerUp(event: PointerEvent): void {
		const start = this.pointerStart;
		this.pointerStart = undefined;
		if (start === undefined || start.id !== event.pointerId || !this.options.edgeTapEnabled) {
			return;
		}
		if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 || isExcludedEdgeTarget(start.target)) {
			return;
		}
		const selection = window.getSelection();
		if (selection !== null && !selection.isCollapsed) {
			return;
		}
		const bounds = this.rootEl.getBoundingClientRect();
		const ratio = (event.clientX - bounds.left) / bounds.width;
		if (ratio >= 0 && ratio <= 0.11 && this.revealNext('cloze')) {
			event.preventDefault();
		} else if (ratio >= 0.89 && ratio <= 1 && this.revealNext('back')) {
			event.preventDefault();
		}
	}
}

export class ReadingReviewControllerRegistry {
	private readonly controllers = new Map<HTMLElement, ReadingReviewController>();

	constructor(private readonly app: App) {}

	getOrCreate(rootEl: HTMLElement, options: ReadingReviewControllerOptions): ReadingReviewController {
		let controller = this.controllers.get(rootEl);
		if (controller === undefined) {
			controller = new ReadingReviewController(this.app, rootEl, options);
			this.controllers.set(rootEl, controller);
			controller.load();
		} else {
			controller.updateOptions(options);
		}
		return controller;
	}

	get(rootEl: HTMLElement): ReadingReviewController | undefined {
		return this.controllers.get(rootEl);
	}

	getForContainer(containerEl: HTMLElement): ReadingReviewController | undefined {
		for (const controller of this.controllers.values()) {
			if (controller.rootEl === containerEl
				|| controller.rootEl.contains(containerEl)
				|| containerEl.contains(controller.rootEl)) {
				return controller;
			}
		}
		return undefined;
	}

	clear(): void {
		for (const controller of this.controllers.values()) {
			controller.unload();
		}
		this.controllers.clear();
	}
}

function isExcludedEdgeTarget(target: Element | null): boolean {
	return target?.closest('a, button, input, textarea, select, code, pre, .acl-review-mask') !== null;
}
