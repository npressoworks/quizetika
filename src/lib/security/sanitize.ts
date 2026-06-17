/**
 * セキュリティ・サニタイズ ユーティリティ
 *
 * フロントエンドでユーザー入力テキスト（問題文・解説文のマークダウンなど）を
 * 安全にレンダリングするためのサニタイズ（無害化）処理を実装します。
 * XSS（クロスサイトスクリプティング）脆弱性および危険なURLスキーマの排除を目的とします。
 */

import DOMPurify from 'isomorphic-dompurify';

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
 * 簡易マークダウンのプレーンテキストを安全なHTMLにパースして無害化する。
 * - 太字 (`**text**` -> `<strong>text</strong>`)
 * - 斜体 (`*text*` -> `<em>text</em>`)
 * - 外部リンク (`[text](url)` -> `<a href="url" ...>text</a>`)
 * - 改行 (`\n` -> `<br />`)
 *
 * @param markdown ユーザーが入力した問題文・解説文等のマークダウン文字列
 * @returns サニタイズ済みの安全なHTML文字列
 */
export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. 特殊文字（&, <, >）のエスケープ
  let escaped = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. コードブロックの保護
  const codeBlocks: string[] = [];
  escaped = escaped.replace(/```(\w*)\r?\n([\s\S]*?)\r?\n```/g, (match, lang, code) => {
    const index = codeBlocks.length;
    const langClass = lang ? ` class="language-${lang}"` : '';
    codeBlocks.push(`<pre><code${langClass}>${code}</code></pre>`);
    return `__CODE_BLOCK_${index}__`;
  });

  // 3. インラインコードの保護
  const inlineCodes: string[] = [];
  escaped = escaped.replace(/`(.*?)`/g, (match, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${code}</code>`);
    return `__INLINE_CODE_${index}__`;
  });

  // 4. 標準マークダウンパース（太字、斜体、リンク）
  let html = escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 5. リストのパース（行ごとの処理）
  const lines = html.split(/\r?\n/);
  let inUl = false;
  let inOl = false;
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^([*-])\s+(.*)/);
    const olMatch = line.match(/^(\d+)\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) {
        processedLines.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        processedLines.push('<ul>');
        inUl = true;
      }
      processedLines.push(`<li>${ulMatch[2]}</li>`);
    } else if (olMatch) {
      if (inUl) {
        processedLines.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        processedLines.push('<ol>');
        inOl = true;
      }
      processedLines.push(`<li>${olMatch[2]}</li>`);
    } else {
      if (inUl) {
        processedLines.push('</ul>');
        inUl = false;
      }
      if (inOl) {
        processedLines.push('</ol>');
        inOl = false;
      }
      processedLines.push(line);
    }
  }

  if (inUl) processedLines.push('</ul>');
  if (inOl) processedLines.push('</ol>');

  // 6. 改行（<br />）の適切な挿入と結合
  let resultHtml = '';
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const isListTag = /<\/?(ul|ol|li)>/.test(line);
    
    resultHtml += line;
    if (i < processedLines.length - 1) {
      const nextLine = processedLines[i + 1];
      const currentIsBlock = isListTag || line.startsWith('__CODE_BLOCK_');
      const nextIsBlock = /<\/?(ul|ol)>/.test(nextLine) || nextLine.startsWith('__CODE_BLOCK_');

      if (!currentIsBlock && !nextIsBlock && line !== '') {
        resultHtml += '<br />';
      }
    }
  }

  // 7. プレースホルダーの書き戻し
  inlineCodes.forEach((codeHtml, idx) => {
    resultHtml = resultHtml.replace(`__INLINE_CODE_${idx}__`, codeHtml);
  });
  codeBlocks.forEach((codeHtml, idx) => {
    resultHtml = resultHtml.replace(`__CODE_BLOCK_${idx}__`, codeHtml);
  });

  // 8. サニタイズ
  return sanitizeHtml(resultHtml);
}
