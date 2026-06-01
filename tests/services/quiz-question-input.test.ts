import { hasQuestionUserInput, hasAnyQuestionUserInput } from '../../src/services/quiz-question-input';
import { createDefaultChoices } from '../../src/services/quiz-choice-utils';
import { Question } from '../../src/types';

function makeDefaultQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: '',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    choices: createDefaultChoices(),
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('hasQuestionUserInput', () => {
  it('returns false for a freshly added default question', () => {
    expect(hasQuestionUserInput(makeDefaultQuestion())).toBe(false);
  });

  it('returns true when question text is entered', () => {
    expect(hasQuestionUserInput(makeDefaultQuestion({ questionText: 'Reactとは？' }))).toBe(true);
  });

  it('returns true when choice count differs from the default', () => {
    expect(
      hasQuestionUserInput(
        makeDefaultQuestion({
          choices: createDefaultChoices(5),
        })
      )
    ).toBe(true);
  });

  it('returns true when choice text is changed from the default', () => {
    const q = makeDefaultQuestion();
    q.choices![0].choiceText = 'useState';
    expect(hasQuestionUserInput(q)).toBe(true);
  });

  it('returns false for default text-input question', () => {
    expect(
      hasQuestionUserInput(
        makeDefaultQuestion({
          type: 'text-input',
          choices: undefined,
          correctTextAnswerList: ['正解テキスト'],
        })
      )
    ).toBe(false);
  });

  it('returns true when text answer is customized', () => {
    expect(
      hasQuestionUserInput(
        makeDefaultQuestion({
          type: 'text-input',
          choices: undefined,
          correctTextAnswerList: ['useState'],
        })
      )
    ).toBe(true);
  });
});

describe('hasAnyQuestionUserInput', () => {
  it('returns false when all questions are default', () => {
    expect(hasAnyQuestionUserInput([makeDefaultQuestion(), makeDefaultQuestion({ id: 'q2' })])).toBe(false);
  });

  it('returns true when any question has user input', () => {
    expect(
      hasAnyQuestionUserInput([
        makeDefaultQuestion(),
        makeDefaultQuestion({ id: 'q2', questionText: '入力あり' }),
      ])
    ).toBe(true);
  });
});
