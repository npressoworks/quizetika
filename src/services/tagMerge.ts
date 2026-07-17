import { createClient } from '../lib/supabase/client';

const supabase = createClient();

export interface MergeRequest {
  id: string;
  targetType: 'tag' | 'genre';
  sourceId: string;
  targetId: string;
  requesterId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenreRequest {
  id: string;
  genreId: string;
  displayName: string;
  description: string;
  iconImageUrl: string | null;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected';
  votesForCount: number;
  votesAgainstCount: number;
  weightedVotesFor: number;
  weightedVotesAgainst: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * タグ/ジャンルのマージ提案を起案する
 * 起案時点で起案者は自動的に賛成1票（重み付き）
 *
 * 循環マージ検知・重複チェック・重み計算・自動賛成票登録はすべて `handle_create_merge_request`
 * RPC内で完結する。`userId` はRPC側で `auth.uid()` から導出されるため実際の認可には使用されない。
 */
export async function createMergeRequest(
  sourceId: string,
  targetId: string,
  targetType: 'tag' | 'genre',
  reason: string,
  userId: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('handle_create_merge_request', {
    p_target_type: targetType,
    p_source_id: sourceId,
    p_target_id: targetId,
    p_reason: reason,
  });

  if (error) {
    if (error.message === 'governance-frozen') {
      throw new Error('コミュニティガバナンスは現在凍結中です。');
    }
    if (error.message === 'same-id') {
      throw new Error('同一のタグ/ジャンルをマージすることはできません。');
    }
    if (error.message === 'circular-merge') {
      throw new Error('循環マージが発生するため、このマージ提案は起案できません。');
    }
    if (error.code === '23505') {
      throw new Error('既に同じマージ提案が進行中です。');
    }
    throw new Error(`マージ提案の起案に失敗しました: ${error.message}`);
  }

  return data as string;
}

/**
 * マージリクエストに賛成/反対投票を行う
 * 重複投票の防止・可決/否決判定・可決時のクイズ側一括書き換えはすべて `handle_vote_merge_request`
 * RPC内で同期完結する。`voterId` はRPC側で `auth.uid()` から導出されるため実際の認可には使用されない。
 */
export async function voteMergeRequest(
  requestId: string,
  voterId: string,
  opinion: 'approve' | 'reject'
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_vote_merge_request', {
    p_request_id: requestId,
    p_opinion: opinion,
  });

  if (error) {
    if (error.message === 'governance-frozen') {
      throw new Error('コミュニティガバナンスは現在凍結中です。');
    }
    if (error.message === 'request-not-found') {
      throw new Error('マージ提案が見つかりません。');
    }
    if (error.message === 'already-resolved') {
      throw new Error('この提案は既に審査が終了しています。');
    }
    if (error.code === '23505') {
      throw new Error('既にこの提案に投票済みです。');
    }
    throw new Error(`マージ提案への投票に失敗しました: ${error.message}`);
  }
}

/**
 * 新しいジャンルの申請を登録する
 * 重み計算・自動賛成票登録は `handle_submit_genre_request` RPC内で完結する。
 * `requesterId` はRPC側で `auth.uid()` から導出されるため実際の認可には使用されない。
 */
export async function submitGenreRequest(
  genreId: string,
  displayName: string,
  description: string,
  iconImageUrl: string,
  requesterId: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('handle_submit_genre_request', {
    p_genre_id: genreId,
    p_display_name: displayName,
    p_description: description,
    p_icon_image_url: iconImageUrl || null,
  });

  if (error) {
    if (error.message === 'governance-frozen') {
      throw new Error('コミュニティガバナンスは現在凍結中です。');
    }
    throw new Error(`ジャンル新設申請の起案に失敗しました: ${error.message}`);
  }

  return data as string;
}

/**
 * ジャンル新設申請に賛成/反対投票を行う
 * 重複投票の防止・可決/否決判定・可決時のジャンルマスタ登録はすべて `handle_vote_genre_request`
 * RPC内で同期完結する。`voterId` はRPC側で `auth.uid()` から導出されるため実際の認可には使用されない。
 */
export async function voteGenreRequest(
  requestId: string,
  voterId: string,
  opinion: 'approve' | 'reject'
): Promise<void> {
  const { error } = await (supabase as any).rpc('handle_vote_genre_request', {
    p_request_id: requestId,
    p_opinion: opinion,
  });

  if (error) {
    if (error.message === 'governance-frozen') {
      throw new Error('コミュニティガバナンスは現在凍結中です。');
    }
    if (error.message === 'request-not-found') {
      throw new Error('ジャンル申請が見つかりません。');
    }
    if (error.message === 'already-resolved') {
      throw new Error('この申請は既に処理済みです。');
    }
    if (error.code === '23505') {
      throw new Error('既にこの申請に投票済みです。');
    }
    throw new Error(`ジャンル新設申請への投票に失敗しました: ${error.message}`);
  }
}
