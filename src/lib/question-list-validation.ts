import type { Quiz, QuizListType } from '../types';
import { resolveListType } from '../types';

export class QuestionNotBookmarkableError extends Error {
  readonly code = 'question-not-bookmarkable' as const;
  constructor(message = '親クイズが公開済みでない設問はブックマークできません') {
    super(message);
    this.name = 'QuestionNotBookmarkableError';
  }
}

export class QuestionNotListAddableError extends Error {
  readonly code = 'question-not-list-addable' as const;
  constructor(message = '親クイズが公開済みでない設問はリストに追加できません') {
    super(message);
    this.name = 'QuestionNotListAddableError';
  }
}

export class ListTypeMismatchError extends Error {
  readonly code = 'list-type-mismatch' as const;
  constructor(message = 'リスト種別と操作が一致しません') {
    super(message);
    this.name = 'ListTypeMismatchError';
  }
}

export function assertParentQuizPublished(
  status: Quiz['status'] | undefined,
  errorClass: typeof QuestionNotBookmarkableError | typeof QuestionNotListAddableError = QuestionNotBookmarkableError
): void {
  if (status !== 'published') {
    throw new errorClass();
  }
}

export function assertListTypeOperation(
  list: Pick<{ listType?: QuizListType }, 'listType'>,
  memberKind: 'quiz' | 'question'
): void {
  const resolved = resolveListType(list as { listType?: QuizListType });
  if (resolved === 'quiz' && memberKind === 'question') {
    throw new ListTypeMismatchError('クイズリストに設問のみの操作はできません');
  }
  if (resolved === 'question' && memberKind === 'quiz') {
    throw new ListTypeMismatchError('設問リストにクイズのみの操作はできません');
  }
}
