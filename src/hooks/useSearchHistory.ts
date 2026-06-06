import { useState, useEffect } from 'react';
import {
  getRecentGenres,
  saveRecentGenre,
  getRecentKeywords,
  saveRecentKeyword,
} from '@/lib/search-history';

export interface UseSearchHistoryResult {
  recentGenres: string[];
  recentKeywords: string[];
  addRecentGenre: (genreId: string) => void;
  addRecentKeyword: (keyword: string) => void;
}

export function useSearchHistory(): UseSearchHistoryResult {
  const [recentGenres, setRecentGenres] = useState<string[]>([]);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);

  // 初期ロード
  useEffect(() => {
    setRecentGenres(getRecentGenres());
    setRecentKeywords(getRecentKeywords());
  }, []);

  const addRecentGenre = (genreId: string) => {
    saveRecentGenre(genreId);
    setRecentGenres(getRecentGenres());
  };

  const addRecentKeyword = (keyword: string) => {
    saveRecentKeyword(keyword);
    setRecentKeywords(getRecentKeywords());
  };

  return {
    recentGenres,
    recentKeywords,
    addRecentGenre,
    addRecentKeyword,
  };
}
