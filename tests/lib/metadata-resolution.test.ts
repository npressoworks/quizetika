let mockSupabase: any;

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    if (!mockSupabase) {
      mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(),
        insert: jest.fn(),
      };
    }
    return mockSupabase;
  },
}));

import {
  chunkIdsForInQuery,
  dedupeQuizzesById,
  quizMatchesGenreFilter,
  sortQuizzesForList,
  walkCanonicalIdChain,
  MetadataValidationError,
  assertActiveGenre,
  resolveCanonicalGenreId,
  expandGenreIdsForQuery,
} from '../../src/lib/metadata-resolution';
import type { Quiz } from '../../src/types';


describe('metadata-resolution (pure)', () => {
  test('chunkIdsForInQuery: 10件超で分割される', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const chunks = chunkIdsForInQuery(ids);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[2]).toHaveLength(5);
  });

  test('chunkIdsForInQuery: 重複排除される', () => {
    const ids = ['a', 'b', 'a', '', 'b'];
    const chunks = chunkIdsForInQuery(ids);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual(['a', 'b']);
  });

  test('dedupeQuizzesById: 重複排除される', () => {
    const quizzes = [
      { id: '1', title: 'a' },
      { id: '2', title: 'b' },
      { id: '1', title: 'a2' },
    ] as Quiz[];
    const deduped = dedupeQuizzesById(quizzes);
    expect(deduped).toHaveLength(2);
    expect(deduped.map((q) => q.title)).toEqual(['a2', 'b']);
  });

  test('quizMatchesGenreFilter: genre が一致するか', () => {
    const expanded = new Set(['programming', 'coding']);
    expect(
      quizMatchesGenreFilter(
        { genre: 'programming', canonicalGenreId: '' } as Quiz,
        expanded
      )
    ).toBe(true);
    expect(
      quizMatchesGenreFilter(
        { genre: 'prog', canonicalGenreId: 'programming' } as Quiz,
        expanded
      )
    ).toBe(true);
    expect(
      quizMatchesGenreFilter(
        { genre: 'history', canonicalGenreId: '' } as Quiz,
        expanded
      )
    ).toBe(false);
  });

  test('sortQuizzesForList: popular は playCount 降順', () => {
    const a = { playCount: 1, bookmarksCount: 0, createdAt: new Date(1) } as any;
    const b = { playCount: 9, bookmarksCount: 0, createdAt: new Date(0) } as any;
    const sorted = sortQuizzesForList([a, b], 'popular');
    expect(sorted[0].playCount).toBe(9);
  });

  test('sortQuizzesForList: latest は Firestore Timestamp 風オブジェクトでも降順', () => {
    const older = {
      playCount: 0,
      bookmarksCount: 0,
      createdAt: { seconds: 100, toDate: () => new Date(100_000) },
    } as any;
    const newer = {
      playCount: 0,
      bookmarksCount: 0,
      createdAt: { seconds: 200, toDate: () => new Date(200_000) },
    } as any;
    const sorted = sortQuizzesForList([older, newer], 'latest');
    expect(sorted[0].createdAt).toBe(newer.createdAt);
  });
});

describe('metadata-resolution (Supabase)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  test('assertActiveGenre: マスタ不在で validation-error', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(assertActiveGenre('unknown')).rejects.toThrow(MetadataValidationError);
  });

  test('resolveCanonicalGenreId: canonicalId チェーンを解決', async () => {
    mockSupabase.maybeSingle.mockImplementation(async () => {
      const lastId = mockSupabase.eq.mock.lastCall?.[1];
      if (lastId === 'prog') {
        return {
          data: {
            id: 'prog',
            display_name: 'Prog',
            is_active: true,
            canonical_id: 'programming',
            merged_genre_ids: [],
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      if (lastId === 'programming') {
        return {
          data: {
            id: 'programming',
            display_name: 'Programming',
            is_active: true,
            canonical_id: null,
            merged_genre_ids: ['prog', 'code'],
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    await expect(resolveCanonicalGenreId('prog')).resolves.toBe('programming');
  });

  test('expandGenreIdsForQuery: canonical と merged を含む', async () => {
    mockSupabase.maybeSingle.mockImplementation(async () => {
      const lastId = mockSupabase.eq.mock.lastCall?.[1];
      if (lastId === 'programming') {
        return {
          data: {
            id: 'programming',
            display_name: 'Programming',
            is_active: true,
            canonical_id: null,
            merged_genre_ids: ['prog', 'code'],
            created_at: new Date().toISOString(),
          },
          error: null,
        };
      }
      return { data: null, error: null };
    });

    const ids = await expandGenreIdsForQuery('programming');
    expect(ids).toEqual(expect.arrayContaining(['programming', 'prog', 'code']));
  });
});
