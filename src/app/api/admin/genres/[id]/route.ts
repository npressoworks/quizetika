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
    console.error('[API/admin/genres/[id]] 認可エラー:', error);
    return null;
  }
}

/**
 * ジャンル削除・既存クイズ再割当てAPI
 * DELETE /api/admin/genres/:id
 */
export async function DELETE(
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
    const body = await request.json().catch(() => ({}));
    const reassignToGenreId: string | null =
      typeof body?.reassignToGenreId === 'string' ? body.reassignToGenreId : null;

    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('delete_genre_with_reassignment', {
      p_genre_id: id,
      p_reassign_to_id: reassignToGenreId,
    });

    if (error) {
      switch (error.message) {
        case 'genre-not-found':
          return NextResponse.json(
            { error: 'genre-not-found', message: '指定されたジャンルが見つかりません。' },
            { status: 404 }
          );
        case 'same-genre':
          return NextResponse.json(
            {
              error: 'same-genre',
              message: '再割当て先ジャンルに削除対象ジャンル自身は指定できません。',
            },
            { status: 400 }
          );
        case 'reassign-required':
          return NextResponse.json(
            {
              error: 'reassign-required',
              message: '削除対象ジャンルに紐づくクイズがあるため、再割当て先ジャンルの指定が必要です。',
            },
            { status: 400 }
          );
        case 'invalid-reassign-target':
          return NextResponse.json(
            {
              error: 'invalid-reassign-target',
              message: '指定された再割当て先ジャンルが見つかりません。',
            },
            { status: 400 }
          );
        default:
          throw new Error(error.message);
      }
    }

    return NextResponse.json(
      { success: true, reassignedCount: data ?? 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API/admin/genres/[id] DELETE] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
