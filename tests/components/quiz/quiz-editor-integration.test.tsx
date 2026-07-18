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
import { render, screen, fireEvent, act } from '@testing-library/react';
import { QuizEditorContent } from '@/components/quiz/quiz-editor';
import { saveQuiz } from '@/services/quiz';
import { listActiveNgWords } from '@/services/ng-words';
import type { GenreMetadata } from '@/types';

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
  hasAiAuthoringEntitlementsForUser: () => true,
}));

// Firestore / Service のモック
jest.mock('@/services/quiz', () => ({
  getQuiz: jest.fn(),
  saveQuiz: jest.fn(),
  updateQuiz: jest.fn(),
}));

// NGワード一覧取得のモック（既存の公開時プレースホルダー ['spam', 'scam', 'hentai', 'adult', 'porn', 'xxx'] と
// 同等の一覧をデフォルトで解決させ、既存テストの挙動を変えないようにする）
jest.mock('@/services/ng-words', () => ({
  listActiveNgWords: jest.fn().mockResolvedValue(['spam', 'scam', 'hentai', 'adult', 'porn', 'xxx']),
}));

const mockGenre: GenreMetadata = {
  id: 'history-geography',
  displayName: '歴史・地理',
  iconImageUrl: null,
  canonicalId: null,
  mergedGenreIds: [],
  isActive: true,
};

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({ genres: [mockGenre], loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('@/hooks/useActiveTags', () => ({
  useActiveTags: () => ({ tags: [], loading: false, error: null, tagLabelById: new Map(), refetch: jest.fn() }),
}));

/** 公開に必要な最低限の項目（タイトル・ジャンル・問題文）を入力するヘルパー */
async function fillMinimalValidQuiz(questionText: string) {
  fireEvent.change(
    screen.getByPlaceholderText('例: 世界の国旗と首都クイズ'),
    { target: { value: 'テストクイズタイトル' } }
  );

  const genreInput = screen.getByTestId('genre-editor-search-input');
  fireEvent.focus(genreInput);
  const genreOption = await screen.findByTestId('genre-editor-search-option-history-geography');
  fireEvent.click(genreOption);

  const questionTextInput = screen.getByPlaceholderText('例: 日本で一番**高い**山は？');
  fireEvent.change(questionTextInput, { target: { value: questionText } });
}

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

describe('QuizEditor NGワード クライアント側事前検証 (要件32.1, 32.2)', () => {
  const mockListActiveNgWords = listActiveNgWords as jest.Mock;
  const mockSaveQuiz = saveQuiz as jest.Mock;

  beforeEach(() => {
    mockListActiveNgWords.mockReset();
    mockSaveQuiz.mockReset();
    mockSaveQuiz.mockResolvedValue('new-quiz-id');
  });

  it('取得したNGワード一覧に一致する語句が問題文に含まれる場合、送信前にクライアント側で警告が表示され公開されないこと', async () => {
    // 旧実装のハードコード配列 ['spam', 'scam', 'hentai', 'adult', 'porn', 'xxx'] には
    // 存在しない合成語を使い、live-fetch されたサービスの結果でしか検出できないようにする
    mockListActiveNgWords.mockResolvedValue(['zzz-unique-forbidden-word']);

    const originalScrollTo = window.scrollTo;
    window.scrollTo = jest.fn();

    render(
      <QuizEditorContent
        quizId={undefined}
        initialGenres={[mockGenre]}
        initialQuiz={null}
      />
    );

    await fillMinimalValidQuiz('これはzzz-unique-forbidden-wordを含む問題文です');

    const publishButton = screen.getByRole('button', { name: '公開' });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    // NGワード検出によるクライアント側警告が表示される
    expect(
      screen.getByText('不適切なワードが含まれているため公開できません。内容を修正してください')
    ).toBeInTheDocument();

    // サーバーへの送信（公開）は行われない
    expect(mockSaveQuiz).not.toHaveBeenCalled();

    // live-fetch された NG ワードサービスが実際に呼び出されたことを確認する
    // （ハードコード配列へのフォールバックではないことの証拠）
    expect(mockListActiveNgWords).toHaveBeenCalled();

    window.scrollTo = originalScrollTo;
  });

  it('NGワード一覧の取得に失敗しても、クライアント側の事前チェックはスキップされ公開処理がクラッシュ・ブロックされないこと（フェイルオープン、最終防衛線はサーバー側検証）', async () => {
    mockListActiveNgWords.mockRejectedValue(new Error('network error'));

    render(
      <QuizEditorContent
        quizId={undefined}
        initialGenres={[mockGenre]}
        initialQuiz={null}
      />
    );

    await fillMinimalValidQuiz('これはNGワードを含まない問題文です');

    const publishButton = screen.getByRole('button', { name: '公開' });
    await act(async () => {
      fireEvent.click(publishButton);
    });

    // NGワード取得失敗はクライアント側事前チェックのスキップに留まり、
    // NGワード起因のエラー表示は出ない
    expect(
      screen.queryByText('不適切なワードが含まれているため公開できません。内容を修正してください')
    ).not.toBeInTheDocument();

    // 事前チェックがスキップされ、公開処理（サーバー送信）が続行される
    // （＝最終防衛線であるサーバー側検証 saveQuiz に処理が委ねられる）
    expect(mockSaveQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'published' }),
      'published'
    );

    // live-fetch された NG ワードサービスが実際に呼び出され、その失敗によって
    // フェイルオープンしたことを確認する（ハードコード配列へのフォールバックではない）
    expect(mockListActiveNgWords).toHaveBeenCalled();
  });
});
