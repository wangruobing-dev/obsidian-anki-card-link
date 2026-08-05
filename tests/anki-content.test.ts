import { describe, expect, it } from 'vitest';
import { toAnkiHtml } from '../src/core/anki-content';

describe('Anki HTML content conversion', () => {
	it('keeps an empty optional field empty', () => {
		expect(toAnkiHtml('')).toBe('');
	});

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

	it('renders inline Markdown styles without exposing their markers', () => {
		expect(toAnkiHtml('**解析：**\n时间复杂度是 `O(1)`，不是 ``O(n)``。')).toBe(
			'<strong>解析：</strong><br>时间复杂度是 <code>O(1)</code>，不是 <code>O(n)</code>。',
		);
		expect(toAnkiHtml('*斜体* __粗体__ ~~删除~~')).toBe('<em>斜体</em> <strong>粗体</strong> <s>删除</s>');
	});

	it('renders Markdown headings as real Anki HTML headings', () => {
		expect(toAnkiHtml('# 一级标题\n## 二级标题\n正文 {{c1::答案}}')).toBe(
			'<h1>一级标题</h1><h2>二级标题</h2>正文 {{c1::答案}}',
		);
	});

	it('renders lists and blockquotes instead of exposing Markdown markers', () => {
		expect(toAnkiHtml('- 第一项\n- **第二项**\n\n> 引用')).toBe(
			'<ul><li>第一项</li><li><strong>第二项</strong></li></ul><br><blockquote>引用</blockquote>',
		);
	});
});
