/**
 * セキュリティ・サニタイズ ユーティリティ
 *
 * フロントエンドでユーザー入力テキスト（クイズ解説文のマークダウンなど）を
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
 * @param markdown ユーザーが入力した解説文等のマークダウン文字列
 * @returns サニタイズ済みの安全なHTML文字列
 */
export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // 1. 特殊文字（<, >）のエスケープ（基本的なHTMLインジェクションの無害化）
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. 簡易マークダウンパース（正規表現による置換）
  html = html
    // 太字: **bold** -> <strong>bold</strong>
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 斜体: *italic* -> <em>italic</em>
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // リンク: [label](url) -> <a href="url" target="_blank" rel="noopener noreferrer">label</a>
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // 改行: \n -> <br />
    .replace(/\n/g, '<br />');

  // 3. 最後に DOMPurify で強力にサニタイズ（悪意あるタグや javascript: リンクを完全に無害化）
  return sanitizeHtml(html);
}
