import {
  filterMyQuizCandidates,
  DEFAULT_MY_QUIZ_FILTER,
} from '../../src/lib/my-quiz-filter';
import type { MyQuizQuestionCandidate } from '../../src/lib/my-quiz-pool';

function makeCandidate(overrides: Partial<MyQuizQuestionCandidate> = {}): MyQuizQuestionCandidate {
  return {
    questionId: 'q1',
    questionText: 'React hooks',
    parentQuizId: 'quiz-1',
    parentQuizTitle: 'React 入門',
    source: 'own',
    genreId: 'web',
    tags: ['react', 'js'],
    format: 'multiple-choice',
    difficulty: 3,
    ...overrides,
  };
}

describe('filterMyQuizCandidates', () => {
  const pool = [
    makeCandidate({ questionId: 'q1', genreId: 'web', tags: ['react', 'js'] }),
    makeCandidate({
      questionId: 'q2',
      questionText: 'Python basics',
      parentQuizTitle: 'Python',
      genreId: 'programming',
      tags: ['python'],
      difficulty: 5,
    }),
  ];

  test('ジャンルフィルタ', () => {
    const result = filterMyQuizCandidates(pool, {
      ...DEFAULT_MY_QUIZ_FILTER,
      genreId: 'web',
    });
    expect(result).toHaveLength(1);
    expect(result[0].questionId).toBe('q1');
  });

  test('タグ AND フィルタ', () => {
    const result = filterMyQuizCandidates(pool, {
      ...DEFAULT_MY_QUIZ_FILTER,
      tagChips: ['react', 'js'],
    });
    expect(result).toHaveLength(1);
  });

  test('キーワード部分一致', () => {
    const result = filterMyQuizCandidates(pool, {
      ...DEFAULT_MY_QUIZ_FILTER,
      keyword: 'python',
    });
    expect(result).toHaveLength(1);
    expect(result[0].questionId).toBe('q2');
  });

  test('難易度レンジ', () => {
    const result = filterMyQuizCandidates(pool, {
      ...DEFAULT_MY_QUIZ_FILTER,
      difficultyMin: 4,
      difficultyMax: 5,
    });
    expect(result).toHaveLength(1);
    expect(result[0].questionId).toBe('q2');
  });
});
