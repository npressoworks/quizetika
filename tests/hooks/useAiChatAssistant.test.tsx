/**
 * @jest-environment jsdom
 */
if (typeof global.TransformStream === 'undefined') {
  const { TransformStream, ReadableStream, WritableStream } = require('node:stream/web');
  global.TransformStream = TransformStream;
  global.ReadableStream = ReadableStream;
  global.WritableStream = WritableStream;
}
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

import '@testing-library/jest-dom';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useAiChatAssistant } from '@/hooks/useAiChatAssistant';

// Firebase config のモック
jest.mock('@/lib/firebase/config', () => ({
  auth: {
    currentUser: {
      getIdToken: jest.fn().mockResolvedValue('mock-token'),
    },
  },
}));

// useChat のモック
const mockSendMessage = jest.fn().mockResolvedValue(undefined);
const mockSetMessages = jest.fn();
const mockAddToolResult = jest.fn();

jest.mock('@ai-sdk/react', () => ({
  useChat: jest.fn().mockImplementation((options) => {
    // onToolCall などをテストから呼び出せるようにモック内でグローバルに保持
    (global as any).lastUseChatOptions = options;
    return {
      messages: [],
      status: 'ready',
      setMessages: mockSetMessages,
      sendMessage: mockSendMessage,
      addToolResult: mockAddToolResult,
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
          parts: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              text: expect.stringContaining('クイズ作問アシスタントです'),
            }),
          ]),
        }),
      ])
    );
  });

  it('triggerQuickAction の呼び出しでチャットを開き sendMessage を呼び出す', () => {
    const { result } = renderHook(() => useAiChatAssistant(defaultProps));

    act(() => {
      result.current.triggerQuickAction('check-all');
    });

    expect(result.current.isChatOpen).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('すべての問題の包括チェック'),
      })
    );
  });

  it('onToolCall が checkQuestion などの即時解決ツールを正しく処理して addToolResult を呼ぶ', async () => {
    renderHook(() => useAiChatAssistant(defaultProps));

    const options = (global as any).lastUseChatOptions;
    expect(options).toBeDefined();

    await options.onToolCall({
      toolCall: {
        toolCallId: 'call-check',
        toolName: 'checkQuestion',
        input: {
          id: 'q-1',
          questionText: 'テスト問題',
          correctAnswer: '正解',
        },
      },
    });

    expect(mockAddToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-check',
        tool: 'checkQuestion',
        output: expect.objectContaining({ checked: true }),
      })
    );
  });

  it('onToolCall が generateBulkQuestions などの承認必要ツールを受け取ると保留状態になり、approve で setQuestions が呼ばれる', async () => {
    const { result } = renderHook(() => useAiChatAssistant(defaultProps));

    const options = (global as any).lastUseChatOptions;
    expect(options).toBeDefined();

    // ツールコールが発生
    await act(async () => {
      await options.onToolCall({
        toolCall: {
          toolCallId: 'call-bulk',
          toolName: 'generateBulkQuestions',
          input: {
            questions: [
              {
                type: 'multiple-choice',
                questionText: '日本の首都は？',
                explanation: '東京です',
              },
            ],
          },
        },
      });
    });

    // 保留状態に追加されていることを確認
    expect(result.current.pendingApprovals['call-bulk']).toBeDefined();
    expect(result.current.pendingApprovals['call-bulk'].toolName).toBe('generateBulkQuestions');

    // 承認を実行
    act(() => {
      result.current.approveToolCall('call-bulk');
    });

    // setQuestions と addToolResult が走っていることを確認
    expect(mockSetQuestions).toHaveBeenCalled();
    expect(mockAddToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        toolCallId: 'call-bulk',
        tool: 'generateBulkQuestions',
        output: expect.objectContaining({ success: true }),
      })
    );
    // 保留から消えていること
    expect(result.current.pendingApprovals['call-bulk']).toBeUndefined();
  });
});

