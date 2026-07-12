import {
  filterAuthorQuizzes,
  filterAuthorQuizzesWithQuestions,
  sortAuthorQuizzes,
} from '../../src/lib/author-quiz-search';
import type { Question, Quiz } from '../../src/types';

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

  test('filterAuthorQuizzesWithQuestions: 問題文一致でヒットする', () => {
    const quizzes = [
      makeQuiz({ id: '1', title: '無関係タイトル' }),
      makeQuiz({ id: '2', title: '別クイズ' }),
    ];
    const questionsByQuizId: Record<string, Question[]> = {
      '1': [
        {
          id: 'q1',
          type: 'text-input',
          questionText: 'useState の役割は',
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          correctTextAnswerList: ['状態管理'],
          correctCount: 0,
          incorrectCount: 0,
        },
      ],
      '2': [
        {
          id: 'q2',
          type: 'multiple-choice',
          questionText: 'Vue とは',
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          choices: [{ id: 'c1', choiceText: 'フレームワーク', isCorrect: true, selectedCount: 0 }],
          correctCount: 0,
          incorrectCount: 0,
        },
      ],
    };
    const result = filterAuthorQuizzesWithQuestions(quizzes, questionsByQuizId, {
      keyword: 'usestate',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  test('filterAuthorQuizzesWithQuestions: 正解テキスト一致でヒットする', () => {
    const quizzes = [makeQuiz({ id: '1', title: '無関係' })];
    const questionsByQuizId: Record<string, Question[]> = {
      '1': [
        {
          id: 'q1',
          type: 'multiple-choice',
          questionText: '問題のみ',
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          choices: [{ id: 'c1', choiceText: '正解キーワード', isCorrect: true, selectedCount: 0 }],
          correctCount: 0,
          incorrectCount: 0,
        },
      ],
    };
    const result = filterAuthorQuizzesWithQuestions(quizzes, questionsByQuizId, {
      keyword: '正解キーワード',
    });
    expect(result).toHaveLength(1);
  });

  test('filterAuthorQuizzesWithQuestions: 不一致は除外される', () => {
    const quizzes = [makeQuiz({ id: '1', title: '無関係' })];
    const questionsByQuizId: Record<string, Question[]> = {
      '1': [
        {
          id: 'q1',
          type: 'text-input',
          questionText: '問題文',
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          correctTextAnswerList: ['答え'],
          correctCount: 0,
          incorrectCount: 0,
        },
      ],
    };
    const result = filterAuthorQuizzesWithQuestions(quizzes, questionsByQuizId, {
      keyword: '見つからない',
    });
    expect(result).toHaveLength(0);
  });

  test('filterAuthorQuizzes: 統合ステータス絞り込みが単独で作用する', () => {
    const quizzes = [
      makeQuiz({ id: '1', status: 'draft' }),
      makeQuiz({ id: '2', status: 'published', visibility: 'public' }),
      makeQuiz({ id: '3', status: 'suspended' }),
    ];
    const result = filterAuthorQuizzes(quizzes, { status: 'draft' });
    expect(result.map((q) => q.id)).toEqual(['1']);

    const publicResult = filterAuthorQuizzes(quizzes, { status: 'public' });
    expect(publicResult.map((q) => q.id)).toEqual(['2']);

    const suspendedResult = filterAuthorQuizzes(quizzes, { status: 'suspended' });
    expect(suspendedResult.map((q) => q.id)).toEqual(['3']);
  });

  test('filterAuthorQuizzes: ジャンル絞り込みは canonicalGenreId 完全一致のみを対象とし、未解決クイズを指定時のみ除外する', () => {
    const quizzes = [
      makeQuiz({ id: '1', canonicalGenreId: 'programming' }),
      makeQuiz({ id: '2', canonicalGenreId: 'design' }),
      makeQuiz({ id: '3', canonicalGenreId: '' }),
    ];

    const filtered = filterAuthorQuizzes(quizzes, { genreId: 'programming' });
    expect(filtered.map((q) => q.id)).toEqual(['1']);
    expect(filtered.some((q) => q.id === '3')).toBe(false);

    const unfiltered = filterAuthorQuizzes(quizzes, {});
    expect(unfiltered.map((q) => q.id)).toEqual(['1', '2', '3']);
  });

  test('filterAuthorQuizzes: 統合ステータス・ジャンル・タグ・キーワードを AND で組み合わせる', () => {
    const quizzes = [
      makeQuiz({
        id: '1',
        title: 'JavaScript 入門',
        status: 'published',
        visibility: 'public',
        canonicalGenreId: 'programming',
        tags: ['js'],
      }),
      makeQuiz({
        id: '2',
        title: 'JavaScript 応用',
        status: 'published',
        visibility: 'public',
        canonicalGenreId: 'programming',
        tags: ['web'],
      }),
      makeQuiz({
        id: '3',
        title: 'JavaScript 発展',
        status: 'draft',
        canonicalGenreId: 'programming',
        tags: ['js'],
      }),
      makeQuiz({
        id: '4',
        title: 'Python 入門',
        status: 'published',
        visibility: 'public',
        canonicalGenreId: 'design',
        tags: ['js'],
      }),
    ];

    const result = filterAuthorQuizzes(quizzes, {
      keyword: 'JavaScript',
      tag: 'js',
      genreId: 'programming',
      status: 'public',
    });
    expect(result.map((q) => q.id)).toEqual(['1']);
  });

  describe('sortAuthorQuizzes', () => {
    function makeQuizzesForSort(): Quiz[] {
      return [
        makeQuiz({
          id: 'a',
          title: 'Banana',
          playCount: 5,
          createdAt: new Date('2026-01-02T00:00:00Z'),
        }),
        makeQuiz({
          id: 'b',
          title: 'Apple',
          playCount: 20,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        }),
        makeQuiz({
          id: 'c',
          title: 'Cherry',
          playCount: 1,
          createdAt: new Date('2026-01-03T00:00:00Z'),
        }),
      ];
    }

    test('title で昇順・降順に並び替える', () => {
      const quizzes = makeQuizzesForSort();
      const asc = sortAuthorQuizzes(quizzes, 'title', 'asc');
      expect(asc.map((q) => q.id)).toEqual(['b', 'a', 'c']);
      const desc = sortAuthorQuizzes(quizzes, 'title', 'desc');
      expect(desc.map((q) => q.id)).toEqual(['c', 'a', 'b']);
    });

    test('playCount で昇順・降順に並び替える', () => {
      const quizzes = makeQuizzesForSort();
      const asc = sortAuthorQuizzes(quizzes, 'playCount', 'asc');
      expect(asc.map((q) => q.id)).toEqual(['c', 'a', 'b']);
      const desc = sortAuthorQuizzes(quizzes, 'playCount', 'desc');
      expect(desc.map((q) => q.id)).toEqual(['b', 'a', 'c']);
    });

    test('createdAt で昇順・降順に並び替える', () => {
      const quizzes = makeQuizzesForSort();
      const asc = sortAuthorQuizzes(quizzes, 'createdAt', 'asc');
      expect(asc.map((q) => q.id)).toEqual(['b', 'a', 'c']);
      const desc = sortAuthorQuizzes(quizzes, 'createdAt', 'desc');
      expect(desc.map((q) => q.id)).toEqual(['c', 'a', 'b']);
    });

    test('入力配列を変更しない', () => {
      const quizzes = makeQuizzesForSort();
      const original = [...quizzes];
      sortAuthorQuizzes(quizzes, 'title', 'asc');
      expect(quizzes.map((q) => q.id)).toEqual(original.map((q) => q.id));
    });
  });
});
