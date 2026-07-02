/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { QuizCarousel } from '@/components/explore/quiz-carousel';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    firebaseUser: { uid: 'user-1' },
    loading: false,
  }),
}));

jest.mock('@/services/bookmark', () => ({
  isBookmarked: jest.fn().mockResolvedValue(false),
  toggleBookmark: jest.fn().mockResolvedValue(undefined),
  getBookmarkedQuizIds: jest.fn().mockResolvedValue(['quiz-1']),
}));

const mockQuizzes: any = [
  {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'テスト作者',
    title: 'JavaScript 基礎クイズ',
    description: 'JSの基礎知識を問います',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'programming',
    tags: ['js'],
    questionCount: 10,
    status: 'published' as const,
    playCount: 10,
    bookmarksCount: 3,
    reviewScore: 4.5,
    questions: [],
    questionIds: [],
  },
  {
    id: 'quiz-2',
    authorId: 'author-2',
    authorName: '作者2',
    title: '歴史クイズ',
    description: '歴史の問題',
    thumbnailUrl: null,
    difficulty: 2,
    genre: 'history',
    tags: [],
    questionCount: 5,
    status: 'published' as const,
    playCount: 5,
    bookmarksCount: 1,
    questions: [],
    questionIds: [],
  },
];

describe('QuizCarousel', () => {
  it('クイズ一覧を横スクロールカルーセルで描画する', () => {
    render(
      <QuizCarousel
        quizzes={mockQuizzes}
        loading={false}
        error={null}
      />
    );

    const carousel = screen.getByTestId('quiz-carousel');
    expect(carousel).toBeInTheDocument();
    expect(screen.getAllByTestId('quiz-card')).toHaveLength(2);
    expect(screen.getByText('JavaScript 基礎クイズ')).toBeInTheDocument();
    expect(screen.getByText('歴史クイズ')).toBeInTheDocument();
  });

  it('各カードからクイズ詳細へ遷移できる', () => {
    render(
      <QuizCarousel
        quizzes={mockQuizzes}
        loading={false}
        error={null}
      />
    );

    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/quiz/quiz-1');
    expect(links[1]).toHaveAttribute('href', '/quiz/quiz-2');
  });

  it('読み込み中はステータスを表示する', () => {
    render(
      <QuizCarousel
        quizzes={[]}
        loading={true}
        error={null}
      />
    );

    expect(screen.getByText('クイズを読み込み中...')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-carousel')).not.toBeInTheDocument();
  });

  it('エラー時はメッセージと再試行ボタンを表示する', () => {
    const onRetry = jest.fn();
    render(
      <QuizCarousel
        quizzes={[]}
        loading={false}
        error="読み込みに失敗しました"
        onRetry={onRetry}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('読み込みに失敗しました');
    fireEvent.click(screen.getByRole('button', { name: '再試行' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('空状態メッセージを表示する', () => {
    render(
      <QuizCarousel
        quizzes={[]}
        loading={false}
        error={null}
        emptyMessage="表示できるクイズがありません。"
      />
    );

    expect(screen.getByText('表示できるクイズがありません。')).toBeInTheDocument();
  });

  it('初期ロード時にブックマーク済みクイズのアイコンが登録済み（塗りつぶし）で表示される', async () => {
    render(
      <QuizCarousel
        quizzes={mockQuizzes}
        loading={false}
        error={null}
      />
    );

    // 非同期ロードされる getBookmarkedQuizIds ('quiz-1'を返す) の結果が適用されるのを待つ
    const filledIcon = await screen.findByTestId('bookmark-icon-filled');
    expect(filledIcon).toBeInTheDocument();

    const outlinedIcon = screen.getByTestId('bookmark-icon-outlined');
    expect(outlinedIcon).toBeInTheDocument();
  });
});
