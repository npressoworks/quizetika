import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { quizzesRef } from '@/lib/firebase/firestore';
import { QUICK_PRESS_BODY_CHAR_MS, sleep } from '@/lib/quick-press-stream-config';
import type { Question, Quiz } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz/quick-press-stream?quizId=&questionId=
 * 問題文本文（マークダウンソース）を1文字ずつ遅延送信し、先読みを防ぐ。
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
    if (quiz.status !== 'published') {
      return NextResponse.json({ error: 'not-published' }, { status: 403 });
    }

    const question = quiz.questions?.find((q) => q.id === questionId);
    if (!question || question.type !== 'quick-press') {
      return NextResponse.json({ error: 'invalid-question' }, { status: 400 });
    }

    const bodyText = question.questionText?.trim() ?? '';
    if (!bodyText) {
      return NextResponse.json({ error: 'empty-question' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const characters = Array.from(bodyText);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for (const char of characters) {
            controller.enqueue(encoder.encode(char));
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
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[quick-press-stream]', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
