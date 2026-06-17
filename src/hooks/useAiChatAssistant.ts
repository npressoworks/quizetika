'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
import { auth } from '@/lib/firebase/config';
import type { Question } from '@/types';

export interface UseAiChatAssistantProps {
  userId?: string;
  isProUser: boolean;
  quizState: {
    title: string;
    description: string;
    genre: string;
    tags: string[];
    questions: Question[];
    thumbnailUrl: string | null;
  };
  setQuestions: React.Dispatch<React.SetStateAction<Question[]>>;
  setTitle: (t: string) => void;
  setDescription: (d: string) => void;
  setThumbnailUrl: (url: string | null) => void;
}

export interface UseAiChatAssistantResult {
  messages: any[];
  input: string;
  isGenerating: boolean;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  triggerQuickAction: (actionType: 'bulk-generate' | 'check-all' | 'check-single', targetQuestionId?: string) => void;
  triggerAuthoringWelcome: () => void;
  openChatWithIntro: () => void;
  pendingApprovals: Record<string, {
    toolCallId: string;
    toolName: string;
    args: any;
    resolve: (result: { success: boolean; message: string; [key: string]: any }) => void;
  }>;
  approveToolCall: (toolCallId: string) => void;
  rejectToolCall: (toolCallId: string) => void;
}

// クライアント側 Zod バリデーション用スキーマ
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

