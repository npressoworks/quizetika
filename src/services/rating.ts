import { createClient } from '../lib/supabase/client';

const supabase = createClient();

/**
 * 難易度投票の型定義
 */
export interface DifficultyVote {
  id?: string;
  userId: string | null;
  quizId: string;
  vote: number; // 1〜5
  createdAt: Date;
}

/**
 * 体感難易度（1〜5）をアトミックに保存する。
 * ログイン済みユーザーは最新値で上書き保存され、上書き時は差分のみがクイズの難易度分布データに反映される。
 * 匿名投票は常に新規行として加算される。
 *
 * @param quizId 投票対象のクイズID
 * @param userId 投票ユーザーのID（nullの場合は匿名投票）
 * @param difficultyVote 投票する難易度（1〜5）
 */
export async function submitDifficultyVote(
  quizId: string,
  userId: string | null,
  difficultyVote: number
): Promise<void> {
  if (difficultyVote < 1 || difficultyVote > 5) {
    throw new Error('難易度投票は1から5の範囲で指定してください。');
  }

  const { error } = await (supabase as any).rpc('handle_submit_difficulty_vote', {
    p_quiz_id: quizId,
    p_user_id: userId,
    p_vote: difficultyVote,
  });

  if (error) {
    throw new Error(`難易度投票の保存に失敗しました: ${error.message}`);
  }
}
