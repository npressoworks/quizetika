'use client';

import React, { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { z } from 'zod';
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

  const chatResult = useChat({
    transport: new DefaultChatTransport({
      api: '/api/quiz/ai-chat-authoring',
      body: {
        userId,
        quizState,
      },
    }),
    onError(err) {
      console.error('[DEBUG useChat onError]', err);
    },
    async onToolCall({ toolCall }) {
      if (!isProUser) return { error: 'pro-required', message: 'Pro機能です' };

      try {
        switch (toolCall.toolName) {
          case 'createQuestion': {
            const args = toolCall.args as any;
            const parsed = questionSchema.safeParse(args.question);
            if (!parsed.success) {
              return { success: false, error: 'validation-failed', message: '問題のスキーマ検証に失敗しました' };
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
            return { success: true, message: '新しい問題を追加しました' };
          }

          case 'updateQuestion': {
            const args = toolCall.args as any;
            const parsedUpdates = questionSchema.partial().safeParse(args.updates);
            if (!parsedUpdates.success || typeof args.id !== 'string') {
              return { success: false, error: 'validation-failed', message: '更新データのスキーマ検証に失敗しました' };
            }

            setQuestions((prev) =>
              prev.map((q) =>
                q.id === args.id ? { ...q, ...parsedUpdates.data } as Question : q
              )
            );
            return { success: true, message: `問題(ID: ${args.id})を更新しました` };
          }

          case 'deleteQuestion': {
            const args = toolCall.args as any;
            if (typeof args.id !== 'string') {
              return { success: false, error: 'invalid-params', message: '問題IDが不正です' };
            }

            setQuestions((prev) => prev.filter((q) => q.id !== args.id));
            return { success: true, message: `問題(ID: ${args.id})を削除しました` };
          }

          case 'generateBulkQuestions': {
            const args = toolCall.args as any;
            const parsedArray = z.array(questionSchema).safeParse(args.questions);
            if (!parsedArray.success) {
              return { success: false, error: 'validation-failed', message: '一括生成データの検証に失敗しました' };
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
            return { success: true, message: `クイズ問題を${newQuestions.length}問一括追加しました` };
          }

          case 'generateThumbnail': {
            const args = toolCall.args as any;
            // 実際の実装ではAI画像生成APIなどを呼び出すが、ここではモック生成URLを即時セットする
            const mockUrl = `/images/ai-generated-${Math.random().toString(36).substring(2, 11)}.jpg`;
            setThumbnailUrl(mockUrl);
            return { success: true, thumbnailUrl: mockUrl, message: 'クイズカバー画像を生成してエディタに適用しました' };
          }

          default:
            return { error: 'unknown-tool', message: '未定義のツールです' };
        }
      } catch (err) {
        console.error('[useAiChatAssistant] Tool handling error:', err);
        return { success: false, error: 'internal-error', message: 'ツール実行中にエラーが発生しました' };
      }
    },
  });

  const {
    messages,
    setMessages,
    status,
    sendMessage,
  } = chatResult;

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
        content: 'クイズ作問アシスタントです！どのようなテーマや難易度のクイズを作成したいですか？\n例：「日本の歴史についての初級クイズ」「世界遺産についての4択クイズ」など、お気軽にお伝えください。',
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
  };
}
