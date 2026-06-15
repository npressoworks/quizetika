import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import {
  authorizeAiAuthoringRequest,
  type AuthoringAuthFailure,
} from '@/services/ai-authoring-route-helpers';
import {
  AI_QUIZ_PROMPT_MAX_LENGTH,
  AI_QUIZ_QUESTION_COUNT,
  PRO_DAILY_QUESTION_GENERATION_LIMIT,
  MIXED_ALLOWED_QUESTION_TYPES,
  buildAiQuizGenerationPrompt,
  checkDailyAuthoringLimit,
  mapAiJsonToQuestions,
} from '@/services/ai-authoring-utils';
import { validateGeneratedQuestions } from '@/services/quiz-validation';
import type { QuizFormat } from '@/lib/quiz-format';
import { getAdminFirestore } from '@/lib/firebase/admin';

export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const MIXED_TYPE_ENUM = MIXED_ALLOWED_QUESTION_TYPES as unknown as string[];

function buildQuestionItemSchema(format: QuizFormat): Schema {
  const typeEnum =
    format === 'mixed'
      ? MIXED_TYPE_ENUM
      : format === 'multiple-choice'
        ? ['multiple-choice', 'true-false']
        : [format];

  return {
    type: SchemaType.OBJECT,
    properties: {
      type: { type: SchemaType.STRING, enum: typeEnum },
      questionText: { type: SchemaType.STRING },
      explanation: { type: SchemaType.STRING },
      hint: { type: SchemaType.STRING, nullable: true },
      choices: {
        type: SchemaType.ARRAY,
        nullable: true,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            choiceText: { type: SchemaType.STRING },
            isCorrect: { type: SchemaType.BOOLEAN },
          },
          required: ['choiceText', 'isCorrect'],
        },
      },
      correctTextAnswerList: {
        type: SchemaType.ARRAY,
        nullable: true,
        items: { type: SchemaType.STRING },
      },
      sortingItems: {
        type: SchemaType.ARRAY,
        nullable: true,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            text: { type: SchemaType.STRING },
            correctOrder: { type: SchemaType.INTEGER },
          },
          required: ['text', 'correctOrder'],
        },
      },
      associationHints: {
        type: SchemaType.ARRAY,
        nullable: true,
        items: { type: SchemaType.STRING },
      },
    },
    required: ['type', 'questionText', 'explanation'],
  } as unknown as Schema;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { prompt, format, title, description, genre, userId } = body as {
      prompt?: string;
      format?: QuizFormat;
      title?: string;
      description?: string;
      genre?: string;
      userId?: string;
    };

    if (!prompt || !format || !userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'prompt, format, userId は必須です' },
        { status: 400 }
      );
    }

    if (format === 'lateral-thinking') {
      return NextResponse.json(
        { error: 'invalid-format', message: '水平思考形式では AI 一括作問は未対応です' },
        { status: 400 }
      );
    }

    if (prompt.length > AI_QUIZ_PROMPT_MAX_LENGTH) {
      return NextResponse.json(
        {
          error: 'prompt-too-long',
          message: `プロンプトは${AI_QUIZ_PROMPT_MAX_LENGTH}文字以内で入力してください`,
        },
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
      auth.questionsCount,
      PRO_DAILY_QUESTION_GENERATION_LIMIT,
      auth.access.skipDailyLimit
    );

    if (limitCheck.exceeded) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          message: `本日の AI 作問上限（${PRO_DAILY_QUESTION_GENERATION_LIMIT}回）に達しました`,
          usage: limitCheck.usage,
        },
        { status: 429 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash-latest',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: buildQuestionItemSchema(format),
          minItems: AI_QUIZ_QUESTION_COUNT,
          maxItems: AI_QUIZ_QUESTION_COUNT,
        },
      },
    });

    let parsedJson: unknown;
    try {
      const userPrompt = buildAiQuizGenerationPrompt({
        prompt,
        format,
        title,
        description,
        genre,
      });
      const result = await model.generateContent(userPrompt);
      const text = result.response.text();
      parsedJson = JSON.parse(text);
    } catch (aiError) {
      console.error('[ai-generate-questions] Gemini API エラー:', aiError);
      return NextResponse.json(
        { error: 'ai-unavailable', message: 'AI が応答できませんでした。しばらくしてから再度お試しください' },
        { status: 503 }
      );
    }

    let questions;
    try {
      questions = mapAiJsonToQuestions(parsedJson, format);
    } catch (mapError) {
      console.error('[ai-generate-questions] マッピングエラー:', mapError);
      return NextResponse.json(
        { error: 'validation-failed', message: 'AI が生成した問題の形式が不正です' },
        { status: 422 }
      );
    }

    const validationErrors = validateGeneratedQuestions(questions, format);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'validation-failed',
          message: 'AI が生成した問題が検証に合格しませんでした',
          details: validationErrors,
        },
        { status: 422 }
      );
    }

    const db = getAdminFirestore();
    const nextCount = auth.questionsCount + 1;

    await db.runTransaction(async (transaction) => {
      transaction.set(
        auth.questionsCountRef,
        { count: nextCount, lastUpdatedDate: auth.todayStr },
        { merge: true }
      );
    });

    const afterLimit = checkDailyAuthoringLimit(
      nextCount,
      PRO_DAILY_QUESTION_GENERATION_LIMIT,
      auth.access.skipDailyLimit
    );

    return NextResponse.json({
      questions,
      usage: afterLimit.usage,
    });
  } catch (error) {
    console.error('[ai-generate-questions] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
