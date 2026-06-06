import type { QuizFormat } from '@/lib/quiz-format';

export interface HomeFeedFilters {
  genreId: string;
  format: QuizFormat | '';
  searchQuery: string;
  tagChips: string[];
  difficultyMin: number;
  difficultyMax: number;
  minQuestions: number;
  maxQuestions: number;
}

export const DEFAULT_HOME_FEED_FILTERS: HomeFeedFilters = {
  genreId: '',
  format: '',
  searchQuery: '',
  tagChips: [],
  difficultyMin: 1,
  difficultyMax: 10,
  minQuestions: 1,
  maxQuestions: 50,
};
