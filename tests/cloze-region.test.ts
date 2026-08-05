import { describe, expect, it } from 'vitest';
import {
	findCardAtLine,
	parseCardCandidates,
	parseCards,
} from '../src/core/card-parser';
import {
	CLOZE_REGION_END,
	CLOZE_REGION_MARKER,
	CLOZE_REGION_START,
	findClozeRegionMarkers,
	parseClozeRegions,
} from '../src/core/cloze-region';

const start = CLOZE_REGION_START;
const end = CLOZE_REGION_END;

describe('explicit Cloze note regions', () => {
	it('parses one complete region and records all source ranges', () => {
		const source = `${start}\n\nJVM 是 {{c1::Java Virtual Machine}}。\n\n${end}`;
		const card = parseCards(source)[0];
		expect(card).toMatchObject({
			type: 'cloze',
			startLine: 0,
			endLine: 4,
			contentStartLine: 2,
			contentEndLine: 2,
			clozeRegionStartLine: 0,
			clozeRegionEndLine: 4,
			explicitRegion: true,
			content: 'JVM 是 {{c1::Java Virtual Machine}}。',
		});
	});

	it.each([
		['multiple paragraphs', `第一段 {{c1::答案一}}。\n\n第二段 {{c2::答案二}}。`],
		['Markdown headings', `## 一级内容\n\n### JVM\n\n{{c1::字节码}}`],
		['lists', `- 支持 {{c1::跨平台}}\n- 支持垃圾回收`],
		['images', `![[jvm.png]]\n\n图中是 {{c1::JVM}}。`],
		['formulas', `$$E={{c1::mc^2}}$$`],
		['fenced code plus a real cloze', '```markdown\n{{c9::示例}}\n```\n\n真实答案是 {{c1::JVM}}。'],
	])('keeps %s inside one region Content', (_name, content) => {
		const cards = parseCards(`${start}\n\n${content}\n\n${end}`);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({ type: 'cloze', content });
	});

	it('parses two regions as two independent Cloze cards', () => {
		const source = `${start}\nA {{c1::一}}\n${end}\n\n${start}\nB {{c1::二}}\n${end}`;
		const cards = parseCards(source);
		expect(cards.map((card) => card.type)).toEqual(['cloze', 'cloze']);
		expect(cards.map((card) => card.type === 'cloze' ? card.content : '')).toEqual(['A {{c1::一}}', 'B {{c1::二}}']);
	});

	it('keeps ordinary notes outside a region without creating extra cards', () => {
		const source = `普通说明\n\n${start}\n{{c1::区域}}\n${end}\n\n继续说明`;
		expect(parseCards(source)).toHaveLength(1);
	});

	it('parses Basic and Choice outside regions in source order', () => {
		const source = `${start}\n{{c1::第一张}}\n${end}\n\n问题::答案\n\n### 选择题【B】\n- A\n- B\n\n${start}\n{{c1::第二张}}\n${end}`;
		expect(parseCards(source).map((card) => card.type)).toEqual(['cloze', 'basic', 'choice', 'cloze']);
	});

	it('treats Basic separators, Choice syntax, and headings inside a region as ordinary Content', () => {
		const content = `### 选择题【A】\n- A\n- B\n\n问题::答案\n\n{{c1::真正填空}}`;
		const cards = parseCards(`${start}\n${content}\n${end}`);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({ type: 'cloze', content });
	});

	it.each([
		['   <!-- anki-card-link:cloze:start -->   ', ' <!-- anki-card-link:cloze:end --> '],
		['<!--anki-card-link:cloze:start-->', '<!--anki-card-link:cloze:end-->'],
		['<!--  anki-card-link:cloze:start  -->', '<!--  anki-card-link:cloze:end  -->'],
	])('accepts marker whitespace variants', (open, close) => {
		expect(parseCards(`${open}\n{{c1::答案}}\n${close}`)).toHaveLength(1);
	});

	it('ignores boundary examples inside backtick and tilde fences', () => {
		const source = `\`\`\`markdown\n${start}\n{{c1::示例}}\n${end}\n\`\`\`\n\n~~~markdown\n${start}\n{{c2::示例}}\n${end}\n~~~`;
		expect(findClozeRegionMarkers(source)).toHaveLength(0);
		expect(parseCards(source)).toHaveLength(0);
	});

	it('ignores a Cloze token outside explicit regions', () => {
		const source = `区域外 {{c9::不应同步}}\n\n${start}\n区域内 {{c1::应同步}}\n${end}`;
		const cards = parseCards(source);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({ type: 'cloze', content: '区域内 {{c1::应同步}}' });
	});

	it('finds a region card from its start marker, body, end marker, or button', () => {
		const source = `${start}\n\n{{c1::答案}}\n\n${end}\n\n[Open](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)`;
		for (const line of [0, 2, 4, 6]) {
			expect(findCardAtLine(source, line)).toMatchObject({ type: 'cloze', uid: 'acl-1234abcd', linkLine: 6 });
		}
	});

	it('reports duplicate UIDs across two explicit regions', () => {
		const button = '[Open](obsidian://anki-card-link?type=nid&value=10&uid=acl-1234abcd&v=2)';
		const source = `${start}\n{{c1::一}}\n${end}\n\n${button}\n\n${start}\n{{c1::二}}\n${end}\n\n${button}`;
		expect(parseCardCandidates(source).filter((candidate) => candidate.error?.code === 'DUPLICATE_CARD_UID')).toHaveLength(2);
	});
});

