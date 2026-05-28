/**
 * モデレーションおよびメタデータ自治ガバナンスのユーティリティ（純粋関数群）
 *
 * Boundary: ModerationService (Task 2.8)
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { User } from '../types';

/* ==========================================================================
   通報閾値チェック
   ========================================================================== */

/** コンテンツを自動保留（非公開化）する通報回数の閾値 */
export const SUSPEND_FLAG_THRESHOLD = 5;

/**
 * 通報回数が自動保留閾値（5回）に達しているか判定する
 * @param flagsCount 現在の通報累計数
 * @returns 閾値に達している場合 true
 */
export function isSuspendThresholdReached(flagsCount: number): boolean {
  return flagsCount >= SUSPEND_FLAG_THRESHOLD;
}

/* ==========================================================================
   重み付き投票
   ========================================================================== */

/**
 * モデレーションティアに応じた投票重みを返す
 * - Senior Moderator: 重み 2
 * - それ以外: 重み 1
 *
 * @param moderationTier ユーザーのモデレーションティア
 * @returns 投票重み（1 または 2）
 */
export function calculateMergeVoteWeight(
  moderationTier: User['moderationTier']
): number {
  return moderationTier === 'senior_moderator' ? 2 : 1;
}

/* ==========================================================================
   ジャンル申請可決判定
   ========================================================================== */

/** ジャンル申請の可決に必要な最小承認重み */
export const GENRE_MIN_APPROVE_WEIGHT = 5;

/** ジャンル申請の可決に必要な最小承認率 */
export const GENRE_MIN_APPROVE_RATE = 0.8;

/**
 * ジャンル申請が可決条件を満たしているか判定する
 *
 * 可決条件:
 * - 承認重み合計 >= 5
 * - 承認率（承認重み / 総重み） >= 80%
 *
 * @param approvedWeight 承認票の重み合計
 * @param totalWeight 全投票の重み合計
 * @returns 可決の場合 true
 */
export function isGenreRequestApproved(
  approvedWeight: number,
  totalWeight: number
): boolean {
  if (totalWeight === 0) return false;
  if (approvedWeight < GENRE_MIN_APPROVE_WEIGHT) return false;
  return approvedWeight / totalWeight >= GENRE_MIN_APPROVE_RATE;
}
