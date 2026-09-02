import { describe, expect, it } from 'vitest';
import { toAnkiHtml } from '../src/core/anki-content';

describe('Anki HTML content conversion', () => {
	it('keeps an empty optional field empty', () => {
		expect(toAnkiHtml('')).toBe('');
	});

	it('renders a shared article as a clickable link without interpreting query underscores as emphasis', () => {
		const url = 'https://www.xiaohongshu.com/explore/example?app_platform=ios&app_version=9.42&share_from_user_hidden=true&xsec_token=sample-token';
		expect(toAnkiHtml(`🔗 **链接**：[小红书](${url})`)).toBe(
			`🔗 <strong>链接</strong>：<a href="${url.replaceAll('&', '&amp;')}">小红书</a>`,
		);
	});

	it.each([
		['[中文](https://example.com/中文?q=%E4%B8%AD%E6%96%87#章节)', '<a href="https://example.com/中文?q=%E4%B8%AD%E6%96%87#章节">中文</a>'],
		['[括号](https://example.com/a_(b_(c))?q=(d))', '<a href="https://example.com/a_(b_(c))?q=(d)">括号</a>'],
		[String.raw`[转义\[标签\]](https://example.com/a\(b\)?q=1\&v=2)`, '<a href="https://example.com/a(b)?q=1&amp;v=2">转义[标签]</a>'],
		[String.raw`[\*文字\*](https://example.com)`, '<a href="https://example.com">*文字*</a>'],
		['[方括号 [文字]](http://example.com)', '<a href="http://example.com">方括号 [文字]</a>'],
		['[尖括号](<https://example.com/a b?q=x_y>)', '<a href="https://example.com/a%20b?q=x_y">尖括号</a>'],
		['[标题](https://example.com "说明 & 标题")', '<a href="https://example.com" title="说明 &amp; 标题">标题</a>'],
		["[标题](https://example.com '说明')", '<a href="https://example.com" title="说明">标题</a>'],
		['[标题](https://example.com (说明（中文）))', '<a href="https://example.com" title="说明（中文）">标题</a>'],
		[String.raw`[标题](https://example.com "说明 \"引号\"")`, '<a href="https://example.com" title="说明 &quot;引号&quot;">标题</a>'],
		['[加粗 **文字** 与 `code`](https://example.com)', '<a href="https://example.com">加粗 <strong>文字</strong> 与 <code>code</code></a>'],
		['[网址公式](https://example.com/?q=$x^2$)', '<a href="https://example.com/?q=$x^2$">网址公式</a>'],
		['[表格](https://example.com/?q=a|b)', '<a href="https://example.com/?q=a|b">表格</a>'],
	])('renders inline link %s', (source, html) => {
		expect(toAnkiHtml(source)).toBe(html);
	});

	it('renders several links in blocks and preserves formatting around them', () => {
		expect(toAnkiHtml('**[甲](https://a.example)** 与 [乙](http://b.example)\n\n> [引用](https://c.example)')).toBe(
			'<strong><a href="https://a.example">甲</a></strong> 与 <a href="http://b.example">乙</a><br><blockquote><a href="https://c.example">引用</a></blockquote>',
		);
		expect(toAnkiHtml('| 来源 | 说明 |\n| --- | --- |\n| [来源](https://example.com/?a=x|y) | 正文 |'))
			.toContain('<a href="https://example.com/?a=x|y">来源</a>');
	});

	it.each([
		'[查看来源]([https://example.com](https://v.douyin.com/example/))',
		'[外层 [内层](https://inner.example)](https://outer.example)',
		'[脚本](javascript:alert(1))',
		'[本地](../note.md)',
		'[错误](https://)',
	])('leaves unsupported or malformed links as text: %s', (source) => {
		expect(toAnkiHtml(source)).toBe(source);
	});

	it('escapes link attributes and label HTML without creating executable attributes', () => {
		expect(toAnkiHtml('[<img src=x onerror=alert(1)>](<https://example.com/?q="onclick="test>)')).toBe(
			'<a href="https://example.com/?q=&quot;onclick=&quot;test">&lt;img src=x onerror=alert(1)&gt;</a>',
		);
	});

	it('keeps links inside code and math literal while rendering adjacent links and Cloze content', () => {
		const link = '[来源](https://example.com/?a_b=c_d)';
		const anchor = '<a href="https://example.com/?a_b=c_d">来源</a>';
		expect(toAnkiHtml(`\`${link}\` ${link}`)).toBe(`<code>${link}</code> ${anchor}`);
		expect(toAnkiHtml(`~~~text\n${link}\n~~~\n${link}`)).toContain(`<code class="language-text">${link}</code></pre></div>${anchor}`);
		expect(toAnkiHtml(`$$x + ${link}$$`)).toBe(`\\[x + ${link}\\]`);
		expect(toAnkiHtml(`{{c1::${link}}} 与 $x^2$`)).toBe(`{{c1::${anchor}}} 与 \\(x^2\\)`);
		expect(toAnkiHtml(`![示意图](附件/a.png) ${link}`, new Map([['附件/a.png', 'media.png']]))).toBe(`<img src="media.png"> ${anchor}`);
		expect(toAnkiHtml('[![示意图](附件/a.png)](https://example.com)', new Map([['附件/a.png', 'media.png']])))
			.toBe('<a href="https://example.com"><img src="media.png"></a>');
		expect(toAnkiHtml('[价格](https://example.com/?price=$value) 与 $x^2$'))
			.toBe('<a href="https://example.com/?price=$value">价格</a> 与 \\(x^2\\)');
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

	it('renders uploaded standard Markdown images with angle-bracket destinations', () => {
		expect(
			toAnkiHtml(
				'解析\n![](<20260808224611081-46aab726.png>)',
				new Map([['20260808224611081-46aab726.png', 'anki-card-link-abcdef12.png']]),
			),
		).toBe('解析<br><img src="anki-card-link-abcdef12.png">');
	});

	it('uses the same decoded reference for Markdown image upload and rendering', () => {
		expect(
			toAnkiHtml(
				'![示意图](附件/Pasted%20image.png "标题")',
				new Map([['附件/Pasted image.png', 'anki-card-link-12345678.png']]),
			),
		).toBe('<img src="anki-card-link-12345678.png">');
	});

	it('keeps image-like text inside inline code as code', () => {
		expect(
			toAnkiHtml(
				'`![](<image.png>)`',
				new Map([['image.png', 'anki-card-link-12345678.png']]),
			),
		).toBe('<code>![](&lt;image.png&gt;)</code>');
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

	it('converts display math to Anki MathJax delimiters', () => {
		expect(toAnkiHtml('$$P\\times(1+r)^n$$')).toBe('\\[P\\times(1+r)^n\\]');
	});

	it('keeps display math inside a Cloze so enhanced templates can typeset it', () => {
		expect(toAnkiHtml('$${{c1::P\\times(1+r)^n}}$$')).toBe('{{c1::\\[P\\times(1+r)^n\\]}}');
	});

	it('converts inline math without treating ordinary dollar text as math', () => {
		expect(toAnkiHtml('收益为 $r=10\\%$，价格为 $5')).toBe('收益为 \\(r=10\\%\\)，价格为 $5');
	});

	it('does not convert math-looking text inside code', () => {
		expect(toAnkiHtml('```text\n$$x^2$$\n```')).toContain('<code class="language-text">$$x^2$$</code>');
	});

	it('renders lists and blockquotes instead of exposing Markdown markers', () => {
		expect(toAnkiHtml('- 第一项\n- **第二项**\n\n> 引用')).toBe(
			'<ul><li>第一项</li><li><strong>第二项</strong></li></ul><br><blockquote>引用</blockquote>',
		);
	});

	it('renders a Markdown table as bordered Anki HTML and preserves Cloze markup', () => {
		expect(toAnkiHtml('| 灯神 | 发森森扥撒扥 |\n| --- | --- |\n| 发森森{{c1::扥撒扥}} | 是扥是扥收到 |')).toBe(
			'<table style="border-collapse: collapse; margin: 0.5em auto;"><thead><tr><th style="border: 1px solid currentColor; padding: 0.35em 0.6em;">灯神</th><th style="border: 1px solid currentColor; padding: 0.35em 0.6em;">发森森扥撒扥</th></tr></thead><tbody><tr><td style="border: 1px solid currentColor; padding: 0.35em 0.6em;">发森森{{c1::扥撒扥}}</td><td style="border: 1px solid currentColor; padding: 0.35em 0.6em;">是扥是扥收到</td></tr></tbody></table>',
		);
	});

	it('supports table alignment, inline styles, and escaped pipes', () => {
		expect(toAnkiHtml('名称 | 说明\n:--- | ---:\n**左侧** | `a|b` 与 A\\|B')).toContain(
			'<th style="border: 1px solid currentColor; padding: 0.35em 0.6em; text-align: left;">名称</th><th style="border: 1px solid currentColor; padding: 0.35em 0.6em; text-align: right;">说明</th>',
		);
		expect(toAnkiHtml('名称 | 说明\n:--- | ---:\n**左侧** | `a|b` 与 A\\|B')).toContain(
			'<td style="border: 1px solid currentColor; padding: 0.35em 0.6em; text-align: right;"><code>a|b</code> 与 A|B</td>',
		);
	});

	it('renders a table that follows ordinary text without requiring a blank line', () => {
		expect(toAnkiHtml('说明\n| 第一列 | 第二列 |\n| --- | --- |\n| A | B |')).toContain(
			'说明<table style="border-collapse: collapse; margin: 0.5em auto;">',
		);
	});
});
