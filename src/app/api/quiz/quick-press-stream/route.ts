import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { quizzesRef } from '@/lib/firebase/firestore';
import { extractBearerToken, verifySupabaseAccessToken } from '@/lib/supabase/auth-verify';
import { assertCanViewQuizAsync, QuizAccessDeniedError } from '@/lib/quiz-access';
import {
  parseMarkdownToQuickPressTokens,
  serializeQuickPressStreamLayout,
  serializeQuickPressStreamToken,
} from '@/lib/quick-press-plain-text';
import { QUICK_PRESS_BODY_CHAR_MS, sleep } from '@/lib/quick-press-stream-config';
import type { Quiz } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz/quick-press-stream?quizId=&questionId=
 * 問題文をパースし、強調フラグ付きトークンを NDJSON で1文字ずつ遅延送信する。
 */
export async function GET(request: NextRequest): Promise<Response> {
  const quizId = request.nextUrl.searchParams.get('quizId');
  const questionId = request.nextUrl.searchParams.get('questionId');

  if (!quizId || !questionId) {
    return NextResponse.json(
      { error: 'missing-params', message: 'quizId と questionId は必須です' },
      { status: 400 }
    );
  }

  try {
    const quizSnap = await getDoc(doc(quizzesRef, quizId));
    if (!quizSnap.exists()) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }

    const quiz = quizSnap.data() as Quiz;

    const token = extractBearerToken(request);
    const viewerUid = token ? await verifySupabaseAccessToken(token) : null;
    try {
      await assertCanViewQuizAsync(quiz, viewerUid);
    } catch (err) {
      if (err instanceof QuizAccessDeniedError) {
        return NextResponse.json({ error: 'QUIZ_ACCESS_DENIED' }, { status: 403 });
      }
      throw err;
    }

    const question = quiz.questions?.find((q) => q.id === questionId);
    if (!question || question.type !== 'quick-press') {
      return NextResponse.json({ error: 'invalid-question' }, { status: 400 });
    }

    const bodyText = question.questionText?.trim() ?? '';
    if (!bodyText) {
      return NextResponse.json({ error: 'empty-question' }, { status: 400 });
    }

    const tokens = parseMarkdownToQuickPressTokens(bodyText);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode(serializeQuickPressStreamLayout(tokens)));
          for (const token of tokens) {
            controller.enqueue(encoder.encode(serializeQuickPressStreamToken(token)));
            await sleep(QUICK_PRESS_BODY_CHAR_MS);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[quick-press-stream]', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
