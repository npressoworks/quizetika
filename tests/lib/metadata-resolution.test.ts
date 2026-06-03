jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import { getDoc } from 'firebase/firestore';
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

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((_db, collectionPath, id) => ({ collectionPath, id })),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
  };
});

describe('metadata-resolution (pure)', () => {
  test('chunkIdsForInQuery: 10件超で分割される', () => {
    const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);
    const chunks = chunkIdsForInQuery(ids);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[2]).toHaveLength(5);
  });

  test('walkCanonicalIdChain: チェーン末端を返す', () => {
    const canonical = walkCanonicalIdChain('a', (id) => {
      if (id === 'a') return 'b';
      if (id === 'b') return null;
      return null;
    });
    expect(canonical).toBe('b');
  });

  test('walkCanonicalIdChain: 循環で拒否', () => {
    expect(() =>
      walkCanonicalIdChain('a', (id) => (id === 'a' ? 'b' : 'a'))
    ).toThrow('循環参照が検出されました');
  });

  test('dedupeQuizzesById: id で重複排除', () => {
    const q = (id: string): Quiz =>
      ({
        id,
        genre: 'g',
        canonicalGenreId: 'g',
        createdAt: new Date(0),
        playCount: 0,
        bookmarksCount: 0,
      }) as Quiz;
    expect(dedupeQuizzesById([q('1'), q('1'), q('2')])).toHaveLength(2);
  });

  test('quizMatchesGenreFilter: genre / canonical のいずれかで一致', () => {
    const expanded = new Set(['parent', 'child']);
    expect(
      quizMatchesGenreFilter(
        { genre: 'child', canonicalGenreId: 'parent' } as Quiz,
        expanded
      )
    ).toBe(true);
    expect(
      quizMatchesGenreFilter(
        { genre: 'other', canonicalGenreId: '' } as Quiz,
        expanded
      )
    ).toBe(false);
  });

  test('sortQuizzesForList: popular は playCount 降順', () => {
    const a = { playCount: 1, bookmarksCount: 0, createdAt: new Date(1) } as Quiz;
    const b = { playCount: 9, bookmarksCount: 0, createdAt: new Date(0) } as Quiz;
    const sorted = sortQuizzesForList([a, b], 'popular');
    expect(sorted[0].playCount).toBe(9);
  });
});

describe('metadata-resolution (Firestore)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('assertActiveGenre: マスタ不在で validation-error', async () => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    await expect(assertActiveGenre('unknown')).rejects.toThrow(MetadataValidationError);
  });

  test('resolveCanonicalGenreId: canonicalId チェーンを解決', async () => {
    (getDoc as jest.Mock).mockImplementation(async (ref: { id: string }) => {
      if (ref.id === 'prog') {
        return { exists: () => true, data: () => ({ canonicalId: 'programming' }) };
      }
      if (ref.id === 'programming') {
        return { exists: () => true, data: () => ({ canonicalId: null }) };
      }
      return { exists: () => false };
    });

    await expect(resolveCanonicalGenreId('prog')).resolves.toBe('programming');
  });

  test('expandGenreIdsForQuery: canonical と merged を含む', async () => {
    (getDoc as jest.Mock).mockImplementation(async (ref: { id: string }) => {
      if (ref.id === 'programming') {
        return {
          exists: () => true,
          data: () => ({
            canonicalId: null,
            mergedGenreIds: ['prog', 'code'],
          }),
        };
      }
      return { exists: () => false };
    });

    const ids = await expandGenreIdsForQuery('programming');
    expect(ids).toEqual(expect.arrayContaining(['programming', 'prog', 'code']));
  });
});
