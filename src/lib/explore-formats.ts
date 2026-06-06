import type { QuizFormat } from '@/lib/quiz-format';
import { getFormatLabel, getFormatIcon } from '@/lib/quiz-format-labels';

export interface ExploreFormatOption {
  id: QuizFormat;
  label: string;
  icon: string;
}

const FORMAT_IDS: QuizFormat[] = [
  'mixed',
  'multiple-choice',
  'text-input',
  'quick-press',
  'sorting',
  'association',
  'lateral-thinking',
];

export const EXPLORE_FORMAT_OPTIONS: ExploreFormatOption[] = FORMAT_IDS.map((id) => ({
  id,
  label: getFormatLabel(id),
  icon: getFormatIcon(id),
}));

