/**
 * NGワードマスタ（`ng_words`）の一覧取得・登録・編集・有効/無効切替サービス
 *
 * - 一覧取得（listNgWords）は RLS の SELECT ポリシー経由（誰でも読み取り可）で行い、RPC 化しない。
 * - 登録・編集・有効/無効切替は SECURITY DEFINER RPC（`handle_create_ng_word` 等）経由で行い、
 *   管理者権限の検証は RPC 内の `is_admin()` を最終防衛線とする。
 *
 * Boundary: NgWordsService
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */

import { createClient } from '../lib/supabase/server';
import { Database } from '../lib/supabase/database.types';

export interface NgWord {
  id: string;
  word: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type NgWordRow = Database['public']['Tables']['ng_words']['Row'];

function mapRowToNgWord(row: NgWordRow): NgWord {
  return {
    id: row.id,
    word: row.word,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * 空文字・空白のみの入力を早期に拒否する（RPC側の検証をフェイルセーフとして残しつつ、
 * サービス層でも事前検証する二重化）。
 */
function assertNonEmptyWord(word: string): void {
  if (word.trim().length === 0) {
    throw new Error('NGワードは空文字または空白のみでは登録できません。');
  }
}

/**
 * NGワードマスタの一覧を取得する（RLS の SELECT ポリシー経由）
 */
export async function listNgWords(): Promise<NgWord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('ng_words').select('*');

  if (error) {
    throw new Error(`NGワード一覧の取得に失敗しました: ${error.message}`);
  }

  return (data ?? []).map(mapRowToNgWord);
}

/**
 * 新しいNGワードを登録する（`is_active = true` で作成される）
 *
 * @param word 登録する語句
 */
export async function createNgWord(word: string): Promise<NgWord> {
  assertNonEmptyWord(word);

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('handle_create_ng_word', {
    p_word: word,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('この語句はすでに登録されています。');
    }
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    throw new Error(`NGワードの登録に失敗しました: ${error.message}`);
  }

  return mapRowToNgWord(data as NgWordRow);
}

/**
 * 登録済みのNGワードの表記を編集する
 *
 * @param id 対象NGワードのID
 * @param word 更新後の語句
 */
export async function updateNgWord(id: string, word: string): Promise<NgWord> {
  assertNonEmptyWord(word);

  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('handle_update_ng_word', {
    p_id: id,
    p_word: word,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('この語句はすでに登録されています。');
    }
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のNGワードが見つかりません');
    }
    throw new Error(`NGワードの更新に失敗しました: ${error.message}`);
  }

  return mapRowToNgWord(data as NgWordRow);
}

/**
 * NGワードの有効/無効状態を切り替える
 *
 * @param id 対象NGワードのID
 * @param isActive true: 有効化, false: 無効化
 */
export async function setNgWordActive(id: string, isActive: boolean): Promise<NgWord> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any).rpc('handle_set_ng_word_active', {
    p_id: id,
    p_is_active: isActive,
  });

  if (error) {
    if (error.message === 'permission-denied') {
      throw new Error('この操作を実行する権限がありません');
    }
    if (error.message === 'target-not-found') {
      throw new Error('対象のNGワードが見つかりません');
    }
    throw new Error(`NGワードの有効/無効切替に失敗しました: ${error.message}`);
  }

  return mapRowToNgWord(data as NgWordRow);
}
