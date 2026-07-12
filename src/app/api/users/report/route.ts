/**
 * ユーザー直接通報API Route
 * POST /api/users/report
 *
 * 認証済みユーザー（admin権限は不要）が、迷惑行為を行う他ユーザーを直接通報する。
 * `submitUserReport` を呼び出し、自己通報は409、その他のサービスエラーは500に丸める。
 *
 * Requirements: 8.3, 8.4, 8.5
 * Boundary: report API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { submitUserReport } from '@/services/user-report';
import { UserReportCategory } from '@/types';

const ALLOWED_CATEGORIES: UserReportCategory[] = ['harassment', 'impersonation', 'spam', 'other'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    const reporterId = await verifySupabaseAccessToken(token);

    if (!reporterId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、無効なトークンです。' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { targetUid, category, detail } = body as {
      targetUid: string;
      category: UserReportCategory;
      detail: string;
    };

    if (!targetUid || typeof targetUid !== 'string') {
      return NextResponse.json(
        { error: 'invalid-params', message: '対象ユーザーのUID(targetUid)は必須です。' },
        { status: 400 }
      );
    }

    if (!category || typeof category !== 'string' || !ALLOWED_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'invalid-params', message: '通報カテゴリ(category)が不正です。' },
        { status: 400 }
      );
    }

    if (!detail || typeof detail !== 'string' || detail.trim().length === 0) {
      return NextResponse.json(
        { error: 'invalid-params', message: '通報理由(detail)は必須です。' },
        { status: 400 }
      );
    }

    await submitUserReport(reporterId, targetUid, category, detail);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error('[API/users/report] 予期しないエラー:', error);

    const message = error instanceof Error ? error.message : '';
    if (message.includes('自分自身を通報することはできません')) {
      return NextResponse.json(
        { error: 'self-report', message: '自分自身を通報することはできません。' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました。' },
      { status: 500 }
    );
  }
}
