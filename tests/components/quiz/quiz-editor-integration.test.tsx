/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';

// Polyfill for TransformStream and TextEncoder in jsdom/node test environment
if (typeof global.TransformStream === 'undefined') {
  const { TransformStream } = require('node:stream/web');
  global.TransformStream = TransformStream;
}
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('node:util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
import { render, screen } from '@testing-library/react';
import { QuizEditorContent } from '@/components/quiz/quiz-editor';

const mockSearchParams = new URLSearchParams();
const mockUser = { id: 'uid-pro', displayName: 'Pro User', avatarUrl: '' };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };

// Auth / Router などのモック
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
  }),
}));

jest.mock('@/lib/pricing-entitlement', () => ({
  hasUnlimitedAiQuestionsForUser: () => true, // Proユーザーに設定
}));

// Firestore / Service のモック
jest.mock('@/services/quiz', () => ({
  getQuiz: jest.fn(),
  saveQuiz: jest.fn(),
  updateQuiz: jest.fn(),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({ genres: [], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({ tags: [], loading: false, error: null, tagLabelById: new Map(), refetch: jest.fn() }),
}));

describe('QuizEditor AI Chat Integration', () => {
  it('Pro ユーザー向けに「AIで作問開始」と「全問包括チェック」ボタンが表示されること', () => {
    render(
      <QuizEditorContent
        quizId={undefined}
        initialGenres={[]}
        initialQuiz={null}
      />
    );

    // まだ quiz-editor.tsx に追加していないため、このテストは失敗する（RED）
    expect(screen.getByRole('button', { name: 'AIで作問開始' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全問包括チェック' })).toBeInTheDocument();
  });
});

describe('QuizEditor Validation Auto Expand', () => {
  it('バリデーションエラーが発生した際、折りたたまれていた問題カードが自動的に展開されること', async () => {
    // window.scrollTo と scrollIntoView をモック
    const originalScrollTo = window.scrollTo;
    window.scrollTo = jest.fn();
    const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = jest.fn();

    render(
      <QuizEditorContent
        quizId={undefined}
        initialGenres={[]}
        initialQuiz={null}
      />
    );

    // 初期状態では1つの問題があり、展開されている（aria-expanded="true"）
    const toggleButton = screen.getByTitle('折りたたむ');
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('問題文（必須）')).toBeInTheDocument();

    // 問題カードを折りたたむ
    const { fireEvent, act } = require('@testing-library/react');
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('問題文（必須）')).not.toBeInTheDocument();

    // 「公開」ボタンをクリックしてバリデーションを実行する
    const publishButton = screen.getByRole('button', { name: '公開' });
    
    await act(async () => {
      fireEvent.click(publishButton);
    });

    // バリデーションエラー（問題文未入力）が発生し、問題カードが自動展開されるはず
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('問題文（必須）')).toBeInTheDocument();

    // 元に戻す
    window.scrollTo = originalScrollTo;
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });
});
