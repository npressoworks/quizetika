import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  authorizeAiAuthoringRequest,
  type AuthoringAuthFailure,
} from '@/services/ai-authoring-route-helpers';
import {
  PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
  checkDailyAuthoringLimit,
} from '@/services/ai-authoring-utils';
import { uploadQuizCoverBuffer } from '@/services/storage-admin';
import { incrementDailyUsageCount } from '@/lib/daily-usage-counters';
import { DAILY_AUTHORING_DOC_THUMBNAIL } from '@/services/ai-authoring-utils';

export const maxDuration = 60;

const imageModelId =
  process.env.GEMINI_IMAGE_MODEL_ID ?? 'gemini-2.5-flash-image';

function buildThumbnailPrompt(title: string, description: string): string {
  return `クイズのサムネイル画像を生成してください。タイトル: ${title}。説明: ${description}。魅力的なクイズカバー画像。テキストは最小限。`;
}

function extractImageBuffer(response: {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
}): Buffer | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return Buffer.from(part.inlineData.data, 'base64');
    }
  }
  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { title, description, quizId, userId } = body as {
      title?: string;
      description?: string;
      quizId?: string;
      userId?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'userId は必須です' },
        { status: 400 }
      );
    }

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'missing-params', message: 'タイトルと説明文を入力してください' },
        { status: 400 }
      );
    }

    const auth = await authorizeAiAuthoringRequest(request, userId);
    if ('status' in auth) {
      const failure = auth as AuthoringAuthFailure;
      return NextResponse.json(
        { error: failure.error, message: failure.message },
        { status: failure.status }
      );
    }

    const limitCheck = checkDailyAuthoringLimit(
      auth.thumbnailCount,
      PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
      auth.access.skipDailyLimit
    );

    if (limitCheck.exceeded) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          message: `本日のサムネ AI 生成上限（${PRO_DAILY_THUMBNAIL_GENERATION_LIMIT}回）に達しました`,
          usage: limitCheck.usage,
        },
        { status: 429 }
      );
    }

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    let imageBuffer: Buffer | null = null;
    try {
      const genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
      const response = await genAiClient.models.generateContent({
        model: imageModelId,
        contents: buildThumbnailPrompt(trimmedTitle, trimmedDescription),
      });
      imageBuffer = extractImageBuffer(response);
    } catch (aiError) {
      console.error('[ai-generate-thumbnail] GenAI API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-unavailable', message: 'AI が応答できませんでした。しばらくしてから再度お試しください' },
        { status: 503 }
      );
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'ai-unavailable', message: '画像の生成に失敗しました' },
        { status: 503 }
      );
    }

    const thumbnailUrl = await uploadQuizCoverBuffer(imageBuffer, {
      quizId: quizId?.trim() || undefined,
      uid: auth.access.uid,
    });

    const nextCount = await incrementDailyUsageCount(
      auth.supabase,
      auth.access.uid,
      DAILY_AUTHORING_DOC_THUMBNAIL,
      auth.todayStr
    );

    const afterLimit = checkDailyAuthoringLimit(
      nextCount,
      PRO_DAILY_THUMBNAIL_GENERATION_LIMIT,
      auth.access.skipDailyLimit
    );

    return NextResponse.json({
      thumbnailUrl,
      usage: afterLimit.usage,
    });
  } catch (error) {
    console.error('[ai-generate-thumbnail] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
