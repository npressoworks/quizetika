import type { Question } from '../types';

export class ReferenceLinkForbiddenError extends Error {
  readonly code = 'reference-link-forbidden' as const;
  constructor(message = '自作クイズ以外の設問は参照リンクできません') {
    super(message);
    this.name = 'ReferenceLinkForbiddenError';
  }
}

export type QuestionSavePartition = {
  referenceOnlyIds: string[];
  ownedToWrite: Question[];
  detachCopies: Question[];
};

const CONTENT_KEYS: (keyof Question)[] = [
  'type',
  'questionText',
  'explanation',
  'imageUrl',
  'hint',
  'limitTime',
  'correctTextAnswerList',
  'textInputMode',
  'textInputCharCount',
  'choices',
  'sortingItems',
  'associationHints',
  'aiContextDetails',
  'truthKeywords',
  'sourceUrl',
];

export function isReferenceLinkQuestion(question: Question): boolean {
  return question.linkKind === 'reference';
}

export function questionContentSnapshot(question: Question): Record<string, unknown> {
  const snap: Record<string, unknown> = {};
  for (const key of CONTENT_KEYS) {
    snap[key] = question[key];
  }
  return snap;
}

export function hasQuestionContentChanged(incoming: Question, stored: Question): boolean {
  const a = JSON.stringify(questionContentSnapshot(incoming));
  const b = JSON.stringify(questionContentSnapshot(stored));
  return a !== b;
}

/**
 * 保存ペイロードを参照 ID のみ / 新規・変更所有設問 / Copy-on-Write 切り離しに分類する（純関数）
 */
export function partitionQuestionsForSave(
  questions: Question[],
  priorQuestionIds: string[],
  storedById: Map<string, Question>
): QuestionSavePartition {
  const referenceOnlyIds: string[] = [];
  const ownedToWrite: Question[] = [];
  const detachCopies: Question[] = [];

  for (const q of questions) {
    const stored = q.id ? storedById.get(q.id) : undefined;
    const isPriorRef =
      q.id &&
      priorQuestionIds.includes(q.id) &&
      isReferenceLinkQuestion(q) &&
      stored &&
      !hasQuestionContentChanged(q, stored);

    if (isPriorRef || (isReferenceLinkQuestion(q) && q.id && stored && !hasQuestionContentChanged(q, stored))) {
      if (q.id) referenceOnlyIds.push(q.id);
      continue;
    }

    if (isReferenceLinkQuestion(q) && q.id && stored && hasQuestionContentChanged(q, stored)) {
      detachCopies.push({ ...q, linkKind: 'owned' });
      ownedToWrite.push({ ...q, linkKind: 'owned' });
      continue;
    }

    if (isReferenceLinkQuestion(q) && q.id && !stored) {
      referenceOnlyIds.push(q.id);
      continue;
    }

    ownedToWrite.push({ ...q, linkKind: q.linkKind ?? 'owned' });
  }

  return { referenceOnlyIds, ownedToWrite, detachCopies };
}

export function assertAuthorOwnsQuestion(
  authorId: string,
  question: Pick<Question, 'authorId'>
): void {
  if (!question.authorId || question.authorId !== authorId) {
    throw new ReferenceLinkForbiddenError();
  }
}

/**
 * 他クイズが当該設問 ID を参照している場合は questions ドキュメントを削除してはならない
 */
export async function canDeleteQuestionDoc(
  questionId: string,
  excludingQuizId: string,
  findQuizIdsContainingQuestion: (questionId: string) => Promise<string[]>
): Promise<boolean> {
  const quizIds = await findQuizIdsContainingQuestion(questionId);
  return !quizIds.some((id) => id !== excludingQuizId);
}
