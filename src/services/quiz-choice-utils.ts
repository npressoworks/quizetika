import { Choice } from '@/types';

export const MIN_MULTIPLE_CHOICE_COUNT = 2;
export const MAX_MULTIPLE_CHOICE_COUNT = 10;
export const DEFAULT_MULTIPLE_CHOICE_COUNT = 4;

export function createDefaultChoices(count = DEFAULT_MULTIPLE_CHOICE_COUNT): Choice[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    choiceText: '',
    isCorrect: i === 0,
    selectedCount: 0,
  }));
}

export function isDefaultChoiceSet(choices: Choice[]): boolean {
  if (choices.length !== DEFAULT_MULTIPLE_CHOICE_COUNT) return false;
  return choices.every(
    (choice, idx) =>
      choice.choiceText === '' && choice.isCorrect === (idx === 0)
  );
}
