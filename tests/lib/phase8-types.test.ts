import {
  resolveListType,
  satisfiesQuestionListAttemptContract,
  type QuizList,
} from '../../src/types';

describe('Phase 8 types', () => {
  test('resolveListType: 未設定は quiz', () => {
    expect(resolveListType({} as QuizList)).toBe('quiz');
    expect(resolveListType({ listType: 'quiz' } as QuizList)).toBe('quiz');
    expect(resolveListType({ listType: 'question' } as QuizList)).toBe('question');
  });

  test('satisfiesQuestionListAttemptContract: question-list 契約', () => {
    expect(
      satisfiesQuestionListAttemptContract({
        mode: 'question-list',
        listId: 'list-1',
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(true);

    expect(
      satisfiesQuestionListAttemptContract({
        mode: 'list',
        listId: 'list-1',
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(false);

    expect(
      satisfiesQuestionListAttemptContract({
        mode: 'question-list',
        listId: null,
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(false);
  });
});
