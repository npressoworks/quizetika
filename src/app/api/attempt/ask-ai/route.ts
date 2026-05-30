/**
 * AI質問判定API Route
 * POST /api/attempt/ask-ai
 *
 * 処理フロー:
 * 1. 認証トークンを検証
 * 2. Firestore から現在の attempt を取得し、キャッシュ照合
 * 3. キャッシュヒット → AI呼び出しなし、ターン消費なしで即時返却
 * 4. 無料ユーザーの1日20回質問制限チェック (dailyAiTurnCounts による日付別管理)
 * 5. Gemini API に質問を送信（ステートレス）
 * 6. 結果を attempt の aiQuestionsHistory にアトミック追加、および制限カウンターの更新
 *
 * Requirements: 4.1, 4.2, 4.3
 * Boundary: AskAiQuestionAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { collection, doc, getDoc, updateDoc, setDoc, arrayUnion, increment, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import {
  findCachedAnswer,
  isAiTurnLimitExceeded,
  buildAiPrompt,
  parseAiResponse,
  mapHistoryToGeminiContents,
  buildAiSystemInstruction,
} from '@/services/ask-ai-utils';
import { AiQuestion, Attempt, Quiz } from '@/types';
import { extractBearerToken, verifyFirebaseIdToken } from '@/lib/firebase/auth-verify';

/** Gemini API クライアント（サーバーサイドでのみ使用） */
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

/** Attempts コレクション参照 */
const attemptsCollection = collection(db, 'attempts');

/** Quizzes コレクション参照 */
const quizzesCollection = collection(db, 'quizzes');

/**
 * 日本時間の今日の日付文字列 (YYYY-MM-DD) を取得するヘルパー
 */
