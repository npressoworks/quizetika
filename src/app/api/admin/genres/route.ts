import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { moveTemporaryGenreIcon } from '@/services/storage-admin';
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
    console.error('[API/admin/genres] 認可エラー:', error);
    return null;
  }
}

/**
 * 全ジャンル取得API
 * GET /api/admin/genres
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase.from('metadata_genres').select('*');

    if (error) {
      throw new Error(error.message);
    }

    const genres = (rows ?? []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      description: row.description ?? '',
      iconImageUrl: row.icon_image_url,
      canonicalId: row.canonical_id,
      mergedGenreIds: row.merged_genre_ids ?? [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return NextResponse.json(genres, { status: 200 });
  } catch (error) {
    console.error('[API/admin/genres GET] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * ジャンル直接新規登録API
 * POST /api/admin/genres
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const isAdmin = await authorizeAdmin(request);
    if (!isAdmin) {
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

    const body = await request.json().catch(() => ({}));
    const { id, displayName, description, iconImageUrl } = body;

    // バリデーション
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'bad-request', message: 'ジャンルIDは必須項目です。' },
        { status: 400 }
      );
    }

    // ID形式チェック: 半角小文字英数字とハイフンのみ
    const idRegex = /^[a-z0-9-]+$/;
    if (!idRegex.test(id)) {
      return NextResponse.json(
        { error: 'bad-request', message: 'ジャンルIDは半角小文字英数字とハイフンのみで入力してください。' },
        { status: 400 }
      );
    }

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'bad-request', message: '表示名は必須項目です。' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 重複チェック
    const { data: existing } = await supabase
      .from('metadata_genres')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate-id', message: 'このジャンルIDはすでに登録されています。' },
        { status: 409 }
      );
    }

    let finalIconImageUrl: string | null = iconImageUrl || null;

    // 一時保存されたアイコン画像（AI生成/手動アップロード）を正式なパスに移行する
    if (finalIconImageUrl && finalIconImageUrl.includes('/genres/temp/')) {
      try {
        finalIconImageUrl = await moveTemporaryGenreIcon(finalIconImageUrl, id);
      } catch (moveError) {
        console.error('[API/admin/genres] アイコン画像移行処理エラー:', moveError);
      }
    }

    const now = new Date().toISOString();
    const { error: insertError } = await supabase.from('metadata_genres').insert({
      id,
      display_name: displayName,
      description: description || '',
      icon_image_url: finalIconImageUrl,
      canonical_id: null,
      merged_genre_ids: [],
      is_active: true,
      created_at: now,
      updated_at: now,
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          id,
          displayName,
          description: description || '',
          iconImageUrl: finalIconImageUrl,
          canonicalId: null,
          mergedGenreIds: [],
          isActive: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API/admin/genres POST] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