describe('single-marker Cloze note regions', () => {
	it('uses one marker to start a card that continues to the end of the file', () => {
		const source = `${CLOZE_REGION_MARKER}\n\n# JVM\n\nJVM 是 {{c1::Java Virtual Machine}}。`;
		expect(parseCards(source)).toEqual([
			expect.objectContaining({
				type: 'cloze',
				startLine: 0,
				endLine: 4,
				contentStartLine: 2,
				contentEndLine: 4,
				clozeRegionStartLine: 0,
				clozeRegionStyle: 'single',
				explicitRegion: true,
				content: '# JVM\n\nJVM 是 {{c1::Java Virtual Machine}}。',
			}),
		]);
	});

	it('starts a new independent card at every following marker', () => {
		const source = `${CLOZE_REGION_MARKER}\n第一张 {{c1::一}}\n\n${CLOZE_REGION_MARKER}\n第二张 {{c1::二}}`;
		const cards = parseCards(source);
		expect(cards.map((card) => card.type === 'cloze' ? card.content : '')).toEqual([
			'第一张 {{c1::一}}',
			'第二张 {{c1::二}}',
		]);
		expect(cards.map((card) => card.startLine)).toEqual([0, 3]);
	});

	it('ignores single-marker examples inside fenced code', () => {
		const source = `\`\`\`markdown\n${CLOZE_REGION_MARKER}\n{{c1::示例}}\n\`\`\``;
		expect(findClozeRegionMarkers(source)).toHaveLength(0);
		expect(parseCards(source)).toHaveLength(0);
	});

	it('does not parse Basic or Choice syntax inside a single-marker card', () => {
		const source = `${CLOZE_REGION_MARKER}\n问题::答案\n\n### 题目【A】\n- A\n- B\n\n{{c1::填空}}`;
		const cards = parseCards(source);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({ type: 'cloze' });
	});

	it('reports an empty or non-Cloze single-marker card without falling back to implicit mode', () => {
		expect(parseCardCandidates(CLOZE_REGION_MARKER)[0]?.error?.code).toBe('CLOZE_REGION_EMPTY');
		expect(parseCardCandidates(`${CLOZE_REGION_MARKER}\n普通正文`)[0]?.error?.code).toBe('CLOZE_REGION_NO_CLOZE');
	});
});

