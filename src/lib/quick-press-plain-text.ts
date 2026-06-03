/**
 * 早押し問題文: マークダウンを表示用1文字トークン列に変換（ストリーム配信用）。
 * parseMarkdownToHtml / markdownToPlainText と同じ露出ルールに合わせる。
 */

export type QuickPressCharToken = {
  char: string;
  bold: boolean;
};

function pushChars(
  tokens: QuickPressCharToken[],
  text: string,
  bold: boolean
): void {
  for (const char of Array.from(text)) {
    tokens.push({ char: char === '\n' ? ' ' : char, bold });
  }
}

/**
 * 問題文マークダウンを、強調フラグ付きの1文字トークン列にパースする。
 */
export function parseMarkdownToQuickPressTokens(
  markdown: string
): QuickPressCharToken[] {
  const tokens: QuickPressCharToken[] = [];
  let rest = markdown;

  while (rest.length > 0) {
    if (rest.startsWith('**')) {
      const match = rest.match(/^\*\*([\s\S]+?)\*\*/);
      if (match) {
        pushChars(tokens, match[1], true);
        rest = rest.slice(match[0].length);
        continue;
      }
    }

    if (rest.startsWith('*') && !rest.startsWith('**')) {
      const match = rest.match(/^\*([^*]+?)\*/);
      if (match) {
        pushChars(tokens, match[1], false);
        rest = rest.slice(match[0].length);
        continue;
      }
    }

    if (rest.startsWith('[')) {
      const match = rest.match(/^\[([^\]]*)\]\([^)]*\)/);
      if (match) {
        pushChars(tokens, match[1], false);
        rest = rest.slice(match[0].length);
        continue;
      }
    }

    if (rest[0] === '\n') {
      tokens.push({ char: ' ', bold: false });
      rest = rest.slice(1);
      continue;
    }

    pushChars(tokens, rest[0], false);
    rest = rest.slice(1);
  }

  return tokens;
}

/** NDJSON 1行（サーバー送信・クライアント受信） */
export function serializeQuickPressStreamToken(token: QuickPressCharToken): string {
  return `${JSON.stringify(token)}\n`;
}

export function parseQuickPressStreamLine(line: string): QuickPressCharToken | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as QuickPressCharToken;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.char !== 'string' ||
      typeof parsed.bold !== 'boolean' ||
      parsed.char.length === 0
    ) {
      return null;
    }
    return { char: parsed.char, bold: parsed.bold };
  } catch {
    return null;
  }
}
