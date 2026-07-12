import { createClient } from '../lib/supabase/client';
import { ReportedUserSummary, BannedUserSummary, AdminLogEntry } from '../types';
import type { ModerationTier, BannedUserFilters } from './reputation';

export type {
  GetReportedUsersRankingResult,
  BannedUserFilters,
  GetBannedUsersResult,
} from './reputation';

const supabase = createClient();

/**
 * 通報数上位ユーザー一覧を、`get_reported_users_ranking` RPC経由で取得する。
 *
 * `page` は 1 始まりのページ番号として扱い、`offset = (page - 1) * pageSize` に変換する。
 * `hasMore` の判定には「余分に1件多く取得する」方式を用いる: RPCへは `p_limit = pageSize + 1` を渡し、
 * 返却件数が `pageSize` を超えていれば `hasMore = true` とし、超過分の1件を除いて返す
 * （RPCが総件数を返さないため）。
 *
 * @param page ページ番号（1始まり）
 * @param pageSize 1ページあたりの表示件数
 */
export async function getReportedUsersRanking(
  page: number,
  pageSize: number
): Promise<{ items: ReportedUserSummary[]; hasMore: boolean }> {
  const offset = (page - 1) * pageSize;
  const limit = pageSize + 1;

  const { data, error } = await (supabase as any).rpc('get_reported_users_ranking', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    throw new Error(`通報数上位ユーザー一覧の取得に失敗しました: ${error.message}`);
  }

  const rows: any[] = data ?? [];
  const hasMore = rows.length > pageSize;
  const trimmedRows = hasMore ? rows.slice(0, pageSize) : rows;

  const items: ReportedUserSummary[] = trimmedRows.map((row) => ({
    uid: row.uid,
    displayName: row.display_name,
    moderationTier: row.moderation_tier as ModerationTier,
    isBanned: row.is_banned,
    totalReportCount: row.total_report_count,
    latestReportAt: row.latest_report_at,
  }));

  return { items, hasMore };
}

/**
 * BAN済みユーザー一覧を、`get_banned_users` RPC経由で取得する（日時範囲・キーワード絞り込み対応）。
 *
 * `page` は 1 始まりのページ番号として扱い、`offset = (page - 1) * pageSize` に変換する。
 * `hasMore` の判定には「余分に1件多く取得する」方式を用いる: RPCへは `p_limit = pageSize + 1` を渡し、
 * 返却件数が `pageSize` を超えていれば `hasMore = true` とし、超過分の1件を除いて返す
 * （`getReportedUsersRanking` と同じパターン）。
 *
 * @param filters 日時範囲・キーワード・ページングの絞り込み条件
 */
export async function getBannedUsers(
  filters: BannedUserFilters
): Promise<{ items: BannedUserSummary[]; hasMore: boolean }> {
  const { bannedFrom, bannedTo, keyword, page, pageSize } = filters;
  const offset = (page - 1) * pageSize;
  const limit = pageSize + 1;

  const { data, error } = await (supabase as any).rpc('get_banned_users', {
    p_limit: limit,
    p_offset: offset,
    p_banned_from: bannedFrom ?? null,
    p_banned_to: bannedTo ?? null,
    p_keyword: keyword ?? null,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    throw new Error(`BAN済みユーザー一覧の取得に失敗しました: ${error.message}`);
  }

  const rows: any[] = data ?? [];
  const hasMore = rows.length > pageSize;
  const trimmedRows = hasMore ? rows.slice(0, pageSize) : rows;

  const items: BannedUserSummary[] = trimmedRows.map((row) => ({
    uid: row.uid,
    displayName: row.display_name,
    bannedReason: row.banned_reason,
    bannedAt: row.banned_at,
    bannedByExecutorId: row.banned_by_executor_id,
  }));

  return { items, hasMore };
}

/**
 * 指定ユーザーに関する監査ログ（`admin_logs`）の履歴一覧を、
 * `get_user_admin_logs` RPC経由で取得する（`created_at` 降順、RPC側で整列済み）。
 *
 * @param targetUid 対象ユーザーのUID
 */
export async function getUserAdminLogs(targetUid: string): Promise<AdminLogEntry[]> {
  const { data, error } = await (supabase as any).rpc('get_user_admin_logs', {
    p_target_uid: targetUid,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    throw new Error(`監査ログ履歴の取得に失敗しました: ${error.message}`);
  }

  const rows: any[] = data ?? [];

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    executorId: row.executor_id,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

/**
 * 指定ユーザーのアカウント停止を解除（UNBAN）し、監査ログに保存する
 *
 * @param targetUid 対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 */
export async function unbanUser(targetUid: string, executorId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_unban_user', {
    p_target_uid: targetUid,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    throw new Error(`UNBAN処理に失敗しました: ${error.message}`);
  }
}
