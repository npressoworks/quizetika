/**
 * 早押しタイプライター用: マークダウン記法を画面に露出せず、
 * 表示上の文字数に合わせて部分レンダリングする。
 */

function stripResidualMarkdownSyntax(text: string): string {
  return text.replace(/\*+/g, '').replace(/\[|\]|\(|\)/g, '');
}

/** parseMarkdownToHtml と同じ規則で得られる表示上の平文 */
export function markdownToPlainText(markdown: string): string {
  if (!markdown) return '';
  const closed = closePartialMarkdownForDisplay(markdown);
  const plain = closed
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\((.+?)\)/g, '$1')
    .replace(/\n/g, ' ');
  return stripResidualMarkdownSyntax(plain);
}

/** 末尾の未完了記法を閉じるか除去し、記号を露出させない */
export function closePartialMarkdownForDisplay(partial: string): string {
  if (!partial) return '';

  let s = partial;

  if (/\[[^\]]*\]\([^)]*$/.test(s)) {
    s = s.replace(/\[[^\]]*\]\([^)]*$/, '');
  } else if (/\[[^\]]*$/.test(s)) {
    s = s.replace(/\[(.*?)$/, '$1');
  }

  const boldMarkers = (s.match(/\*\*/g) || []).length;
  if (boldMarkers % 2 === 1) {
    s += '**';
  }

  if (s.endsWith('*') && !s.endsWith('**')) {
    s = s.slice(0, -1);
  }

  if (/^\*+$/.test(s.trim())) {
    return '';
  }

  return s;
}

/**
 * 表示上 visibleLength 文字分に相当する最短のマークダウン接頭辞を返す。
 */
export function getMarkdownPrefixForPlainVisibleLength(
  markdown: string,
  visibleLength: number
): string {
  if (visibleLength <= 0) return '';

  const fullPlain = markdownToPlainText(markdown);
  if (visibleLength >= fullPlain.length) {
    return markdown;
  }

  for (let end = 1; end <= markdown.length; end++) {
    const prefix = markdown.slice(0, end);
    const plainLen = markdownToPlainText(
      closePartialMarkdownForDisplay(prefix)
    ).length;
    if (plainLen >= visibleLength) {
      return prefix;
    }
  }

  return markdown;
}

/** 早押し表示用マークダウン（「問題：」+ 本文の部分表示） */
export function buildQuickPressDisplayMarkdown(
  label: string,
  bodyMarkdown: string,
  bodyVisibleLength: number
): string {
  const prefix = getMarkdownPrefixForPlainVisibleLength(
    bodyMarkdown,
    bodyVisibleLength
  );
  const bodyClosed = closePartialMarkdownForDisplay(prefix);
  if (!bodyClosed) {
    return label;
  }
  return label + bodyClosed;
}
