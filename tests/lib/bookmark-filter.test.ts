import {
  filterBookmarkedQuizzes,
  filterBookmarkedQuestions,
} from '../../src/lib/bookmark-filter';
import { DEFAULT_MY_QUIZ_FILTER } from '../../src/lib/my-quiz-filter';
import type { Quiz, BookmarkedQuestionEntry, Question } from '../../src/types';

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz-1',
    authorId: 'user-1',
    authorName: 'テスト作者',
    authorAvatar: '',
    title: 'React入門',
    description: 'Reactの基礎知識です。',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'programming',
    canonicalGenreId: 'programming',
    tags: ['react', 'js'],
    canonicalTagIds: ['react', 'js'],
    originalTags: ['react', 'js'],
    questionIds: [],
    questions: [],
    questionCount: 0,
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
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    format: 'multiple-choice',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeQuestionEntry(overrides: Partial<BookmarkedQuestionEntry> = {}): BookmarkedQuestionEntry {
  const question: Question = {
    id: 'q-1',
    quizId: 'quiz-1',
    type: 'multiple-choice',
    questionText: 'Reactのフックとは？',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
    ...(overrides.question || {}),
  };

  return {
    question,
    parentQuizId: 'quiz-1',
    parentQuizTitle: 'React入門',
    bookmarkedAt: new Date(),
    genreId: 'programming',
    difficulty: 3,
    tags: ['react', 'js'],
    format: 'multiple-choice',
    ...overrides,
  };
}

describe('filterBookmarkedQuizzes', () => {
  const quizzes = [
    makeQuiz({ id: 'quiz-1', title: 'React入門', description: 'Reactの基礎', canonicalGenreId: 'programming', tags: ['react', 'js'], difficulty: 2, format: 'multiple-choice' }),
    makeQuiz({ id: 'quiz-2', title: 'TypeScript応用', description: 'TSの高度な型', canonicalGenreId: 'programming', tags: ['typescript', 'js'], difficulty: 4, format: 'text-input' }),
    makeQuiz({ id: 'quiz-3', title: '歴史クイズ', description: '日本の歴史', canonicalGenreId: 'history', tags: ['history'], difficulty: 3, format: 'true-false' }),
  ];

  test('ジャンルフィルタ', () => {
    const result = filterBookmarkedQuizzes(quizzes, {
      ...DEFAULT_MY_QUIZ_FILTER,
      genreId: 'history',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('quiz-3');
  });

  test('タグ AND フィルタ', () => {
    const result = filterBookmarkedQuizzes(quizzes, {
      ...DEFAULT_MY_QUIZ_FILTER,
      tagChips: ['js', 'typescript'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('quiz-2');
  });

  test('形式フィルタ', () => {
    const result = filterBookmarkedQuizzes(quizzes, {
      ...DEFAULT_MY_QUIZ_FILTER,
      format: 'true-false',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('quiz-3');
  });

  test('難易度レンジ', () => {
    const result = filterBookmarkedQuizzes(quizzes, {
      ...DEFAULT_MY_QUIZ_FILTER,
      difficultyMin: 3,
      difficultyMax: 4,
    });
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.id);
    expect(ids).toContain('quiz-2');
    expect(ids).toContain('quiz-3');
  });

  test('キーワード部分一致（タイトル／説明）', () => {
    const result = filterBookmarkedQuizzes(quizzes, {
      ...DEFAULT_MY_QUIZ_FILTER,
      keyword: '応用',
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('quiz-2');
  });
});

describe('filterBookmarkedQuestions', () => {
  const questions = [
    makeQuestionEntry({
      question: { id: 'q-1', questionText: 'Reactのフックとは？', type: 'multiple-choice', correctCount: 0, incorrectCount: 0, explanation: '', imageUrl: null, hint: null, limitTime: null },
      parentQuizTitle: 'React入門',
      genreId: 'programming',
      tags: ['react', 'js'],
      difficulty: 2,
      format: 'multiple-choice',
    }),
    makeQuestionEntry({
      question: { id: 'q-2', questionText: 'TypeScriptのUnion型とは？', type: 'text-input', correctCount: 0, incorrectCount: 0, explanation: '', imageUrl: null, hint: null, limitTime: null },
      parentQuizTitle: 'TypeScript応用',
      genreId: 'programming',
      tags: ['typescript', 'js'],
      difficulty: 4,
      format: 'text-input',
    }),
    makeQuestionEntry({
      question: { id: 'q-3', questionText: '織田信長が滅ぼした大名は？', type: 'true-false', correctCount: 0, incorrectCount: 0, explanation: '', imageUrl: null, hint: null, limitTime: null },
      parentQuizTitle: '戦国時代クイズ',
      genreId: 'history',
      tags: ['history'],
      difficulty: 3,
      format: 'true-false',
    }),
  ];

  test('ジャンルフィルタ', () => {
    const result = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      genreId: 'history',
    });
    expect(result).toHaveLength(1);
    expect(result[0].question.id).toBe('q-3');
  });

  test('タグ AND フィルタ', () => {
    const result = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      tagChips: ['js', 'react'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].question.id).toBe('q-1');
  });

  test('形式フィルタ', () => {
    const result = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      format: 'text-input',
    });
    expect(result).toHaveLength(1);
    expect(result[0].question.id).toBe('q-2');
  });

  test('難易度レンジ', () => {
    const result = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      difficultyMin: 3,
      difficultyMax: 4,
    });
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.question.id);
    expect(ids).toContain('q-2');
    expect(ids).toContain('q-3');
  });

  test('キーワード部分一致（問題文／親クイズタイトル）', () => {
    const resultByQuestionText = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      keyword: '信長',
    });
    expect(resultByQuestionText).toHaveLength(1);
    expect(resultByQuestionText[0].question.id).toBe('q-3');

    const resultByParentQuizTitle = filterBookmarkedQuestions(questions, {
      ...DEFAULT_MY_QUIZ_FILTER,
      keyword: '応用',
    });
    expect(resultByParentQuizTitle).toHaveLength(1);
    expect(resultByParentQuizTitle[0].question.id).toBe('q-2');
  });
});
