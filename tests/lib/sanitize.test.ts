/**
 * @jest-environment jsdom
 */

import { parseMarkdownToHtml } from '@/lib/security/sanitize';

describe('parseMarkdownToHtml', () => {
  test('基本的なマークダウン記法（太字、斜体、改行）がパースされ無害化されること', () => {
    const markdown = 'こんにちは **太字** と *斜体* です。\n次の行です。';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<strong>太字</strong>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('こんにちは ');
    expect(html).toContain('<br>'); // DOMPurify によって <br> に正規化される
  });

  test('リンクが target="_blank" と rel="noopener noreferrer" 付きでパースされること', () => {
    const markdown = '[Google](https://google.com)';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<a href="https://google.com" target="_blank" rel="noopener noreferrer">Google</a>');
  });

  test('インラインコードが code タグにパースされること', () => {
    const markdown = 'これは `const x = 1` です。';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<code>const x = 1</code>');
  });

  test('コードブロックが pre と code タグにパースされること', () => {
    const markdown = '```typescript\nconst a = 1;\nconsole.log(a);\n```';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<pre><code class="language-typescript">const a = 1;\nconsole.log(a);</code></pre>');
  });

  test('コード内の改行文字やマークダウン類似記号がパース処理に干渉しないこと', () => {
    const markdown = '```\n*これは斜体ではない*\n**これは太字ではない**\n[リンク](url)\n```';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<pre><code>*これは斜体ではない*\n**これは太字ではない**\n[リンク](url)</code></pre>');
    expect(html).not.toContain('<em>');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<a href');
  });

  test('箇条書きリスト（- または *）が ul/li にパースされること', () => {
    const markdown = '- アイテム1\n- アイテム2\n* アイテム3';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<ul><li>アイテム1</li><li>アイテム2</li><li>アイテム3</li></ul>');
    expect(html).not.toContain('<ul><br>');
    expect(html).not.toContain('</li><br>');
  });

  test('番号付きリストが ol/li にパースされること', () => {
    const markdown = '1. 第一\n2. 第二\n3. 第三';
    const html = parseMarkdownToHtml(markdown);
    expect(html).toContain('<ol><li>第一</li><li>第二</li><li>第三</li></ol>');
  });

  test('リストの前後や間にある通常行の改行が適切に処理されること', () => {
    const markdown = '導入文\n- リスト1\n- リスト2\n結び文';
    const html = parseMarkdownToHtml(markdown);
    // ブロックレベル要素の前後には br は挿入されないのが正しい挙動
    expect(html).toBe('導入文<ul><li>リスト1</li><li>リスト2</li></ul>結び文');
  });

  test('不正な HTML タグや危険な URL スキーマが安全にエスケープまたはサニタイズされること', () => {
    const markdown = '危険なタグ <script>alert(1)</script> <iframe src="x"></iframe>\n[危険なリンク](javascript:alert(1))';
    const html = parseMarkdownToHtml(markdown);
    // <, > が &lt;, &gt; にエスケープされているため、プレーンテキストとして安全に表示され実行されない
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;iframe src="x"&gt;&lt;/iframe&gt;');
    // javascript: スキーマのリンクは href 自体がサニタイズされ除去される
    expect(html).not.toContain('href="javascript:');
  });
});
