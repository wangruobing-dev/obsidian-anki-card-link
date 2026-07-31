import { describe, expect, it } from 'vitest';
import { parseCardBlock, parseCards } from '../src/core/card-parser';
import { ensureAnkiNoteLink } from '../src/core/card-link';

describe('Anki note links in Markdown', () => {
	it('writes a nid link after a card block and updates it instead of duplicating it', () => {
		const source = 'Question :: Answer\n^acl-1234abcd';
		const card = parseCards(source)[0];
		if (card === undefined) {
			throw new Error('Test card was not parsed.');
		}
		const linked = ensureAnkiNoteLink(source, card, 100, 'Open corresponding Anki card');
		expect(linked).toBe(
			'Question :: Answer\n^acl-1234abcd\n\n[Open corresponding Anki card](obsidian://anki-card-link?type=nid&value=100)',
		);
		const linkedCard = parseCardBlock(linked.slice(0, linked.indexOf('\n\n')));
		if (linkedCard === null) {
			throw new Error('Linked test card was not parsed.');
		}
		expect(ensureAnkiNoteLink(linked, linkedCard, 200, 'Open corresponding Anki card')).toContain(
			'value=200',
		);
		expect(ensureAnkiNoteLink(linked, linkedCard, 200, 'Open corresponding Anki card')).not.toContain(
			'value=100',
		);
	});

	it('moves a link outside an unclosed code fence', () => {
		const source = '命令是什么？\n?\n```shell\nps -ef\n^acl-1234abcd\n\n[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=100)';
		const card = parseCards(source)[0];
		if (card === undefined) {
			throw new Error('Test card was not parsed.');
		}
		expect(ensureAnkiNoteLink(source, card, 100, '打开对应 Anki 卡片')).toBe(
			'命令是什么？\n?\n```shell\nps -ef\n```\n^acl-1234abcd\n\n[打开对应 Anki 卡片](obsidian://anki-card-link?type=nid&value=100)',
		);
	});

	it('adds a missing blank line before an existing note link', () => {
		const source = 'Question :: Answer\n^acl-1234abcd\n[Open corresponding Anki card](obsidian://anki-card-link?type=nid&value=100)';
		const card = parseCards(source)[0];
		if (card === undefined) {
			throw new Error('Test card was not parsed.');
		}
		expect(ensureAnkiNoteLink(source, card, 100, 'Open corresponding Anki card')).toBe(
			'Question :: Answer\n^acl-1234abcd\n\n[Open corresponding Anki card](obsidian://anki-card-link?type=nid&value=100)',
		);
	});
});
