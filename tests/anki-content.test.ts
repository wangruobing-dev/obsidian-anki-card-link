import { describe, expect, it } from 'vitest';
import { toAnkiHtml } from '../src/core/anki-content';

describe('Anki HTML content conversion', () => {
	it('renders fenced code without synchronizing Markdown fence markers', () => {
		expect(toAnkiHtml('查找进程：\n```shell\nps -ef | grep [h]ealthcloud\n```')).toBe(
			'查找进程：<div style="text-align: center;"><pre style="display: inline-block; text-align: left;"><code class="language-shell">ps -ef | grep [h]ealthcloud</code></pre></div>',
		);
	});

	it('preserves code line breaks and escapes code as text', () => {
		expect(toAnkiHtml('```sql\nselect <column>\nfrom table_name;\n```')).toBe(
			'<div style="text-align: center;"><pre style="display: inline-block; text-align: left;"><code class="language-sql">select &lt;column&gt;\nfrom table_name;</code></pre></div>',
		);
	});

	it('keeps ordinary Markdown behavior and safely handles an unfinished code block', () => {
		expect(toAnkiHtml('Front\nBack')).toBe('Front<br>Back');
		expect(toAnkiHtml('```shell\nps -ef')).toBe('<div style="text-align: center;"><pre style="display: inline-block; text-align: left;"><code class="language-shell">ps -ef</code></pre></div>');
	});

	it('renders uploaded Obsidian images as Anki media images', () => {
		expect(
			toAnkiHtml(
				'答案 ![[Pasted image.png|320]]',
				new Map([['Pasted image.png', 'anki-card-link-12345678.png']]),
			),
		).toBe('答案 <img src="anki-card-link-12345678.png">');
	});
});
