import type { Question, Quiz } from '../types';
import { searchTextIncludes } from './normalize-search-text';
import { questionMatchesKeyword } from './question-search-text';

export interface SearchAuthorQuizzesParams {
  authorId: string;
  keyword?: string;
  tag?: string;
  includeDrafts?: boolean;
}

function matchesQuizMetaKeyword(quiz: Quiz, keyword: string): boolean {
  const hay = `${quiz.title} ${quiz.description}`;
  return searchTextIncludes(hay, keyword);
}

function matchesTag(quiz: Quiz, tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return quiz.tags.some((t) => t.toLowerCase() === normalized);
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
  params: Pick<SearchAuthorQuizzesParams, 'keyword' | 'tag'>
): Quiz[] {
  return filterAuthorQuizzesWithQuestions(quizzes, {}, params);
}

/**
 * 設問データ付きで自作クイズをキーワード・タグでフィルタ
 */
export function filterAuthorQuizzesWithQuestions(
  quizzes: Quiz[],
  questionsByQuizId: Record<string, Question[]>,
  params: Pick<SearchAuthorQuizzesParams, 'keyword' | 'tag'>
): Quiz[] {
  return quizzes.filter((quiz) => {
    if (params.tag && !matchesTag(quiz, params.tag)) return false;
    if (params.keyword?.trim()) {
      const questions = questionsByQuizId[quiz.id] ?? [];
      if (!matchesKeyword(quiz, params.keyword.trim(), questions)) return false;
    }
    return true;
  });
}
