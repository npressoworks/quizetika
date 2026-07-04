import { createClient } from '@/lib/supabase/client';
import { listUserPlayedQuizIds } from '@/services/attempt';

const supabase = createClient();

/**
 * ログイン中ユーザーのプレイ済みクイズ ID 一覧（Supabase セッションベース）
 */
export async function fetchPlayedQuizIds(): Promise<string[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) {
    return [];
  }

  return listUserPlayedQuizIds(uid);
}
