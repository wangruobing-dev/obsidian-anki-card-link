import { MarkdownView, TFile, type App } from 'obsidian';
import type { ObsidianSourceHost, SourceEditor, SourceFile } from './obsidian-source-locator';

export class AppObsidianSourceHost implements ObsidianSourceHost {
	constructor(private readonly app: App) {}

	getVaultName(): string {
		return this.app.vault.getName();
	}

	getFile(path: string): SourceFile | undefined {
		const file = this.app.vault.getAbstractFileByPath(path);
		return file instanceof TFile ? file : undefined;
	}

	async readFile(file: SourceFile): Promise<string> {
		const target = this.app.vault.getAbstractFileByPath(file.path);
		if (!(target instanceof TFile)) {
			throw new Error(`Markdown file disappeared before it could be read: ${file.path}`);
		}
		return this.app.vault.cachedRead(target);
	}

	async openFile(file: SourceFile): Promise<SourceEditor | undefined> {
		const target = this.app.vault.getAbstractFileByPath(file.path);
		if (!(target instanceof TFile)) {
			return undefined;
		}
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(target);
		return leaf.view instanceof MarkdownView ? leaf.view.editor : undefined;
	}
}
