/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '../../src/hooks/useSearchHistory';
import {
  getRecentGenres,
  saveRecentGenre,
  getRecentKeywords,
  saveRecentKeyword,
} from '../../src/lib/search-history';

// localStorage のモック
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Search History Utility & Hook (localStorage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('search-history.ts (純粋なユーティリティ)', () => {
    test('初期状態では空配列が返ること', () => {
      expect(getRecentGenres()).toEqual([]);
      expect(getRecentKeywords()).toEqual([]);
    });

    test('ジャンル履歴を保存でき、重複は排除されて先頭にくること（最大3件）', () => {
      saveRecentGenre('science');
      expect(getRecentGenres()).toEqual(['science']);

      saveRecentGenre('history');
      expect(getRecentGenres()).toEqual(['history', 'science']);

      // 重複時：scienceを再追加すると先頭にくる
      saveRecentGenre('science');
      expect(getRecentGenres()).toEqual(['science', 'history']);

      saveRecentGenre('sports');
      expect(getRecentGenres()).toEqual(['sports', 'science', 'history']);

      // 4件目追加で、一番古い history が消え、最大3件になる
      saveRecentGenre('anime');
      expect(getRecentGenres()).toEqual(['anime', 'sports', 'science']);
    });

    test('キーワード履歴を保存でき、重複は排除されて先頭にくること（最大5件）', () => {
      saveRecentKeyword('js');
      saveRecentKeyword('react');
      saveRecentKeyword('vue');
      saveRecentKeyword('nextjs');
      saveRecentKeyword('svelte');
      
      expect(getRecentKeywords()).toEqual(['svelte', 'nextjs', 'vue', 'react', 'js']);

      // 重複時：jsを再追加すると先頭にくる
      saveRecentKeyword('js');
      expect(getRecentKeywords()).toEqual(['js', 'svelte', 'nextjs', 'vue', 'react']);

      // 6件目追加で、一番古い react が消え、最大5件になる
      saveRecentKeyword('angular');
      expect(getRecentKeywords()).toEqual(['angular', 'js', 'svelte', 'nextjs', 'vue']);
    });
  });

  describe('useSearchHistory.ts (React Hook)', () => {
    test('フック呼び出し時に初期履歴を読み込み、追加操作で状態が更新されること', () => {
      const { result } = renderHook(() => useSearchHistory());

      expect(result.current.recentGenres).toEqual([]);
      expect(result.current.recentKeywords).toEqual([]);

      // ジャンル追加
      act(() => {
        result.current.addRecentGenre('science');
      });
      expect(result.current.recentGenres).toEqual(['science']);

      // キーワード追加
      act(() => {
        result.current.addRecentKeyword('react');
      });
      expect(result.current.recentKeywords).toEqual(['react']);
    });
  });
});
