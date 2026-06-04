import {
  doc,
  getDoc,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { usersRef } from '../lib/firebase/firestore';
import { User, ReputationEventLog } from '../types';

/**
 * 権限ティアーの定数定義
 */
export type ModerationTier = 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator';

/**
 * 信頼スコア加算制限の型定義
 */
export interface ReputationLimit {
  id: string; // senderId
  totalDelta: number; // 加算累計値（上限5）
}

/**
 * 信頼スコアからモデレータ資格（ティアー）を自動解決する
 *
 * - Newcomer: 0 〜 49
 * - Contributor: 50 〜 149
 * - Moderator: 150 〜 499
 * - Senior Moderator: 500 以上
 */
export function resolveModerationTier(reputationScore: number): ModerationTier {
  if (reputationScore >= 500) return 'senior_moderator';
  if (reputationScore >= 150) return 'moderator';
  if (reputationScore >= 50) return 'contributor';
  return 'newcomer';
}

/**
 * 指定ユーザーの信頼スコア、モデレータティアー、および履歴ログを取得する
 *
 * @param uid ユーザーID
 */
export async function getReputationScore(
  uid: string
): Promise<{ reputationScore: number; moderationTier: ModerationTier; reputationHistory: ReputationEventLog[] }> {
  const userDocRef = doc(usersRef, uid);
  const snap = await getDoc(userDocRef);

  if (!snap.exists()) {
    return {
      reputationScore: 0,
      moderationTier: 'newcomer',
      reputationHistory: [],
    };
  }

  const userData = snap.data() as User;
  return {
    reputationScore: userData.reputationScore ?? 0,
    moderationTier: (userData.moderationTier as ModerationTier) ?? 'newcomer',
    reputationHistory: userData.reputationHistory ?? [],
  };
}

/**
 * 指定ユーザーがモデレータ資格（moderationTier >= 'moderator'）を持っているか検証する
 *
 * @param uid ユーザーID
 */
export async function checkModeratorEligibility(uid: string): Promise<boolean> {
  const { moderationTier } = await getReputationScore(uid);
  return moderationTier === 'moderator' || moderationTier === 'senior_moderator';
}

/**
 * 特定の評価者（senderId）からクリエイター（authorId）への累計スコア加算上限（最大 +5 pt）を確認・取得する。
 * アトミックなトランザクション内でサブコレクション users/{uid}/reputationLimits/{senderId} を参照する。
 *
 * @param authorId クリエイター（作家）のUID
 * @param senderId 評価者のUID
 * @returns 累計加算ポイント totalDelta
 */
export async function getReputationLimit(
  authorId: string,
  senderId: string
): Promise<{ totalDelta: number }> {
  const limitDocRef = doc(db, 'users', authorId, 'reputationLimits', senderId);
  const snap = await getDoc(limitDocRef);

  if (!snap.exists()) {
    return { totalDelta: 0 };
  }

  const limitData = snap.data() as ReputationLimit;
  return {
    totalDelta: limitData.totalDelta ?? 0,
  };
}

/**
 * 指定ユーザーの信頼スコアとティアーを手動で強制リセットし、監査ログに保存する
 *
 * @param targetUid リセット対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID
 * @param reason リセット理由（10文字以上）
 */
export async function resetUserReputation(
  targetUid: string,
  executorId: string,
  reason: string
): Promise<void> {
  // リセット理由は10文字以上で入力してください。
  if (reason.length < 10) {
    throw new Error('リセット理由は10文字以上で入力してください。');
  }

  await runTransaction(db, async (transaction) => {
    // 実行者の権限確認
    const executorRef = doc(usersRef, executorId);
    const executorSnap = await transaction.get(executorRef);

    if (!executorSnap.exists() || (executorSnap.data()?.moderationTier as string) !== 'admin') {
      throw new Error('この操作を実行する権限がありません');
    }

    // 対象ユーザーの存在確認
    const targetUserRef = doc(usersRef, targetUid);
    const targetUserSnap = await transaction.get(targetUserRef);

    if (!targetUserSnap.exists()) {
      throw new Error('対象のユーザーが見つかりません');
    }

    // スコアとティアーのリセット
    transaction.update(targetUserRef, {
      reputationScore: 0,
      moderationTier: 'newcomer',
      updatedAt: serverTimestamp(),
    });

    // 監査ログの記録
    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      targetUid,
      executorId,
      action: 'reputation_reset',
      reason,
      createdAt: serverTimestamp(),
    });
  });
}

