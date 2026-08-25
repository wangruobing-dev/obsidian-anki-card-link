import { Component, FileSystemAdapter, MarkdownRenderer, Platform, TFile, type App } from 'obsidian';
import { extractObsidianImageReferencesInOrder } from '../core/anki-media';
import { buildWordFileName, buildWordImageDataUrl } from '../core/word-export';

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface WordExportInput {
	markdown: string;
	sourcePath: string;
	documentTitle: string;
	pluginDirectory: string;
}

export interface WordExportResult {
	saved: boolean;
	filePath?: string;
}

export async function exportMarkdownToWord(app: App, input: WordExportInput): Promise<WordExportResult> {
	const component = new Component();
	component.load();
	const container = document.body.createDiv({ cls: 'markdown-preview-view markdown-rendered acl-word-export' });
	try {
		await MarkdownRenderer.render(app, input.markdown, container, input.sourcePath, component);
		await waitForImages(container);
		await embedLocalImages(app, container, input.markdown, input.sourcePath);
		stripPluginGeneratedLinks(container);
		const htmlToDocx = loadHtmlToDocx(app, input.pluginDirectory);
		const docx = await htmlToDocx(toDocumentHtml(container.innerHTML, input.documentTitle), null, {
			title: input.documentTitle,
			creator: 'Anki Card Link',
		});
		return await saveWordDocument(normalizeDocxResult(docx), buildWordFileName(input.documentTitle));
	} finally {
		container.remove();
		component.unload();
	}
}

type HtmlToDocx = typeof import('@turbodocx/html-to-docx');
interface HtmlToDocxModule {
	default: HtmlToDocx;
}

function loadHtmlToDocx(app: App, pluginDirectory: string): HtmlToDocx {
	if (!(app.vault.adapter instanceof FileSystemAdapter)) {
		throw new Error('Word export is only available for local desktop vaults.');
	}
	const path = require('node:path') as NodePathModule;
	const runtimePath = path.join(
		app.vault.adapter.getBasePath(),
		pluginDirectory,
		'word-export-runtime.cjs',
	);
	const runtimeModule = require(runtimePath) as HtmlToDocxModule;
	return runtimeModule.default;
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

async function embedLocalImages(app: App, root: HTMLElement, markdown: string, sourcePath: string): Promise<void> {
	const references = extractObsidianImageReferencesInOrder(markdown);
	const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
		.filter((image) => !isExternalOrDataImageSource(image.getAttribute('src') ?? ''));
	if (images.length !== references.length) {
		throw new Error(`Could not match rendered images to local attachments (${images.length}/${references.length}).`);
	}
	await Promise.all(images.map(async (image, index) => {
		const reference = references[index];
		if (reference === undefined) {
			throw new Error('Could not resolve a local image reference for Word export.');
		}
		const file = app.metadataCache.getFirstLinkpathDest(reference, sourcePath);
		if (!(file instanceof TFile)) {
			throw new Error(`Image attachment was not found: ${reference}.`);
		}
		const dataUrl = buildWordImageDataUrl(await app.vault.readBinary(file), file.extension);
		image.removeAttribute('srcset');
		image.setAttribute('src', dataUrl);
	}));
}

function isExternalOrDataImageSource(source: string): boolean {
	return /^(?:data:|https?:)/iu.test(source.trim());
}

interface ElectronDialogModule {
	dialog?: ElectronSaveDialog;
	remote?: {
		dialog?: ElectronSaveDialog;
	};
}

interface ElectronSaveDialog {
	showSaveDialog(options: {
		defaultPath: string;
		filters: Array<{ name: string; extensions: string[] }>;
	}): Promise<{ canceled: boolean; filePath?: string }>;
}

interface NodeFileSystemModule {
	promises: {
		access(path: string): Promise<void>;
		mkdir(path: string, options: { recursive: true }): Promise<void>;
		writeFile(path: string, data: Uint8Array): Promise<void>;
	};
}

interface NodePathModule {
	join(...parts: string[]): string;
	parse(path: string): { dir: string; name: string; ext: string };
}

interface NodeOsModule {
	homedir(): string;
}

async function saveWordDocument(blob: Blob, suggestedName: string): Promise<WordExportResult> {
	if (Platform.isDesktopApp) {
		return saveWordDocumentOnDesktop(blob, suggestedName);
	}
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
			return { saved: true };
		} catch (error) {
			if (isAbortError(error)) {
				return { saved: false };
			}
			throw error;
		}
	}
	downloadBlob(blob, suggestedName);
	return { saved: true };
}

async function saveWordDocumentOnDesktop(blob: Blob, suggestedName: string): Promise<WordExportResult> {
	const fileSystem = require('node:fs') as NodeFileSystemModule;
	const path = require('node:path') as NodePathModule;
	const os = require('node:os') as NodeOsModule;
	const downloadsDirectory = path.join(os.homedir(), 'Downloads');
	await fileSystem.promises.mkdir(downloadsDirectory, { recursive: true });
	const defaultPath = path.join(downloadsDirectory, suggestedName);
	const selectedPath = await selectDesktopSavePath(defaultPath);
	if (selectedPath === null) {
		return { saved: false };
	}
	const filePath = selectedPath ?? await findAvailableFilePath(fileSystem, path, defaultPath);
	const bytes = new Uint8Array(await blob.arrayBuffer());
	await fileSystem.promises.writeFile(filePath, bytes);
	return { saved: true, filePath };
}

async function selectDesktopSavePath(defaultPath: string): Promise<string | null | undefined> {
	const electron = require('electron') as ElectronDialogModule;
	const dialog = electron.dialog ?? electron.remote?.dialog;
	if (dialog === undefined) {
		return undefined;
	}
	const result = await dialog.showSaveDialog({
		defaultPath,
		filters: [{ name: 'Word document', extensions: ['docx'] }],
	});
	return result.canceled || result.filePath === undefined ? null : result.filePath;
}

async function findAvailableFilePath(
	fileSystem: NodeFileSystemModule,
	path: NodePathModule,
	preferredPath: string,
): Promise<string> {
	if (!await fileExists(fileSystem, preferredPath)) {
		return preferredPath;
	}
	const parsed = path.parse(preferredPath);
	for (let index = 2; ; index += 1) {
		const candidate = path.join(parsed.dir, `${parsed.name} (${index})${parsed.ext}`);
		if (!await fileExists(fileSystem, candidate)) {
			return candidate;
		}
	}
}

async function fileExists(fileSystem: NodeFileSystemModule, path: string): Promise<boolean> {
	try {
		await fileSystem.promises.access(path);
		return true;
	} catch {
		return false;
	}
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
