import { filterAuthorQuizzes } from '../../src/lib/author-quiz-search';
import type { Quiz } from '../../src/types';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'q1',
    authorId: 'author-1',
    authorName: '作者',
    authorAvatar: '',
    title: 'JavaScript 入門',
    description: '基礎を学ぶ',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'programming',
    tags: ['js', 'web'],
    originalTags: [],
    questionIds: [],
    questions: [],
    questionCount: 0,
    status: 'draft',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: 'programming',
    canonicalTagIds: [],
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('author-quiz-search', () => {
  test('filterAuthorQuizzes: キーワードとタグで自作クイズを絞り込む', () => {
    const quizzes = [
      makeQuiz({ id: '1', title: 'Python 基礎', tags: ['python'] }),
      makeQuiz({ id: '2', title: 'JavaScript 入門', tags: ['js'] }),
    ];
    expect(filterAuthorQuizzes(quizzes, { keyword: 'javascript' })).toHaveLength(1);
    expect(filterAuthorQuizzes(quizzes, { tag: 'python' })).toHaveLength(1);
    expect(filterAuthorQuizzes(quizzes, {})).toHaveLength(2);
  });
});
