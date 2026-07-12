/**
 * NGワードマスタ（`ng_words`、`supabase-governance` 所有）の読み取り専用参照サービス
 *
 * - マスタ自体の登録・編集・無効化はここでは行わない（`supabase-governance` の責務）。
 * - `ng_words` の RLS SELECT ポリシー（`ng_words_read`, `FOR SELECT USING (TRUE)`）経由で
 *   誰でも読み取り可能なため、特別な権限処理は不要。
 * - 取得に失敗した場合は例外をそのまま呼び出し元へ伝播させる（フェイルクローズ）。
 *
 * Boundary: NgWordsService
 * Requirements: 32.1, 32.4, 32.5
 */

import { createClient } from '../lib/supabase/client';
import { Database } from '../lib/supabase/database.types';

const supabase = createClient();

type NgWordRow = Pick<Database['public']['Tables']['ng_words']['Row'], 'word'>;

/**
 * `is_active = true` のNGワード一覧を取得する。
 * Supabase クエリが失敗した場合は例外をスローする（呼び出し元での空配列フォールバックは行わない）。
 */
export async function listActiveNgWords(): Promise<string[]> {
  const { data, error } = await supabase
    .from('ng_words')
    .select('word')
    .eq('is_active', true);

  if (error) {
    throw new Error(`NGワード一覧の取得に失敗しました: ${error.message}`);
  }

  return ((data ?? []) as NgWordRow[]).map((row) => row.word);
}
