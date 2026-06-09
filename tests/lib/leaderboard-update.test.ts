import {
  isLeaderboardEligibleAttempt,
  buildLeaderboardUpdatesForQuiz,
} from '../../src/lib/leaderboard-update';
import type { Quiz } from '../../src/types';

const userId = 'user-uid';

function mockQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    authorId: 'author-1',
    authorName: 'Author',
    authorAvatar: '',
    title: 'Test Quiz',
    description: '',
    thumbnailUrl: '',
    difficulty: 3,
    genre: 'general',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
    questionCount: 3,
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
  } as Quiz;
}

describe('isLeaderboardEligibleAttempt - Phase 18', () => {
  test('ゲストは非対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId: 'guest', mode: 'normal' })).toBe(false);
    expect(isLeaderboardEligibleAttempt({ userId: '', mode: 'normal' })).toBe(false);
  });

  test('test-play は非対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'test-play' })).toBe(false);
  });

  test('exam / flashcard は非対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'exam' })).toBe(false);
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'flashcard' })).toBe(false);
  });

  test('normal / review / list / question-list / my-quiz は対象', () => {
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'normal' })).toBe(true);
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'review' })).toBe(true);
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'list' })).toBe(true);
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'question-list' })).toBe(true);
    expect(isLeaderboardEligibleAttempt({ userId, mode: 'my-quiz' })).toBe(true);
  });
});

describe('buildLeaderboardUpdatesForQuiz - Phase 18', () => {
  const entry = {
    userId,
    displayName: 'Tester',
    score: 3,
    elapsedSeconds: 30,
    completedAt: new Date(),
  };

  test('exam モードでは null を返す', () => {
    const result = buildLeaderboardUpdatesForQuiz(mockQuiz(), 0, entry, 'exam');
    expect(result).toBeNull();
  });

  test('flashcard モードでは null を返す', () => {
    const result = buildLeaderboardUpdatesForQuiz(mockQuiz(), 0, entry, 'flashcard');
    expect(result).toBeNull();
  });

  test('normal モードでは初回プレイボード更新を返す', () => {
    const result = buildLeaderboardUpdatesForQuiz(mockQuiz(), 0, entry, 'normal');
    expect(result).not.toBeNull();
    expect(result!.board).toBe('firstPlay');
    expect(result!.updates).toHaveProperty('leaderboardFirstPlay');
  });
});
