'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getBookmarkedQuestions, getQuestionsByQuiz } from '@/services/question';
import { getLatestQuizzes } from '@/services/quiz';
import { searchAuthorQuizzes } from '@/services/author-quiz-search';
import { getQuiz } from '@/services/quiz';
import {
  filterQuestionCandidatesByKeyword,
  type QuestionAttachCandidate,
  type QuestionAttachSource,
} from '@/lib/question-attach-search';
import type { Question, Quiz } from '@/types';

export type QuestionAttachTab = QuestionAttachSource;

const PUBLIC_EXPLORE_POOL_SIZE = 50;
const KEYWORD_DEBOUNCE_MS = 300;

async function questionsToCandidates(
  questions: Question[],
  parentQuiz: Pick<Quiz, 'id' | 'title'>,
  source: QuestionAttachSource
): Promise<QuestionAttachCandidate[]> {
  return questions.map((q) => ({
    questionId: q.id,
    questionText: q.questionText,
    parentQuizId: parentQuiz.id,
    parentQuizTitle: parentQuiz.title,
    source,
  }));
}

async function fetchOwnPublished(authorId: string): Promise<QuestionAttachCandidate[]> {
  const { quizzes } = await searchAuthorQuizzes({ authorId, includeDrafts: true });
  const published = quizzes.filter((q) => q.status === 'published');
  const groups = await Promise.all(
    published.map(async (quiz) => {
      const questions = await getQuestionsByQuiz(quiz.id);
      return questionsToCandidates(questions, quiz, 'own-published');
    })
  );
  return groups.flat();
}

async function fetchBookmarked(userId: string): Promise<QuestionAttachCandidate[]> {
  const questions = await getBookmarkedQuestions(userId);
  const quizTitleCache = new Map<string, string>();
  const candidates: QuestionAttachCandidate[] = [];

  for (const q of questions) {
    const parentQuizId = q.quizId ?? '';
    let parentTitle = quizTitleCache.get(parentQuizId);
    if (!parentTitle && parentQuizId) {
      const quiz = await getQuiz(parentQuizId);
      parentTitle = quiz?.title ?? '（不明なクイズ）';
      quizTitleCache.set(parentQuizId, parentTitle);
    }
    candidates.push({
      questionId: q.id,
      questionText: q.questionText,
      parentQuizId,
      parentQuizTitle: parentTitle ?? '（不明なクイズ）',
      source: 'bookmarked',
    });
  }
  return candidates;
}

async function fetchPublicExplore(
  authorId: string
): Promise<QuestionAttachCandidate[]> {
  const quizzes = await getLatestQuizzes(PUBLIC_EXPLORE_POOL_SIZE);
  const others = quizzes.filter(
    (q) => q.status === 'published' && q.authorId !== authorId
  );
  const groups = await Promise.all(
    others.map(async (quiz) => {
      const questions = await getQuestionsByQuiz(quiz.id);
      return questionsToCandidates(questions, quiz, 'public-explore');
    })
  );
  return groups.flat();
}

export function useQuestionAttachSearch(
  authorId: string | undefined,
  activeTab: QuestionAttachTab
) {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [rawCandidates, setRawCandidates] = useState<QuestionAttachCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), KEYWORD_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keyword]);

  const loadTab = useCallback(async () => {
    if (!authorId) {
      setRawCandidates([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let fetched: QuestionAttachCandidate[] = [];
      if (activeTab === 'own-published') {
        fetched = await fetchOwnPublished(authorId);
      } else if (activeTab === 'bookmarked') {
        fetched = await fetchBookmarked(authorId);
      } else {
        fetched = await fetchPublicExplore(authorId);
      }
      setRawCandidates(fetched);
    } catch (e) {
      console.error('[useQuestionAttachSearch]', e);
      setError(e instanceof Error ? e.message : '候補の取得に失敗しました');
      setRawCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [authorId, activeTab]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const candidates = useMemo(
    () => filterQuestionCandidatesByKeyword(rawCandidates, debouncedKeyword),
    [rawCandidates, debouncedKeyword]
  );

  return {
    keyword,
    setKeyword,
    candidates,
    loading,
    error,
    refetch: loadTab,
  };
}
