import {
  MERGE_MIN_APPROVE_RATE,
  MERGE_MIN_APPROVE_WEIGHT,
  GENRE_MIN_APPROVE_RATE,
  GENRE_MIN_APPROVE_WEIGHT,
} from '../../src/lib/metadata-governance';

describe('TagMergeService threshold constants', () => {
  test('マージ可決閾値は 70% / 重み5', () => {
    expect(MERGE_MIN_APPROVE_WEIGHT).toBe(5);
    expect(MERGE_MIN_APPROVE_RATE).toBe(0.7);
  });

  test('ジャンル新設可決閾値は 80% / 重み5', () => {
    expect(GENRE_MIN_APPROVE_WEIGHT).toBe(5);
    expect(GENRE_MIN_APPROVE_RATE).toBe(0.8);
  });
});
