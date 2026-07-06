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
    difficulty: 4,
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
    reviewScore: 0.85,
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

  it('難易度を🔥表記形式で表示しプログレスバーを持たない', () => {
    const { container } = render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    expect(screen.getByTestId('quiz-card-difficulty')).toHaveTextContent('🔥🔥🔥🔥🔥');
    expect(container.querySelector('.progressBarBg')).toBeNull();
    expect(container.querySelector('.progressBar')).toBeNull();
  });

  it('ジャンル表示名と出題形式を表示する', () => {
    render(
      <QuizCard
        quiz={makeQuiz({ format: 'multiple-choice' })}
        genreDisplayName="コンピュータ・IT"
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    expect(screen.getByTestId('quiz-card-genre')).toHaveTextContent('コンピュータ・IT');
    expect(screen.getByTestId('quiz-card-format')).toHaveTextContent('選択式');
    fireEvent.mouseEnter(screen.getByTestId('quiz-card-format'));
    expect(screen.getByRole('tooltip')).toHaveTextContent('選択肢');
  });

  it('良問率をいいねアイコン付きのパーセント表示する', () => {
    render(
      <QuizCard
        quiz={makeQuiz({ reviewScore: 92.3 })}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    expect(screen.getByTestId('quiz-card-review-score')).toHaveTextContent('92%');
  });

  it('プレイボタンに play-btn testid がある', () => {
    render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    fireEvent.click(screen.getByTestId('play-btn'));
    expect(mockPlayClick).toHaveBeenCalledWith('quiz-1');
  });

  it('ブックマークボタンをクリックしたとき onBookmarkToggle が呼ばれる', () => {
    render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    fireEvent.click(screen.getByTestId('quiz-card-bookmark-btn'));
    expect(mockBookmarkToggle).toHaveBeenCalledWith('quiz-1');
  });

  it('ブックマーク済みの場合は塗りつぶしアイコンが表示され、未登録時は中抜きアイコンが表示される', () => {
    const { rerender } = render(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={false}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    // 未登録時は中抜きアイコンが存在し、塗りつぶしアイコンは存在しないこと
    expect(screen.getByTestId('bookmark-icon-outlined')).toBeInTheDocument();
    expect(screen.queryByTestId('bookmark-icon-filled')).toBeNull();

    // 登録済みに更新
    rerender(
      <QuizCard
        quiz={makeQuiz()}
        isBookmarked={true}
        onBookmarkToggle={mockBookmarkToggle}
        onPlayClick={mockPlayClick}
      />
    );

    // 登録時は塗りつぶしアイコンが存在し、中抜きアイコンは存在しないこと
    expect(screen.getByTestId('bookmark-icon-filled')).toBeInTheDocument();
    expect(screen.queryByTestId('bookmark-icon-outlined')).toBeNull();
  });
});
