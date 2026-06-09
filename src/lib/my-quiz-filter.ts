import { filterQuestionCandidatesByKeyword } from '@/lib/question-attach-search';
import type { QuizFormat } from './quiz-format';
import type { MyQuizQuestionCandidate } from '@/lib/my-quiz-pool';

export interface MyQuizFilterState {
  keyword: string;
  genreId: string;
  tagChips: string[];
  format: QuizFormat | '';
  difficultyMin: number;
  difficultyMax: number;
}

export const DEFAULT_MY_QUIZ_FILTER: MyQuizFilterState = {
  keyword: '',
  genreId: '',
  tagChips: [],
  format: '',
  difficultyMin: 1,
  difficultyMax: 5,
};

export function hasActiveMyQuizFilters(filters: MyQuizFilterState): boolean {
  return (
    filters.keyword.trim() !== '' ||
    filters.genreId.trim() !== '' ||
    filters.tagChips.length > 0 ||
    filters.format !== '' ||
    filters.difficultyMin !== DEFAULT_MY_QUIZ_FILTER.difficultyMin ||
    filters.difficultyMax !== DEFAULT_MY_QUIZ_FILTER.difficultyMax
  );
}

export function filterMyQuizCandidates(
  candidates: MyQuizQuestionCandidate[],
  filters: MyQuizFilterState
): MyQuizQuestionCandidate[] {
  let result = candidates;

  if (filters.genreId.trim()) {
    result = result.filter((c) => c.genreId === filters.genreId);
  }

  if (filters.tagChips.length > 0) {
    result = result.filter((c) =>
      filters.tagChips.every((tag) => c.tags.includes(tag))
    );
  }

  if (filters.format) {
    result = result.filter((c) => c.format === filters.format);
  }

  if (
    filters.difficultyMin !== DEFAULT_MY_QUIZ_FILTER.difficultyMin ||
    filters.difficultyMax !== DEFAULT_MY_QUIZ_FILTER.difficultyMax
  ) {
    result = result.filter(
      (c) =>
        c.difficulty >= filters.difficultyMin && c.difficulty <= filters.difficultyMax
    );
  }

  if (filters.keyword.trim()) {
    const attachLike = result.map((c) => ({
      questionId: c.questionId,
      questionText: c.questionText,
      parentQuizId: c.parentQuizId,
      parentQuizTitle: c.parentQuizTitle,
      source: 'own-published' as const,
    }));
    const filtered = filterQuestionCandidatesByKeyword(attachLike, filters.keyword);
    const ids = new Set(filtered.map((f) => f.questionId));
    result = result.filter((c) => ids.has(c.questionId));
  }

  return result;
}
