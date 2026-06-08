/**
 * 良問評価・指摘フィードバックのユーティリティ（純粋関数群）
 *
 * Boundary: ReviewService (Task 2.7)
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

/* ==========================================================================
   良問スコア計算
   ========================================================================== */

/**
 * 👍/👎 投票数から良問スコア（良問率）を計算する
 * @param positiveCount 👍の数
 * @param negativeCount 👎の数
 * @returns 0.0〜1.0 のスコア、投票なしの場合は null
 */
export function calculateReviewScore(
  positiveCount: number,
  negativeCount: number
): number | null {
  const total = positiveCount + negativeCount;
  if (total === 0) return null;
  return positiveCount / total;
}

/**
 * 良問スコアに応じた評価バッジ名を返す
 * @param score 良問スコア（null の場合はバッジなし）
 * @returns バッジ名文字列、またはnull
 */
export function getReviewBadge(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 1.0) return '殿堂入り';
  if (score >= 0.8) return '良問';
  if (score >= 0.6) return '普通';
  if (score >= 0.4) return '要改善';
  return '悪問';
}

/**
 * 良問率を 0〜100 のパーセント値に正規化する。
 * 0.0〜1.0 の比率と 0〜100 のパーセント値の両方に後方互換で対応する。
 */
export function normalizeReviewScoreToPercent(
  score: number | null | undefined
): number | null {
  if (score === null || score === undefined) return null;
  return score <= 1 ? score * 100 : score;
}

/**
 * 良問率をパーセント表示用文字列に整形する
 */
export function formatReviewScorePercent(
  score: number | null | undefined
): string | null {
  const percent = normalizeReviewScoreToPercent(score);
  if (percent === null) return null;
  return `${Math.round(percent)}%`;
}

/* ==========================================================================
   投票権チェック
   ========================================================================== */

/**
 * 投票者がクイズの作成者でないか確認する（作成者除外）
 * @param voterUid 投票者のUID
 * @param authorUid クイズ作成者のUID
 * @returns 投票可能な場合 true
 */
export function canVote(voterUid: string, authorUid: string): boolean {
  return voterUid !== authorUid;
}
