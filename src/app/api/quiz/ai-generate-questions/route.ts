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
  // 選択肢スキーマ（複数選択式用）
  const choicesSchema: Schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        choiceText: { type: SchemaType.STRING },
        isCorrect: { type: SchemaType.BOOLEAN },
      },
      required: ['choiceText', 'isCorrect'],
    },
  };

  // 選択肢スキーマ（〇✕形式用）
  const trueFalseChoicesSchema: Schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        choiceText: { type: SchemaType.STRING, enum: ['〇', '✕'], format: 'enum' as const },
        isCorrect: { type: SchemaType.BOOLEAN },
      },
      required: ['choiceText', 'isCorrect'],
    },
  };

  // 正解テキストスキーマ（記述式、早押し、連想用）
  const correctTextAnswerListSchema: Schema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.STRING },
  };

  // 並び替え要素スキーマ（並び替え用）
  const sortingItemsSchema: Schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        text: { type: SchemaType.STRING },
        correctOrder: { type: SchemaType.INTEGER },
      },
      required: ['text', 'correctOrder'],
    },
  };

  // 連想ヒントスキーマ（連想用）
  const associationHintsSchema: Schema = {
    type: SchemaType.ARRAY,
    items: { type: SchemaType.STRING },
  };

  // 各問題タイプの定義マップ
  const schemas = {
    'multiple-choice': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['multiple-choice', 'true-false'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        choices: choicesSchema,
      },
      required: ['type', 'questionText', 'explanation', 'choices'],
    },
    'true-false': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['true-false'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        choices: trueFalseChoicesSchema,
      },
      required: ['type', 'questionText', 'explanation', 'choices'],
    },
    'text-input': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['text-input'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        correctTextAnswerList: correctTextAnswerListSchema,
      },
      required: ['type', 'questionText', 'explanation', 'correctTextAnswerList'],
    },
    'quick-press': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['quick-press'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        correctTextAnswerList: correctTextAnswerListSchema,
      },
      required: ['type', 'questionText', 'explanation', 'correctTextAnswerList'],
    },
    'sorting': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['sorting'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        sortingItems: sortingItemsSchema,
      },
      required: ['type', 'questionText', 'explanation', 'sortingItems'],
    },
    'association': {
      type: SchemaType.OBJECT,
      properties: {
        type: { type: SchemaType.STRING, enum: ['association'], format: 'enum' as const },
        questionText: { type: SchemaType.STRING },
        explanation: { type: SchemaType.STRING },
        hint: { type: SchemaType.STRING, nullable: true },
        associationHints: associationHintsSchema,
        correctTextAnswerList: correctTextAnswerListSchema,
      },
      required: ['type', 'questionText', 'explanation', 'associationHints', 'correctTextAnswerList'],
    },
  };

  // mixed 形式の場合は anyOf で 4つの許容される個別スキーマを定義する
  if (format === 'mixed') {
    const mcSchemaForMixed = {
      ...schemas['multiple-choice'],
      properties: {
        ...schemas['multiple-choice'].properties,
        type: { type: SchemaType.STRING, enum: ['multiple-choice'], format: 'enum' as const },
      },
    };
    return {
      type: SchemaType.OBJECT,
      anyOf: [
        mcSchemaForMixed,
        schemas['true-false'],
        schemas['text-input'],
        schemas['sorting'],
      ],
    } as unknown as Schema;
  }

  const targetSchema = (schemas as Record<string, any>)[format];
  if (!targetSchema) {
    throw new Error(`Unsupported quiz format for schema generation: ${format}`);
  }
  return targetSchema as Schema;
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
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
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
