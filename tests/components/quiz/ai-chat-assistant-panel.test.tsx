/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiChatAssistantPanel } from '@/components/quiz/editor/ai-chat-assistant-panel';
import { AiChatAssistantButton } from '@/components/quiz/editor/ai-chat-assistant-button';

describe('AiChatAssistantButton', () => {
  it('Pro ユーザーでない場合は表示されない', () => {
    const { container } = render(
      <AiChatAssistantButton isCreatorUser={false} isChatOpen={false} onOpen={jest.fn()} onClose={jest.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('Pro ユーザーの場合は表示され、クリックで onOpen を呼ぶ', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    render(
      <AiChatAssistantButton isCreatorUser={true} isChatOpen={false} onOpen={onOpen} onClose={onClose} />
    );

    const button = screen.getByTestId('ai-chat-assistant-button');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    // チャットが閉じている状態でクリックすると onOpen が呼ばれること
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AiChatAssistantPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    messages: [
      { id: '1', role: 'assistant' as const, content: 'こんにちは' },
      { id: '2', role: 'user' as const, content: '作問をお願いします' },
    ],
    input: '',
    isGenerating: false,
    handleInputChange: jest.fn(),
    handleSubmit: jest.fn(),
    chatLimitUsage: { limit: 100, usedToday: 10, remainingToday: 90 },
    // 承認フロー用 Props（デフォルトは空の承認待ち）
    pendingApprovals: {} as Record<string, { toolCallId: string; toolName: string; args: any; resolve: (result: any) => void }>,
    approveToolCall: jest.fn(),
    rejectToolCall: jest.fn(),
    thumbnailGenerations: {} as Record<string, { status: 'generating' | 'ready' | 'error'; imageUrl?: string; errorMessage?: string }>,
    // イントロアクションボタン用
    onSuggest: jest.fn(),
    // リセットボタン用
    onReset: jest.fn(),
  };

  it('非表示の時はレンダリングされない', () => {
    const { container } = render(
      <AiChatAssistantPanel {...defaultProps} isOpen={false} />
    );
    // スライドアウトして非表示にするために DOM 上に存在しつつ visibility や opacity が反映されるか、
    // あるいは単純にマウントされないかのいずれか。
    // 設計書に従い、isOpen === false の場合は表示されない、または data-open="false" 属性となるように検証。
    const panel = container.querySelector('[data-testid="ai-chat-assistant-panel"]');
    if (panel) {
      expect(panel).toHaveAttribute('data-open', 'false');
    }
  });

  it('メッセージ履歴と入力フォームが正しく表示される', () => {
    render(<AiChatAssistantPanel {...defaultProps} />);

    expect(screen.getByText('こんにちは')).toBeInTheDocument();
    expect(screen.getByText('作問をお願いします')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('AIに指示を送る...')).toBeInTheDocument();
    expect(screen.getByText('10/100回使用中')).toBeInTheDocument(); // 利用制限の表記
  });

  it('メッセージ入力欄が textarea（AutoGrowTextarea）として描画される', () => {
    render(<AiChatAssistantPanel {...defaultProps} />);

    const input = screen.getByPlaceholderText('AIに指示を送る...');
    expect(input.tagName).toBe('TEXTAREA');
  });

  it('閉じるボタンのクリックで onClose を呼ぶ', () => {
    const onClose = jest.fn();
    render(<AiChatAssistantPanel {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByTestId('ai-chat-close-button');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('承認待ちのツールがある場合、入力フォームが disabled になること', () => {
    const pendingApprovals = {
      'call-123': {
        toolCallId: 'call-123',
        toolName: 'generateBulkQuestions',
        args: { questions: [{ type: 'multiple-choice', questionText: 'テスト問題', explanation: '解説' }] },
        resolve: jest.fn(),
      },
    };
    render(
      <AiChatAssistantPanel
        {...defaultProps}
        pendingApprovals={pendingApprovals}
        approveToolCall={jest.fn()}
        rejectToolCall={jest.fn()}
      />
    );

    const input = screen.getByPlaceholderText('提案の承認/却下を選択してください');
    expect(input).toBeDisabled();
  });

  it('承認ボタンをクリックすると approveToolCall が呼ばれること', () => {
    const approveToolCall = jest.fn();
    const rejectToolCall = jest.fn();

    // メッセージに toolInvocations を含むモック
    const messagesWithTool = [
      {
        id: 'msg-1',
        role: 'assistant' as const,
        content: 'クイズ問題を一括作成します。',
        toolInvocations: [
          {
            toolCallId: 'call-approve-test',
            toolName: 'generateBulkQuestions',
            args: { questions: [{ type: 'multiple-choice', questionText: '承認テスト問題', explanation: '解説' }] },
            state: 'call' as const,
          },
        ],
      },
    ];

    const pendingApprovals = {
      'call-approve-test': {
        toolCallId: 'call-approve-test',
        toolName: 'generateBulkQuestions',
        args: { questions: [{ type: 'multiple-choice', questionText: '承認テスト問題', explanation: '解説' }] },
        resolve: jest.fn(),
      },
    };

    render(
      <AiChatAssistantPanel
        {...defaultProps}
        messages={messagesWithTool}
        pendingApprovals={pendingApprovals}
        approveToolCall={approveToolCall}
        rejectToolCall={rejectToolCall}
      />
    );

    // 承認待ちラベルの表示確認
    expect(screen.getByText('問題の一括生成の承認待ち…')).toBeInTheDocument();

    // 承認ボタンのクリック
    const approveBtn = screen.getByRole('button', { name: 'フォームに反映する' });

    fireEvent.click(approveBtn);
    expect(approveToolCall).toHaveBeenCalledWith('call-approve-test');
  });

  it('却下ボタンをクリックすると rejectToolCall が呼ばれること', () => {
    const approveToolCall = jest.fn();
    const rejectToolCall = jest.fn();

    const messagesWithTool = [
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: '問題を削除します。',
        toolInvocations: [
          {
            toolCallId: 'call-reject-test',
            toolName: 'deleteQuestions',
            args: { ids: ['q-001'] },
            state: 'call' as const,
          },
        ],
      },
    ];

    const pendingApprovals = {
      'call-reject-test': {
        toolCallId: 'call-reject-test',
        toolName: 'deleteQuestions',
        args: { ids: ['q-001'] },
        resolve: jest.fn(),
      },
    };

    render(
      <AiChatAssistantPanel
        {...defaultProps}
        messages={messagesWithTool}
        pendingApprovals={pendingApprovals}
        approveToolCall={approveToolCall}
        rejectToolCall={rejectToolCall}
      />
    );

    // 却下ボタンのクリック
    const rejectBtn = screen.getByRole('button', { name: 'キャンセル' });
    fireEvent.click(rejectBtn);
    expect(rejectToolCall).toHaveBeenCalledWith('call-reject-test');
  });
});
