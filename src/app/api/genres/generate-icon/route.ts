import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getJstTodayString, buildAuthoringUsage } from '@/services/ai-authoring-utils';
import { uploadTemporaryGenreIconBuffer } from '@/services/storage-admin';

export const maxDuration = 60;

const imageModelId =
  process.env.GEMINI_IMAGE_MODEL_ID ?? 'gemini-2.5-flash-image';

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

    const db = getAdminFirestore();
    const userSnap = await db.collection('users').doc(verifiedUid).get();
    if (!userSnap.exists) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'ユーザーが存在しません' },
        { status: 401 }
      );
    }

    const userData = userSnap.data();
    const role = userData?.role;
    const moderationTier = userData?.moderationTier;
    const isAdmin = role === 'admin' || moderationTier === 'admin';

    const todayStr = getJstTodayString();
    const limitRef = db
      .collection('users')
      .doc(verifiedUid)
      .collection('authoring_limits')
      .doc('genre-icon');

    let currentCount = 0;

    if (!isAdmin) {
      // 一般ユーザーのみトランザクションで制限チェックと更新を行う
      const limitExceeded = await db.runTransaction(async (transaction) => {
        const limitSnap = await transaction.get(limitRef);
        let count = 0;
        let lastUpdatedDate = todayStr;

        if (limitSnap.exists) {
          const data = limitSnap.data();
          if (data && data.lastUpdatedDate === todayStr) {
            count = data.count ?? 0;
          }
        }

        if (count >= DAILY_LIMIT) {
          currentCount = count;
          return true; // 制限超過
        }

        currentCount = count + 1;
        transaction.set(
          limitRef,
          { count: currentCount, lastUpdatedDate },
          { merge: true }
        );
        return false;
      });

      if (limitExceeded) {
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

      // AIエラー時は、一般ユーザーであれば増やしてしまったカウンターを元に戻す
      if (!isAdmin) {
        await db.runTransaction(async (transaction) => {
          const limitSnap = await transaction.get(limitRef);
          if (limitSnap.exists) {
            const data = limitSnap.data();
            if (data && data.lastUpdatedDate === todayStr) {
              const count = Math.max(0, (data.count ?? 1) - 1);
              transaction.set(limitRef, { count }, { merge: true });
            }
          }
        });
      }

      return NextResponse.json(
        { error: 'ai-unavailable', message: '画像の生成に失敗しました。しばらくしてから再度お試しください' },
        { status: 503 }
      );
    }

    if (!imageBuffer) {
      // 生成失敗時も同様にカウンターを戻す
      if (!isAdmin) {
        await db.runTransaction(async (transaction) => {
          const limitSnap = await transaction.get(limitRef);
          if (limitSnap.exists) {
            const data = limitSnap.data();
            if (data && data.lastUpdatedDate === todayStr) {
              const count = Math.max(0, (data.count ?? 1) - 1);
              transaction.set(limitRef, { count }, { merge: true });
            }
          }
        });
      }

      return NextResponse.json(
        { error: 'ai-unavailable', message: '画像の生成に失敗しました' },
        { status: 503 }
      );
    }

    const iconImageUrl = await uploadTemporaryGenreIconBuffer(imageBuffer, verifiedUid);
    const usage = buildAuthoringUsage(currentCount, DAILY_LIMIT, isAdmin);

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
