jest.mock('../../src/lib/firebase/config', () => ({ db: {} }));

import {
  MERGE_MIN_APPROVE_RATE,
  MERGE_MIN_APPROVE_WEIGHT,
  GENRE_MIN_APPROVE_RATE,
  GENRE_MIN_APPROVE_WEIGHT,
} from '../../src/lib/metadata-governance';
import {
  chunkIdsForInQuery,
  dedupeQuizzesById,
  quizMatchesGenreFilter,
} from '../../src/lib/metadata-resolution';

jest.mock('firebase/firestore', () => {
  const original = jest.requireActual('firebase/firestore');
  return {
    ...original,
    doc: jest.fn((_db, _path, id) => ({ id })),
    collection: jest.fn((_db, path) => ({ path })),
    query: jest.fn((ref, ...clauses) => ({ ref, clauses })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    orderBy: jest.fn((field, dir) => ({ field, dir })),
    limit: jest.fn((n) => ({ limit: n })),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    writeBatch: jest.fn(),
    runTransaction: jest.fn(),
  };
});

describe('Phase 6 governance thresholds', () => {
  test('マージ可決: 重み5以上かつ賛成率70%以上', () => {
    const weightedFor = 5;
    const total = 7;
    const rate = weightedFor / total;
    expect(weightedFor >= MERGE_MIN_APPROVE_WEIGHT && rate >= MERGE_MIN_APPROVE_RATE).toBe(true);
    expect(4 >= MERGE_MIN_APPROVE_WEIGHT && rate >= MERGE_MIN_APPROVE_RATE).toBe(false);
  });

  test('ジャンル新設可決: 重み5以上かつ賛成率80%以上', () => {
    const weightedFor = 5;
    const total = 6;
    const rate = weightedFor / total;
    expect(weightedFor >= GENRE_MIN_APPROVE_WEIGHT && rate >= GENRE_MIN_APPROVE_RATE).toBe(true);
    expect(5 >= GENRE_MIN_APPROVE_WEIGHT && 5 / 7 >= GENRE_MIN_APPROVE_RATE).toBe(false);
  });
});

describe('Phase 6 C2 dedupe', () => {
  test('canonical と legacy の重複クイズは1件にまとまる', () => {
    const quiz = (id: string, genre: string, canonicalGenreId: string) =>
      ({
        id,
        genre,
        canonicalGenreId,
        createdAt: new Date(),
        playCount: 0,
        bookmarksCount: 0,
      }) as import('../../src/types').Quiz;

    const merged = dedupeQuizzesById([
      quiz('q1', 'prog', 'programming'),
      quiz('q1', 'programming', 'programming'),
    ]);
    expect(merged).toHaveLength(1);
  });

  test('マージ子ジャンルは親フィルタに含まれる', () => {
    const expanded = new Set(chunkIdsForInQuery(['programming', 'prog', 'code']).flat());
    expect(
      quizMatchesGenreFilter(
        { genre: 'prog', canonicalGenreId: 'programming' } as import('../../src/types').Quiz,
        expanded
      )
    ).toBe(true);
  });
});
