/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useListsSearch } from '../../src/hooks/useListsSearch';
import { searchLists } from '../../src/services/quiz-list';

jest.mock('../../src/services/quiz-list', () => ({
  searchLists: jest.fn(),
  DEFAULT_LIST_SEARCH_LIMIT: 50,
}));

describe('useListsSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('public visibility で searchLists を呼ぶ', async () => {
    (searchLists as jest.Mock).mockResolvedValue([]);
    const { result } = renderHook(() => useListsSearch('user-1', 'public'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(searchLists).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'public', limit: 50 })
    );
  });

  test('keyword デバウンス後に searchLists が再呼び出しされる', async () => {
    (searchLists as jest.Mock).mockResolvedValue([]);
    const { result } = renderHook(() => useListsSearch('user-1', 'public'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    result.current.setKeyword('react');
    jest.advanceTimersByTime(300);

    await waitFor(() =>
      expect(searchLists).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'react' })
      )
    );
  });

  test('private かつ userId なしでは fetch しない', async () => {
    const { result } = renderHook(() => useListsSearch(undefined, 'private'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(searchLists).not.toHaveBeenCalled();
    expect(result.current.lists).toEqual([]);
  });
});
