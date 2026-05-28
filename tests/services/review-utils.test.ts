/**
 * Task 2.7 単体テスト: 指摘フィードバックおよび良問評価システム（純粋関数）
 *
 * テスト対象:
 * - calculateReviewScore: 良問スコア（良問率）の計算
 * - getReviewBadge: スコアに応じた評価バッジ名を取得
 * - canVote: 作成者除外チェック
 */

import {
  calculateReviewScore,
  getReviewBadge,
  canVote,
} from '../../src/services/review-utils';

describe('calculateReviewScore', () => {
  test('👍が10件、👎が0件の場合、スコアは1.0', () => {
    expect(calculateReviewScore(10, 0)).toBeCloseTo(1.0);
  });

  test('👍が0件、👎が10件の場合、スコアは0.0', () => {
    expect(calculateReviewScore(0, 10)).toBeCloseTo(0.0);
  });

  test('👍が7件、👎が3件の場合、スコアは0.7', () => {
    expect(calculateReviewScore(7, 3)).toBeCloseTo(0.7);
  });

  test('総投票数が0件の場合、スコアはnullを返す', () => {
    expect(calculateReviewScore(0, 0)).toBeNull();
  });

  test('スコアは0以上1以下の値を返す', () => {
    const score = calculateReviewScore(3, 7);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe('getReviewBadge', () => {
  test('スコア1.0以上は「殿堂入り」バッジ', () => {
    expect(getReviewBadge(1.0)).toBe('殿堂入り');
  });

  test('スコア0.8以上は「良問」バッジ', () => {
    expect(getReviewBadge(0.85)).toBe('良問');
  });

  test('スコア0.6以上0.8未満は「普通」バッジ', () => {
    expect(getReviewBadge(0.65)).toBe('普通');
  });

  test('スコア0.4以上0.6未満は「要改善」バッジ', () => {
    expect(getReviewBadge(0.5)).toBe('要改善');
  });

  test('スコア0.4未満は「悪問」バッジ', () => {
    expect(getReviewBadge(0.3)).toBe('悪問');
  });

  test('スコアがnullの場合はnullを返す', () => {
    expect(getReviewBadge(null)).toBeNull();
  });
});

describe('canVote', () => {
  test('作成者でないユーザーは投票できる', () => {
    expect(canVote('voter_uid', 'author_uid')).toBe(true);
  });

  test('作成者自身は投票できない', () => {
    expect(canVote('author_uid', 'author_uid')).toBe(false);
  });
});
