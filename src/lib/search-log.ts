import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

/**
 * 検索キーワードやタグを Supabase の search_logs テーブルにサイレント記録する (fire-and-forget)
 * 
 * @param userId ログインユーザーのID (未認証時は undefined)
 * @param queryText 検索に入力されたフリーワード
 * @param tags 検索に指定されたタグ配列
 * @param genreId 検索に指定されたジャンルID
 */
export async function writeSearchLog(
  userId: string | undefined,
  queryText?: string,
  tags?: string[],
  genreId?: string
): Promise<void> {
  // 未認証ユーザーの場合は記録しない
  if (!userId) {
    return;
  }

  const hasQueryText = queryText && queryText.trim().length > 0;
  const hasTags = tags && tags.length > 0;
  const hasGenre = genreId && genreId.trim().length > 0;

  // キーワード、タグ、ジャンルのいずれも指定されていない空検索の場合は記録しない
  if (!hasQueryText && !hasTags && !hasGenre) {
    return;
  }

  try {
    const payload: Record<string, any> = {};

    if (hasQueryText) {
      payload.queryText = queryText.trim();
    }
    if (hasTags) {
      payload.tags = tags;
    }
    if (hasGenre) {
      payload.genreId = genreId.trim();
    }

    // JSON 文字列化して query カラムに格納
    const queryValue = JSON.stringify(payload);

    // 非同期に書き込む。待機 (await) するが、呼び出し側は await せずに実行する
    await supabase.from('search_logs').insert({
      user_id: userId,
      query: queryValue,
    });
  } catch (error) {
    // 検索処理自体を阻害しないよう、エラーはログ出力するのみで例外を外に伝播させない
    console.error('Failed to write search log:', error);
  }
}
