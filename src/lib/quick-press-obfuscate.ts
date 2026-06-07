import { Question } from '@/types';

function encodeAnswer(answer: string): string {
  return btoa(unescape(encodeURIComponent(answer)));
}

/**
 * プレイ画面向け quick-press 難読化（本文は空、正解のみ Base64）。
 * 早押し問題文は API ストリームで配信する。
 */
export function obfuscateQuickPressQuestions(questions: Question[]): Question[] {
  return questions.map((q) => {
    if (q.type !== 'quick-press') return q;
    return {
      ...q,
      questionText: '',
      correctTextAnswerList:
        q.correctTextAnswerList?.map((ans) => encodeAnswer(ans)) ?? [],
    };
  });
}

export function obfuscateQuickPressQuiz<T extends { questions?: Question[] }>(
  quiz: T
): T {
  if (!quiz.questions?.length) return quiz;
  return {
    ...quiz,
    questions: obfuscateQuickPressQuestions(quiz.questions),
  };
}
