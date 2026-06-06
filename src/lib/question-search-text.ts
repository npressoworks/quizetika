import type { Question } from '@/types';
import { searchTextIncludes } from '@/lib/normalize-search-text';

/** 設問タイプに応じた正解テキスト（検索照合用）を返す。aiContextDetails は含めない。 */
export function getQuestionAnswerSearchTexts(question: Question): string[] {
  switch (question.type) {
    case 'multiple-choice':
    case 'true-false':
      return (question.choices ?? [])
        .filter((c) => c.isCorrect)
        .map((c) => c.choiceText);
    case 'text-input':
    case 'quick-press':
    case 'association':
      return question.correctTextAnswerList ?? [];
    case 'sorting':
      return (question.sortingItems ?? []).map((item) => item.text);
    case 'lateral-thinking':
      return question.truthKeywords ?? [];
    default:
      return [];
  }
}

/** 設問の問題文 + 正解テキストをフラット配列で返す */
export function getQuestionSearchableTexts(question: Question): string[] {
  return [question.questionText, ...getQuestionAnswerSearchTexts(question)].filter(
    (text) => text.trim().length > 0
  );
}

/** キーワードが問題文に部分一致するか */
export function questionTextMatchesKeyword(question: Question, keyword: string): boolean {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  return searchTextIncludes(question.questionText, trimmed);
}

/** キーワードが問題文または正解テキストのいずれかに部分一致するか */
export function questionMatchesKeyword(question: Question, keyword: string): boolean {
  const trimmed = keyword.trim();
  if (!trimmed) return true;
  return getQuestionSearchableTexts(question).some((text) =>
    searchTextIncludes(text, trimmed)
  );
}

/** キーワードに一致する設問のみ返す */
export function filterQuestionsMatchingKeyword(
  questions: Question[],
  keyword: string
): Question[] {
  const trimmed = keyword.trim();
  if (!trimmed) return questions;
  return questions.filter((q) => questionMatchesKeyword(q, trimmed));
}

/** 問題文ヒットを先頭に、表示用に並べ替えた設問リスト */
export function sortQuestionsForKeywordDisplay(
  questions: Question[],
  keyword: string
): Question[] {
  const trimmed = keyword.trim();
  if (!trimmed) return questions;
  const matching = filterQuestionsMatchingKeyword(questions, trimmed);
  const textHits = matching.filter((q) => questionTextMatchesKeyword(q, trimmed));
  const answerOnlyHits = matching.filter((q) => !questionTextMatchesKeyword(q, trimmed));
  return [...textHits, ...answerOnlyHits];
}

/** 問題文でキーワードに一致する設問が1件以上あるか */
export function quizHasQuestionTextMatch(questions: Question[], keyword: string): boolean {
  const trimmed = keyword.trim();
  if (!trimmed) return false;
  return questions.some((q) => questionTextMatchesKeyword(q, trimmed));
}
