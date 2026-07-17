import { createClient } from '../lib/supabase/client';

const supabase = createClient();

export type MergeTargetType = 'tag' | 'genre';
export type AdminDecision = 'approve' | 'reject';

/**
 * 管理者による新規マージの即時実行。戻り値は監査用 merge_requests の id
 */
export async function adminExecuteMerge(
  sourceId: string,
  targetId: string,
  targetType: MergeTargetType,
  reason: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('handle_admin_execute_merge', {
    p_target_type: targetType,
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'forbidden') {
      throw new Error('管理者権限がありません。');
    }
    if (error.message === 'same-id') {
      throw new Error('同一のタグ/ジャンルをマージすることはできません。');
    }
    if (error.message === 'circular-merge') {
      throw new Error('循環マージが発生するため、このマージは実行できません。');
    }
    if (error.code === '23505') {
      throw new Error('既に同じマージ提案が進行中です。');
    }
    throw new Error(`マージの即時実行に失敗しました: ${error.message}`);
  }

  return data as string;
}

/**
 * 保留中マージ提案の承認（即時実行）/却下
 */
export async function adminResolveMergeRequest(
  requestId: string,
  decision: AdminDecision
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_admin_resolve_merge_request', {
    p_request_id: requestId,
    p_decision: decision,
  });

  if (error) {
    if (error.message === 'forbidden') {
      throw new Error('管理者権限がありません。');
    }
    if (error.message === 'request-not-found') {
      throw new Error('マージ提案が見つかりません。');
    }
    if (error.message === 'already-resolved') {
      throw new Error('この提案は既に処理済みです。');
    }
    throw new Error(`マージ提案の処理に失敗しました: ${error.message}`);
  }
}

/**
 * 保留中ジャンル申請の承認（即時登録）/却下
 */
export async function adminResolveGenreRequest(
  requestId: string,
  decision: AdminDecision
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_admin_resolve_genre_request', {
    p_request_id: requestId,
    p_decision: decision,
  });

  if (error) {
    if (error.message === 'forbidden') {
      throw new Error('管理者権限がありません。');
    }
    if (error.message === 'request-not-found') {
      throw new Error('ジャンル申請が見つかりません。');
    }
    if (error.message === 'already-resolved') {
      throw new Error('この申請は既に処理済みです。');
    }
    if (error.code === '23505') {
      throw new Error('指定されたジャンルIDはすでに存在します。');
    }
    throw new Error(`ジャンル申請の処理に失敗しました: ${error.message}`);
  }
}
