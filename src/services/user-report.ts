/**
 * ユーザー通報サービス
 *
 * 機能:
 * 1. submitUserReport - ユーザー本人への直接通報を送信する（自己通報のクライアント側事前検証・冪等な重複防止）
 *
 * Boundary: user-report service
 * Requirements: 8.3, 8.5, 8.6
 */

import { createClient } from '../lib/supabase/client';
import { UserReportCategory } from '../types';

const supabase = createClient();

/**
 * 指定ユーザーを通報する。
 *
 * `reporterId === targetUid` の場合はRPCを呼び出さずクライアント側で即座にエラーを返す（自己通報防止, 8.5）。
 * 同一通報者による同一対象への未処理(open)通報が既に存在する場合、RPC側で冪等に無視される
 * （エラーにはならず、既存の通報状態が維持される, 8.6）。
 *
 * @param reporterId 通報者のUID（RPC側で `auth.uid()` から実際の通報者が導出されるため、
 *   実際の認可には使用されない。自己通報のクライアント側事前検証にのみ使用する）
 * @param targetUid 通報対象ユーザーのUID
 * @param category 通報カテゴリ
 * @param detail 通報理由の詳細
 */
export async function submitUserReport(
  reporterId: string,
  targetUid: string,
  category: UserReportCategory,
  detail: string
): Promise<void> {
  if (reporterId === targetUid) {
    throw new Error('自分自身を通報することはできません');
  }

  const { error } = await (supabase as any).rpc('handle_report_user', {
    p_target_uid: targetUid,
    p_category: category,
    p_detail: detail,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'self-report') {
      throw new Error('自分自身を通報することはできません');
    }
    if (error.message === 'invalid-category') {
      throw new Error('無効な通報カテゴリです');
    }
    if (error.message === 'detail-required') {
      throw new Error('通報理由を入力してください');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    throw new Error(`ユーザー通報の処理に失敗しました: ${error.message}`);
  }
}
