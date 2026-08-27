import { TFile, type App } from 'obsidian';
import { lengthPrefixedBytes, sha256Hex, utf8Bytes } from '../core/content-hash';
import { prepareMarkdownForSharing, type ShareMarkdownResult } from '../core/share-markdown';
import { AnkiCardLinkError, type AnkiCardLinkSettings } from '../types';
import { YoudaoApiError, type YoudaoImageUpload, type YoudaoSyncApi, type YoudaoUploadedResource } from './youdao-api';
import { normalizeVaultPath, YoudaoSyncIndex, type YoudaoNoteBinding } from './youdao-sync-index';

export interface YoudaoSyncResult {
	status: 'created' | 'updated' | 'unchanged';
	fileId: string;
	shareUrl: string;
	binding: YoudaoNoteBinding;
}

export interface YoudaoSyncServiceOptions {
	host: YoudaoSyncHost;
	settings: AnkiCardLinkSettings;
	index: YoudaoSyncIndex;
	api: YoudaoSyncApi;
	now?: () => number;
}

export interface YoudaoSyncImageFile {
	path: string;
	name: string;
	extension: string;
}

export interface YoudaoSyncHost {
	resolveImage(reference: string, sourcePath: string): YoudaoSyncImageFile | undefined;
	readBinary(path: string): Promise<ArrayBuffer>;
}

export class AppYoudaoSyncHost implements YoudaoSyncHost {
	constructor(private readonly app: App) {}

	resolveImage(reference: string, sourcePath: string): YoudaoSyncImageFile | undefined {
		const file = this.app.metadataCache.getFirstLinkpathDest(reference, sourcePath);
		return file instanceof TFile ? { path: file.path, name: file.name, extension: file.extension } : undefined;
	}

	readBinary(path: string): Promise<ArrayBuffer> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			throw new AnkiCardLinkError('IMAGE_NOT_FOUND', `Image attachment was not found: ${path}.`);
		}
		return this.app.vault.readBinary(file);
	}
}

export class YoudaoSyncService {
	private readonly now: () => number;

	constructor(private readonly options: YoudaoSyncServiceOptions) {
		this.now = options.now ?? Date.now;
	}

	async testConnection(): Promise<void> {
		this.requireConfig();
		await this.options.api.testConnection();
	}

	async syncNote(sourcePath: string, markdown: string): Promise<YoudaoSyncResult> {
		this.requireConfig();
		const normalizedPath = normalizeVaultPath(sourcePath);
		if (!normalizedPath.toLowerCase().endsWith('.md')) {
			throw new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The current editor does not contain a Markdown file.');
		}
		const title = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);
		const folderPath = normalizedPath.slice(0, Math.max(0, normalizedPath.lastIndexOf('/')));
		const prepared = prepareMarkdownForSharing(markdown);
		const images = await this.resolveImages(prepared, normalizedPath);
		const contentHash = await calculateContentHash(prepared.markdown, images);
		const existing = this.options.index.getByPath(normalizedPath);
		let fileId = existing?.fileId;
		const remoteNote = fileId === undefined ? undefined : await this.options.api.getNote(fileId);
		const parentFolderId = await this.ensureFolder(folderPath);
		let status: YoudaoSyncResult['status'];
		let shareUrl: string;
		let shareKey = existing?.shareKey ?? remoteNote?.shareKey;

		if (fileId === undefined || remoteNote === undefined) {
			const upload = await this.uploadImages(prepared, images);
			fileId = await this.options.api.createNote(title, parentFolderId, upload.markdown, upload.resources);
			const share = await this.options.api.publishNote(fileId);
			shareUrl = share.shareUrl;
			shareKey = share.shareKey;
			status = 'created';
		} else {
			const binding = existing!;
			const contentChanged = binding.contentHash !== contentHash;
			const titleChanged = binding.title !== title;
			const folderChanged = binding.parentFolderId !== parentFolderId;
			if (titleChanged) {
				await this.options.api.updateNoteTitle(fileId, title);
			}
			if (folderChanged) {
				await this.options.api.moveNote(fileId, parentFolderId);
			}
			if (contentChanged) {
				const upload = await this.uploadImages(prepared, images);
				await this.options.api.updateNoteContent(fileId, title, upload.markdown, upload.resources);
			}
			status = titleChanged || folderChanged || contentChanged ? 'updated' : 'unchanged';
			shareUrl = binding.shareUrl || remoteNote.shareUrl || '';
			if (shareUrl.length === 0) {
				const share = await this.options.api.publishNote(fileId);
				shareUrl = share.shareUrl;
				shareKey = share.shareKey;
				status = status === 'unchanged' ? 'updated' : status;
			}
		}

