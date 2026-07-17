import { buildMyQuizQuestionPool } from '../../src/lib/my-quiz-pool';
import { searchAuthorQuizzes } from '../../src/services/author-quiz-search';
import {
  enrichBookmarkedQuestions,
  getBookmarkedQuizzes,
} from '../../src/services/bookmark';
import { getQuestionsByQuiz } from '../../src/services/question';
import type { Question, Quiz } from '../../src/types';

jest.mock('../../src/services/author-quiz-search');
jest.mock('../../src/services/bookmark');
jest.mock('../../src/services/question');
jest.mock('../../src/services/quiz', () => ({
  getQuiz: jest.fn(),
}));

const userId = 'user-1';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    authorId: userId,
    authorName: '作者',
    authorAvatar: '',
    title: 'テストクイズ',
    description: '',
    thumbnailUrl: null,
    difficulty: 4,
    genre: 'programming',
    tags: ['js'],
    originalTags: [],
    questionIds: ['q1'],
    questions: [],
    questionCount: 1,
    status: 'published',
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

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: '問題文',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('buildMyQuizQuestionPool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('全 flags false のとき空配列を返す', async () => {
    const result = await buildMyQuizQuestionPool(userId, {
      ownQuizzes: false,
      bookmarkedQuizzes: false,
      bookmarkedQuestions: false,
    });
    expect(result).toEqual([]);
  });

  test('同一 questionId は own が先勝ちする', async () => {
    const quiz = makeQuiz({ id: 'quiz-own' });
    const question = makeQuestion({ id: 'dup-q' });

    (searchAuthorQuizzes as jest.Mock).mockResolvedValue({
      quizzes: [quiz],
      questionsByQuizId: {},
    });
    (getQuestionsByQuiz as jest.Mock).mockResolvedValue([question]);
    (getBookmarkedQuizzes as jest.Mock).mockResolvedValue([
      makeQuiz({ id: 'quiz-bm', status: 'published' }),
    ]);

    const result = await buildMyQuizQuestionPool(userId, {
      ownQuizzes: true,
      bookmarkedQuizzes: true,
      bookmarkedQuestions: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('own');
    expect(result[0].questionId).toBe('dup-q');
  });

  test('ブックマーク経路で非公開親クイズを除外する', async () => {
    (searchAuthorQuizzes as jest.Mock).mockResolvedValue({ quizzes: [], questionsByQuizId: {} });
    (getBookmarkedQuizzes as jest.Mock).mockResolvedValue([
      makeQuiz({ id: 'draft-quiz', status: 'draft' }),
    ]);

    const result = await buildMyQuizQuestionPool(userId, {
      ownQuizzes: false,
      bookmarkedQuizzes: true,
      bookmarkedQuestions: false,
    });

    expect(result).toEqual([]);
    expect(getQuestionsByQuiz).not.toHaveBeenCalled();
  });

  test('候補に format・difficulty・source メタデータを付与する', async () => {
    const quiz = makeQuiz({
      id: 'quiz-meta',
      format: 'true-false',
      difficulty: 5,
      tags: ['react'],
      canonicalGenreId: 'web',
    });
    const question = makeQuestion({ id: 'meta-q', questionText: '〇✕問題' });

    (searchAuthorQuizzes as jest.Mock).mockResolvedValue({
      quizzes: [quiz],
      questionsByQuizId: {},
    });
    (getQuestionsByQuiz as jest.Mock).mockResolvedValue([question]);

    const result = await buildMyQuizQuestionPool(userId, {
      ownQuizzes: true,
      bookmarkedQuizzes: false,
      bookmarkedQuestions: false,
    });

    expect(result[0]).toMatchObject({
      questionId: 'meta-q',
      questionText: '〇✕問題',
      parentQuizId: 'quiz-meta',
      parentQuizTitle: 'テストクイズ',
      source: 'own',
      genreId: 'web',
      tags: ['react'],
      format: 'true-false',
      difficulty: 5,
    });
  });

  test('ブックマーク問題ソースを収集する', async () => {
    (enrichBookmarkedQuestions as jest.Mock).mockResolvedValue([
      {
        question: makeQuestion({ id: 'bm-q', questionText: 'BM問題' }),
        parentQuizId: 'parent-q',
        parentQuizTitle: '親クイズ',
        bookmarkedAt: new Date(),
      },
    ]);

    const { getQuiz } = jest.requireMock('../../src/services/quiz');
    (getQuiz as jest.Mock).mockResolvedValue(
      makeQuiz({ id: 'parent-q', title: '親クイズ', status: 'published' })
    );

    const result = await buildMyQuizQuestionPool(userId, {
      ownQuizzes: false,
      bookmarkedQuizzes: false,
      bookmarkedQuestions: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('bookmarked-question');
    expect(result[0].questionId).toBe('bm-q');
  });
});
