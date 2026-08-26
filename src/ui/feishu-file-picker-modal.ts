import { Modal, Setting, type App, type TFile } from 'obsidian';
import { getStrings } from '../strings';
import { collectSelectedMarkdownFiles } from '../services/feishu-batch-selection';
import {
	getNextCollapsedFolders,
	getSelectionState,
	isFolderExpanded,
} from './feishu-file-picker-state';

interface FolderNode {
	name: string;
	path: string;
	children: Map<string, FolderNode>;
	files: TFile[];
}

export class FeishuFilePickerModal extends Modal {
	private readonly selectedPaths = new Set<string>();
	private collapsedFolders = new Set<string>();
	private readonly files: TFile[];

	constructor(
		app: App,
		language: Parameters<typeof getStrings>[0],
		private readonly onSubmit: (files: TFile[]) => void,
	) {
		super(app);
		this.language = language;
		this.files = app.vault.getMarkdownFiles().sort((left, right) => left.path.localeCompare(right.path));
		this.contentEl.addClass('anki-card-link-modal', 'anki-card-link-feishu-picker');
	}

	private readonly language: Parameters<typeof getStrings>[0];

	override onOpen(): void {
		this.render();
	}

	override onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		const strings = getStrings(this.language);
		this.contentEl.empty();
		this.setTitle(strings.titles.feishuFilePicker);
		const root = buildFolderTree(this.files);
		this.renderSelection(this.contentEl, strings.labels.allNotes, this.files, () => this.toggleFiles(this.files));
		const tree = this.contentEl.createDiv({ cls: 'anki-card-link-feishu-picker__tree' });
		for (const child of [...root.children.values()].sort(compareFolders)) {
			this.renderFolder(tree, child);
		}
		for (const file of root.files) {
			this.renderSelection(tree, file.name, [file], () => this.toggleFiles([file]), 'anki-card-link-feishu-picker__file');
		}
		new Setting(this.contentEl)
			.setDesc(strings.labels.selectedNotes(this.selectedPaths.size))
			.addButton((button) => button.setButtonText(strings.labels.cancel).onClick(() => this.close()))
			.addButton((button) => button
				.setButtonText(strings.labels.startSync)
				.setCta()
				.setDisabled(this.selectedPaths.size === 0)
				.onClick(() => {
					const selected = collectSelectedMarkdownFiles(this.files, this.selectedPaths);
					if (selected.length === 0) return;
					this.onSubmit(selected);
					this.close();
				}));
	}

	private renderFolder(parent: HTMLElement, folder: FolderNode): void {
		const folderFiles = allFilesInFolder(folder);
		const expanded = isFolderExpanded(folder.path, this.collapsedFolders);
		const container = parent.createDiv({ cls: 'anki-card-link-feishu-picker__folder' });
		const row = container.createDiv({ cls: 'anki-card-link-feishu-picker__folder-row' });
		const checkbox = row.createEl('input', { type: 'checkbox', cls: 'anki-card-link-feishu-picker__checkbox' });
		const selection = getSelectionState(folderFiles, this.selectedPaths);
		checkbox.checked = selection.checked;
		checkbox.indeterminate = selection.indeterminate;
		checkbox.setAttribute('aria-label', folder.name);
		checkbox.addEventListener('change', () => this.toggleFiles(folderFiles));

		const toggle = row.createEl('button', { type: 'button', cls: 'anki-card-link-feishu-picker__folder-toggle' });
		toggle.setAttribute('aria-expanded', String(expanded));
		toggle.addEventListener('click', () => this.toggleFolder(folder.path));
		toggle.createSpan({ text: expanded ? '▾' : '▸', cls: 'anki-card-link-feishu-picker__folder-arrow' });
		toggle.createSpan({ text: folder.name, cls: 'anki-card-link-feishu-picker__folder-name' });

		const children = container.createDiv({ cls: 'anki-card-link-feishu-picker__children' });
		children.toggleClass('anki-card-link-feishu-picker__children--collapsed', !expanded);
		for (const child of [...folder.children.values()].sort(compareFolders)) {
			this.renderFolder(children, child);
		}
		for (const file of folder.files) {
			this.renderSelection(children, file.name, [file], () => this.toggleFiles([file]), 'anki-card-link-feishu-picker__file');
		}
	}

	private renderSelection(
		parent: HTMLElement,
		label: string,
		files: readonly TFile[],
		onToggle: () => void,
		className?: string,
	): void {
		const row = parent.createEl('label', { cls: ['anki-card-link-feishu-picker__row', className].filter(Boolean).join(' ') });
		const checkbox = row.createEl('input', { type: 'checkbox', cls: 'anki-card-link-feishu-picker__checkbox' });
		const selection = getSelectionState(files, this.selectedPaths);
		checkbox.checked = selection.checked;
		checkbox.indeterminate = selection.indeterminate;
		checkbox.addEventListener('click', (event) => event.stopPropagation());
		checkbox.addEventListener('change', () => onToggle());
		row.createSpan({ text: label });
	}

	private toggleFolder(folderPath: string): void {
		this.collapsedFolders = getNextCollapsedFolders(this.collapsedFolders, folderPath);
		this.render();
	}

	private toggleFiles(files: readonly TFile[]): void {
		const selected = files.filter((file) => this.selectedPaths.has(file.path)).length;
		if (selected === files.length) {
			for (const file of files) this.selectedPaths.delete(file.path);
		} else {
			for (const file of files) this.selectedPaths.add(file.path);
		}
		this.render();
	}
}

function buildFolderTree(files: readonly TFile[]): FolderNode {
	const root: FolderNode = { name: '', path: '', children: new Map(), files: [] };
	for (const file of files) {
		const segments = file.path.split('/');
		const fileName = segments.pop();
		if (fileName === undefined) continue;
		let current = root;
		for (const segment of segments) {
			const path = current.path.length === 0 ? segment : `${current.path}/${segment}`;
			let child = current.children.get(segment);
			if (child === undefined) {
				child = { name: segment, path, children: new Map(), files: [] };
				current.children.set(segment, child);
			}
			current = child;
		}
		current.files.push(file);
	}
	return root;
}

function allFilesInFolder(folder: FolderNode): TFile[] {
	return [...folder.files, ...[...folder.children.values()].flatMap(allFilesInFolder)];
}

function compareFolders(left: FolderNode, right: FolderNode): number {
	return left.name.localeCompare(right.name);
}
