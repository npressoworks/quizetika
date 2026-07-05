import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type DailyUsageCounterClient = SupabaseClient<Database>;

/**
 * `daily_usage_counters` から指定キーの本日分カウントを読み取る（Adminクライアント専用）
 * 保存日付が `todayStr` と異なる場合は日次リセットとみなし 0 を返す
 */
export async function readDailyUsageCount(
  supabase: DailyUsageCounterClient,
  userId: string,
  counterKey: string,
  todayStr: string
): Promise<number> {
  const { data } = await supabase
    .from('daily_usage_counters')
    .select('count, counter_date')
    .eq('user_id', userId)
    .eq('counter_key', counterKey)
    .maybeSingle();

  if (!data || data.counter_date !== todayStr) return 0;
  return data.count ?? 0;
}

/**
 * `daily_usage_counters` の本日分カウントをアトミックにインクリメントする（Adminクライアント専用）
 * 保存日付が `todayStr` と異なる場合は 1 にリセットしてから返す
 */
export async function incrementDailyUsageCount(
  supabase: DailyUsageCounterClient,
  userId: string,
  counterKey: string,
  todayStr: string
): Promise<number> {
  const { data, error } = await (supabase as any).rpc('handle_increment_daily_usage_counter', {
    p_user_id: userId,
    p_counter_key: counterKey,
    p_today: todayStr,
  });

  if (error) {
    throw new Error(`日次利用カウンタの更新に失敗しました: ${error.message}`);
  }

  return data as number;
}
