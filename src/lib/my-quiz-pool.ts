import { resolveQuizFormat } from '@/lib/quiz-format';
import { searchAuthorQuizzes } from '@/services/author-quiz-search';
import { enrichBookmarkedQuestions, getBookmarkedQuizzes } from '@/services/bookmark';
import { getQuestionsByQuiz } from '@/services/question';
import { getQuiz } from '@/services/quiz';
import type { QuizFormat } from '@/lib/quiz-format';
import type { Question, Quiz } from '@/types';

export type MyQuizSource = 'own' | 'bookmarked-quiz' | 'bookmarked-question';

export interface MyQuizQuestionCandidate {
  questionId: string;
  questionText: string;
  parentQuizId: string;
  parentQuizTitle: string;
  source: MyQuizSource;
  genreId: string;
  tags: string[];
  format: QuizFormat;
  /** 親クイズ difficulty（1–5） */
  difficulty: number;
}

export interface MyQuizSourceFlags {
  ownQuizzes: boolean;
  bookmarkedQuizzes: boolean;
  bookmarkedQuestions: boolean;
}

export function candidateMatchesSourceFlags(
  candidate: MyQuizQuestionCandidate,
  flags: MyQuizSourceFlags
): boolean {
  switch (candidate.source) {
    case 'own':
      return flags.ownQuizzes;
    case 'bookmarked-quiz':
      return flags.bookmarkedQuizzes;
    case 'bookmarked-question':
      return flags.bookmarkedQuestions;
    default:
      return false;
  }
}

export function filterCandidatesBySourceFlags(
  candidates: MyQuizQuestionCandidate[],
  flags: MyQuizSourceFlags
): MyQuizQuestionCandidate[] {
  return candidates.filter((candidate) => candidateMatchesSourceFlags(candidate, flags));
}

function dedupeMyQuizCandidates(
  candidates: MyQuizQuestionCandidate[]
): MyQuizQuestionCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((c) => {
    if (seen.has(c.questionId)) return false;
    seen.add(c.questionId);
    return true;
  });
}

function toCandidate(
  question: Question,
  parentQuiz: Quiz,
  source: MyQuizSource
): MyQuizQuestionCandidate {
  return {
    questionId: question.id,
    questionText: question.questionText,
    parentQuizId: parentQuiz.id,
    parentQuizTitle: parentQuiz.title,
    source,
    genreId: parentQuiz.canonicalGenreId ?? parentQuiz.genre ?? 'general',
    tags: parentQuiz.tags ?? [],
    format: resolveQuizFormat(parentQuiz),
    difficulty: parentQuiz.difficulty ?? 3,
  };
}

async function collectOwnQuizzes(userId: string): Promise<MyQuizQuestionCandidate[]> {
  const { quizzes } = await searchAuthorQuizzes({ authorId: userId, includeDrafts: true });
  const groups = await Promise.all(
    quizzes.map(async (quiz) => {
      const questions = await getQuestionsByQuiz(quiz.id);
      return questions.map((q) => toCandidate(q, quiz, 'own'));
    })
  );
  return groups.flat();
}

async function collectBookmarkedQuizzes(userId: string): Promise<MyQuizQuestionCandidate[]> {
  const quizzes = await getBookmarkedQuizzes(userId);
  const published = quizzes.filter((q) => q.status === 'published');
  const groups = await Promise.all(
    published.map(async (quiz) => {
      const questions = await getQuestionsByQuiz(quiz.id);
      return questions.map((q) => toCandidate(q, quiz, 'bookmarked-quiz'));
    })
  );
  return groups.flat();
}

async function collectBookmarkedQuestions(userId: string): Promise<MyQuizQuestionCandidate[]> {
  const entries = await enrichBookmarkedQuestions(userId);
  const candidates: MyQuizQuestionCandidate[] = [];

  for (const { question, parentQuizId, parentQuizTitle } of entries) {
    const parentQuiz = parentQuizId ? await getQuiz(parentQuizId) : null;
    if (parentQuiz) {
      candidates.push(toCandidate(question, parentQuiz, 'bookmarked-question'));
    } else {
      candidates.push({
        questionId: question.id,
        questionText: question.questionText,
        parentQuizId,
        parentQuizTitle,
        source: 'bookmarked-question',
        genreId: 'general',
        tags: [],
        format: resolveQuizFormat({ questions: [question] }),
        difficulty: 3,
      });
    }
  }

  return candidates;
}

/**
 * 有効化された取得元のみを統合し、問題候補配列を返す（questionId 先勝ち dedupe）
 */
export async function buildMyQuizQuestionPool(
  userId: string,
  flags: MyQuizSourceFlags
): Promise<MyQuizQuestionCandidate[]> {
  const groups: MyQuizQuestionCandidate[][] = [];

  if (flags.ownQuizzes) {
    groups.push(await collectOwnQuizzes(userId));
  }
  if (flags.bookmarkedQuizzes) {
    groups.push(await collectBookmarkedQuizzes(userId));
  }
  if (flags.bookmarkedQuestions) {
    groups.push(await collectBookmarkedQuestions(userId));
  }

  if (groups.length === 0) {
    return [];
  }

  return dedupeMyQuizCandidates(groups.flat());
}
