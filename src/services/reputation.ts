import { createClient } from '../lib/supabase/server';
import { ReputationEventLog, ReportedUserSummary, BannedUserSummary, AdminLogEntry } from '../types';

/**
 * 権限ティアーの定数定義
 */
export type ModerationTier = 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator';

/**
 * 信頼スコア加算制限の型定義
 */
export interface ReputationLimit {
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('reputation_score, moderation_tier, reputation_history')
    .eq('id', uid)
    .maybeSingle();

  if (error || !data) {
    return {
      reputationScore: 0,
      moderationTier: 'newcomer',
      reputationHistory: [],
    };
  }

  return {
    reputationScore: data.reputation_score ?? 0,
    moderationTier: (data.moderation_tier as ModerationTier) ?? 'newcomer',
    reputationHistory: (data.reputation_history as unknown as ReputationEventLog[]) ?? [],
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
 *
 * @param authorId クリエイター（作家）のUID
 * @param senderId 評価者のUID
 * @returns 累計加算ポイント totalDelta
 */
export async function getReputationLimit(
  authorId: string,
  senderId: string
): Promise<ReputationLimit> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reputation_limits')
    .select('total_delta')
    .eq('author_id', authorId)
    .eq('sender_id', senderId)
    .maybeSingle();

  if (error || !data) {
    return { totalDelta: 0 };
  }

  return { totalDelta: data.total_delta ?? 0 };
}

/**
 * 指定ユーザーの信頼スコアとティアーを手動で強制リセットし、監査ログに保存する
 *
 * @param targetUid リセット対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 * @param reason リセット理由（10文字以上）
 */
export async function resetUserReputation(
  targetUid: string,
  executorId: string,
  reason: string
): Promise<void> {
  if (reason.length < 10) {
    throw new Error('リセット理由は10文字以上で入力してください。');
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('handle_reset_user_reputation', {
    p_target_uid: targetUid,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    throw new Error(`信頼スコアのリセットに失敗しました: ${error.message}`);
  }
}

/**
 * 指定ユーザーのアカウントを停止（BAN）し、監査ログに保存する
 *
 * @param targetUid 対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 * @param reason BAN理由（10文字以上）
 */
export async function banUser(
  targetUid: string,
  executorId: string,
  reason: string
): Promise<void> {
  if (reason.length < 10) {
    throw new Error('BAN理由は10文字以上で入力してください。');
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('handle_ban_user', {
    p_target_uid: targetUid,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    throw new Error(`BAN処理に失敗しました: ${error.message}`);
  }
}

/**
 * 指定ユーザーのアカウント停止を解除（UNBAN）し、監査ログに保存する
 *
 * @param targetUid 対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 */
export async function unbanUser(
  targetUid: string,
  executorId: string
): Promise<void> {
  const supabase = await createClient();
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

/**
 * 指定ユーザーのモデレータティアーを、現在より厳密に下位のティアへ引き下げ、監査ログに保存する
 *
 * @param targetUid 対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 * @param newTier 引き下げ先のティアー（現在のティアより厳密に下位である必要がある）
 * @param reason ティア引き下げ理由（10文字以上）
 */
export async function downgradeUserTier(
  targetUid: string,
  executorId: string,
  newTier: ModerationTier,
  reason: string
): Promise<void> {
  if (reason.length < 10) {
    throw new Error('ティア引き下げ理由は10文字以上で入力してください。');
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('handle_downgrade_tier', {
    p_target_uid: targetUid,
    p_new_tier: newTier,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    if (error.message === 'reason-too-short') {
      throw new Error('ティア引き下げ理由は10文字以上で入力してください。');
    }
    if (error.message === 'invalid-tier-downgrade') {
      throw new Error('引き下げ先のティアは現在のティアより下位である必要があります');
    }
    throw new Error(`ティア引き下げ処理に失敗しました: ${error.message}`);
  }
}

/**
 * 対象ユーザーへのユーザー直接通報（`user_reports`）を一括で解決済みにし、通報数リセットを監査ログに保存する
 *
 * @param targetUid 対象ユーザーのUID
 * @param executorId 実行者（管理者）のUID（RPC側で `auth.uid()` から権限検証されるため実際の認可には使用されない）
 * @param reason 通報数リセット理由（10文字以上）
 */
export async function resetUserReports(
  targetUid: string,
  executorId: string,
  reason: string
): Promise<void> {
  if (reason.length < 10) {
    throw new Error('通報数リセット理由は10文字以上で入力してください。');
  }

  const supabase = await createClient();
  const { error } = await (supabase as any).rpc('handle_reset_user_reports', {
    p_target_uid: targetUid,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のユーザーが見つかりません');
    }
    if (error.message === 'reason-too-short') {
      throw new Error('通報数リセット理由は10文字以上で入力してください。');
    }
    throw new Error(`通報数リセットに失敗しました: ${error.message}`);
  }
}

/**
 * 対象ユーザーへの未処理（`status = 'open'`）のユーザー直接通報件数を、
 * `get_user_open_report_count` RPC経由で取得する。
 *
 * Requirement 12.7: 検索対象ユーザーの未処理直接通報件数が0件の場合、
 * `UserSearchPanel` が通報数リセット操作を非活性化するための事前判定に使用する。
 *
 * @param targetUid 対象ユーザーのUID
 */
export async function getUserOpenReportCount(targetUid: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('get_user_open_report_count', {
    p_target_uid: targetUid,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    throw new Error(`未処理通報件数の取得に失敗しました: ${error.message}`);
  }

  return typeof data === 'number' ? data : 0;
}

/**
 * `getReportedUsersRanking` の戻り値。
 */
export interface GetReportedUsersRankingResult {
  items: ReportedUserSummary[];
  hasMore: boolean;
}

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
): Promise<GetReportedUsersRankingResult> {
  const offset = (page - 1) * pageSize;
  const limit = pageSize + 1;

  const supabase = await createClient();
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
 * `getBannedUsers` の絞り込み条件。
 */
export interface BannedUserFilters {
  bannedFrom?: string; // ISO日時
  bannedTo?: string; // ISO日時
  keyword?: string; // UIDまたは表示名の部分一致
  page: number;
  pageSize: number;
}

/**
 * `getBannedUsers` の戻り値。
 */
export interface GetBannedUsersResult {
  items: BannedUserSummary[];
  hasMore: boolean;
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
export async function getBannedUsers(filters: BannedUserFilters): Promise<GetBannedUsersResult> {
  const { bannedFrom, bannedTo, keyword, page, pageSize } = filters;
  const offset = (page - 1) * pageSize;
  const limit = pageSize + 1;

  const supabase = await createClient();
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
  const supabase = await createClient();
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
