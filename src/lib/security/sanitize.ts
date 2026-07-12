/**
 * セキュリティ・サニタイズ ユーティリティ
 *
 * フロントエンドでユーザー入力テキスト（問題文・解説文のマークダウンなど）を
 * 安全にレンダリングするためのサニタイズ（無害化）処理を実装します。
 * XSS（クロスサイトスクリプティング）脆弱性および危険なURLスキーマの排除を目的とします。
 */

import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

// リンクのトークンからhref・title・表示テキストを取り出す共通処理
function extractLinkParts(this: any, hrefOrToken: any, title?: any, text?: any) {
  if (hrefOrToken && typeof hrefOrToken === 'object') {
    return {
      href: hrefOrToken.href || '',
      titleStr: hrefOrToken.title || '',
      linkText: (this && this.parser && hrefOrToken.tokens)
        ? this.parser.parseInline(hrefOrToken.tokens)
        : (hrefOrToken.text || ''),
    };
  }
  return { href: hrefOrToken || '', titleStr: title || '', linkText: text || '' };
}

// コードブロックの末尾の不要な改行を取り除く（レンダラー共通）
function renderCode(codeOrToken: any, infostring?: any) {
  let code = '';
  let lang = '';

  if (codeOrToken && typeof codeOrToken === 'object') {
    code = codeOrToken.text || '';
    lang = codeOrToken.lang || '';
  } else {
    code = codeOrToken || '';
    lang = infostring || '';
  }

  const langClass = lang ? ` class="language-${lang}"` : '';
  const trimmedCode = code.replace(/\n$/, '');
  return `<pre><code${langClass}>${trimmedCode}</code></pre>`;
}

// 通常のレンダラー: リンクに target="_blank" と rel="noopener noreferrer" を自動付与
const renderer = new marked.Renderer();
renderer.link = function (this: any, hrefOrToken: any, title?: any, text?: any) {
  const { href, titleStr, linkText } = extractLinkParts.call(this, hrefOrToken, title, text);
  return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleStr ? ` title="${titleStr}"` : ''}>${linkText}</a>`;
};
renderer.code = renderCode;

marked.use({ renderer });

// URL埋め込みを禁止するレンダラー: リンク記法・ベアURLをすべてプレーンテキスト化する
const noLinkRenderer = new marked.Renderer();
noLinkRenderer.link = function (this: any, hrefOrToken: any, title?: any, text?: any) {
  const { linkText } = extractLinkParts.call(this, hrefOrToken, title, text);
  return linkText;
};
noLinkRenderer.code = renderCode;

// marked のデフォルト設定を適用
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * HTML文字列をDOMPurifyを使用して強力にサニタイズ（無害化）する。
 * - 許可されない危険なHTMLタグ（<script>, <iframe> 等）を完全に除去。
 * - `javascript:` 等の悪意あるURLスキーマを href 属性から自動排除。
 *
 * @param html サニタイズ対象の生HTML文字列
 * @returns 無害化された安全なHTML文字列
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    // 許可する安全なタグ一覧
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'hr', 'span', 'div'
    ],
    // 許可する安全な属性一覧
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
    // 許可するURLパターン（javascript: などのスキーマを強力に排除）
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^&:\/?#]*(?:[\/?#]|$))/i,
  });
}

/**
 * マークダウンを安全なHTMLにパースして無害化する。
 * - 見出し、太字、斜体、リスト、リンク、コードブロック、表などの完全なマークダウンに対応。
 *
 * @param markdown ユーザーが入力した問題文・解説文等のマークダウン文字列
 * @param options.disableLinks trueの場合、リンク記法・ベアURLをリンク化せずプレーンテキストとして表示する（作問の問題文でのURL埋め込み廃止用）
 * @returns サニタイズ済みの安全なHTML文字列
 */
export function parseMarkdownToHtml(markdown: string, options?: { disableLinks?: boolean }): string {
  if (!markdown) return '';

  // 1. マークダウン箇条書き記号の正規化と、リストの自動クローズ処理
  const lines = markdown.split(/\r?\n/);
  const processedLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 行頭の引用記号（例: `>`, `>>`, ` >` 等）を一時的にプレースホルダーに置換してエスケープから保護
    let blockquotePrefix = '';
    const bqMatch = line.match(/^(\s*(?:>\s*)+)/);
    if (bqMatch) {
      blockquotePrefix = bqMatch[1];
      line = line.slice(blockquotePrefix.length);
    }

    // 行頭の * 箇条書きを - に正規化 (例: '* アイテム' -> '- アイテム')
    line = line.replace(/^(\s*)\*\s+/, '$1- ');

    if (blockquotePrefix) {
      const protectedPrefix = blockquotePrefix.replace(/>/g, '__BQ_TEMP_MARKER__');
      processedLines.push(protectedPrefix + line);
    } else {
      processedLines.push(line);
    }
    
    if (i < lines.length - 1) {
      const currentLine = line.trim();
      const nextLineRaw = lines[i + 1];

      // 次の行の引用プレフィックスを解析
      let nextBqPrefix = '';
      let nextLine = nextLineRaw;
      const nextBqMatch = nextLineRaw.match(/^(\s*(?:>\s*)+)/);
      if (nextBqMatch) {
        nextBqPrefix = nextBqMatch[1];
        nextLine = nextLineRaw.slice(nextBqPrefix.length);
      }

      const isCurrentList = /^([-]|\d+\.)\s+/.test(currentLine);
      const isNextList = /^([*-]|\d+\.)\s+/.test(nextLine.trim());
      if (isCurrentList && !isNextList && nextLine.trim() !== '') {
        // 次の行と同じ引用レベルを維持した空行を挿入してリストを確実に閉じる
        const protectedNextBqPrefix = nextBqPrefix.replace(/>/g, '__BQ_TEMP_MARKER__');
        processedLines.push(protectedNextBqPrefix);
      }
    }
  }
  const normalizedMarkdown = processedLines.join('\n');

  // 2. 特殊文字（&, <, >）のエスケープ（生HTMLインジェクション防止ポリシーの維持）
  let escaped = normalizedMarkdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 退避していた引用記号を元に戻す
  escaped = escaped.replace(/__BQ_TEMP_MARKER__/g, '>');

  try {
    // 3. marked によるマークダウンパース
    let parsedHtml = marked.parse(escaped, {
      async: false,
      renderer: options?.disableLinks ? noLinkRenderer : renderer,
    }) as string;
    
    // 4. タグ末尾の余分な改行文字の整理
    parsedHtml = parsedHtml
      .replace(/<\/pre>\n/g, '</pre>')
      .replace(/<\/ul>\n/g, '</ul>')
      .replace(/<\/ol>\n/g, '</ol>')
      .replace(/<\/p>\n/g, '</p>')
      .replace(/<\/li>\n/g, '</li>');

    // 5. サニタイズ
    return sanitizeHtml(parsedHtml);
  } catch (error) {
    console.error('[parseMarkdownToHtml] Failed to parse markdown:', error);
    return sanitizeHtml(escaped);
  }
}
