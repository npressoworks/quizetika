import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';

const supabase = createClient();

export interface Reaction {
  id: string;
  senderId: string;
  receiverId: string; // クイズ作成者
  quizId: string;
  quizTitle: string;
  type: 'like';
  createdAt: Date;
}

type ReactionRow = Database['public']['Tables']['reactions']['Row'];

function mapRowToReaction(row: ReactionRow, quizTitle: string): Reaction {
  return {
    id: `${row.sender_id}_${row.quiz_id}_${row.type}`,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    quizId: row.quiz_id,
    quizTitle,
    type: row.type as 'like',
    createdAt: new Date(row.created_at),
  };
}

/** リアクション対象のクイズタイトルを一括取得し、行データへ付与する */
async function attachQuizTitles(rows: ReactionRow[]): Promise<Reaction[]> {
  if (rows.length === 0) return [];

  const quizIds = [...new Set(rows.map((row) => row.quiz_id))];
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, title')
    .in('id', quizIds);

  const titleMap = new Map<string, string>();
  (quizzes ?? []).forEach((q) => titleMap.set(q.id, q.title));

  return rows.map((row) => mapRowToReaction(row, titleMap.get(row.quiz_id) ?? ''));
}

/**
 * 作家へのいいねリアクションをアトミックにトグル（追加/解除）する
 * receiverId はクライアントから受け取らず、RPC側でクイズの作成者から導出する
 */
export async function toggleReaction(senderId: string, quizId: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc('handle_toggle_reaction', {
    p_sender_id: senderId,
    p_quiz_id: quizId,
  });

  if (error) {
    throw new Error(`リアクション処理のRPC実行に失敗しました: ${error.message}`);
  }

  return !!data;
}

/**
 * 自分が送ったリアクション履歴を取得 (降順)
 */
export async function getSentReactions(userId: string): Promise<Reaction[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select('*')
    .eq('sender_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return attachQuizTitles(data);
}

/**
 * 自作クイズに貰ったリアクション履歴を取得 (降順)
 */
export async function getReceivedReactions(userId: string): Promise<Reaction[]> {
  const { data, error } = await supabase
    .from('reactions')
    .select('*')
    .eq('receiver_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return attachQuizTitles(data);
}
