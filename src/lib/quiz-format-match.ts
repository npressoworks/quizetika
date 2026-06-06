import type { Quiz } from '../types';
import { resolveQuizFormat, type QuizFormat } from './quiz-format';

/** format 未指定時は true（フィルタ無効） */
export function quizMatchesFormat(
  quiz: Pick<Quiz, 'format' | 'questions'>,
  format: QuizFormat
): boolean {
  return resolveQuizFormat(quiz) === format;
}

export function applyFormatFilter<T extends Pick<Quiz, 'format' | 'questions'>>(
  quizzes: T[],
  format?: QuizFormat
): T[] {
  if (!format) return quizzes;
  return quizzes.filter((quiz) => quizMatchesFormat(quiz, format));
}
