import { createAdminClient } from '@/lib/supabase/server';
import { mapRowToAttempt } from './attempt';
import type { Attempt } from '@/types';

/**
 * サーバー専用: 本人の attempt を Supabase Admin クライアント（サービスロール）で取得する。
 * RLS をバイパスするため、Firebase Admin と同様に手動で userId の所有チェックを行う。
 */
export async function getAttemptByIdForUser(
  attemptId: string,
  userId: string
): Promise<Attempt | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('attempts')
    .select('*')
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  if (data.user_id !== userId) {
    return null;
  }

  return mapRowToAttempt(data);
}
