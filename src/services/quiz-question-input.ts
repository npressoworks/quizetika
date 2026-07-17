import { Question } from '@/types';
import { isDefaultChoiceSet } from '@/services/quiz-choice-utils';

const DEFAULT_TEXT_ANSWER = '';
const DEFAULT_ASSOCIATION_HINT = '';
const DEFAULT_SORTING_ITEM_COUNT = 2;

function hasMultipleChoiceUserInput(q: Question): boolean {
  if (!q.choices) return false;
  if (!isDefaultChoiceSet(q.choices)) return true;
  return false;
}

function hasTextAnswerUserInput(q: Question): boolean {
  const answers = q.correctTextAnswerList ?? [];
  if (answers.length !== 1) return true;
  return answers[0] !== DEFAULT_TEXT_ANSWER;
}

function hasSortingUserInput(q: Question): boolean {
  const items = q.sortingItems ?? [];
  if (items.length !== DEFAULT_SORTING_ITEM_COUNT) return true;
  if (items.some((item) => item.text !== '')) return true;
  return items.some((item, idx) => item.correctOrder !== idx);
}

function hasAssociationUserInput(q: Question): boolean {
  const hints = q.associationHints ?? [];
  const answers = q.correctTextAnswerList ?? [];
  if (hints.length !== 1 || hints[0] !== DEFAULT_ASSOCIATION_HINT) return true;
  return answers.length !== 1 || answers[0] !== DEFAULT_TEXT_ANSWER;
}

function hasLateralThinkingUserInput(q: Question): boolean {
  if (q.aiContextDetails?.trim()) return true;
  return (q.truthKeywords?.length ?? 0) > 0;
}

/** 問題にユーザー入力（初期値以外の内容）があるか判定する */
export function hasQuestionUserInput(q: Question): boolean {
  if (q.questionText.trim()) return true;
  if (q.explanation.trim()) return true;
  if (q.imageUrl) return true;
  if (q.hint?.trim()) return true;
  if (q.limitTime != null) return true;

  switch (q.type) {
    case 'multiple-choice':
    case 'true-false':
      return hasMultipleChoiceUserInput(q);
    case 'text-input':
    case 'quick-press':
      return hasTextAnswerUserInput(q);
    case 'sorting':
      return hasSortingUserInput(q);
    case 'association':
      return hasAssociationUserInput(q);
    case 'lateral-thinking':
      return hasLateralThinkingUserInput(q);
    default:
      return false;
  }
}

export function hasAnyQuestionUserInput(questions: Question[]): boolean {
  return questions.some(hasQuestionUserInput);
}
