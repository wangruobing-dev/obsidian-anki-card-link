import { describe, expect, it } from 'vitest';
import {
	addBlockId,
	findCardAtLine,
	generateBlockId,
	getCardTitle,
	getClozeNumbers,
	parseCardBlock,
	parseCards,
} from '../src/core/card-parser';

describe('card parser', () => {
	it('parses a single-line basic card and its existing block ID', () => {
		const card = parseCardBlock('什么是 JVM？ :: Java 虚拟机。 ^acl-1234abcd');
		expect(card).toMatchObject({
			type: 'basic',
			front: '什么是 JVM？',
			back: 'Java 虚拟机。',
			blockId: 'acl-1234abcd',
		});
	});

	it('includes following Wiki images in the answer of a single-line card', () => {
		const source = '今天天气如何？ :: 我觉得可以1111\n![[Pasted image.png]]';
		const card = parseCardBlock(source);
		expect(card).toMatchObject({
			type: 'basic',
			front: '今天天气如何？',
			back: '我觉得可以1111\n![[Pasted image.png]]',
		});
		expect(addBlockId(source, card!, 'acl-1234abcd')).toBe(
			'今天天气如何？ :: 我觉得可以1111\n![[Pasted image.png]]\n^acl-1234abcd',
		);
	});

	it('parses a multi-line basic card only when the separator is a complete line', () => {
		const card = parseCardBlock('为什么不安全？\n可能数据覆盖。\n?\n状态不一致。\n^acl-1234abcd');
		expect(card).toMatchObject({
			type: 'basic',
			front: '为什么不安全？\n可能数据覆盖。',
			back: '状态不一致。',
		});
		expect(parseCards('普通问题？\n继续说明。')).toHaveLength(0);
	});

	it('gives cloze priority over a basic-card separator and supports multiple numbers', () => {
		const card = parseCardBlock('Java 的 {{c1::垃圾回收器::提示}} :: {{c1::自动}} {{c3::内存}}');
		expect(card).toMatchObject({ type: 'cloze' });
		expect(getClozeNumbers(card?.content ?? '')).toEqual([1, 1, 3]);
	});

	it('parses multi-line cloze content', () => {
		const card = parseCardBlock('第一行 {{c1::内容}}\n第二行 {{c2::答案}}\n^acl-1234abcd');
		expect(card).toMatchObject({ type: 'cloze', blockId: 'acl-1234abcd' });
	});

	it('rejects empty basic fields and invalid cloze syntax', () => {
		expect(() => parseCardBlock(' :: Back')).toThrow(/front cannot be empty/u);
		expect(() => parseCardBlock('Front :: ')).toThrow(/back cannot be empty/u);
		expect(() => parseCardBlock('Java {{c1::}}')).toThrow(/valid cloze/u);
	});

	it('keeps parsing valid cards when another card has invalid syntax', () => {
		const cards = parseCards('One :: Answer\n\nBroken {{c1::}}\n\nTwo :: Answer');
		expect(cards).toHaveLength(2);
	});

	it('generates and persists a stable block ID only when missing', () => {
		const source = '# 标题\nFront :: Back';
		const card = findCardAtLine(source, 1);
		expect(card).toBeDefined();
		const generated = generateBlockId(() => 'ABCDEF12-0000-0000-0000-000000000000');
		expect(generated).toBe('acl-abcdef12');
		const updated = addBlockId(source, card!, generated);
		expect(updated).toBe('# 标题\nFront :: Back\n^acl-abcdef12');
		const updatedCard = findCardAtLine(updated, 1);
		expect(updatedCard?.blockId).toBe(generated);
		expect(getCardTitle(updated, updatedCard!, 'other.md')).toBe('标题');
	});

	it('closes an unclosed code fence before writing a card block ID', () => {
		const source = '命令是什么？\n?\n```shell\nps -ef';
		const card = parseCardBlock(source);
		if (card === null) {
			throw new Error('Test card was not parsed.');
		}
		expect(addBlockId(source, card, 'acl-1234abcd')).toBe(
			'命令是什么？\n?\n```shell\nps -ef\n```\n^acl-1234abcd',
		);
	});
});
