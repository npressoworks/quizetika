import { Attempt, Question, QuestionAnswerRecord } from '@/types';

export function getUserAnswerRaw(
  questionAnswers: QuestionAnswerRecord[] | undefined,
  questionId: string
): string | undefined {
  return questionAnswers?.find((a) => a.questionId === questionId)?.userAnswer;
}

export function toQuestionAnswerRecords(
  answers: Record<string, string> | undefined
): QuestionAnswerRecord[] {
  if (!answers) return [];
  return Object.entries(answers).map(([questionId, userAnswer]) => ({ questionId, userAnswer }));
}

export function formatUserAnswer(
  question: Question,
  rawAnswer: string | undefined,
  mode?: Attempt['mode'],
  hasStoredAnswers = true
): string {
  if (rawAnswer === undefined || rawAnswer === '') {
    return hasStoredAnswers ? '未回答' : '（記録なし）';
  }

  if (mode === 'flashcard') {
    if (rawAnswer === 'correct') return '覚えていた';
    if (rawAnswer === 'incorrect') return '覚えていなかった';
  }

  switch (question.type) {
    case 'multiple-choice':
    case 'true-false': {
      const choice = question.choices?.find((c) => c.id === rawAnswer);
      return choice?.choiceText ?? rawAnswer;
    }
    case 'text-input':
    case 'association':
    case 'quick-press':
      return rawAnswer;
    case 'sorting': {
      const ids = rawAnswer.split(',').filter(Boolean);
      return ids
        .map((id) => question.sortingItems?.find((item) => item.id === id)?.text ?? id)
        .join(' → ');
    }
    case 'lateral-thinking':
      return rawAnswer;
    default:
      return rawAnswer;
  }
}

export function formatCorrectAnswer(question: Question): string {
  switch (question.type) {
    case 'multiple-choice':
    case 'true-false': {
      const correctChoices = question.choices?.filter((c) => c.isCorrect) ?? [];
      return correctChoices.map((c) => c.choiceText).join(' / ') || '—';
    }
    case 'text-input':
    case 'association':
      return question.correctTextAnswerList?.join(' / ') || '—';
    case 'quick-press':
      return (
        question.correctTextAnswerList
          ?.map((ans) => {
            try {
              return decodeURIComponent(escape(atob(ans)));
            } catch {
              return ans;
            }
          })
          .join(' / ') || '—'
      );
    case 'sorting': {
      const items = [...(question.sortingItems ?? [])].sort((a, b) => a.correctOrder - b.correctOrder);
      return items.map((item) => item.text).join(' → ') || '—';
    }
    case 'lateral-thinking':
      return question.truthKeywords?.join(' / ') || '—';
    default:
      return '—';
  }
}
