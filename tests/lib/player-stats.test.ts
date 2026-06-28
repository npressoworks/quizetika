import { computePlayerStats } from '@/lib/player-stats';
import { Attempt, Quiz } from '@/types';

// テスト用モックデータの定義
const mockGenres = {
  g1: 'プログラミング',
  g2: '歴史',
  g3: 'アニメ',
};

const createMockAttempt = (overrides: Partial<Attempt>): Attempt => ({
  id: 'att_' + Math.random(),
  userId: 'user1',
  quizId: 'q1',
  mode: 'normal',
  score: 8,
  totalQuestions: 10,
  elapsedSeconds: 120,
  failedQuestionIds: ['q1_1', 'q1_2'],
  aiTurnCount: 0,
  aiTurnLimit: null,
  completedAt: new Date('2026-06-28T12:00:00Z'),
  ...overrides,
});

const createMockQuiz = (id: string, genre: string, tags: string[]): Quiz => ({
  id,
  title: 'クイズ ' + id,
  description: '説明 ' + id,
  genre,
  tags,
  status: 'published',
  authorId: 'author1',
  playCount: 10,
  bookmarksCount: 2,
  reviewScore: 90,
  questions: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('computePlayerStats - プレイヤー統計集計ユーティリティのテスト', () => {
  it('attempts が空のとき、空の初期統計データを返すこと', () => {
    const stats = computePlayerStats([], new Map());
    expect(stats.totalPlays).toBe(0);
    expect(stats.averageAccuracy).toBe(0);
    expect(stats.averageTime).toBe(0);
    expect(stats.uniqueQuizzesCount).toBe(0);
    expect(stats.frequentGenres).toHaveLength(0);
    expect(stats.frequentTags).toHaveLength(0);
    expect(stats.accurateGenres).toHaveLength(0);
    expect(stats.accurateTags).toHaveLength(0);
  });

  it('基本的な統計（プレイ数、正答率、時間、ユニーククイズ数）が正しく集集計されること', () => {
    const attempts = [
      createMockAttempt({ quizId: 'q1', score: 8, totalQuestions: 10, elapsedSeconds: 100 }),
      createMockAttempt({ quizId: 'q1', score: 6, totalQuestions: 10, elapsedSeconds: 200 }),
      createMockAttempt({ quizId: 'q2', score: 10, totalQuestions: 10, elapsedSeconds: 150 }),
    ];
    const quizMap = new Map<string, { genre: string; tags: string[] }>([
      ['q1', { genre: 'g1', tags: ['ts', 'js'] }],
      ['q2', { genre: 'g2', tags: ['history'] }],
    ]);

    const stats = computePlayerStats(attempts, quizMap);

    expect(stats.totalPlays).toBe(3);
    // 合計問題数 30, 合計正解数 24 => 正答率 80%
    expect(stats.averageAccuracy).toBe(80);
    // 合計秒数 450 => 平均 150秒
    expect(stats.averageTime).toBe(150);
    expect(stats.uniqueQuizzesCount).toBe(2);
  });

  it('よくプレイするジャンルとタグがプレイ回数順（最大5件）で降順集計されること', () => {
    const attempts = [
      createMockAttempt({ quizId: 'q1' }), // g1, tags: [t1, t2]
      createMockAttempt({ quizId: 'q1' }),
      createMockAttempt({ quizId: 'q2' }), // g2, tags: [t2, t3]
      createMockAttempt({ quizId: 'q3' }), // g1, tags: [t1]
      createMockAttempt({ quizId: 'q4' }), // g3, tags: [t4]
    ];
    const quizMap = new Map<string, { genre: string; tags: string[] }>([
      ['q1', { genre: 'g1', tags: ['t1', 't2'] }],
      ['q2', { genre: 'g2', tags: ['t2', 't3'] }],
      ['q3', { genre: 'g1', tags: ['t1'] }],
      ['q4', { genre: 'g3', tags: ['t4'] }],
    ]);

    const stats = computePlayerStats(attempts, quizMap);

    // ジャンル集計頻度: g1(3回), g2(1回), g3(1回)
    expect(stats.frequentGenres[0]).toEqual({ genreId: 'g1', count: 3 });
    expect(stats.frequentGenres).toHaveLength(3);

    // タグ集計頻度: t1(3回), t2(3回), t3(1回), t4(1回)
    expect(stats.frequentTags[0].count).toBe(3);
    expect(stats.frequentTags).toHaveLength(4);
  });

  it('得意（正答率の高い）なジャンルとタグが、プレイ回数3回以上のものを対象に、正答率降順で集計されること', () => {
    const attempts = [
      // g1 (プレイ回数4回、正解数: 8+8+8+6=30, 総問題数: 40 => 75%)
      createMockAttempt({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q1', score: 6, totalQuestions: 10 }),

      // g2 (プレイ回数2回、正解数: 10+10=20, 総問題数: 20 => 100% -> 3回未満のため足切り対象)
      createMockAttempt({ quizId: 'q2', score: 10, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q2', score: 10, totalQuestions: 10 }),

      // g3 (プレイ回率4回、正解数: 10+10+10+10=40, 総問題数: 40 => 100% -> 対象)
      createMockAttempt({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockAttempt({ quizId: 'q3', score: 10, totalQuestions: 10 }),
    ];
    const quizMap = new Map<string, { genre: string; tags: string[] }>([
      ['q1', { genre: 'g1', tags: ['t1'] }],
      ['q2', { genre: 'g2', tags: ['t2'] }],
      ['q3', { genre: 'g3', tags: ['t3'] }],
    ]);

    const stats = computePlayerStats(attempts, quizMap);

    // 足切りにより g2 は除外され、g3 (100%) と g1 (75%) のみになる
    expect(stats.accurateGenres).toHaveLength(2);
    expect(stats.accurateGenres[0]).toEqual({ genreId: 'g3', accuracy: 100, count: 4 });
    expect(stats.accurateGenres[1]).toEqual({ genreId: 'g1', accuracy: 75, count: 4 });
  });

  it('日別プレイ数が過去7日間の範囲で集計されること', () => {
    // 現在日時を固定してモック
    const baseDate = new Date('2026-06-28T12:00:00');
    const attempts = [
      createMockAttempt({ completedAt: new Date('2026-06-28T10:00:00') }),
      createMockAttempt({ completedAt: new Date('2026-06-28T15:00:00') }),
      createMockAttempt({ completedAt: new Date('2026-06-27T12:00:00') }),
      createMockAttempt({ completedAt: new Date('2026-06-25T12:00:00') }),
    ];

    const stats = computePlayerStats(attempts, new Map(), baseDate);

    // 直近7日間 (6/22 〜 6/28)
    expect(stats.dailyPlayCounts).toHaveLength(7);
    // 6/28 は 2回
    expect(stats.dailyPlayCounts.find(d => d.label === '6/28')?.value).toBe(2);
    // 6/27 は 1回
    expect(stats.dailyPlayCounts.find(d => d.label === '6/27')?.value).toBe(1);
    // 6/26 は 0回
    expect(stats.dailyPlayCounts.find(d => d.label === '6/26')?.value).toBe(0);
    // 6/25 は 1回
    expect(stats.dailyPlayCounts.find(d => d.label === '6/25')?.value).toBe(1);
  });

  it('プレイモード別の割合が正しく集計されること', () => {
    const attempts = [
      createMockAttempt({ mode: 'normal' }),
      createMockAttempt({ mode: 'normal' }),
      createMockAttempt({ mode: 'exam' }),
      createMockAttempt({ mode: 'flashcard' }),
    ];

    const stats = computePlayerStats(attempts, new Map());

    expect(stats.modeDistribution).toHaveLength(3);
    expect(stats.modeDistribution.find(d => d.label === '通常')?.count).toBe(2);
    expect(stats.modeDistribution.find(d => d.label === '試験')?.count).toBe(1);
    expect(stats.modeDistribution.find(d => d.label === '暗記カード')?.count).toBe(1);
  });
});
