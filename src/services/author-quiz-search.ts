import { getQuizzesByAuthor } from './quiz';
import { getQuestionsByQuiz } from './question';
import {
  filterAuthorQuizzes,
  type SearchAuthorQuizzesParams,
} from '../lib/author-quiz-search';

export type { SearchAuthorQuizzesParams };
export { filterAuthorQuizzes };

export async function searchAuthorQuizzes(
  params: SearchAuthorQuizzesParams
): Promise<import('../types').Quiz[]> {
  const includeDrafts = params.includeDrafts ?? true;
  const quizzes = await getQuizzesByAuthor(params.authorId, includeDrafts);
  return filterAuthorQuizzes(quizzes, params);
}

export { getQuestionsByQuiz };
