/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAiChatAssistant } from '@/hooks/useAiChatAssistant';

// useChat のモック
const mockAppend = jest.fn();
const mockSetMessages = jest.fn();
const mockHandleInputChange = jest.fn();
const mockHandleSubmit = jest.fn();

jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn().mockImplementation((options) => {
    // onToolCall などをテストから呼び出せるようにモック内でグローバルに保持
    (global as any).lastUseChatOptions = options;
    return {
      messages: [],
      input: '',
      setMessages: mockSetMessages,
      handleInputChange: mockHandleInputChange,
      handleSubmit: mockHandleSubmit,
      isLoading: false,
      append: mockAppend,
    };
  }),
}));

describe('useAiChatAssistant', () => {
  const mockSetQuestions = jest.fn();
  const mockSetTitle = jest.fn();
  const mockSetDescription = jest.fn();
  const mockSetThumbnailUrl = jest.fn();

  const defaultProps = {
    userId: 'uid-pro',
    isProUser: true,
    quizState: {
      title: 'テストクイズ',
      description: 'テストです',
      genre: '一般',
      tags: [],
      questions: [],
      thumbnailUrl: null,
    },
    setQuestions: mockSetQuestions,
    setTitle: mockSetTitle,
    setDescription: mockSetDescription,
    setThumbnailUrl: mockSetThumbnailUrl,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('初期状態とウェルカムメッセージ表示機能', () => {
    const { result } = renderHook(() => useAiChatAssistant(defaultProps));

    expect(result.current.isChatOpen).toBe(false);

    // ウェルカムメッセージトリガー
    act(() => {
      result.current.triggerAuthoringWelcome();
    });

    expect(result.current.isChatOpen).toBe(true);
    expect(mockSetMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('クイズ作問アシスタントです'),
        }),
      ])
    );
  });

  it('triggerQuickAction の呼び出しでチャットを開き append を呼び出す', () => {
    const { result } = renderHook(() => useAiChatAssistant(defaultProps));

    act(() => {
      result.current.triggerQuickAction('check-all');
    });

    expect(result.current.isChatOpen).toBe(true);
    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'user',
        content: expect.stringContaining('すべての問題の包括チェック'),
      })
    );
  });

  it('onToolCall が createQuestion を正しく処理し、setQuestions を更新する', async () => {
    renderHook(() => useAiChatAssistant(defaultProps));

    const options = (global as any).lastUseChatOptions;
    expect(options).toBeDefined();

    // mock createQuestion tool call
    const result = await options.onToolCall({
      toolCall: {
        toolCallId: 'call-1',
        toolName: 'createQuestion',
        args: {
          question: {
            type: 'multiple-choice',
            questionText: '日本の首都は？',
            explanation: '東京です',
          },
        },
      },
    });

    expect(result).toEqual(expect.objectContaining({ success: true }));
    expect(mockSetQuestions).toHaveBeenCalled();
  });
});
