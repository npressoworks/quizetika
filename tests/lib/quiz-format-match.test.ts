import {
  applyFormatFilter,
  quizMatchesFormat,
} from '../../src/lib/quiz-format-match';
import type { Quiz } from '../../src/types';
import type { Question } from '../../src/types';

function makeQuestion(type: Question['type']): Question {
  return {
    id: 'q1',
    type,
    questionText: 'Q',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
  };
}

function makeQuiz(
  overrides: Partial<Pick<Quiz, 'format' | 'questions'>> = {}
): Pick<Quiz, 'format' | 'questions'> {
  return {
    format: undefined,
    questions: [],
    ...overrides,
  };
}

describe('quiz-format-match', () => {
  test('format フィールド一致', () => {
    const quiz = makeQuiz({ format: 'multiple-choice', questions: [] });
    expect(quizMatchesFormat(quiz, 'multiple-choice')).toBe(true);
    expect(quizMatchesFormat(quiz, 'text-input')).toBe(false);
  });

  test('設問 type からの推定一致', () => {
    const quiz = makeQuiz({
      questions: [makeQuestion('lateral-thinking')],
    });
    expect(quizMatchesFormat(quiz, 'lateral-thinking')).toBe(true);
    expect(quizMatchesFormat(quiz, 'multiple-choice')).toBe(false);
  });

  test('不一致', () => {
    const quiz = makeQuiz({
      format: 'text-input',
      questions: [makeQuestion('multiple-choice')],
    });
    expect(quizMatchesFormat(quiz, 'multiple-choice')).toBe(false);
  });

  test('レガシーフィクスチャ: format 未設定 + questions 空は mixed のみ一致', () => {
    const legacy = makeQuiz({ format: undefined, questions: [] });
    expect(quizMatchesFormat(legacy, 'mixed')).toBe(true);
    expect(quizMatchesFormat(legacy, 'multiple-choice')).toBe(false);
    expect(quizMatchesFormat(legacy, 'lateral-thinking')).toBe(false);
  });

  test('applyFormatFilter: 未指定時は入力配列をそのまま返す', () => {
    const quizzes = [
      { id: 'a', format: 'mixed' as const, questions: [] },
      { id: 'b', format: 'text-input' as const, questions: [] },
    ];
    expect(applyFormatFilter(quizzes, undefined)).toBe(quizzes);
    expect(applyFormatFilter(quizzes)).toBe(quizzes);
  });

  test('applyFormatFilter: 指定形式のみ残す', () => {
    const mc = makeQuiz({ format: 'multiple-choice', questions: [] });
    const lt = makeQuiz({
      questions: [makeQuestion('lateral-thinking')],
    });
    const filtered = applyFormatFilter(
      [{ ...mc, id: 'mc' }, { ...lt, id: 'lt' }],
      'multiple-choice'
    );
    expect(filtered.map((q) => q.id)).toEqual(['mc']);
  });
});
