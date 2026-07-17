import { computePlayerStats } from '@/lib/player-stats';
import { PlayHistoryEntry, Quiz } from '@/types';

// テスト用モックデータの定義
const mockGenres = {
  g1: 'プログラミング',
  g2: '歴史',
  g3: 'アニメ',
};

const createMockPlayHistoryEntry = (overrides: Partial<PlayHistoryEntry>): PlayHistoryEntry => ({
  attemptId: 'att_' + Math.random(),
  quizId: 'q1',
  quizTitle: 'クイズ q1',
  mode: 'normal',
  score: 8,
  totalQuestions: 10,
  elapsedSeconds: 120,
  completedAt: new Date('2026-06-28T12:00:00Z'),
  ...overrides,
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
      createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10, elapsedSeconds: 100 }),
      createMockPlayHistoryEntry({ quizId: 'q1', score: 6, totalQuestions: 10, elapsedSeconds: 200 }),
      createMockPlayHistoryEntry({ quizId: 'q2', score: 10, totalQuestions: 10, elapsedSeconds: 150 }),
    ];
    const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
      ['q1', { genre: 'g1', tags: ['ts', 'js'], title: 'TypeScript 基礎' }],
      ['q2', { genre: 'g2', tags: ['history'], title: '日本史' }],
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
      createMockPlayHistoryEntry({ quizId: 'q1' }), // g1, tags: [t1, t2]
      createMockPlayHistoryEntry({ quizId: 'q1' }),
      createMockPlayHistoryEntry({ quizId: 'q2' }), // g2, tags: [t2, t3]
      createMockPlayHistoryEntry({ quizId: 'q3' }), // g1, tags: [t1]
      createMockPlayHistoryEntry({ quizId: 'q4' }), // g3, tags: [t4]
    ];
    const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
      ['q1', { genre: 'g1', tags: ['t1', 't2'], title: 'クイズ q1' }],
      ['q2', { genre: 'g2', tags: ['t2', 't3'], title: 'クイズ q2' }],
      ['q3', { genre: 'g1', tags: ['t1'], title: 'クイズ q3' }],
      ['q4', { genre: 'g3', tags: ['t4'], title: 'クイズ q4' }],
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
      createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q1', score: 6, totalQuestions: 10 }),

      // g2 (プレイ回数2回、正解数: 10+10=20, 総問題数: 20 => 100% -> 3回未満のため足切り対象)
      createMockPlayHistoryEntry({ quizId: 'q2', score: 10, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q2', score: 10, totalQuestions: 10 }),

      // g3 (プレイ回率4回、正解数: 10+10+10+10=40, 総問題数: 40 => 100% -> 対象)
      createMockPlayHistoryEntry({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q3', score: 10, totalQuestions: 10 }),
      createMockPlayHistoryEntry({ quizId: 'q3', score: 10, totalQuestions: 10 }),
    ];
    const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
      ['q1', { genre: 'g1', tags: ['t1'], title: 'クイズ q1' }],
      ['q2', { genre: 'g2', tags: ['t2'], title: 'クイズ q2' }],
      ['q3', { genre: 'g3', tags: ['t3'], title: 'クイズ q3' }],
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
      createMockPlayHistoryEntry({ completedAt: new Date('2026-06-28T10:00:00') }),
      createMockPlayHistoryEntry({ completedAt: new Date('2026-06-28T15:00:00') }),
      createMockPlayHistoryEntry({ completedAt: new Date('2026-06-27T12:00:00') }),
      createMockPlayHistoryEntry({ completedAt: new Date('2026-06-25T12:00:00') }),
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
      createMockPlayHistoryEntry({ mode: 'normal' }),
      createMockPlayHistoryEntry({ mode: 'normal' }),
      createMockPlayHistoryEntry({ mode: 'exam' }),
      createMockPlayHistoryEntry({ mode: 'flashcard' }),
    ];

    const stats = computePlayerStats(attempts, new Map());

    expect(stats.modeDistribution).toHaveLength(3);
    expect(stats.modeDistribution.find(d => d.label === '通常')?.count).toBe(2);
    expect(stats.modeDistribution.find(d => d.label === '試験')?.count).toBe(1);
    expect(stats.modeDistribution.find(d => d.label === '暗記カード')?.count).toBe(1);
  });

  describe('tagCloud / keywordCloud - ワードクラウド用データの集計', () => {
    it('attempts が空のとき、tagCloud と keywordCloud が空配列になること', () => {
      const stats = computePlayerStats([], new Map());
      expect(stats.tagCloud).toEqual([]);
      expect(stats.keywordCloud).toEqual([]);
    });

    it('tagCloud がプレイ回数降順・同数はタグ名昇順で集計されること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q1', score: 6, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q2', score: 10, totalQuestions: 10 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['beta', 'alpha'], title: 'カレー ラーメン' }],
        ['q2', { genre: 'g2', tags: ['alpha', 'zeta'], title: '日本史' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      // count: alpha(3), beta(2), zeta(1)
      expect(stats.tagCloud.map((i) => i.text)).toEqual(['alpha', 'beta', 'zeta']);
      expect(stats.tagCloud.map((i) => i.count)).toEqual([3, 2, 1]);
    });

    it('tagCloud で同数タグがテキスト昇順（localeCompare）に並ぶこと', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1' }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['charlie', 'alpha', 'bravo'], title: 'クイズ q1' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.tagCloud.map((i) => i.text)).toEqual(['alpha', 'bravo', 'charlie']);
    });

    it('tagCloud の accuracy が Math.round(Σscore / ΣtotalQuestions * 100) で算出されること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q1', score: 6, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q2', score: 5, totalQuestions: 10 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['t1'], title: 'クイズ q1' }],
        ['q2', { genre: 'g2', tags: ['t1', 't2'], title: 'クイズ q2' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      // t1: (8+6+5) / (10+10+10) = 19/30 => 63.33 -> 63
      const t1 = stats.tagCloud.find((i) => i.text === 't1');
      expect(t1).toEqual({ text: 't1', count: 3, accuracy: 63 });
      // t2: 5/10 => 50
      const t2 = stats.tagCloud.find((i) => i.text === 't2');
      expect(t2).toEqual({ text: 't2', count: 1, accuracy: 50 });
    });

    it('totalQuestions の合計が 0 のとき accuracy が 0 になること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 0, totalQuestions: 0 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['t1'], title: 'カレー' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.tagCloud[0]).toEqual({ text: 't1', count: 1, accuracy: 0 });
    });

    it('1 attempt 内でタグが重複していても1回のみカウントされること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['t1', 't1', 't1'], title: 'クイズ q1' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.tagCloud).toEqual([{ text: 't1', count: 1, accuracy: 80 }]);
    });

    it('tagCloud が上位最大30件に制限されること', () => {
      const manyTags = Array.from({ length: 35 }, (_, i) => `tag${String(i + 1).padStart(2, '0')}`);
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1' }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: manyTags, title: 'クイズ q1' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.tagCloud).toHaveLength(30);
      // 全て count 1 なのでテキスト昇順の上位30件（tag01〜tag30）
      expect(stats.tagCloud[0].text).toBe('tag01');
      expect(stats.tagCloud[29].text).toBe('tag30');
    });

    it('keywordCloud がタイトルキーワードごとにプレイ回数降順で集計されること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 8, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q1', score: 6, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q2', score: 5, totalQuestions: 10 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: [], title: 'カレー ラーメン' }],
        ['q2', { genre: 'g2', tags: [], title: 'カレー 雑学' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      // カレー: count 3, accuracy round(19/30*100)=63
      // ラーメン: count 2, accuracy round(14/20*100)=70
      // 雑学: count 1, accuracy 50
      expect(stats.keywordCloud).toEqual([
        { text: 'カレー', count: 3, accuracy: 63 },
        { text: 'ラーメン', count: 2, accuracy: 70 },
        { text: '雑学', count: 1, accuracy: 50 },
      ]);
    });

    it('同一クイズタイトル内に同じ語が複数回含まれても 1 attempt につき1回のみカウントされること', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1', score: 10, totalQuestions: 10 }),
        createMockPlayHistoryEntry({ quizId: 'q1', score: 10, totalQuestions: 10 }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: [], title: 'カレー カレー カレー' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.keywordCloud).toEqual([{ text: 'カレー', count: 2, accuracy: 100 }]);
    });

    it('ストップワード（「クイズ」等）は keywordCloud に含まれないこと', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1' }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: [], title: 'カレー クイズ 問題' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.keywordCloud.map((i) => i.text)).toEqual(['カレー']);
    });

    it('ワードクラウド追加後も既存フィールド（frequentTags 等）の挙動が変わらないこと', () => {
      const attempts = [
        createMockPlayHistoryEntry({ quizId: 'q1' }),
        createMockPlayHistoryEntry({ quizId: 'q1' }),
        createMockPlayHistoryEntry({ quizId: 'q2' }),
      ];
      const quizMap = new Map<string, { genre: string; tags: string[]; title: string }>([
        ['q1', { genre: 'g1', tags: ['t1'], title: 'カレー' }],
        ['q2', { genre: 'g2', tags: ['t2'], title: 'ラーメン' }],
      ]);

      const stats = computePlayerStats(attempts, quizMap);

      expect(stats.frequentTags).toEqual([
        { tagName: 't1', count: 2 },
        { tagName: 't2', count: 1 },
      ]);
      expect(stats.frequentGenres[0]).toEqual({ genreId: 'g1', count: 2 });
    });
  });
});
