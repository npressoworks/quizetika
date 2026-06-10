import type { Quiz } from '../types';

export class QuestionNotBookmarkableError extends Error {
  readonly code = 'question-not-bookmarkable' as const;
  constructor(message = '親クイズが公開済みでない問題はブックマークできません') {
    super(message);
    this.name = 'QuestionNotBookmarkableError';
  }
}

export function assertParentQuizPublished(status: Quiz['status'] | undefined): void {
  if (status !== 'published') {
    throw new QuestionNotBookmarkableError();
  }
}
