import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { updateNgWord, setNgWordActive, NgWord } from '@/services/ngWords';
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
    console.error('[API/admin/ng-words/[id]] 認可エラー:', error);
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
 * NGワード表記編集・有効/無効切替API
 * PATCH /api/admin/ng-words/[id]
 *
 * リクエストボディ:
 * - word?: string (更新後の語句)
 * - isActive?: boolean (有効/無効状態)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const executorId = await authorizeAdmin(request);
    if (!executorId) {
      return await unauthorizedOrForbidden(request);
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { word, isActive } = body as { word?: string; isActive?: boolean };

    if (word === undefined && isActive === undefined) {
      return NextResponse.json(
        { error: 'bad-request', message: '更新項目(word または isActive)を指定してください。' },
        { status: 400 }
      );
    }

    let updated: NgWord | undefined;

    if (word !== undefined) {
      if (typeof word !== 'string' || word.trim().length === 0) {
        return NextResponse.json(
          { error: 'bad-request', message: 'NGワードは空文字または空白のみでは更新できません。' },
          { status: 400 }
        );
      }
      updated = await updateNgWord(id, word.trim());
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json(
          { error: 'bad-request', message: 'isActive は真偽値で指定してください。' },
          { status: 400 }
        );
      }
      updated = await setNgWordActive(id, isActive);
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('見つかりません')) {
      return NextResponse.json({ error: 'not-found', message }, { status: 404 });
    }
    if (message.includes('すでに登録')) {
      return NextResponse.json({ error: 'duplicate', message }, { status: 409 });
    }
    if (message.includes('権限がありません')) {
      return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
    }
    if (message.includes('空文字')) {
      return NextResponse.json({ error: 'bad-request', message }, { status: 400 });
    }

    console.error('[API/admin/ng-words/[id] PATCH] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
