/**
 * SNS共有URL生成用の純粋関数群。
 *
 * `src/app/quiz/[id]/success/success-client.tsx`（投稿完了画面）の既存共有実装
 * （X投稿作成インテント・LINE共有インテント）と同一のURL組み立て規則に従う。
 * フレームワーク非依存・副作用なし（DOM操作・ネットワークI/Oを行わない）。
 */

/**
 * X（旧Twitter）の投稿作成インテントURLを組み立てる。
 *
 * @param quizTitle - 共有対象クイズのタイトル（空文字を許容する）
 * @param shareUrl - 共有対象の絶対URL（クイズ詳細画面自身のURL）
 * @returns `encodeURIComponent` でエンコードされた投稿文・URLを含むX投稿作成インテントの絶対URL
 */
export function buildTwitterShareUrl(quizTitle: string, shareUrl: string): string {
  const text = `【クイズ公開！】「${quizTitle}」を公開しました！あなたは何問解ける？挑戦を待っています！\n#quizetika #クイズ\n`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
}

/**
 * LINEの共有インテントURLを組み立てる。
 *
 * @param shareUrl - 共有対象の絶対URL（クイズ詳細画面自身のURL）
 * @returns `encodeURIComponent` でエンコードされたURLを含むLINE共有インテントの絶対URL
 */
export function buildLineShareUrl(shareUrl: string): string {
  return `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;
}
