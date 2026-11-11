// Mikkadr Hub P4 S1: the plan reader escapes first, then builds only headings, lists, code, bold and tables.
import assert from 'node:assert/strict';
import {renderMarkdown,escapeHtml} from '../hub/markdown.js';

assert.equal(escapeHtml('<a href="x">&\'</a>'),'&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
assert.equal(renderMarkdown('# Title'),'<h1>Title</h1>');assert.equal(renderMarkdown('### Deep ###'),'<h3>Deep</h3>');
assert.equal(renderMarkdown('one\ntwo\n\nthree'),'<p>one<br>two</p>\n<p>three</p>');
assert.equal(renderMarkdown('- a\n- **b**\n* c'),'<ul><li>a</li><li><strong>b</strong></li><li>c</li></ul>');
assert.equal(renderMarkdown('1. x\n2) y'),'<ol><li>x</li><li>y</li></ol>');
assert.equal(renderMarkdown('use `npm test` now'),'<p>use <code>npm test</code> now</p>');
assert.equal(renderMarkdown('```js\nif (a < b) {}\n```'),'<pre><code>if (a &lt; b) {}</code></pre>');
assert.equal(renderMarkdown('```\nunclosed <b>'),'<pre><code>unclosed &lt;b&gt;</code></pre>','an unclosed fence runs to the end');
assert.equal(renderMarkdown('| A | B |\n|---|:-:|\n| 1 | **2** |'),'<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td><strong>2</strong></td></tr></tbody></table>');
// nothing a plan writes becomes markup
for(const evil of ['<script>alert(1)</script>','<img src=x onerror=alert(1)>','[click](javascript:alert(1))','# <b>h</b>','- <i>x</i>','| <u> |\n|--|\n| <s> |','`<x>`','**<y>**']){
 const html=renderMarkdown(evil);assert.ok(!/<(script|img|b|i|u|s|x|y)[ >]/.test(html.replace(/<\/?(strong|code|h1|ul|li|table|thead|tbody|tr|th|td|p)>/g,'')),`escaped: ${evil}`);assert.ok(!html.includes('<a '),'no links are built')}
assert.equal(renderMarkdown(''),'');assert.equal(renderMarkdown(null),'');
assert.equal(renderMarkdown('a\r\nb'),'<p>a<br>b</p>','CRLF');
console.log('hub-markdown ok');
