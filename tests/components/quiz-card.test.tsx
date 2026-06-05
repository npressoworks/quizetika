/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizCard } from '@/components/quiz/quiz-card';
import type { Quiz } from '@/types';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'テスト作者',
    authorAvatar: '',
    title: 'JavaScript 基礎クイズ',
    description: 'JSの基礎知識を問います',
    thumbnailUrl: 'http://example.com/thumb.jpg',
    difficulty: 5,
    genre: 'programming',
    tags: ['js', 'frontend'],
    originalTags: [],
    questionIds: [],
    questions: [],
    questionCount: 10,
    status: 'published',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 3,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: 4.5,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'programming',
    canonicalTagIds: ['js', 'frontend'],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('QuizCard', () => {
  const mockBookmarkToggle = jest.fn();
  const mockPlayClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('クイズのタイトル、作成者名、難易度、評価スター、設問数が正しく表示されること', () => {
    render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    expect(screen.getByText('JavaScript 基礎クイズ')).toBeInTheDocument();
    expect(screen.getByText('テスト作者', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('難易度: 5 / 10', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('★ 4.5', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('問題数: 10問', { exact: false })).toBeInTheDocument();
  });

  it('プレイするボタンをクリックしたとき、onPlayClick が呼び出されること', () => {
    render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    const playButton = screen.getByRole('button', { name: '挑戦する' });
    fireEvent.click(playButton);

    expect(mockPlayClick).toHaveBeenCalledWith('quiz-1');
  });

  it('ブックマークボタンをクリックしたとき、onBookmarkToggle が呼び出されイベントの伝播が防がれること', () => {
    render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    const bookmarkButton = screen.getByTestId('quiz-card-bookmark-btn');
    fireEvent.click(bookmarkButton);

    expect(mockBookmarkToggle).toHaveBeenCalledWith('quiz-1');
  });
});