export function useAiChatAssistant({
  userId,
  isProUser,
  quizState,
  setQuestions,
  setTitle,
  setDescription,
  setThumbnailUrl,
}: UseAiChatAssistantProps): UseAiChatAssistantResult {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<Record<string, {
    toolCallId: string;
    toolName: string;
    args: any;
    resolve: (result: any) => void;
  }>>({});
  const pendingResolvesRef = React.useRef<Record<string, (result: any) => void>>({});
  const addToolResultRef = React.useRef<any>(null);

  const userIdRef = React.useRef(userId);
  const quizStateRef = React.useRef(quizState);

  React.useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  React.useEffect(() => {
    quizStateRef.current = quizState;
  }, [quizState]);

  const chatResult = useChat({
    maxSteps: 5,
    transport: new DefaultChatTransport({
      api: '/api/quiz/ai-chat-authoring',
      prepareSendMessagesRequest: ({ messages, id }) => {
        return {
          body: {
            messages,
            id,
            userId: userIdRef.current,
            quizState: quizStateRef.current,
          },
        };
      },
      fetch: async (input, init) => {
        const token = await auth.currentUser?.getIdToken();
        const headers = new Headers(init?.headers);
        if (token) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        return fetch(input, {
          ...init,
          headers,
        });
      },
    }),
    onError(err) {
      console.error('[DEBUG useChat onError]', err);
    },
    async onToolCall({ toolCall }) {
      if (!isProUser) {
        addToolResultRef.current?.({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName as any,
          output: { error: 'pro-required', message: 'Pro機能です' },
        });
        return;
      }

      // 承認フローを必要とするクライアント操作ツール一覧
      const approvalRequiredTools = [
        'createQuestion',
        'updateQuestion',
        'deleteQuestion',
        'generateBulkQuestions',
        'generateThumbnail'
      ];

      // 対象のツールであれば即時解決せず、pendingApprovals に退避して同期的に終了
      if (approvalRequiredTools.includes(toolCall.toolName)) {
        setPendingApprovals((prev) => ({
          ...prev,
          [toolCall.toolCallId]: {
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: toolCall.input,
            resolve: () => {} // 互換性のためのダミー解決関数
          }
        }));
        return;
      }

      try {
        switch (toolCall.toolName) {
          case 'checkQuestion': {
            const args = toolCall.input as any;
            addToolResultRef.current?.({
              toolCallId: toolCall.toolCallId,
              tool: 'checkQuestion' as any,
              output: {
                checked: true,
                message: `問題 (ID: ${args.id}) の包括的チェックを開始しました。AIは次に Google 検索等を使用して事実の裏付けを行い、校正・ファクトチェック結果を提示します。`,
              },
            });
            return;
          }

          case 'checkAllQuestions': {
            const args = toolCall.input as any;
            addToolResultRef.current?.({
              toolCallId: toolCall.toolCallId,
              tool: 'checkAllQuestions' as any,
              output: {
                checked: true,
                message: `全問題 (計 ${args.questionIds?.length || 0} 問) の包括的な一括チェックを開始しました。AIは問題ごとに必要に応じて検索等を行い、チェック結果を整理して提示します。`,
              },
            });
            return;
          }

          case 'googleSearch': {
            // クライアント側でダミー応答として解決（APIルート側で本来executeされるが、フロントエンドでも形式上フォールバック）
            addToolResultRef.current?.({
              toolCallId: toolCall.toolCallId,
              tool: 'googleSearch' as any,
              output: {
                query: (toolCall.input as any).query,
                results: [],
              },
            });
            return;
          }

          default:
            addToolResultRef.current?.({
              toolCallId: toolCall.toolCallId,
              tool: toolCall.toolName as any,
              output: { error: 'unknown-tool', message: '未定義のツールです' },
            });
            return;
        }
      } catch (err) {
        console.error('[useAiChatAssistant] Tool handling error:', err);
        addToolResultRef.current?.({
          toolCallId: toolCall.toolCallId,
          tool: toolCall.toolName as any,
          output: { success: false, error: 'internal-error', message: 'ツール実行中にエラーが発生しました' },
        });
        return;
      }
    },
  });

  const {
    messages,
    setMessages,
    status,
    sendMessage,
    addToolResult,
  } = chatResult;

  // ref に値をセット
  addToolResultRef.current = addToolResult;

  const isGenerating = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    sendMessage({ text: input });
    setInput('');
  };

  // ユーザーが提案された変更を承認（エディタへ反映）した際の処理
  const approveToolCall = (toolCallId: string) => {
    const pending = pendingApprovals[toolCallId];
    const resolvePromise = pendingResolvesRef.current[toolCallId];
    if (!pending) return;

    let resultPayload: any = null;

    try {
      switch (pending.toolName) {
        case 'createQuestion': {
          const args = pending.args as any;
          const parsed = questionSchema.safeParse(args.question);
          if (!parsed.success) {
            resultPayload = { success: false, error: 'validation-failed', message: '問題のスキーマ検証に失敗しました' };
            break;
          }
          const q = parsed.data;
          const newQuestion: Question = {
            ...q,
            id: q.id || Math.random().toString(36).substring(2, 11),
            imageUrl: null,
            limitTime: null,
            correctCount: 0,
            incorrectCount: 0,
          } as Question;
          setQuestions((prev) => [...prev, newQuestion]);
          resultPayload = { success: true, message: '新しい問題を追加しました' };
          break;
        }

        case 'updateQuestion': {
          const args = pending.args as any;
          const parsedUpdates = questionSchema.partial().safeParse(args.updates);
          if (!parsedUpdates.success || typeof args.id !== 'string') {
            resultPayload = { success: false, error: 'validation-failed', message: '更新データのスキーマ検証に失敗しました' };
            break;
          }
          setQuestions((prev) =>
            prev.map((q) =>
              q.id === args.id ? ({ ...q, ...parsedUpdates.data } as Question) : q
            )
          );
          resultPayload = { success: true, message: `問題(ID: ${args.id})を更新しました` };
          break;
        }

        case 'deleteQuestion': {
          const args = pending.args as any;
          if (typeof args.id !== 'string') {
            resultPayload = { success: false, error: 'invalid-params', message: '問題IDが不正です' };
            break;
          }
          setQuestions((prev) => prev.filter((q) => q.id !== args.id));
          resultPayload = { success: true, message: `問題(ID: ${args.id})を削除しました` };
          break;
        }

        case 'generateBulkQuestions': {
          const args = pending.args as any;
          const parsedArray = z.array(questionSchema).safeParse(args.questions);
          if (!parsedArray.success) {
            resultPayload = { success: false, error: 'validation-failed', message: '一括生成データの検証に失敗しました' };
            break;
          }
          const newQuestions = parsedArray.data.map((q) => ({
            ...q,
            id: q.id || Math.random().toString(36).substring(2, 11),
            imageUrl: null,
            limitTime: null,
            correctCount: 0,
            incorrectCount: 0,
          })) as Question[];
          setQuestions((prev) => [...prev, ...newQuestions]);
          resultPayload = { success: true, message: `クイズ問題を${newQuestions.length}問一括追加しました` };
          break;
        }

        case 'generateThumbnail': {
          const mockUrl = `/images/ai-generated-${Math.random().toString(36).substring(2, 11)}.jpg`;
          setThumbnailUrl(mockUrl);
          resultPayload = { success: true, thumbnailUrl: mockUrl, message: 'クイズカバー画像を生成してエディタに適用しました' };
          break;
        }

        default:
          resultPayload = { error: 'unknown-tool', message: '未定義のツールです' };
      }
    } catch (err) {
      console.error('[useAiChatAssistant] Approve tool call error:', err);
      resultPayload = { success: false, error: 'internal-error', message: 'ツール実行中にエラーが発生しました' };
    }

    if (resultPayload) {
      if (resolvePromise) {
        resolvePromise(resultPayload);
        delete pendingResolvesRef.current[toolCallId];
      } else if (pending.resolve) {
        pending.resolve(resultPayload);
      }
      addToolResultRef.current?.({
        toolCallId: toolCallId,
        tool: pending.toolName as any,
        output: resultPayload,
      });
    }

    setPendingApprovals((prev) => {
      const next = { ...prev };
      delete next[toolCallId];
      return next;
    });
  };

  // ユーザーが提案された変更を却下（キャンセル）した際の処理
  const rejectToolCall = (toolCallId: string) => {
    const pending = pendingApprovals[toolCallId];
    const resolvePromise = pendingResolvesRef.current[toolCallId];
    if (!pending) return;

    const resultPayload = { success: false, error: 'rejected', message: 'ユーザーにより却下されました' };
    if (resolvePromise) {
      resolvePromise(resultPayload);
      delete pendingResolvesRef.current[toolCallId];
    } else if (pending.resolve) {
      pending.resolve(resultPayload);
    }
    addToolResultRef.current?.({
      toolCallId: toolCallId,
      tool: pending.toolName as any,
      output: resultPayload,
    });

    setPendingApprovals((prev) => {
      const next = { ...prev };
      delete next[toolCallId];
      return next;
    });
  };

  const triggerQuickAction = (
    actionType: 'bulk-generate' | 'check-all' | 'check-single',
    targetQuestionId?: string
  ) => {
    setIsChatOpen(true);
    let promptText = '';
    
    if (actionType === 'bulk-generate') {
      promptText = 'クイズを10問一括で作成して、フォームに流し込んでください。';
    } else if (actionType === 'check-all') {
      promptText = '現在エディタにあるすべての問題の包括チェック（ファクトチェック・誤字脱字・表現校正）を実行してください。';
    } else if (actionType === 'check-single') {
      promptText = `ID ${targetQuestionId} の問題について、包括チェック（ファクトチェック・誤字脱字・表現校正）を実行してください。`;
    }

    if (promptText) {
      console.log('[DEBUG] calling sendMessage with:', promptText);
      sendMessage({ text: promptText })
        .then(() => console.log('[DEBUG] sendMessage resolved'))
        .catch(err => console.error('[DEBUG] sendMessage failed:', err));
    }
  };

  const triggerAuthoringWelcome = () => {
    setIsChatOpen(true);
    setMessages([
      {
        id: 'welcome-message',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'クイズ作問アシスタントです！どのようなテーマや難易度のクイズを作成したいですか？\n例：「日本の歴史についての初級クイズ」「世界遺産についての4択クイズ」など、お気軽にお伝えください。',
          },
        ],
      },
    ]);
  };

  // アイコンからチャットを開いた場合に表示する「できること」紹介メッセージ
  const openChatWithIntro = () => {
    // すでに会話履歴があれば初期メッセージをセットせずそのまま開く
    if (messages.length > 0) {
      setIsChatOpen(true);
      return;
    }
    setIsChatOpen(true);
    setMessages([
      {
        id: 'intro-message',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'こんにちは！**AI作問アシスタント**です 🎓\n\nクイズ作問をサポートします。以下のことができます：\n\n- 📝 **問題を作成** — テーマを伝えると問題・選択肢を生成します\n- 🔍 **ファクトチェック** — 問題の内容が正確か検証します\n- ✏️ **問題を編集・修正** — 既存の問題をブラッシュアップします\n- 🗑️ **問題を削除** — 不要な問題を取り除きます\n- 🖼️ **サムネイル画像を生成** — クイズのカバー画像をAIで作成します\n\nなんでもお気軽にどうぞ！',
          },
        ],
      },
    ]);
  };

  return {
    messages,
    input,
    isGenerating,
    isChatOpen,
    setIsChatOpen,
    handleInputChange,
    handleSubmit,
    triggerQuickAction,
    triggerAuthoringWelcome,
    openChatWithIntro,
    pendingApprovals,
    approveToolCall,
    rejectToolCall,
  };
}
