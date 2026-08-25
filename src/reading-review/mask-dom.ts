import { MarkdownRenderer, type App, type Component } from 'obsidian';
import type { ReadingReviewMask } from './mask-model';

export interface ReadingReviewMaskLabels {
	cloze: string;
	back: string;
}

export async function replaceTextWithMask(
	app: App,
	root: HTMLElement,
	text: string,
	mask: ReadingReviewMask,
	sourcePath: string,
	component: Component,
	labels: ReadingReviewMaskLabels,
): Promise<boolean> {
	const range = findCompactTextRange(root, text) ?? findCompactTextRange(root, markdownToRenderedText(text));
	if (range === undefined) {
		return false;
	}
	const maskElement = await createMaskElement(app, mask, sourcePath, component, labels);
	range.deleteContents();
	range.insertNode(maskElement);
	return true;
}

export async function replaceCodeTextWithMask(
	app: App,
	root: HTMLElement,
	mask: ReadingReviewMask,
	sourcePath: string,
	component: Component,
	labels: ReadingReviewMaskLabels,
): Promise<boolean> {
	const codeElements = root.matches('code')
		? [root, ...Array.from(root.querySelectorAll<HTMLElement>('code'))]
		: Array.from(root.querySelectorAll<HTMLElement>('code'));
	for (const codeElement of codeElements) {
		const range = findCompactTextRange(codeElement, mask.matchText);
		if (range === undefined) {
			continue;
		}
		const maskElement = await createMaskElement(app, mask, sourcePath, component, labels);
		range.deleteContents();
		range.insertNode(maskElement);
		return true;
	}
	return false;
}

export function wrapRenderedTextWithMask(
	root: HTMLElement,
	mask: ReadingReviewMask,
	labels: ReadingReviewMaskLabels,
): boolean {
	const exactElement = findExactRenderedElement(root, mask.answer);
	if (exactElement !== undefined && exactElement !== root) {
		const shell = createMaskShell(mask, labels, 'div');
		const content = shell.querySelector<HTMLElement>('.acl-review-mask__content');
		if (content === null) {
			return false;
		}
		exactElement.before(shell);
		content.append(exactElement);
		return true;
	}
	const range = findCompactTextRange(root, markdownToRenderedText(mask.answer));
	if (range === undefined) {
		return false;
	}
	const shell = createMaskShell(mask, labels, 'span');
	const content = shell.querySelector<HTMLElement>('.acl-review-mask__content');
	if (content === null) {
		return false;
	}
	content.append(range.extractContents());
	range.insertNode(shell);
	return true;
}

export async function createMaskElement(
	app: App,
	mask: ReadingReviewMask,
	sourcePath: string,
	component: Component,
	labels: ReadingReviewMaskLabels,
): Promise<HTMLElement> {
	const element = createMaskShell(mask, labels, mask.display === 'block' ? 'div' : 'span');
	const content = element.querySelector<HTMLElement>('.acl-review-mask__content');
	if (content === null) {
		return element;
	}
	content.dataset.aclReviewRendering = 'true';
	if (mask.renderAsCode) {
		content.textContent = mask.answer;
	} else {
		await MarkdownRenderer.render(app, mask.answer, content, sourcePath, component);
	}
	if (mask.kind === 'cloze') {
		flattenSingleParagraph(content);
	}

	return element;
}

function createMaskShell(
	mask: ReadingReviewMask,
	labels: ReadingReviewMaskLabels,
	tag: 'div' | 'span',
): HTMLElement {
	const element = createEl(tag);
	element.className = `acl-review-mask acl-review-mask--${mask.display}`;
	element.dataset.aclReviewKind = mask.kind;
	element.dataset.aclReviewMaskId = mask.id;
	element.setAttribute('role', 'button');
	element.tabIndex = 0;
	element.setAttribute('aria-label', mask.kind === 'cloze' ? labels.cloze : labels.back);

	const content = createEl(tag);
	content.className = 'acl-review-mask__content';
	element.append(content);

	if (mask.hint !== undefined) {
		const hint = createSpan();
		hint.className = 'acl-review-mask__hint';
		hint.textContent = mask.hint;
		element.append(hint);
	}

	return element;
}

export function setMaskRevealed(element: HTMLElement, revealed: boolean): void {
	element.classList.toggle('acl-review-mask--revealed', revealed);
	element.setAttribute('aria-pressed', String(revealed));
}

function findCompactTextRange(root: HTMLElement, text: string): Range | undefined {
	const target = compactText(text);
	if (target.length === 0) {
		return undefined;
	}
	const characters: Array<{ node: Text; offset: number }> = [];
	let compact = '';
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	let current = walker.nextNode();
	while (current !== null) {
		if (isTextNode(current) && current.parentElement?.closest('.acl-review-mask') === null) {
			for (let offset = 0; offset < current.data.length; offset += 1) {
				const character = current.data[offset];
				if (character !== undefined && !/\s/u.test(character)) {
					compact += character;
					characters.push({ node: current, offset });
				}
			}
		}
		current = walker.nextNode();
	}
	const start = compact.indexOf(target);
	const first = characters[start];
	const last = characters[start + target.length - 1];
	if (start < 0 || first === undefined || last === undefined) {
		return undefined;
	}
	const range = document.createRange();
	range.setStart(first.node, first.offset);
	range.setEnd(last.node, last.offset + 1);
	return range;
}

function isTextNode(node: Node): node is Text {
	return node.nodeType === 3;
}

function findExactRenderedElement(root: HTMLElement, markdown: string): HTMLElement | undefined {
	const target = compactText(markdownToRenderedText(markdown));
	if (target.length === 0) {
		return undefined;
	}
	const candidates = [root, ...Array.from(root.querySelectorAll<HTMLElement>('p, li, pre, blockquote, div'))];
	return candidates
		.filter((element) => element.closest('.acl-review-mask') === null && compactText(element.textContent) === target)
		.sort((left, right) => left.querySelectorAll('*').length - right.querySelectorAll('*').length)[0];
}

function compactText(value: string): string {
	return value.replace(/\s+/gu, '');
}

function markdownToRenderedText(value: string): string {
	return value
		.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/gu, '$1')
		.replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
		.replace(/\*\*|__|~~|`/gu, '')
		.replace(/^\s{0,3}#{1,6}\s+/gmu, '')
		.replace(/^\s{0,3}-\s+/gmu, '');
}

function flattenSingleParagraph(element: HTMLElement): void {
	if (element.childElementCount !== 1 || element.firstElementChild?.tagName !== 'P') {
		return;
	}
	const paragraph = element.firstElementChild;
	if (paragraph !== null) {
		paragraph.replaceWith(...Array.from(paragraph.childNodes));
	}
}