describe('invalid Cloze note region markers', () => {
	it.each([
		[`${start}\n{{c1::答案}}`, 'CLOZE_REGION_UNMATCHED_START', 0],
		[`${end}\n普通内容`, 'CLOZE_REGION_UNMATCHED_END', 0],
		[`${start}\n${start}\n{{c1::答案}}\n${end}`, 'CLOZE_REGION_NESTED', 0],
		[`${end}\n${start}\n{{c1::答案}}\n${end}`, 'CLOZE_REGION_UNMATCHED_END', 1],
		[`${start}\n${end}`, 'CLOZE_REGION_EMPTY', 0],
		[`${start}\n \t \n${end}`, 'CLOZE_REGION_EMPTY', 0],
		[`${start}\n普通内容\n${end}`, 'CLOZE_REGION_NO_CLOZE', 0],
		[`${start}\n\`\`\`md\n{{c1::示例}}\n\`\`\`\n${end}`, 'CLOZE_REGION_NO_CLOZE', 0],
	])('reports %s with an explicit error code', (source, code, expectedClozeCards) => {
		const candidates = parseCardCandidates(source);
		expect(candidates.some((candidate) => candidate.error?.code === code)).toBe(true);
		expect(candidates.filter((candidate) => candidate.card?.type === 'cloze')).toHaveLength(expectedClozeCards);
	});

	it('does not fall back to implicit whole-note mode after a boundary error', () => {
		const source = `${start}\n{{c1::区域内}}\n区域外仍有 {{c2::填空}}`;
		const candidates = parseCardCandidates(source);
		expect(candidates.some((candidate) => candidate.error?.code === 'CLOZE_REGION_UNMATCHED_START')).toBe(true);
		expect(candidates.some((candidate) => candidate.card?.type === 'cloze')).toBe(false);
	});

	it('keeps marker pairs available for overlap checks even when the region is invalid', () => {
		const scan = parseClozeRegions(`${start}\n普通内容\n${end}`);
		expect(scan.explicitMode).toBe(true);
		expect(scan.protectedRanges).toEqual([{ startLine: 0, endLine: 2 }]);
	});
});

describe('implicit whole-note Cloze compatibility', () => {
	it.each([
		['one paragraph', 'JVM 是 {{c1::Java Virtual Machine}}。'],
		['multiple paragraphs', '第一段 {{c1::一}}。\n\n第二段 {{c2::二}}。'],
		['headings', '# JVM\n\n内容 {{c1::答案}}\n\n## 内存\n\n内容 {{c2::答案二}}'],
	])('creates one card for %s', (_name, source) => {
		const cards = parseCards(source);
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({ type: 'cloze', explicitRegion: false, content: source });
	});

	it('excludes YAML frontmatter from Content', () => {
		const source = `---\ntags:\n  - anki-card-link\nprivate: {{c9::metadata}}\n---\n\n# JVM\n\n{{c1::正文}}`;
		const card = parseCards(source)[0];
		expect(card).toMatchObject({ type: 'cloze', content: '# JVM\n\n{{c1::正文}}', contentStartLine: 6 });
	});

	it('excludes the synchronized button and legacy UID while preserving noteId and UID', () => {
		const source = `# JVM\n\n{{c1::正文}}\n^acl-1234abcd\n\n[Open](obsidian://anki-card-link?type=nid&value=99&uid=acl-1234abcd&v=2)`;
		const card = parseCards(source)[0];
		expect(card).toMatchObject({ type: 'cloze', content: '# JVM\n\n{{c1::正文}}', uid: 'acl-1234abcd', noteId: 99, linkLine: 5 });
	});

	it('does not let a fenced-code Cloze trigger implicit mode', () => {
		expect(parseCards('```markdown\n{{c1::示例}}\n```')).toHaveLength(0);
	});

	it('does not create a Cloze card without a valid token', () => {
		expect(parseCards('普通内容\n\n{{c1::}}')).toHaveLength(0);
	});

	it('trims only meaningless outer blank lines', () => {
		const card = parseCards('\n\n# 标题\n\n{{c1::答案}}\n\n段落\n\n')[0];
		expect(card).toMatchObject({ type: 'cloze', content: '# 标题\n\n{{c1::答案}}\n\n段落' });
	});
});
