/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useWeeklyTopGenres, useWeeklyTopSearch } from '../../src/hooks/useWeeklyTrends';

// fetch のモック
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useWeeklyTrends Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useWeeklyTopGenres', () => {
    test('正常に週間人気ジャンルを取得し、loading と data の状態が正しく遷移すること', async () => {
      const mockGenres = [
        { genreId: 'genre-1', playCount: 10 },
        { genreId: 'genre-2', playCount: 5 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ genres: mockGenres }),
      });

      const { result } = renderHook(() => useWeeklyTopGenres());

      // 初期状態は loading が true
      expect(result.current.loading).toBe(true);
      expect(result.current.genres).toEqual([]);
      expect(result.current.error).toBe(false);

      // 非同期取得の完了を待機
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.genres).toEqual(mockGenres);
      expect(result.current.error).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/genres/weekly-top');
    });

    test('API エラーのとき error が true になり loading が false になること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useWeeklyTopGenres());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.genres).toEqual([]);
    });

    test('ネットワークエラー（例外）のとき error が true になり loading が false になること', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Failure'));

      const { result } = renderHook(() => useWeeklyTopGenres());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.genres).toEqual([]);
    });
  });

  describe('useWeeklyTopSearch', () => {
    test('正常に週間人気ワード・タグを取得し、loading と data の状態が正しく遷移すること', async () => {
      const mockKeywords = ['react', 'vue'];
      const mockTags = ['js', 'web'];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ keywords: mockKeywords, tags: mockTags }),
      });

      const { result } = renderHook(() => useWeeklyTopSearch());

      expect(result.current.loading).toBe(true);
      expect(result.current.keywords).toEqual([]);
      expect(result.current.tags).toEqual([]);
      expect(result.current.error).toBe(false);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.keywords).toEqual(mockKeywords);
      expect(result.current.tags).toEqual(mockTags);
      expect(result.current.error).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith('/api/search/weekly-top');
    });

    test('API エラーのとき error が true になること', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useWeeklyTopSearch());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(true);
      expect(result.current.keywords).toEqual([]);
      expect(result.current.tags).toEqual([]);
    });
  });
});
