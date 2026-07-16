/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  authUser: null,
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
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: null,
      loading: false,
    });
  });

  it('未プレイクイズでは警告と代替導線を表示しない', () => {
    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });

  it('プレイ済みクイズで警告と代替導線を表示し、模擬試験・フラッシュカードへそれぞれ遷移できる', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

    const pushMock = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push: pushMock });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    const warning = screen.getByTestId('play-mode-leaderboard-warning');
    const altPanel = screen.getByTestId('alt-mode-play-panel');

    expect(warning).toBeInTheDocument();
    expect(altPanel).toBeInTheDocument();
    expect(warning).toHaveTextContent('模擬試験モード');
    expect(warning).toHaveTextContent('フラッシュカードモード');
    expect(warning).toHaveTextContent('プレイ回数や順序にかかわらず');
    expect(warning).not.toHaveTextContent('先にこれらのモードでプレイした場合');

    screen.getByRole('button', { name: '模擬試験で復習する' }).click();
    expect(pushMock).toHaveBeenCalledWith('/quiz/quiz-1/play?mode=exam');

    screen.getByRole('button', { name: 'フラッシュカードで復習する' }).click();
    expect(pushMock).toHaveBeenCalledWith('/quiz/quiz-1/play?mode=flashcard');
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
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
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
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });

  it('認証済み・未プレイクイズでは警告と代替導線を表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set<string>(),
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });

  it('未認証時はplayedQuizIdsに該当エントリがあっても警告と代替導線を表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByTestId('play-mode-leaderboard-warning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });

  it('プレイ済みのウミガメ専用クイズでも警告と代替導線を表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

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
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });

  it('プレイ済みの早押しクイズでも警告と代替導線を表示しない', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: new Set(['quiz-1']),
      loading: false,
    });

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
    expect(screen.queryByTestId('alt-mode-play-panel')).not.toBeInTheDocument();
  });
});

describe('QuizDetailClient - Phase 37 単一プレイボタン化', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: null,
      loading: false,
    });
  });

  it('通常形式クイズでは3択のプレイモード選択UIを表示せず、見出しも表示しない（ボタン自体が「プレイ」のため）', () => {
    render(<QuizDetailClient quiz={makeQuiz()} />);

    expect(screen.queryByRole('heading', { name: 'プレイ' })).not.toBeInTheDocument();
    expect(screen.queryByText('プレイモード選択')).not.toBeInTheDocument();
    expect(screen.queryByText('通常モード')).not.toBeInTheDocument();
    expect(screen.queryByText('模擬試験モード')).not.toBeInTheDocument();
    expect(screen.queryByText('フラッシュカードモード')).not.toBeInTheDocument();
  });

  it('通常形式クイズでは単一の「プレイ」ボタンのみが表示され、押下すると常に通常モードへ遷移する', () => {
    const pushMock = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push: pushMock });

    render(<QuizDetailClient quiz={makeQuiz()} />);

    const buttons = screen.getAllByRole('button').filter((btn) => btn.getAttribute('data-analytics') === 'quiz-play-start-detail');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('プレイ');

    buttons[0].click();
    expect(pushMock).toHaveBeenCalledWith('/quiz/quiz-1/play?mode=normal');
  });

  it('水平思考形式クイズの単一モード表示は維持される', () => {
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

    expect(screen.getByText('水平思考チャットモード')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '会員登録してプレイする' })).toBeInTheDocument();
  });

  it('早押し形式クイズの単一モード表示は維持される', () => {
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

    expect(screen.getByText('早押し通常プレイ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '早押しを開始する' })).toBeInTheDocument();
  });
});

describe('QuizDetailClient - play status', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1' },
      authUser: null,
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
      authUser: null,
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

describe('QuizDetailClient - Phase 40 共有トリガー＋メニュー', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
    });
    mockUsePlayedQuizIds.mockReturnValue({
      playedQuizIds: null,
      loading: false,
    });
  });

  it('クイズ詳細画面に共有トリガーが描画され、クリックするとメニューが開き、正しいクイズID・タイトルで共有リンクが生成される', async () => {
    render(<QuizDetailClient quiz={makeQuiz({ id: 'quiz-42', title: '共有テストクイズ' })} />);

    const trigger = screen.getByTestId('quiz-detail-share-trigger');
    expect(trigger).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const menu = await screen.findByTestId('quiz-detail-share-menu');
    expect(menu).toBeInTheDocument();

    const xLink = await screen.findByTestId('quiz-detail-share-x');
    const lineLink = screen.getByTestId('quiz-detail-share-line');

    expect(xLink.getAttribute('href')).toContain(encodeURIComponent('http://localhost/quiz/quiz-42'));
    expect(xLink.getAttribute('href')).toContain(encodeURIComponent('共有テストクイズ'));
    expect(lineLink.getAttribute('href')).toContain(encodeURIComponent('http://localhost/quiz/quiz-42'));
  });
});
