import { satisfiesMyQuizAttemptContract } from '../../src/types';

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
});
