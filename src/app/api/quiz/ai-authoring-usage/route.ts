import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeAiAuthoringRequest,
  type AuthoringAuthFailure,
} from '@/services/ai-authoring-route-helpers';
import { readDailyAuthoringUsage } from '@/services/ai-authoring-utils';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = request.nextUrl.searchParams.get('userId') ?? '';
    const auth = await authorizeAiAuthoringRequest(request, userId);

    if ('status' in auth) {
      const failure = auth as AuthoringAuthFailure;
      return NextResponse.json(
        { error: failure.error, message: failure.message },
        { status: failure.status }
      );
    }

    const usage = readDailyAuthoringUsage(
      auth.questionsCount,
      auth.thumbnailCount,
      auth.chatCount,
      auth.access.skipDailyLimit
    );

    return NextResponse.json(usage);
  } catch (error) {
    console.error('[ai-authoring-usage] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
