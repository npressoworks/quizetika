import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { createAdminClient } from '@/lib/supabase/server';
import { getJstTodayString, buildAuthoringUsage } from '@/services/ai-authoring-utils';
import { uploadTemporaryGenreIconBuffer } from '@/services/storage-admin';
import { readDailyUsageCount, incrementDailyUsageCount } from '@/lib/daily-usage-counters';

export const maxDuration = 60;

const imageModelId =
  process.env.GEMINI_IMAGE_MODEL_ID ?? 'gemini-2.5-flash-image';

const GENRE_ICON_COUNTER_KEY = 'genre-icon';
const DAILY_LIMIT = 5;

function buildIconPrompt(displayName: string, description: string): string {
  return `ジャンルのアイコンイラストを生成してください。表示名: ${displayName}。説明: ${description}。文字やテキストを含まない、シンプルでフラットデザインの美しいアイコンイラスト。`;
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
    const body = await request.json().catch(() => ({}));
    const { displayName, description, userId } = body as {
      displayName?: string;
      description?: string;
      userId?: string;
    };

    if (!userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'userId は必須です' },
        { status: 400 }
      );
    }

    if (!displayName?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: 'missing-params', message: 'ジャンル名と説明を入力してください' },
        { status: 400 }
      );
    }

    const token = extractBearerToken(request);
    const verifiedUid = await verifySupabaseAccessToken(token);

    if (!verifiedUid || verifiedUid !== userId) {
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const { data: userRow } = await supabase
      .from('users')
      .select('role, moderation_tier')
      .eq('id', verifiedUid)
      .maybeSingle();

    if (!userRow) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'ユーザーが存在しません' },
        { status: 401 }
      );
    }

    const isAdmin = userRow.role === 'admin' || userRow.moderation_tier === 'admin';
    const todayStr = getJstTodayString();

    let currentCount = 0;
    if (!isAdmin) {
      currentCount = await readDailyUsageCount(
        supabase,
        verifiedUid,
        GENRE_ICON_COUNTER_KEY,
        todayStr
      );

      if (currentCount >= DAILY_LIMIT) {
        return NextResponse.json(
          {
            error: 'limit-exceeded',
            message: '本日の画像生成上限に達しました',
            usage: buildAuthoringUsage(currentCount, DAILY_LIMIT, false),
          },
          { status: 429 }
        );
      }
    }

    let imageBuffer: Buffer | null = null;
    try {
      const genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
      const response = await genAiClient.models.generateContent({
        model: imageModelId,
        contents: buildIconPrompt(displayName.trim(), description.trim()),
        config: {
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          }
        }
      });
      imageBuffer = extractImageBuffer(response);
    } catch (aiError) {
      console.error('[generate-icon] GenAI API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-unavailable', message: '画像の生成に失敗しました。しばらくしてから再度お試しください' },
        { status: 503 }
      );
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'ai-unavailable', message: '画像の生成に失敗しました' },
        { status: 503 }
      );
    }

    const iconImageUrl = await uploadTemporaryGenreIconBuffer(imageBuffer, verifiedUid);

    const nextCount = isAdmin
      ? currentCount
      : await incrementDailyUsageCount(supabase, verifiedUid, GENRE_ICON_COUNTER_KEY, todayStr);
    const usage = buildAuthoringUsage(nextCount, DAILY_LIMIT, isAdmin);

    return NextResponse.json({
      iconImageUrl,
      usage,
    });
  } catch (error) {
    console.error('[generate-icon] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