function getTodayString(): string {
  const d = new Date();
  // 日本標準時 (JST) での日付を YYYY-MM-DD フォーマットで取得
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(d.getTime() + jstOffset);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // ── リクエストボディのパース ────────────────────────────
    const body = await request.json();
    const { attemptId, questionText, userId } = body as {
      attemptId: string;
      questionText: string;
      userId: string;
    };

    // 入力バリデーション
    if (!attemptId || !questionText || !userId) {
      return NextResponse.json(
        { error: 'missing-params', message: 'attemptId, questionText, userId は必須です' },
        { status: 400 }
      );
    }

    if (questionText.length > 100) {
      return NextResponse.json(
        { error: 'question-too-long', message: '質問は100文字以内で入力してください' },
        { status: 400 }
      );
    }

    // ── トークン検証による認証チェック ────────────────────
    const token = extractBearerToken(request);
    const verifiedUid = await verifyFirebaseIdToken(token, userId);

    if (!verifiedUid || verifiedUid !== userId) {
      console.warn(`[ask-ai] 認証に失敗しました。要求userId: ${userId}, 検証UID: ${verifiedUid}`);
      return NextResponse.json(
        { error: 'unauthorized', message: '認証に失敗したか、本人の操作ではありません' },
        { status: 401 }
      );
    }

    // ── 認証済みのUIDを元にデータベースから安全にプレミアム状態を解決 ──
    let isPremium = false;
    try {
      const userDocRef = doc(db, 'users', verifiedUid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const userData = userSnap.data();
        isPremium = userData.isPremium === true || ['moderator', 'senior_moderator'].includes(userData.moderationTier);
      }
    } catch (dbErr) {
      console.error('[ask-ai] ユーザープレミアム情報の解決エラー (非致命的):', dbErr);
    }

    // ── Attempt ドキュメントを取得 ──────────────────────────
    const attemptRef = doc(attemptsCollection, attemptId);
    const attemptSnap = await getDoc(attemptRef);

    if (!attemptSnap.exists()) {
      return NextResponse.json(
        { error: 'attempt-not-found', message: '対象 of プレイ記録が見つかりません' },
        { status: 404 }
      );
    }

    const attempt = attemptSnap.data() as Attempt;

    // セキュリティ: 本人のAttemptのみ操作可能
    if (attempt.userId !== verifiedUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: '他のユーザーのプレイ記録は操作できません' },
        { status: 403 }
      );
    }

    const history: AiQuestion[] = attempt.aiQuestionsHistory ?? [];

    // ── キャッシュ検索（同一質問は AI を呼ばず即時返却）────
    const cached = findCachedAnswer(questionText, history);
    if (cached) {
      return NextResponse.json({
        answerType: cached.answerType,
        aiComment: cached.aiComment,
        isFromCache: true,
        turnsRemaining: null,
      });
    }

    // ── 1日同一クイズ20回制限チェック ────────────────────────
    const todayStr = getTodayString();
    const dailyCountDocRef = doc(db, 'users', userId, 'dailyAiTurnCounts', attempt.quizId);
    const dailyCountSnap = await getDoc(dailyCountDocRef);

    let currentDailyCount = 0;
    if (dailyCountSnap.exists()) {
      const dailyData = dailyCountSnap.data() as { count: number; lastUpdatedDate: string };
      if (dailyData.lastUpdatedDate === todayStr) {
        currentDailyCount = dailyData.count;
      }
    }

    if (isAiTurnLimitExceeded(currentDailyCount, isPremium ?? false)) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          message: '本日のこのクイズに対する質問上限（20回）に達しました。プレミアムプランで制限を解除できます。',
        },
        { status: 429 }
      );
    }

    // ── クイズの裏設定を取得 ────────────────────────────────
    const quizRef = doc(quizzesCollection, attempt.quizId);
    const quizSnap = await getDoc(quizRef);

    if (!quizSnap.exists()) {
      return NextResponse.json(
        { error: 'quiz-not-found', message: 'クイズが見つかりません' },
        { status: 404 }
      );
    }

    const quiz = quizSnap.data() as Quiz;
    const lateralQuestion = quiz.questions.find((q) => q.type === 'lateral-thinking');
    const aiContextDetails = lateralQuestion?.aiContextDetails;

    if (!aiContextDetails) {
      return NextResponse.json(
        { error: 'no-context', message: 'このクイズはAI判定に対応していません' },
        { status: 400 }
      );
    }

    // ── Gemini API に質問を送信（会話履歴を含めたステートフル対話）──
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash-latest',
      systemInstruction: buildAiSystemInstruction(aiContextDetails),
    });

    const mappedHistory = mapHistoryToGeminiContents(history);
    const chat = model.startChat({
      history: mappedHistory,
      generationConfig: {
        maxOutputTokens: 200,
      },
    });

    let answerType: AiQuestion['answerType'] = 'unknown';
    let aiComment = '判断できませんでした。';

    try {
      const result = await chat.sendMessage(questionText);
      const responseText = result.response.text();
      const parsed = parseAiResponse(responseText);
      answerType = parsed.answerType;
      aiComment = parsed.aiComment;
    } catch (aiError) {
      console.error('[ask-ai] Gemini API エラー:', aiError);
      return NextResponse.json({
        answerType: 'unknown',
        aiComment: 'AIが応答できませんでした。もう一度お試しください。',
        isFromCache: false,
        turnsRemaining: null,
      });
    }

    // ── 結果を アトミックトランザクションで保存 ─────────────────
    const newEntry: AiQuestion = {
      id: `${attemptId}_${Date.now()}`,
      questionText,
      answerType,
      aiComment,
      isFromCache: false,
      createdAt: new Date(),
    };

    await runTransaction(db, async (transaction) => {
      // 1. attempt の対話履歴と質問数インクリメント
      transaction.update(attemptRef, {
        aiQuestionsHistory: arrayUnion(newEntry),
        aiTurnCount: increment(1),
      });

      // 2. 1日20回制限のカウンタをインクリメント・本日日付に更新
      transaction.set(
        dailyCountDocRef,
        {
          count: increment(1),
          lastUpdatedDate: todayStr,
        },
        { merge: true }
      );
    });

    const newTurnCount = currentDailyCount + 1;
    const turnsRemaining = isPremium
      ? null
      : Math.max(0, 20 - newTurnCount);

    return NextResponse.json({
      answerType,
      aiComment,
      isFromCache: false,
      turnsRemaining,
    });
  } catch (error) {
    console.error('[ask-ai] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}
