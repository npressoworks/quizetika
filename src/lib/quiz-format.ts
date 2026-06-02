import { Question, Quiz } from '@/types';

export type QuizFormat = NonNullable<Quiz['format']>;

const SINGLE_FORMAT_TYPES: QuizFormat[] = [
  'multiple-choice',
  'text-input',
  'quick-press',
  'sorting',
  'association',
  'lateral-thinking',
];

const MIXED_ALLOWED_QUESTION_TYPES = new Set([
  'multiple-choice',
  'true-false',
  'text-input',
  'sorting',
]);

/**
 * 編集画面表示用。Firestore に format が無い旧データは設問 type から推定する。
 */
export function resolveQuizFormat(
  quiz: Pick<Quiz, 'format' | 'questions'>
): QuizFormat {
  if (quiz.format) {
    return quiz.format;
  }

  const types = quiz.questions.map((q) => q.type);
  if (types.length === 0) {
    return 'mixed';
  }

  const unique = new Set(types);

  if (unique.size === 1) {
    const only = types[0];
    if (SINGLE_FORMAT_TYPES.includes(only as QuizFormat)) {
      return only as QuizFormat;
    }
    if (only === 'true-false') {
      return 'mixed';
    }
  }

  if (types.every((t) => MIXED_ALLOWED_QUESTION_TYPES.has(t))) {
    return 'mixed';
  }

  return 'mixed';
}

export function resolveQuizFormatFromQuestions(questions: Question[]): QuizFormat {
  return resolveQuizFormat({ questions });
}
