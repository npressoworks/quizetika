import {
  satisfiesMyQuizAttemptContract,
  satisfiesQuestionListAttemptContract,
} from '../../src/types';

describe('satisfiesMyQuizAttemptContract', () => {
  test('my-quiz 契約を満たすとき true', () => {
    expect(
      satisfiesMyQuizAttemptContract({
        mode: 'my-quiz',
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(true);
  });

  test('totalQuestions が 1 でないとき false', () => {
    expect(
      satisfiesMyQuizAttemptContract({
        mode: 'my-quiz',
        quizId: 'quiz-1',
        totalQuestions: 5,
      })
    ).toBe(false);
  });

  test('quizId 欠落時 false', () => {
    expect(
      satisfiesMyQuizAttemptContract({
        mode: 'my-quiz',
        quizId: '',
        totalQuestions: 1,
      })
    ).toBe(false);
  });

  test('question-list 契約は listId 必須（回帰）', () => {
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
        mode: 'question-list',
        listId: null,
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(false);
  });
});
