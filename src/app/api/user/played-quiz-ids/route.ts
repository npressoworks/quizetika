/**
 * 本人のプレイ済みクイズ ID 一覧
 * GET /api/user/played-quiz-ids
 */

import { NextRequest, NextResponse } from 'next/server';
import { listUserPlayedQuizIds } from '@/services/attempt';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = extractBearerToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証トークンが必要です' },
        { status: 401 }
      );
    }

    const verifiedUid = await verifyFirebaseIdToken(token);
    if (!verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗しました' },
        { status: 401 }
      );
    }

    const quizIds = await listUserPlayedQuizIds(verifiedUid);
    return NextResponse.json({ quizIds });
  } catch (error) {
    console.error('[played-quiz-ids] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'プレイ済み一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}
