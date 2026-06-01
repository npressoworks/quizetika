/**
 * プレイ画面で quick-press 設問の questionText が Base64 難読化されている場合に復号する。
 */
export function decodeStoredQuestionText(
  questionText: string,
  type?: string
): string {
  if (type !== 'quick-press') {
    return questionText;
  }
  try {
    return decodeURIComponent(escape(atob(questionText)));
  } catch {
    return questionText;
  }
}
