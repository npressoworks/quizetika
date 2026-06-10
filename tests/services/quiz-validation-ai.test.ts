import { validateGeneratedQuestions } from '@/services/quiz-validation';
import { createDefaultChoices } from '@/services/quiz-choice-utils';
import type { Question } from '@/types';

function makeValidMcQuestion(index: number): Question {
  return {
    id: `q-${index}`,
    type: 'multiple-choice',
    questionText: `問題文テスト${index}です`,
    explanation: `解説文テスト${index}です`,
    imageUrl: null,
    hint: null,
    limitTime: null,
    choices: createDefaultChoices(4).map((c, i) => ({
      ...c,
      choiceText: i === 0 ? '正解選択肢' : `選択肢${i}`,
      isCorrect: i === 0,
    })),
    correctCount: 0,
    incorrectCount: 0,
  };
}

describe('validateGeneratedQuestions', () => {
  test('単一形式 multiple-choice は合格する', () => {
    const questions = Array.from({ length: 10 }, (_, i) => makeValidMcQuestion(i));
    const errors = validateGeneratedQuestions(questions, 'multiple-choice');
    expect(errors).toHaveLength(0);
  });

  test('mixed で allowlist 外 type はエラー', () => {
    const questions = Array.from({ length: 10 }, (_, i) => makeValidMcQuestion(i));
    questions[0] = { ...questions[0], type: 'quick-press', correctTextAnswerList: ['答え'] };
    const errors = validateGeneratedQuestions(questions, 'mixed');
    expect(errors.some((e) => e.questionField === 'type')).toBe(true);
  });

  test('mixed で4種は合格する', () => {
    const questions: Question[] = [
      makeValidMcQuestion(0),
      {
        ...makeValidMcQuestion(1),
        type: 'true-false',
        choices: [
          { id: '1', choiceText: '〇', isCorrect: true, selectedCount: 0 },
          { id: '2', choiceText: '✕', isCorrect: false, selectedCount: 0 },
        ],
      },
      {
        ...makeValidMcQuestion(2),
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['正解テキスト'],
      },
      {
        ...makeValidMcQuestion(3),
        type: 'sorting',
        choices: undefined,
        sortingItems: [
          { id: '1', text: '要素1', correctOrder: 0 },
          { id: '2', text: '要素2', correctOrder: 1 },
        ],
      },
      ...Array.from({ length: 6 }, (_, i) => makeValidMcQuestion(i + 4)),
    ];
    const errors = validateGeneratedQuestions(questions, 'mixed');
    expect(errors).toHaveLength(0);
  });
});
