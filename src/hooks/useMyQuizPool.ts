'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildMyQuizQuestionPool,
  filterCandidatesBySourceFlags,
  type MyQuizQuestionCandidate,
  type MyQuizSourceFlags,
} from '@/lib/my-quiz-pool';
import {
  DEFAULT_MY_QUIZ_FILTER,
  filterMyQuizCandidates,
  type MyQuizFilterState,
} from '@/lib/my-quiz-filter';
import type { MyQuizSessionEntry } from '@/lib/my-quiz-session';

export type MyQuizCountPreset = '10' | '20' | 'all' | 'custom';

export interface MyQuizPlaySettingsState {
  countPreset: MyQuizCountPreset;
  customCount: number;
  shuffle: boolean;
}

export const DEFAULT_MY_QUIZ_PLAY_SETTINGS: MyQuizPlaySettingsState = {
  countPreset: '10',
  customCount: 10,
  shuffle: true,
};

export function resolveEffectivePlayCount(
  filteredCount: number,
  settings: MyQuizPlaySettingsState
): number {
  if (filteredCount === 0) return 0;
  if (settings.countPreset === 'all') return filteredCount;
  const requested =
    settings.countPreset === 'custom'
      ? settings.customCount
      : parseInt(settings.countPreset, 10);
  return Math.min(Math.max(1, requested), filteredCount);
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildFinalEntries(
  candidates: MyQuizQuestionCandidate[],
  settings: MyQuizPlaySettingsState
): MyQuizSessionEntry[] {
  const effective = resolveEffectivePlayCount(candidates.length, settings);
  if (effective === 0) return [];

  const sorted = [...candidates].sort((a, b) => {
    const titleCmp = a.parentQuizTitle.localeCompare(b.parentQuizTitle);
    if (titleCmp !== 0) return titleCmp;
    return a.questionId.localeCompare(b.questionId);
  });

  const ordered = settings.shuffle ? shuffleArray(sorted) : sorted;
  return ordered.slice(0, effective).map((c) => ({
    questionId: c.questionId,
    parentQuizId: c.parentQuizId,
  }));
}

export function useMyQuizPool(userId: string | undefined) {
  const [sourceFlags, setSourceFlags] = useState<MyQuizSourceFlags>({
    ownQuizzes: true,
    bookmarkedQuizzes: true,
    bookmarkedQuestions: true,
  });
  const [filters, setFilters] = useState<MyQuizFilterState>(DEFAULT_MY_QUIZ_FILTER);
  const [playSettings, setPlaySettings] = useState<MyQuizPlaySettingsState>(
    DEFAULT_MY_QUIZ_PLAY_SETTINGS
  );
  const [rawCandidates, setRawCandidates] = useState<MyQuizQuestionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const fetchIdRef = useRef(0);
  const prevSourceFlagsRef = useRef(sourceFlags);

  const hasAnySource =
    sourceFlags.ownQuizzes ||
    sourceFlags.bookmarkedQuizzes ||
    sourceFlags.bookmarkedQuestions;

  useEffect(() => {
    hasLoadedOnceRef.current = false;
    fetchIdRef.current = 0;
    prevSourceFlagsRef.current = sourceFlags;
    setRawCandidates([]);
    setError(null);
    setLoading(false);
  }, [userId]);

  const fetchPool = useCallback(async () => {
    if (!userId || !hasAnySource) {
      setLoading(false);
      return;
    }
    const fetchId = ++fetchIdRef.current;
    const isInitialLoad = !hasLoadedOnceRef.current;
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);
    try {
      const pool = await buildMyQuizQuestionPool(userId, sourceFlags);
      if (fetchId !== fetchIdRef.current) return;
      setRawCandidates(pool);
      hasLoadedOnceRef.current = true;
    } catch (e) {
      if (fetchId !== fetchIdRef.current) return;
      console.error('[useMyQuizPool]', e);
      setError(e instanceof Error ? e.message : '問題プールの取得に失敗しました');
      if (isInitialLoad) {
        setRawCandidates([]);
      }
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [userId, sourceFlags, hasAnySource]);

  useEffect(() => {
    if (!userId || !hasAnySource) {
      setLoading(false);
      return;
    }

    const enabledNewSource = (
      Object.keys(sourceFlags) as (keyof MyQuizSourceFlags)[]
    ).some((key) => sourceFlags[key] && !prevSourceFlagsRef.current[key]);
    const isFirstLoad = !hasLoadedOnceRef.current;

    prevSourceFlagsRef.current = sourceFlags;

    if (isFirstLoad || enabledNewSource) {
      void fetchPool();
    }
  }, [userId, hasAnySource, sourceFlags, fetchPool]);

  const sourceScopedCandidates = useMemo(() => {
    if (!hasAnySource) return [];
    return filterCandidatesBySourceFlags(rawCandidates, sourceFlags);
  }, [rawCandidates, sourceFlags, hasAnySource]);

  const filteredCandidates = useMemo(
    () => filterMyQuizCandidates(sourceScopedCandidates, filters),
    [sourceScopedCandidates, filters]
  );

  const filteredCount = filteredCandidates.length;
  const effectivePlayCount = resolveEffectivePlayCount(filteredCount, playSettings);

  const buildEntries = useCallback(
    () => buildFinalEntries(filteredCandidates, playSettings),
    [filteredCandidates, playSettings]
  );

  return {
    sourceFlags,
    setSourceFlags,
    filters,
    setFilters,
    playSettings,
    setPlaySettings,
    rawCandidates,
    filteredCandidates,
    filteredCount,
    effectivePlayCount,
    buildEntries,
    loading,
    error,
    hasAnySource,
    refetch: fetchPool,
  };
}
