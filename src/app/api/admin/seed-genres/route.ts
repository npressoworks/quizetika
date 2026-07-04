import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { seedInitialGenresWithAdmin } from '@/services/seedInitialGenresAdmin';
import { User } from '@/types';

/**
 * 初期ジャンル一括投入API
 * POST /api/admin/seed-genres
 *
 * Supabase Admin クライアント（サービスロール）で metadata_genres へ書き込む（RLSに依存しない）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    const executorId = await verifySupabaseAccessToken(token);

    if (!executorId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { data: executorRow } = await supabase
      .from('users')
      .select('moderation_tier, role')
      .eq('id', executorId)
      .maybeSingle();

    if (!executorRow) {
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const executor = {
      moderationTier: executorRow.moderation_tier,
      role: executorRow.role,
    } as User;
    if (!isAdminUser(executor)) {
      return NextResponse.json(
        { error: 'forbidden', message: 'この操作を実行する権限がありません。' },
        { status: 403 }
      );
    }

    const result = await seedInitialGenresWithAdmin();

    return NextResponse.json(
      {
        success: true,
        added: result.added,
        updated: result.updated,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API/admin/seed-genres] 予期しないエラー:', error);

    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
