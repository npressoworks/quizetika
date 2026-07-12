import type { Question, Quiz } from '../types';
import { searchTextIncludes } from './normalize-search-text';
import { questionMatchesKeyword } from './question-search-text';
import type { CreatorQuizStatus } from './creator-quiz-status';
import { resolveCreatorQuizStatus } from './creator-quiz-status';

export interface SearchAuthorQuizzesParams {
  authorId: string;
  keyword?: string;
  tag?: string;
  includeDrafts?: boolean;
  genreId?: string;
  status?: CreatorQuizStatus;
  sortBy?: 'title' | 'playCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

function matchesQuizMetaKeyword(quiz: Quiz, keyword: string): boolean {
  const hay = `${quiz.title} ${quiz.description}`;
  return searchTextIncludes(hay, keyword);
}

function matchesTag(quiz: Quiz, tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return quiz.tags.some((t) => t.toLowerCase() === normalized);
}

function matchesStatus(quiz: Quiz, status: CreatorQuizStatus): boolean {
  return resolveCreatorQuizStatus(quiz) === status;
}

function matchesGenreId(quiz: Quiz, genreId: string): boolean {
  return quiz.canonicalGenreId === genreId;
}

function matchesKeyword(
  quiz: Quiz,
  keyword: string,
  questions: Question[] = []
): boolean {
  if (matchesQuizMetaKeyword(quiz, keyword)) return true;
  return questions.some((q) => questionMatchesKeyword(q, keyword));
}

/**
 * 自作クイズ一覧をキーワード・タグでフィルタ（下書き含む）
 */
export function filterAuthorQuizzes(
  quizzes: Quiz[],
  params: Pick<SearchAuthorQuizzesParams, 'keyword' | 'tag' | 'genreId' | 'status'>
): Quiz[] {
  return filterAuthorQuizzesWithQuestions(quizzes, {}, params);
}

/**
 * 問題データ付きで自作クイズをキーワード・タグ・統合ステータス・ジャンルでフィルタ（AND合成）
 */
export function filterAuthorQuizzesWithQuestions(
  quizzes: Quiz[],
  questionsByQuizId: Record<string, Question[]>,
  params: Pick<SearchAuthorQuizzesParams, 'keyword' | 'tag' | 'genreId' | 'status'>
): Quiz[] {
  return quizzes.filter((quiz) => {
    if (params.tag && !matchesTag(quiz, params.tag)) return false;
    if (params.status && !matchesStatus(quiz, params.status)) return false;
    if (params.genreId && !matchesGenreId(quiz, params.genreId)) return false;
    if (params.keyword?.trim()) {
      const questions = questionsByQuizId[quiz.id] ?? [];
      if (!matchesKeyword(quiz, params.keyword.trim(), questions)) return false;
    }
    return true;
  });
}

/**
 * 自作クイズ一覧を指定した基準・順序で並び替える（入力配列は変更しない）
 */
export function sortAuthorQuizzes(
  quizzes: Quiz[],
  sortBy: 'title' | 'playCount' | 'createdAt',
  sortOrder: 'asc' | 'desc'
): Quiz[] {
  const direction = sortOrder === 'asc' ? 1 : -1;
  return [...quizzes].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else if (sortBy === 'playCount') {
      comparison = a.playCount - b.playCount;
    } else {
      comparison = a.createdAt.getTime() - b.createdAt.getTime();
    }
    return comparison * direction;
  });
}
