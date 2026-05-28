/**
 * Task 2.8 単体テスト: モデレーションおよびメタデータ自治ガバナンス（純粋関数）
 *
 * テスト対象:
 * - isSuspendThresholdReached: 5回通報閾値チェック
 * - calculateMergeVoteWeight: モデレータ重み付き投票計算
 * - isGenreRequestApproved: ジャンル申請の可決判定
 */

import {
  isSuspendThresholdReached,
  calculateMergeVoteWeight,
  isGenreRequestApproved,
} from '../../src/services/moderation-utils';

describe('isSuspendThresholdReached', () => {
  test('5回未満はfalse', () => {
    expect(isSuspendThresholdReached(4)).toBe(false);
  });

  test('ちょうど5回でtrueになる', () => {
    expect(isSuspendThresholdReached(5)).toBe(true);
  });

  test('5回超過もtrue', () => {
    expect(isSuspendThresholdReached(6)).toBe(true);
  });

  test('0回はfalse', () => {
    expect(isSuspendThresholdReached(0)).toBe(false);
  });
});

describe('calculateMergeVoteWeight', () => {
  test('newcomerの投票重みは1', () => {
    expect(calculateMergeVoteWeight('newcomer')).toBe(1);
  });

  test('contributorの投票重みは1', () => {
    expect(calculateMergeVoteWeight('contributor')).toBe(1);
  });

  test('moderatorの投票重みは1', () => {
    expect(calculateMergeVoteWeight('moderator')).toBe(1);
  });

  test('senior_moderatorの投票重みは2', () => {
    expect(calculateMergeVoteWeight('senior_moderator')).toBe(2);
  });
});

describe('isGenreRequestApproved', () => {
  test('重み付き投票が5以上かつ承認率80%以上で可決', () => {
    // 重み合計6、承認重み5、承認率 5/6 ≈ 83%
    expect(isGenreRequestApproved(5, 6)).toBe(true);
  });

  test('重み付き投票が5以上でも承認率80%未満は否決', () => {
    // 重み合計10、承認重み7、承認率 7/10 = 70%
    expect(isGenreRequestApproved(7, 10)).toBe(false);
  });

  test('承認率が80%以上でも投票重みが5未満は否決', () => {
    // 重み合計4、承認重み4、承認率 100%
    expect(isGenreRequestApproved(4, 4)).toBe(false);
  });

  test('承認重みが5以上かつ承認率ちょうど80%で可決', () => {
    // 重み合計10、承認重み8、承認率 80%
    expect(isGenreRequestApproved(8, 10)).toBe(true);
  });

  test('総投票が0件は否決', () => {
    expect(isGenreRequestApproved(0, 0)).toBe(false);
  });
});
