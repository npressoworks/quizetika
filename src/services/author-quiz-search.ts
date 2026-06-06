import type { Question, Quiz } from '../types';
import { getQuizzesByAuthor } from './quiz';
import { getQuestionsByQuiz } from './question';
import {
  filterAuthorQuizzes,
  filterAuthorQuizzesWithQuestions,
  type SearchAuthorQuizzesParams,
} from '../lib/author-quiz-search';

export type { SearchAuthorQuizzesParams };
export { filterAuthorQuizzes, filterAuthorQuizzesWithQuestions };

export interface AuthorQuizSearchResult {
  quizzes: Quiz[];
  questionsByQuizId: Record<string, Question[]>;
}

export async function searchAuthorQuizzes(
  params: SearchAuthorQuizzesParams
): Promise<AuthorQuizSearchResult> {
  const includeDrafts = params.includeDrafts ?? true;
  const quizzes = await getQuizzesByAuthor(params.authorId, includeDrafts);

  const keyword = params.keyword?.trim();
  if (!keyword) {
    return {
      quizzes: filterAuthorQuizzes(quizzes, params),
      questionsByQuizId: {},
    };
  }

  const questionsByQuizId: Record<string, Question[]> = {};
  await Promise.all(
    quizzes.map(async (quiz) => {
      try {
        questionsByQuizId[quiz.id] = await getQuestionsByQuiz(quiz.id);
      } catch {
        questionsByQuizId[quiz.id] = [];
      }
    })
  );

  return {
    quizzes: filterAuthorQuizzesWithQuestions(quizzes, questionsByQuizId, params),
    questionsByQuizId,
  };
}

export { getQuestionsByQuiz };
