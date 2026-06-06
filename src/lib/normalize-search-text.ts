const KATAKANA_TO_HIRAGANA_OFFSET = 0x60;

/** 検索用: NFKC・小文字化・カタカナ→ひらがな */
export function normalizeSearchText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - KATAKANA_TO_HIRAGANA_OFFSET)
    );
}

export function searchTextIncludes(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return true;
  return normalizeSearchText(haystack).includes(normalizedNeedle);
}

export function searchTextStartsWith(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) return true;
  return normalizeSearchText(haystack).startsWith(normalizedNeedle);
}

export function searchTextEquals(a: string, b: string): boolean {
  return normalizeSearchText(a) === normalizeSearchText(b);
}
