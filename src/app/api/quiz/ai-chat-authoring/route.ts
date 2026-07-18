import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool, stepCountIs, convertToModelMessages } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { incrementDailyUsageCount } from '@/lib/daily-usage-counters';

const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || 'dummy-api-key-for-tests',
});
import {
  authorizeAiAuthoringRequest,
  type AuthoringAuthFailure,
} from '@/services/ai-authoring-route-helpers';
import {
  PRO_DAILY_CHAT_LIMIT,
  DAILY_AUTHORING_DOC_CHAT,
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

    // チャット回数をインクリメント
    await incrementDailyUsageCount(auth.supabase, auth.access.uid, DAILY_AUTHORING_DOC_CHAT, auth.todayStr);

    // システムプロンプトの構築
    const systemPrompt = `あなたはクイズ投稿SNS「quizetika」のクイズ作成を支援する優秀なAI作問アシスタントです。
現在のクイズエディタの内容は以下の通りです：
- クイズタイトル: ${quizState.title || '（未入力）'}
- クイズ説明: ${quizState.description || '（未入力）'}
- ジャンル: ${quizState.genre || '（未指定）'}
- タグ: ${quizState.tags?.join(', ') || '（なし）'}
- 現在の問題リスト (${quizState.questions?.length || 0}問):
${JSON.stringify(quizState.questions || [], null, 2)}

【動作ルール】
1. 必ず日本語で回答・対話してください。
2. ユーザーが問題の作成・追加・一括生成を指示した場合は generateBulkQuestions ツールを呼び出してください。1問でも generateBulkQuestions を使用してください。問題数の指定がなければ1問生成してください。上限は10問です。
3. ユーザーが問題の更新・編集を指示した場合は updateQuestion ツールを呼び出してください。「1問目」「2番目」など番号で指定された場合は questionIndex を使用し、IDで指定された場合は id を使用してください。
4. ユーザーが問題の削除を指示した場合は deleteQuestions ツールを呼び出してください。1問の削除でも複数問の削除でもこのツールを使用します。番号指定は questionIndexes、ID指定は ids を使用してください。
5. ユーザーがサムネイル・カバー画像の生成を指示した場合は generateThumbnail ツールを呼び出してください。クイズのタイトル・説明を自動的に参照します。ユーザーの追加指示があれば userInstruction に含めてください。
6. ユーザーが問題のチェックやファクトチェックを求めた場合は、指定された問題に対して checkQuestion または checkAllQuestions ツールを呼び出してください。事実確認には googleSearch ツールを連携して使用してください。
7. ツール呼び出しと併せて、どのような操作を行うか、あるいは行ったかをユーザーに日本語で親切に説明してください。`;

    // streamText を呼び出し
    const result = streamText({
      model: googleProvider(process.env.GEMINI_MODEL_ID ?? 'gemini-3.1-flash-lite'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      tools: {
        // 1. 問題作成・一括生成 (クライアント反映) — 1〜10問の任意数に対応
        generateBulkQuestions: tool({
          description: '指定されたテーマ・条件に沿って1〜10問のクイズ問題を生成します。1問作成でも複数問作成でもこのツールを使用してください。ユーザーが問題数を指定した場合はその数、指定がない場合は1問生成してください。',
          inputSchema: z.object({
            questions: z.array(questionSchema).min(1).max(10).describe('生成する問題の配列（1〜10問）'),
          }),
        }),
        // 2. 問題更新 (クライアント反映)
        updateQuestion: tool({
          description: '指定された問題（問題番号またはIDで指定）の内容を更新します。「1問目」「2番目」など番号で指定された場合は questionIndex、IDで指定された場合は id を使用してください。',
          inputSchema: z.object({
            id: z.string().optional().describe('更新対象の問題ID（IDで指定する場合）'),
            questionIndex: z.number().int().min(1).optional().describe('更新対象の問題番号（1始まり）。例: 1問目なら1'),
            updates: questionSchema.partial().describe('更新する内容'),
          }),
        }),
        // 3. 問題削除 (クライアント反映)
        deleteQuestions: tool({
          description: '指定された問題（問題番号またはIDで指定）をエディタから削除します。1問のみの削除でも複数問まとめての削除でもこのツールを使用してください。「1問目と3問目」など番号で指定された場合は questionIndexes、IDで指定された場合は ids を使用してください。',
          inputSchema: z.object({
            ids: z.array(z.string()).optional().describe('削除対象の問題IDの配列（IDで指定する場合）'),
            questionIndexes: z.array(z.number().int().min(1)).optional().describe('削除対象の問題番号の配列（1始まり）。例: 1問目なら1'),
          }),
        }),
        // 4. サムネイル生成 (クライアント反映)
        generateThumbnail: tool({
          description: '現在のクイズのタイトル・説明文・ユーザーの追加指示をもとにクイズカバー画像をAI生成し、エディタに適用します。',
          inputSchema: z.object({
            userInstruction: z.string().optional().describe('ユーザーからの追加指示（テーマ・色・スタイルなど）'),
          }),
        }),
        // 5. 指定問題の包括的チェック (サーバー実行)
        checkQuestion: tool({
          description: '指定された問題の事実関係（ファクトチェック）、誤字脱字、および表現の不自然さを包括的に検証します。必要に応じて内部で googleSearch ツールを実行します。',
          inputSchema: z.object({
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
        }),
        // 6. 全問題の一括包括的チェック (サーバー実行)
        checkAllQuestions: tool({
          description: 'エディタ上にあるすべての問題について、事実関係、誤字脱字、表現の不自然さを一括して検証します。',
          inputSchema: z.object({
            questionIds: z.array(z.string()).describe('チェック対象のすべての問題IDの配列'),
          }),
          execute: async ({ questionIds }) => {
            return {
              checked: true,
              message: `全問題 (計 ${questionIds.length} 問) の包括的な一括チェックを開始しました。AIは問題ごとに必要に応じて検索等を行い、チェック結果を整理して提示します。`,
            };
          },
        }),
        // 7. Google 検索ツール (サーバー実行)
        googleSearch: tool({
          description: '事実関係を検証するための情報を Google 検索から取得します。',
          inputSchema: z.object({
            query: z.string().describe('Google検索クエリ'),
          }),
          execute: async ({ query }) => {
            const results = await fetchGoogleSearchResults(query);
            return {
              query,
              results,
            };
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse();
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
