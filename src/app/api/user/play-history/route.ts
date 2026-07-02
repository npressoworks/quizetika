/**
 * 本人プレイ履歴API
 * GET /api/user/play-history?limit=20&cursor=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { listUserPlayHistory } from '@/services/attempt';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証トークンが必要です' },
        { status: 401 }
      );
    }

    const verifiedUid = await verifySupabaseAccessToken(token);
    if (!verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const requestedUid = request.nextUrl.searchParams.get('uid');
    if (requestedUid && requestedUid !== verifiedUid) {
      return NextResponse.json(
        { error: 'forbidden', message: '他ユーザーのプレイ履歴は取得できません' },
        { status: 403 }
      );
    }

    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : undefined;
    const cursor = request.nextUrl.searchParams.get('cursor');

    const page = await listUserPlayHistory({
      uid: verifiedUid,
      limit,
      cursor,
    });

    return NextResponse.json(page);
  } catch (error) {
    console.error('[play-history] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'プレイ履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
