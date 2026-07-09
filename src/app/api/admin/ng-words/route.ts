import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { listNgWords, createNgWord } from '@/services/ngWords';
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
    console.error('[API/admin/ng-words] 認可エラー:', error);
    return null;
  }
}

/**
 * 認可失敗時の 401/403 トリアージ
 */
async function unauthorizedOrForbidden(request: NextRequest): Promise<NextResponse> {
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

/**
 * NGワード一覧取得API
 * GET /api/admin/ng-words
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const executorId = await authorizeAdmin(request);
    if (!executorId) {
      return await unauthorizedOrForbidden(request);
    }

    const ngWords = await listNgWords();
    return NextResponse.json(ngWords, { status: 200 });
  } catch (error) {
    console.error('[API/admin/ng-words GET] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}

/**
 * NGワード新規登録API
 * POST /api/admin/ng-words
 *
 * リクエストボディ:
 * - word: string (登録する語句)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const executorId = await authorizeAdmin(request);
    if (!executorId) {
      return await unauthorizedOrForbidden(request);
    }

    const body = await request.json().catch(() => ({}));
    const { word } = body as { word?: string };

    if (typeof word !== 'string' || word.trim().length === 0) {
      return NextResponse.json(
        { error: 'bad-request', message: 'NGワードは空文字または空白のみでは登録できません。' },
        { status: 400 }
      );
    }

    const created = await createNgWord(word.trim());

    return NextResponse.json({ success: true, data: created }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('すでに登録')) {
      return NextResponse.json({ error: 'duplicate', message }, { status: 409 });
    }
    if (message.includes('権限がありません')) {
      return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
    }
    if (message.includes('空文字')) {
      return NextResponse.json({ error: 'bad-request', message }, { status: 400 });
    }

    console.error('[API/admin/ng-words POST] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
