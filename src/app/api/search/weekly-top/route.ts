import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const revalidate = 1800; // 30分キャッシュ (1800秒)

interface SearchLogQueryPayload {
  queryText?: string;
  tags?: string[];
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createAdminClient();

    // 7日前の日付を計算
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 過去7日間の検索ログを取得
    const { data, error } = await supabase
      .from('search_logs')
      .select('query')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ keywords: [], tags: [] });
    }

    const keywordCounts: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};

    for (const row of data) {
      let payload: SearchLogQueryPayload;
      try {
        payload = JSON.parse(row.query) as SearchLogQueryPayload;
      } catch {
        continue;
      }

      // キーワードの集計
      const queryText = payload.queryText;
      if (queryText && typeof queryText === 'string' && queryText.trim().length > 0) {
        const cleanQuery = queryText.trim();
        keywordCounts[cleanQuery] = (keywordCounts[cleanQuery] || 0) + 1;
      }

      // タグの集計
      const tags = payload.tags;
      if (tags && Array.isArray(tags)) {
        tags.forEach((tag) => {
          if (tag && typeof tag === 'string' && tag.trim().length > 0) {
            const cleanTag = tag.trim();
            tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
          }
        });
      }
    }

    // キーワードを件数降順にソートし、Top5を抽出
    const sortedKeywords = Object.keys(keywordCounts)
      .map((keyword) => ({ keyword, count: keywordCounts[keyword]! }))
      .sort((a, b) => b.count - a.count)
      .map((entry) => entry.keyword)
      .slice(0, 5);

    // タグを件数降順にソートし、Top5を抽出
    const sortedTags = Object.keys(tagCounts)
      .map((tag) => ({ tag, count: tagCounts[tag]! }))
      .sort((a, b) => b.count - a.count)
      .map((entry) => entry.tag)
      .slice(0, 5);

    return NextResponse.json({
      keywords: sortedKeywords,
      tags: sortedTags,
    });
  } catch (error) {
    console.error('[weekly-top-search] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: '週間人気検索データの集計に失敗しました' },
      { status: 500 }
    );
  }
}
