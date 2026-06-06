import {
  filterAuthorQuizzes,
  filterAuthorQuizzesWithQuestions,
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

  test('filterAuthorQuizzesWithQuestions: 設問文一致でヒットする', () => {
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
});
