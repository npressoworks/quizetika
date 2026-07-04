/**
 * モデレーションおよびメタデータ自治ガバナンスサービス
 *
 * 機能:
 * 1. flagContent      - コンテンツ通報とアトミックカウント更新・自動保留
 * 2. resolveFlag      - 管理者審査（公開復帰 / 永久削除）
 * マージ・ジャンル新設は TagMergeService (`tagMerge.ts`) に集約。
 *
 * Boundary: ModerationService
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { createClient } from '../lib/supabase/client';

const supabase = createClient();

/**
 * クイズを通報し、通報累計数をアトミックにインクリメントする。
 * 同一報告者による同一クイズへの重複通報は、DB側の一意制約により冪等に無視される。
 * 5回に達した場合は自動的に status を 'suspended' に変更する。
 *
 * @param quizId 通報対象のクイズID
 * @param reporterId 通報者のUID（RPC側で `auth.uid()` から導出されるため実際の認可には使用されない）
 * @param reason 通報理由
 */
export async function flagContent(
  quizId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_flag_content', {
    p_quiz_id: quizId,
    p_reason: reason,
  });

  if (error) {
    throw new Error(`コンテンツ通報の処理に失敗しました: ${error.message}`);
  }
}

/**
 * 管理者による審査結果を反映する
 * @param quizId 審査対象のクイズID
 * @param action 'restore'（公開復帰） | 'delete'（永久削除）
 * @param executorId 審査を実行するユーザーのUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 */
export async function resolveFlag(
  quizId: string,
  action: 'restore' | 'delete',
  executorId: string
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_resolve_flag', {
    p_quiz_id: quizId,
    p_action: action,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません (CISOセキュリティ制限)');
    }
    throw new Error(`コンテンツ審査の処理に失敗しました: ${error.message}`);
  }
}
