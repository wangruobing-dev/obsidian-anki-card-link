import { TFile, type App } from 'obsidian';
import { prepareMarkdownForSharing, type ShareMarkdownResult } from '../core/share-markdown';
import { parseFeishuRootFolderUrl } from '../settings';
import { AnkiCardLinkError, type AnkiCardLinkSettings } from '../types';
import { FeishuApiError, type FeishuImageUpload, type FeishuSyncApi } from './feishu-api';
import { FeishuSyncIndex, normalizeVaultPath, type FeishuNoteBinding } from './feishu-sync-index';

export interface FeishuSyncResult {
	status: 'created' | 'updated';
	documentToken: string;
	shareUrl: string;
	shareWarning?: string;
	binding: FeishuNoteBinding;
}

export interface FeishuSyncServiceOptions {
	host: FeishuSyncHost;
	settings: AnkiCardLinkSettings;
	index: FeishuSyncIndex;
	api: FeishuSyncApi;
	now?: () => number;
}

export interface FeishuSyncImageFile {
	path: string;
	name: string;
	extension: string;
}

export interface FeishuSyncHost {
	resolveImage(reference: string, sourcePath: string): FeishuSyncImageFile | undefined;
	readBinary(path: string): Promise<ArrayBuffer>;
}

export class AppFeishuSyncHost implements FeishuSyncHost {
	constructor(private readonly app: App) {}

	resolveImage(reference: string, sourcePath: string): FeishuSyncImageFile | undefined {
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

export class FeishuSyncService {
	private readonly now: () => number;

	constructor(private readonly options: FeishuSyncServiceOptions) {
		this.now = options.now ?? Date.now;
	}

	async testConnection(): Promise<void> {
		this.requireConfig();
		const root = parseFeishuRootFolderUrl(this.options.settings.feishuRootFolderUrl);
		try {
			await this.options.api.testConnection(root.rootFolderToken);
		} catch (error) {
			if (error instanceof FeishuApiError && (error.apiCode === 1061003 || error.apiCode === 1061007)) {
				throw new AnkiCardLinkError('FEISHU_ROOT_FOLDER_INVALID', 'The configured Feishu root folder does not exist.');
			}
			throw error;
		}
	}

	async syncNote(sourcePath: string, markdown: string): Promise<FeishuSyncResult> {
		const root = this.requireConfig();
		const normalizedPath = normalizeVaultPath(sourcePath);
		if (!normalizedPath.toLowerCase().endsWith('.md')) {
			throw new AnkiCardLinkError('CURRENT_CARD_NOT_FOUND', 'The current editor does not contain a Markdown file.');
		}
		const title = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1, -3);
		const folderPath = normalizedPath.slice(0, Math.max(0, normalizedPath.lastIndexOf('/')));
		const parentFolderToken = await this.ensureFolder(root.rootFolderToken, folderPath);
		const prepared = prepareMarkdownForSharing(markdown);
		const images = await this.resolveImages(prepared, normalizedPath);
		const existing = this.options.index.getByPath(normalizedPath);
		let documentToken = existing?.documentToken;
		let status: FeishuSyncResult['status'] = 'updated';
		if (documentToken === undefined || await this.options.api.getDocument(documentToken) === undefined) {
			documentToken = await this.options.api.createDocument(title);
			status = 'created';
			await this.options.api.moveDocument(documentToken, parentFolderToken);
		} else if (existing?.parentFolderToken !== parentFolderToken) {
			await this.options.api.moveDocument(documentToken, parentFolderToken);
		}
		await this.options.api.updateDocumentTitle(documentToken, title);
		await this.options.api.replaceDocumentContent(documentToken, prepared.markdown, images);
		let shareWarning: string | undefined;
		try {
			await this.options.api.setSharePermission(documentToken, this.options.settings.feishuShareMode);
		} catch (error) {
			if (error instanceof AnkiCardLinkError
				&& (error.code === 'FEISHU_PERMISSION_DENIED' || error.code === 'FEISHU_SHARE_PERMISSION_FAILED')) {
				shareWarning = 'Document content was synchronized, but Feishu did not allow the selected share permission.';
			} else {
				throw error;
			}
		}
		const shareUrl = status === 'created'
			? `${root.tenantOrigin}/docx/${documentToken}`
			: existing?.shareUrl ?? `${root.tenantOrigin}/docx/${documentToken}`;
		const binding: FeishuNoteBinding = {
			sourcePath: normalizedPath,
			documentToken,
			parentFolderToken,
			shareUrl,
			title,
			updatedAt: this.now(),
		};
		this.options.index.set(binding);
		return { status, documentToken, shareUrl, shareWarning, binding };
	}

	private requireConfig(): ReturnType<typeof parseFeishuRootFolderUrl> {
		if (this.options.settings.feishuAppId.trim().length === 0 || this.options.settings.feishuAppSecret.length === 0) {
			throw new AnkiCardLinkError('FEISHU_NOT_CONFIGURED', 'Feishu App ID and App Secret are required.');
		}
		return parseFeishuRootFolderUrl(this.options.settings.feishuRootFolderUrl);
	}

	private async ensureFolder(rootToken: string, folderPath: string): Promise<string> {
		let parentToken = rootToken;
		let currentPath = '';
		for (const segment of folderPath.split('/').filter((item) => item.length > 0)) {
			currentPath = currentPath.length === 0 ? segment : `${currentPath}/${segment}`;
			const cached = this.options.index.getFolder(currentPath);
			if (cached !== undefined) {
				try {
					await this.options.api.listFolder(cached.folderToken);
					parentToken = cached.folderToken;
					continue;
				} catch (error) {
					if (!isMissingFolderError(error)) {
						throw error;
					}
					this.options.index.invalidateFolderPrefix(currentPath);
				}
			}
			const entries = await this.options.api.listFolder(parentToken);
			const existing = entries.find((entry) => entry.type === 'folder' && entry.name === segment);
			const folderToken = existing?.token ?? await this.options.api.createFolder(parentToken, segment);
			this.options.index.setFolder({ sourceFolderPath: currentPath, folderToken, updatedAt: this.now() });
			parentToken = folderToken;
		}
		return parentToken;
	}

	private async resolveImages(prepared: ShareMarkdownResult, sourcePath: string): Promise<FeishuImageUpload[]> {
		const uploads: FeishuImageUpload[] = [];
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
}

function isMissingFolderError(error: unknown): boolean {
	return error instanceof FeishuApiError
		&& (error.httpStatus === 404 || error.apiCode === 1061003 || error.apiCode === 1061007);
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
