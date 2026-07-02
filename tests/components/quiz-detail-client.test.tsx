/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuizDetailClient } from '@/app/quiz/[id]/quiz-detail-client';
import type { Quiz } from '@/types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}));

const mockUseAuth = jest.fn(() => ({
  user: null as { id: string } | null,
  firebaseUser: null,
  loading: false,
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [{ id: 'general', displayName: 'ノンジャンル・総合', iconImageUrl: null }],
    loading: false,
    error: null,
    genreLabelById: new Map(),
    refetch: jest.fn(),
  }),
}));

const mockUsePlayedQuizIds = jest.fn(() => ({
  playedQuizIds: null as Set<string> | null,
  loading: false,
}));

jest.mock('@/hooks/usePlayedQuizIds', () => ({
  usePlayedQuizIds: () => mockUsePlayedQuizIds(),
}));

jest.mock('@/services/bookmark', () => ({
  isBookmarked: jest.fn().mockResolvedValue(false),
  toggleBookmark: jest.fn(),
}));

function makeQuiz(overrides: any = {}): any {
  return {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'テスト作者',
    authorAvatar: '',
    title: 'テストクイズ',
    description: '説明文',
    thumbnailUrl: '',
    difficulty: 3,
    genre: 'general',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        questionText: '問題1',
        choices: [
          { id: 'A', choiceText: 'A', isCorrect: true, selectedCount: 0 },
          { id: 'B', choiceText: 'B', isCorrect: false, selectedCount: 0 }
        ],
        explanation: '',
      },
    ] as any,
    questionCount: 1,
    status: 'published',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: 0,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'general',
    canonicalTagIds: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('QuizDetailClient - Phase 19 LB warning', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: null,
      loading: false,
    });
  });

  it('通常クイズでランキング非対象警告をプレイ開始ボタンの下に表示する', () => {
    render(<QuizDetailClient quiz={makeQuiz()} />);

    const warning = screen.getByTestId('play-mode-leaderboard-warning');
    const playBtn = screen.getByRole('button', { name: 'プレイを開始する' });

    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent('模擬試験モード');
    expect(warning).toHaveTextContent('フラッシュカードモード');
    expect(warning).toHaveTextContent('初回プレイランキング');
    expect(
      playBtn.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('プレイ済みクイズでは警告を表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      firebaseUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
  });

  it('ウミガメ専用クイズでは警告を表示しない', () => {
    render(
      <QuizDetailClient
        quiz={makeQuiz({
          questions: [
            {
              id: 'q1',
              type: 'lateral-thinking',
              text: 'ウミガメ',
              truthKeywords: ['真相'],
              explanation: '',
            },
          ],
        })}
      />
    );

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
  });

  it('早押しクイズでは警告を表示しない', () => {
    render(
      <QuizDetailClient
        quiz={makeQuiz({
          format: 'quick-press',
          questions: [
            {
              id: 'q1',
              type: 'quick-press',
              text: '早押し',
              correctAnswer: '答え',
              explanation: '',
            },
          ],
        })}
      />
    );

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
  });
});

describe('QuizDetailClient - play status', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      firebaseUser: null,
      loading: false,
    });
  });

  it('ログイン済み・未プレイの場合は未プレイバッジを表示する', () => {
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set<string>(),
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.getByTestId('quiz-detail-play-status')).toHaveTextContent('未プレイ');
  });

  it('ログイン済み・プレイ済みの場合はプレイ済みバッジを表示する', () => {
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.getByTestId('quiz-detail-play-status')).toHaveTextContent('プレイ済み');
  });

  it('未ログイン時はプレイステータスを表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      firebaseUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: null,
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByTestId('quiz-detail-play-status')).not.toBeInTheDocument();
  });
});
