import {
  assertListTypeOperation,
  assertParentQuizPublished,
  ListTypeMismatchError,
  QuestionNotBookmarkableError,
  QuestionNotListAddableError,
} from '../../src/lib/question-list-validation';

describe('question-list-validation', () => {
  test('assertParentQuizPublished: 公開のみ許可', () => {
    expect(() => assertParentQuizPublished('published')).not.toThrow();
    expect(() => assertParentQuizPublished('draft')).toThrow(QuestionNotBookmarkableError);
    expect(() => assertParentQuizPublished('suspended')).toThrow(QuestionNotBookmarkableError);
    expect(() =>
      assertParentQuizPublished('draft', QuestionNotListAddableError)
    ).toThrow(QuestionNotListAddableError);
  });

  test('assertListTypeOperation: タイプ不一致を拒否', () => {
    expect(() => assertListTypeOperation({ listType: 'quiz' }, 'quiz')).not.toThrow();
    expect(() => assertListTypeOperation({ listType: 'question' }, 'question')).not.toThrow();
    expect(() => assertListTypeOperation({ listType: 'quiz' }, 'question')).toThrow(
      ListTypeMismatchError
    );
    expect(() => assertListTypeOperation({ listType: 'question' }, 'quiz')).toThrow(
      ListTypeMismatchError
    );
    expect(() => assertListTypeOperation({}, 'question')).toThrow(ListTypeMismatchError);
  });
});
