import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { User } from '@/types';

/**
 * 管理者チェック用の共通ヘルパー
 * @returns 実行ユーザーの UID（成功時）、または null（失敗時）
 */
async function authorizeAdmin(request: NextRequest): Promise<string | null> {
  try {
    const token = extractBearerToken(request);
    const executorId = await verifySupabaseAccessToken(token);

    if (!executorId) {
      return null;
    }

    const supabase = createAdminClient();
    const { data: executorRow } = await supabase
      .from('users')
      .select('moderation_tier, role')
      .eq('id', executorId)
      .maybeSingle();

    if (!executorRow) {
      return null;
    }

    const executor = {
      moderationTier: executorRow.moderation_tier,
      role: executorRow.role,
    } as User;
    if (!isAdminUser(executor)) {
      return null;
    }

    return executorId;
  } catch (error) {
    console.error('[API/admin/genres/[id]/usage] 認可エラー:', error);
    return null;
  }
}

/**
 * ジャンル影響確認API
 * GET /api/admin/genres/:id/usage
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const isAdmin = await authorizeAdmin(request);
    if (!isAdmin) {
      // 認証失敗のトリアージ
      const token = extractBearerToken(request);
      const executorId = token ? await verifySupabaseAccessToken(token) : null;
      if (!executorId) {
        return NextResponse.json(
          { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const supabase = createAdminClient();

    const { data: genreRow } = await supabase
      .from('metadata_genres')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (!genreRow) {
      return NextResponse.json(
        { error: 'not-found', message: '指定されたジャンルが見つかりません。' },
        { status: 404 }
      );
    }

    const { count, error } = await supabase
      .from('quizzes')
      .select('id', { count: 'exact', head: true })
      .eq('canonical_genre_id', id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ quizCount: count ?? 0 }, { status: 200 });
  } catch (error) {
    console.error('[API/admin/genres/[id]/usage GET] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
