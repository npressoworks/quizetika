import { useState, useCallback } from 'react';
import { DashboardPeriod } from '@/types/dashboard';

export interface DashboardFilters {
  period: DashboardPeriod;
  genreId?: string;
  tag?: string;
  questionType?: string;
  mode?: string;
  format?: string;
  visibility?: 'public' | 'followers' | 'private';
}

export function useDashboardFilters(initialPeriod: DashboardPeriod = '30d') {
  const [filters, setFilters] = useState<DashboardFilters>({
    period: initialPeriod,
  });

  const setPeriod = useCallback((period: DashboardPeriod) => {
    setFilters((prev) => ({ ...prev, period }));
  }, []);

  const setGenreId = useCallback((genreId?: string) => {
    setFilters((prev) => ({ ...prev, genreId: genreId || undefined }));
  }, []);

  const setTag = useCallback((tag?: string) => {
    setFilters((prev) => ({ ...prev, tag: tag || undefined }));
  }, []);

  const setQuestionType = useCallback((questionType?: string) => {
    setFilters((prev) => ({ ...prev, questionType: questionType || undefined }));
  }, []);

  const setMode = useCallback((mode?: string) => {
    setFilters((prev) => ({ ...prev, mode: mode || undefined }));
  }, []);

  const setFormat = useCallback((format?: string) => {
    setFilters((prev) => ({ ...prev, format: format || undefined }));
  }, []);

  const setVisibility = useCallback((visibility?: 'public' | 'followers' | 'private') => {
    setFilters((prev) => ({ ...prev, visibility: visibility || undefined }));
  }, []);

  const reset = useCallback(() => {
    setFilters({ period: initialPeriod });
  }, [initialPeriod]);

  return {
    filters,
    setFilters,
    setPeriod,
    setGenreId,
    setTag,
    setQuestionType,
    setMode,
    setFormat,
    setVisibility,
    reset,
  };
}
