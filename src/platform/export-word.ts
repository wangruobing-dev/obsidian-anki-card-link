import { Component, MarkdownRenderer, type App } from 'obsidian';
import { buildWordFileName } from '../core/word-export';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface WordExportInput {
	markdown: string;
	sourcePath: string;
	documentTitle: string;
}

export async function exportMarkdownToWord(app: App, input: WordExportInput): Promise<void> {
	const component = new Component();
	component.load();
	const container = document.body.createDiv({ cls: 'markdown-preview-view markdown-rendered acl-word-export' });
	try {
		await MarkdownRenderer.render(app, input.markdown, container, input.sourcePath, component);
		await waitForImages(container);
		stripPluginGeneratedLinks(container);
		const htmlToDocx = await loadHtmlToDocx();
		const docx = await htmlToDocx(toDocumentHtml(container.innerHTML, input.documentTitle), null, {
			title: input.documentTitle,
			creator: 'Anki Card Link',
		});
		await saveWordDocument(normalizeDocxResult(docx), buildWordFileName(input.documentTitle));
	} finally {
		container.remove();
		component.unload();
	}
}

type HtmlToDocx = typeof import('@turbodocx/html-to-docx');
type HtmlToDocxModule = { default: HtmlToDocx };

async function loadHtmlToDocx(): Promise<HtmlToDocx> {
	const module: HtmlToDocxModule = await import('@turbodocx/html-to-docx');
	return module.default;
}

function stripPluginGeneratedLinks(root: HTMLElement): void {
	const links = Array.from(root.querySelectorAll<HTMLAnchorElement>(
		'a[href^="obsidian://anki-card-link?"], a[href^="obsidian://anki-card-link-open?"]',
	));
	for (const link of links) {
		const parent = link.parentElement;
		link.remove();
		pruneEmptyBlocks(parent);
	}
}

function pruneEmptyBlocks(element: HTMLElement | null): void {
	let current = element;
	while (current !== null && current !== document.body) {
		if (!isEmptyBlock(current)) {
			return;
		}
		const parent = current.parentElement;
		current.remove();
		current = parent;
	}
}

function isEmptyBlock(element: HTMLElement): boolean {
	return element.childElementCount === 0 && (element.textContent ?? '').trim().length === 0;
}

async function waitForImages(root: HTMLElement): Promise<void> {
	const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
	await Promise.all(images.map(async (image) => {
		if (image.complete) {
			return;
		}
		await new Promise<void>((resolve) => {
			image.addEventListener('load', () => resolve(), { once: true });
			image.addEventListener('error', () => resolve(), { once: true });
		});
	}));
}

function toDocumentHtml(bodyHtml: string, title: string): string {
	return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function normalizeDocxResult(value: Blob | ArrayBuffer | Uint8Array): Blob {
	return value instanceof Blob
		? value
		: new Blob([new Uint8Array(value).slice().buffer], { type: DOCX_MIME_TYPE });
}

interface WordSavePickerWindow extends Window {
	showSaveFilePicker?: (options: WordSavePickerOptions) => Promise<WordSaveFileHandle>;
}

interface WordSaveFileHandle {
	createWritable(): Promise<WordWritableFile>;
}

interface WordWritableFile {
	write(data: Blob): Promise<void>;
	close(): Promise<void>;
}

interface WordSavePickerOptions {
	suggestedName?: string;
	types?: Array<{
		description?: string;
		accept: Record<string, string[]>;
	}>;
}

async function saveWordDocument(blob: Blob, suggestedName: string): Promise<void> {
	const picker = (window as WordSavePickerWindow).showSaveFilePicker;
	if (picker !== undefined) {
		try {
			const handle = await picker({
				suggestedName,
				types: [{
					description: 'Word document',
					accept: { [DOCX_MIME_TYPE]: ['.docx'] },
				}],
			});
			const writable = await handle.createWritable();
			await writable.write(blob);
			await writable.close();
			return;
		} catch (error) {
			if (isAbortError(error)) {
				return;
			}
			throw error;
		}
	}
	downloadBlob(blob, suggestedName);
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException
		? error.name === 'AbortError'
		: error instanceof Error && error.name === 'AbortError';
}

function downloadBlob(blob: Blob, suggestedName: string): void {
	const url = URL.createObjectURL(blob);
	const anchor = document.body.createEl('a');
	anchor.href = url;
	anchor.download = suggestedName;
	anchor.rel = 'noopener';
	anchor.click();
	anchor.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