		const binding: YoudaoNoteBinding = {
			sourcePath: normalizedPath,
			fileId,
			parentFolderId,
			shareUrl,
			title,
			contentHash,
			shareKey,
			updatedAt: this.now(),
		};
		this.options.index.set(binding);
		return { status, fileId, shareUrl, binding };
	}

	private requireConfig(): void {
		if (this.options.settings.youdaoYnNotePc.trim().length === 0 && this.options.settings.youdaoSessionCookies.trim().length === 0) {
			throw new AnkiCardLinkError('YOUDAO_NOT_CONFIGURED', 'A Youdao browser Cookie or YNOTE-PC is required.');
		}
	}

	private async ensureFolder(folderPath: string): Promise<string> {
		let parentId = await this.options.api.getRootFolderId();
		let currentPath = '';
		for (const segment of ['Obsidian', ...folderPath.split('/').filter((item) => item.length > 0)]) {
			currentPath = currentPath.length === 0 ? segment : `${currentPath}/${segment}`;
			const cached = this.options.index.getFolder(currentPath);
			if (cached !== undefined) {
				try {
					await this.options.api.listFolder(cached.folderId);
					parentId = cached.folderId;
					continue;
				} catch (error) {
					if (!isMissingFolderError(error)) {
						throw error;
					}
					this.options.index.invalidateFolderPrefix(currentPath);
				}
			}
			const entries = await this.options.api.listFolder(parentId);
			const existing = entries.find((entry) => entry.dir && entry.name === segment);
			const folderId = existing?.id ?? await this.options.api.createFolder(parentId, segment);
			this.options.index.setFolder({ sourceFolderPath: currentPath, folderId, updatedAt: this.now() });
			parentId = folderId;
		}
		return parentId;
	}

	private async resolveImages(prepared: ShareMarkdownResult, sourcePath: string): Promise<YoudaoImageUpload[]> {
		const uploads: YoudaoImageUpload[] = [];
		for (const image of prepared.images) {
			const file = this.options.host.resolveImage(image.reference, sourcePath);
			if (file === undefined) {
				throw new AnkiCardLinkError('IMAGE_NOT_FOUND', `Image attachment was not found: ${image.reference}.`);
			}
			const mimeType = mimeForExtension(file.extension);
			if (mimeType === undefined) {
				throw new AnkiCardLinkError('UNSUPPORTED_IMAGE', `Unsupported image format: ${file.extension}.`);
			}
			uploads.push({
				reference: image.reference,
				placeholder: image.placeholder,
				fileName: file.name,
				mimeType,
				data: await this.options.host.readBinary(file.path),
			});
		}
		return uploads;
	}

	private async uploadImages(prepared: ShareMarkdownResult, images: readonly YoudaoImageUpload[]): Promise<{ markdown: string; resources: YoudaoUploadedResource[] }> {
		let markdown = prepared.markdown;
		const resources: YoudaoUploadedResource[] = [];
		for (const image of images) {
			const resource = await this.options.api.uploadImage(image);
			resources.push(resource);
			markdown = markdown.replaceAll(image.placeholder, resource.remoteUrl);
		}
		return { markdown, resources };
	}
}

async function calculateContentHash(markdown: string, images: readonly YoudaoImageUpload[]): Promise<string> {
	const parts = [lengthPrefixedBytes(utf8Bytes(markdown))];
	for (const image of images) {
		parts.push(lengthPrefixedBytes(image.data));
	}
	return sha256Hex(parts);
}

function isMissingFolderError(error: unknown): boolean {
	return error instanceof YoudaoApiError
		&& (error.httpStatus === 404 || error.code === 'YOUDAO_NOTE_NOT_FOUND');
}

function mimeForExtension(extension: string): string | undefined {
	return {
		apng: 'image/apng',
		avif: 'image/avif',
		bmp: 'image/bmp',
		gif: 'image/gif',
		jpeg: 'image/jpeg',
		jpg: 'image/jpeg',
		png: 'image/png',
		svg: 'image/svg+xml',
		webp: 'image/webp',
	}[extension.toLowerCase()];
}
