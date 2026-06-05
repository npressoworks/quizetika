import type { Quiz } from '../types';

export interface SearchAuthorQuizzesParams {
  authorId: string;
  keyword?: string;
  tag?: string;
  includeDrafts?: boolean;
}

function matchesKeyword(quiz: Quiz, keyword: string): boolean {
  const hay = `${quiz.title} ${quiz.description}`.toLowerCase();
  return hay.includes(keyword.toLowerCase());
}

function matchesTag(quiz: Quiz, tag: string): boolean {
  const normalized = tag.trim().toLowerCase();
  return quiz.tags.some((t) => t.toLowerCase() === normalized);
}

/**
 * 自作クイズ一覧をキーワード・タグでフィルタ（下書き含む）
 */
export function filterAuthorQuizzes(
  quizzes: Quiz[],
  params: Pick<SearchAuthorQuizzesParams, 'keyword' | 'tag'>
): Quiz[] {
  return quizzes.filter((quiz) => {
    if (params.tag && !matchesTag(quiz, params.tag)) return false;
    if (params.keyword?.trim() && !matchesKeyword(quiz, params.keyword.trim())) return false;
    return true;
  });
}
