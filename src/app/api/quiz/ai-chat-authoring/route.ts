import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebase/admin';
import {
  authorizeAiAuthoringRequest,
  type AuthoringAuthFailure,
} from '@/services/ai-authoring-route-helpers';
import {
  PRO_DAILY_CHAT_LIMIT,
  checkDailyAuthoringLimit,
} from '@/services/ai-authoring-utils';

export const maxDuration = 60;

const choiceSchema = z.object({
  id: z.string(),
  choiceText: z.string(),
  isCorrect: z.boolean(),
});

const sortingItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  correctOrder: z.number(),
});

const questionSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    'multiple-choice',
    'true-false',
    'text-input',
    'quick-press',
    'sorting',
    'association',
    'lateral-thinking',
  ]),
  questionText: z.string(),
  explanation: z.string(),
  hint: z.string().nullable().optional(),
  choices: z.array(choiceSchema).optional(),
  correctTextAnswerList: z.array(z.string()).optional(),
  sortingItems: z.array(sortingItemSchema).optional(),
  associationHints: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = await request.json();
    const { userId, messages, quizState } = body as {
      userId?: string;
      messages?: any[];
      quizState?: {
        title: string;
        description: string;
        genre: string;
        tags: string[];
        questions: any[];
      };
    };

    if (!userId || !messages || !quizState) {
      return NextResponse.json(
        { error: 'missing-params', message: 'userId, messages, quizState は必須です' },
        { status: 400 }
      );
    }

    // 最新のユーザーメッセージの長さをチェック
    const latestUserMessage = messages.filter((m: any) => m.role === 'user').pop();
    if (latestUserMessage && typeof latestUserMessage.content === 'string') {
      if (latestUserMessage.content.length > 500) {
        return NextResponse.json(
          { error: 'prompt-too-long', message: 'メッセージは500文字以内で入力してください' },
          { status: 400 }
        );
      }
    }

    // 認可チェック
    const auth = await authorizeAiAuthoringRequest(request, userId);
    if ('status' in auth) {
      const failure = auth as AuthoringAuthFailure;
      return NextResponse.json(
        { error: failure.error, message: failure.message },
        { status: failure.status }
      );
    }

    // レート制限チェック
    const limitCheck = checkDailyAuthoringLimit(
      auth.chatCount,
      PRO_DAILY_CHAT_LIMIT,
      auth.access.skipDailyLimit
    );

    if (limitCheck.exceeded) {
      return NextResponse.json(
        {
          error: 'limit-exceeded',
          message: `本日の AI チャット制限回数（${PRO_DAILY_CHAT_LIMIT}回）に達しました。`,
          usage: limitCheck.usage,
        },
        { status: 429 }
      );
    }

    // トランザクションでチャット回数をインクリメント
    const db = getAdminFirestore();
    const nextCount = auth.chatCount + 1;

    await db.runTransaction(async (transaction) => {
      transaction.set(
        auth.chatCountRef,
        { count: nextCount, lastUpdatedDate: auth.todayStr },
        { merge: true }
      );
    });

    // システムプロンプトの構築
    const systemPrompt = `あなたはクイズ投稿SNS「quizeum」のクイズ作成を支援する優秀なAI作問アシスタントです。
現在のクイズエディタの内容は以下の通りです：
- クイズタイトル: ${quizState.title || '（未入力）'}
- クイズ説明: ${quizState.description || '（未入力）'}
- ジャンル: ${quizState.genre || '（未指定）'}
- タグ: ${quizState.tags?.join(', ') || '（なし）'}
- 現在の問題リスト (${quizState.questions?.length || 0}問):
${JSON.stringify(quizState.questions || [], null, 2)}

【動作ルール】
1. 必ず日本語で回答・対話してください。
2. ユーザーが問題の追加、更新、削除、一括作成、またはサムネイル画像生成を指示した場合は、対応するツールを呼び出してください。
3. ユーザーが問題のチェックやファクトチェックを求めた場合は、指定された問題に対して checkQuestion または checkAllQuestions ツールを呼び出してください。事実確認には googleSearch ツールを連携して使用してください。
4. ツール呼び出しと併せて、どのような操作を行うか、あるいは行ったかをユーザーに日本語で親切に説明してください。`;

    // streamText を呼び出し
    const result = streamText({
      model: google(process.env.GEMINI_MODEL_ID ?? 'gemini-1.5-flash'),
      system: systemPrompt,
      messages,
      maxSteps: 5,
      tools: {
        // 1. 一括生成 (クライアント反映)
        generateBulkQuestions: {
          description: '指定されたテーマやプロンプトに沿って、複数のクイズ問題を一括生成します。通常10問生成されます。',
          parameters: z.object({
            questions: z.array(questionSchema).length(10),
          }),
        },
        // 2. 単一追加 (クライアント反映)
        createQuestion: {
          description: '新しいクイズ問題を1問作成し、エディタの問題リストの末尾に追加します。',
          parameters: z.object({
            question: questionSchema,
          }),
        },
        // 3. 問題更新 (クライアント反映)
        updateQuestion: {
          description: '指定された問題 ID の問題データ（問題文、選択肢、正解、解説など）を指定された新しい内容で更新します。',
          parameters: z.object({
            id: z.string().describe('更新対象の問題ID'),
            updates: questionSchema.partial(),
          }),
        },
        // 4. 問題削除 (クライアント反映)
        deleteQuestion: {
          description: '指定された問題 ID の問題をエディタの問題リストから削除します。',
          parameters: z.object({
            id: z.string().describe('削除対象の問題ID'),
          }),
        },
        // 5. サムネ生成 (クライアント反映)
        generateThumbnail: {
          description: '現在のクイズのタイトルと説明に基づいてクイズカバー画像をAI生成し、エディタに適用します。',
          parameters: z.object({
            prompt: z.string().optional().describe('画像のテーマに関する追加指示'),
          }),
        },
        // 6. 指定問題の包括的チェック (サーバー実行)
        checkQuestion: {
          description: '指定された問題の事実関係（ファクトチェック）、誤字脱字、および表現の不自然さを包括的に検証します。必要に応じて内部で googleSearch ツールを実行します。',
          parameters: z.object({
            id: z.string().describe('チェック対象の問題ID'),
            questionText: z.string().describe('チェック対象の問題文'),
            correctAnswer: z.string().describe('チェック対象の答えテキスト（正解テキストまたは正解選択肢）'),
          }),
          execute: async ({ id, questionText, correctAnswer }) => {
            return {
              checked: true,
              message: `問題 (ID: ${id}) の包括的チェックを開始しました。AIは次に Google 検索等を使用して事実の裏付けを行い、校正・ファクトチェック結果を提示します。`,
            };
          },
        },
        // 7. 全問題の一括包括的チェック (サーバー実行)
        checkAllQuestions: {
          description: 'エディタ上にあるすべての問題について、事実関係、誤字脱字、表現の不自然さを一括して検証します。',
          parameters: z.object({
            questionIds: z.array(z.string()).describe('チェック対象のすべての問題IDの配列'),
          }),
          execute: async ({ questionIds }) => {
            return {
              checked: true,
              message: `全問題 (計 ${questionIds.length} 問) の包括的な一括チェックを開始しました。AIは問題ごとに必要に応じて検索等を行い、チェック結果を整理して提示します。`,
            };
          },
        },
        // 8. Google 検索ツール (サーバー実行)
        googleSearch: {
          description: '事実関係を検証するための情報を Google 検索から取得します。',
          parameters: z.object({
            query: z.string().describe('Google検索クエリ'),
          }),
          execute: async ({ query }) => {
            const results = await fetchGoogleSearchResults(query);
            return {
              query,
              results,
            };
          },
        },
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error('[ai-chat-authoring] 予期しないエラー:', error);
    return NextResponse.json(
      { error: 'internal-error', message: 'サーバー内部エラーが発生しました' },
      { status: 500 }
    );
  }
}

async function fetchGoogleSearchResults(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch DDG search results: ${res.statusText}`);
    }
    const html = await res.text();

    const results: { title: string; url: string; snippet: string }[] = [];
    const resultBlocks = html.split('class="result__body"');

    for (let i = 1; i < resultBlocks.length && results.length < 5; i++) {
      const block = resultBlocks[i];
      const aMatch = block.match(/<a\s+class="result__a"\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/<a\s+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);

      if (aMatch) {
        let rawUrl = aMatch[1];
        if (rawUrl.includes('uddg=')) {
          const searchParams = new URLSearchParams(rawUrl.split('?')[1]);
          rawUrl = searchParams.get('uddg') || rawUrl;
        }

        const title = aMatch[2].replace(/<[^>]+>/g, '').trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        results.push({
          title: decodeHtmlEntities(title),
          url: rawUrl,
          snippet: decodeHtmlEntities(snippet),
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Search extraction error:', error);
    // 検索エラー時は空配列を返却し、ファクトチェック以外の校正機能へフォールバックできるようにする
    return [];
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x60;/g, '`')
    .replace(/&#39;/g, "'");
}

