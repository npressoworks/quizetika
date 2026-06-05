import {
  assertAuthorOwnsQuestion,
  hasQuestionContentChanged,
  partitionQuestionsForSave,
  ReferenceLinkForbiddenError,
} from '../../src/lib/linked-question';
import type { Question } from '../../src/types';

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: '問題文',
    explanation: '解説',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('linked-question', () => {
  test('partitionQuestionsForSave: 参照 ID のみのとき ownedToWrite が空', () => {
    const stored = baseQuestion({ id: 'ref-1', linkKind: 'owned' });
    const incoming = baseQuestion({ id: 'ref-1', linkKind: 'reference' });
    const result = partitionQuestionsForSave(
      [incoming],
      [],
      new Map([['ref-1', stored]])
    );
    expect(result.referenceOnlyIds).toEqual(['ref-1']);
    expect(result.ownedToWrite).toHaveLength(0);
    expect(result.detachCopies).toHaveLength(0);
  });

  test('hasQuestionContentChanged: 内容変更を検出', () => {
    const stored = baseQuestion();
    const changed = baseQuestion({ questionText: '変更後' });
    expect(hasQuestionContentChanged(changed, stored)).toBe(true);
    expect(hasQuestionContentChanged(stored, stored)).toBe(false);
  });

  test('assertAuthorOwnsQuestion: 非自作は拒否', () => {
    expect(() => assertAuthorOwnsQuestion('author-a', { authorId: 'author-a' })).not.toThrow();
    expect(() => assertAuthorOwnsQuestion('author-a', { authorId: 'author-b' })).toThrow(
      ReferenceLinkForbiddenError
    );
  });
});
