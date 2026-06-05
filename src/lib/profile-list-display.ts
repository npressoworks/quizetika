import type { QuizList, QuizListType } from '@/types';
import { resolveListType } from '@/types';

export function getProfileListTypeLabel(listType: QuizListType): string {
  return listType === 'question' ? '設問リスト' : 'クイズリスト';
}

export function getProfileListItemCount(
  list: Pick<QuizList, 'listType' | 'quizIds' | 'questionIds'>
): { count: number; countLabel: string } {
  const resolved = resolveListType(list as QuizList);
  if (resolved === 'question') {
    const count = list.questionIds?.length ?? 0;
    return { count, countLabel: `収録設問: ${count} 件` };
  }
  const count = list.quizIds?.length ?? 0;
  return { count, countLabel: `収録クイズ: ${count} 件` };
}
