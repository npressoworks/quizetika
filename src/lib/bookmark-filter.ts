import type { Quiz, BookmarkedQuestionEntry } from '@/types';
import type { MyQuizFilterState } from '@/lib/my-quiz-filter';
import { DEFAULT_MY_QUIZ_FILTER } from '@/lib/my-quiz-filter';

/**
 * ブックマークされたクイズをフィルター条件に基づいて絞り込む
 *
 * @param quizzes ブックマークされたクイズの配列
 * @param filters フィルター条件
 * @returns 絞り込まれたクイズの配列
 */
export function filterBookmarkedQuizzes(
  quizzes: Quiz[],
  filters: MyQuizFilterState
): Quiz[] {
  let result = quizzes;

  // ジャンルでの絞り込み
  if (filters.genreId.trim()) {
    result = result.filter(
      (q) => (q.canonicalGenreId ?? q.genre) === filters.genreId
    );
  }

  // タグでの絞り込み
  if (filters.tagChips.length > 0) {
    result = result.filter((q) =>
      filters.tagChips.every((tag) => q.tags?.includes(tag))
    );
  }

  // 形式での絞り込み
  if (filters.format) {
    result = result.filter((q) => q.format === filters.format);
  }

  // 難易度での絞り込み
  if (
    filters.difficultyMin !== DEFAULT_MY_QUIZ_FILTER.difficultyMin ||
    filters.difficultyMax !== DEFAULT_MY_QUIZ_FILTER.difficultyMax
  ) {
    result = result.filter(
      (q) =>
        q.difficulty >= filters.difficultyMin &&
        q.difficulty <= filters.difficultyMax
    );
  }

  // キーワードでの絞り込み（タイトルと説明文が対象）
  if (filters.keyword.trim()) {
    const kw = filters.keyword.toLowerCase().trim();
    result = result.filter(
      (q) =>
        q.title.toLowerCase().includes(kw) ||
        (q.description && q.description.toLowerCase().includes(kw))
    );
  }

  return result;
}

/**
 * ブックマークされた問題をフィルター条件に基づいて絞り込む
 *
 * @param questions ブックマークされた問題のエントリ配列
 * @param filters フィルター条件
 * @returns 絞り込まれた問題のエントリ配列
 */
export function filterBookmarkedQuestions(
  questions: BookmarkedQuestionEntry[],
  filters: MyQuizFilterState
): BookmarkedQuestionEntry[] {
  let result = questions;

  // ジャンルでの絞り込み
  if (filters.genreId.trim()) {
    result = result.filter((q) => q.genreId === filters.genreId);
  }

  // タグでの絞り込み
  if (filters.tagChips.length > 0) {
    result = result.filter((q) =>
      filters.tagChips.every((tag) => q.tags?.includes(tag))
    );
  }

  // 形式での絞り込み
  if (filters.format) {
    result = result.filter((q) => q.format === filters.format);
  }

  // 難易度での絞り込み
  if (
    filters.difficultyMin !== DEFAULT_MY_QUIZ_FILTER.difficultyMin ||
    filters.difficultyMax !== DEFAULT_MY_QUIZ_FILTER.difficultyMax
  ) {
    result = result.filter(
      (q) =>
        q.difficulty !== undefined &&
        q.difficulty >= filters.difficultyMin &&
        q.difficulty <= filters.difficultyMax
    );
  }

  // キーワードでの絞り込み（問題文と親クイズタイトルが対象）
  if (filters.keyword.trim()) {
    const kw = filters.keyword.toLowerCase().trim();
    result = result.filter(
      (q) =>
        q.question.questionText.toLowerCase().includes(kw) ||
        q.parentQuizTitle.toLowerCase().includes(kw)
    );
  }

  return result;
}
