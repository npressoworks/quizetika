import {
  assertPlayModeAllowedForSave,
  satisfiesMyQuizAttemptContract,
} from '../../src/types';

describe('Phase 26 type contracts', () => {
  test('assertPlayModeAllowedForSave: list / question-list を拒否する', () => {
    expect(() => assertPlayModeAllowedForSave('list')).toThrow('LIST_PLAY_MODE_DEPRECATED');
    expect(() => assertPlayModeAllowedForSave('question-list')).toThrow(
      'LIST_PLAY_MODE_DEPRECATED'
    );
    expect(() => assertPlayModeAllowedForSave('my-quiz')).not.toThrow();
    expect(() => assertPlayModeAllowedForSave('normal')).not.toThrow();
  });

  test('satisfiesMyQuizAttemptContract: my-quiz 契約', () => {
    expect(
      satisfiesMyQuizAttemptContract({
        mode: 'my-quiz',
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(true);
    expect(
      satisfiesMyQuizAttemptContract({
        mode: 'normal',
        quizId: 'quiz-1',
        totalQuestions: 1,
      })
    ).toBe(false);
  });
});
