import { resolveQuizFormat, resolveQuizFormatFromQuestions } from '@/lib/quiz-format';
import { Question } from '@/types';

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

describe('resolveQuizFormat', () => {
  it('returns stored format when present', () => {
    expect(
      resolveQuizFormat({
        format: 'text-input',
        questions: [makeQuestion('multiple-choice')],
      })
    ).toBe('text-input');
  });

  it('infers single-format quizzes from question types', () => {
    expect(
      resolveQuizFormatFromQuestions([
        makeQuestion('multiple-choice'),
        makeQuestion('multiple-choice'),
      ])
    ).toBe('multiple-choice');

    expect(resolveQuizFormatFromQuestions([makeQuestion('quick-press')])).toBe(
      'quick-press'
    );
  });

  it('infers mixed when question types differ within mixed-allowed set', () => {
    expect(
      resolveQuizFormatFromQuestions([
        makeQuestion('multiple-choice'),
        makeQuestion('text-input'),
      ])
    ).toBe('mixed');
  });

  it('infers mixed for true-false-only quizzes', () => {
    expect(resolveQuizFormatFromQuestions([makeQuestion('true-false')])).toBe('mixed');
  });

  it('defaults to mixed when there are no questions', () => {
    expect(resolveQuizFormat({ questions: [] })).toBe('mixed');
  });
});
