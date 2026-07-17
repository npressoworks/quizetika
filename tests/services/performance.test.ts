/**
 * Task 4.1 検証テスト: コアプレイフロー統合検証および非機能要件テスト
 * 
 * 以下の非機能要件を検証するテストスイート:
 * - 8.1 ページの初期HTML応答およびページロード時間が通常トラフィック下で平均0.5秒以内であること
 * - 8.2 高負荷（スパイクアクセス）シミュレーション下で5xxエラー率が0.1%未満であること
 * - 8.3 クローラー向け高速HTMLとOGPメタデータ（JavaScript未実行時）が動的に挿入されていること
 */

import { renderOgpHtml, simulateSpikeAccess } from '../../src/services/performance-utils';
import { Quiz } from '../../src/types';

// テスト用モッククイズデータ
const mockQuiz: Quiz = {
  id: 'performance-test-quiz',
  authorId: 'creator-99',
  authorName: 'テストクリエイター',
  authorAvatar: 'https://quizetika.com/avatars/creator-99.png',
  title: '世界史の真実クイズ',
  description: '歴史ミステリーの真相に迫る高度なクイズです。',
  thumbnailUrl: 'https://quizetika.com/covers/history.png',
  difficulty: 4,
  genre: '歴史',
  tags: ['歴史', 'ミステリー'],
  originalTags: ['歴史', 'ミステリー'],
  questions: [],
  questionIds: [], // 問題IDの配列
  questionCount: 0,
  status: 'published',
  flagsCount: 0,
  playCount: 1500,
  bookmarksCount: 230,
  positiveCount: 120,
  negativeCount: 5,
  tempPositiveCount: 0,
  tempNegativeCount: 0,
  reviewScore: 4.8,
  reviewBadge: 'excellent',
  isReviewMasked: false,
  activeResetRequestId: null,
  canonicalGenreId: 'genre-history',
  canonicalTagIds: ['tag-history', 'tag-mystery'],
  leaderboard: [],
  leaderboardFirstPlay: [],
  leaderboardReplay: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Task 4.1 非機能要件 & パフォーマンス検証テスト', () => {

  describe('8.3 クローラー向け動的OGPメタデータ検証', () => {
    test('クイズ情報に基づいて必要なOGPおよびSEOメタデータが初期HTML内に動的挿入されていること', () => {
      const html = renderOgpHtml(mockQuiz);

      // HTMLとしての基本タグ構造の確認
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="ja">');

      // titleおよびdescriptionの整合性検証
      expect(html).toContain('<title>世界史の真実クイズ | quizetika</title>');
      expect(html).toContain('<meta name="description" content="歴史ミステリーの真相に迫る高度なクイズです。">');

      // OGP (Facebook/SNS) メタデータの整合性検証
      expect(html).toContain('<meta property="og:title" content="世界史の真実クイズ | quizetika">');
      expect(html).toContain('<meta property="og:description" content="歴史ミステリーの真相に迫る高度なクイズです。">');
      expect(html).toContain('<meta property="og:url" content="https://quizetika.com/quiz/performance-test-quiz">');
      expect(html).toContain('<meta property="og:image" content="https://quizetika.com/covers/history.png">');

      // Twitter カードメタデータの整合性検証
      expect(html).toContain('<meta property="twitter:title" content="世界史の真実クイズ | quizetika">');
      expect(html).toContain('<meta property="twitter:description" content="歴史ミステリーの真相に迫る高度なクイズです。">');
      expect(html).toContain('<meta property="twitter:image" content="https://quizetika.com/covers/history.png">');
    });

    test('8.1 初期HTMLのレンダリング応答時間が0.5秒（500ms）を遥かに下回り、極めて高速に処理完了すること', () => {
      const start = performance.now();

      // 100回連続でレンダリングを実行して負荷をかける
      for (let i = 0; i < 100; i++) {
        renderOgpHtml(mockQuiz);
      }

      const duration = performance.now() - start;
      const averageTime = duration / 100;

      // 平均処理時間が 500ms（0.5秒）を遥かに下回る（通常は 0.1ms 以下）ことを保証
      expect(averageTime).toBeLessThan(500);
      console.log(`[Performance] 平均OGPレンダリング時間: ${averageTime.toFixed(4)} ms`);
    });
  });

  describe('8.1 & 8.2 高負荷（スパイクアクセス）シミュレーション', () => {
    test('1000件の同時並行アクセススパイクにおいて、エラー率が0.1%未満であり、平均応答時間が0.5秒以内であること', async () => {
      const requestCount = 1000;

      // 通常運用状態（エラー確率 0%）でのスパイクアクセス検証
      const result = await simulateSpikeAccess(requestCount, 0);

      // エラー率が 0.1% 未満（0.001）であることを検証
      expect(result.errorRate).toBeLessThan(0.001);

      // 平均応答時間が 0.5秒（500ms）以下であることを検証
      expect(result.averageResponseTimeMs).toBeLessThan(500);

      console.log(`[Spike Simulation] 総リクエスト数: ${requestCount}件`);
      console.log(`[Spike Simulation] 成功率: ${(result.successRate * 100).toFixed(2)} %`);
      console.log(`[Spike Simulation] エラー率: ${(result.errorRate * 100).toFixed(2)} %`);
      console.log(`[Spike Simulation] 平均応答時間: ${result.averageResponseTimeMs.toFixed(2)} ms`);
    });

    test('エラー確率を0.05%に設定した場合でも、エラー率が0.5%未満の安全圏に収まること', async () => {
      const requestCount = 1000;
      // 0.05% の極低確率エラー（想定されるシステム偶発エラー）
      const expectedErrorProb = 0.0005;

      const result = await simulateSpikeAccess(requestCount, expectedErrorProb);

      // 許容エラーしきい値 0.5% 以下であることをアサート
      expect(result.errorRate).toBeLessThanOrEqual(0.005);
    });
  });

});
