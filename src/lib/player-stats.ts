import { PlayHistoryEntry, Attempt } from '@/types';
import { WordCloudItem, extractTitleKeywords } from '@/lib/word-cloud';

export interface PlayerStats {
  totalPlays: number;          // 累計プレイ回数 (Attempt数)
  totalCorrect: number;        // 合計正解数
  totalQuestions: number;      // 合計出題数
  averageAccuracy: number;     // 平均正解率 (0-100)
  totalTime: number;           // 合計プレイ時間（秒）
  averageTime: number;         // 1プレイあたり平均解答時間（秒）
  uniqueQuizzesCount: number;  // プレイしたユニークなクイズ数
  dailyPlayCounts: { label: string; value: number }[]; // 直近7日間の日別プレイ回数推移
  modeDistribution: { label: string; count: number }[]; // プレイモード別の割合
  frequentGenres: { genreId: string; count: number }[]; // よくプレイするジャンル (降順、最大5件)
  frequentTags: { tagName: string; count: number }[];   // よくプレイするタグ (降順、最大5件)
  accurateGenres: { genreId: string; accuracy: number; count: number }[]; // 正答率の高いジャンル (回数3回以上、降順、最大5件)
  accurateTags: { tagName: string; accuracy: number; count: number }[];   // 正答率の高いタグ (回数3回以上、降順、最大5件)
  tagCloud: WordCloudItem[];     // タグ別プレイ回数上位30件 (count 降順、同数はテキスト昇順)
  keywordCloud: WordCloudItem[]; // タイトルキーワード別プレイ回数上位30件 (同上)
}

// ワードクラウドに表示する語の上限数
const WORD_CLOUD_LIMIT = 30;

// プレイモードの日本語ラベルマッピング
const modeLabels: Record<Attempt['mode'], string> = {
  normal: '通常',
  exam: '試験',
  flashcard: '暗記カード',
  review: '復習',
  list: 'リストプレイ',
  'question-list': '問題リストプレイ',
  'my-quiz': 'カスタムクイズ',
  'test-play': 'テストプレイ',
};

export function computePlayerStats(
  attempts: PlayHistoryEntry[],
  quizMap: Map<string, { genre: string; tags: string[]; title: string }>,
  baseDate: Date = new Date()
): PlayerStats {
  if (!attempts || attempts.length === 0) {
    return {
      totalPlays: 0,
      totalCorrect: 0,
      totalQuestions: 0,
      averageAccuracy: 0,
      totalTime: 0,
      averageTime: 0,
      uniqueQuizzesCount: 0,
      dailyPlayCounts: generateEmptyDailyCounts(baseDate),
      modeDistribution: [],
      frequentGenres: [],
      frequentTags: [],
      accurateGenres: [],
      accurateTags: [],
      tagCloud: [],
      keywordCloud: [],
    };
  }

  // 1. 基本統計の集計
  let totalPlays = attempts.length;
  let totalCorrect = 0;
  let totalQuestions = 0;
  let totalTime = 0;
  const uniqueQuizzes = new Set<string>();

  // ジャンル・タグ別の集計用一時データ構造
  // id/name -> { plays, correct, totalQuestions }
  const genreStatsMap = new Map<string, { count: number; correct: number; total: number }>();
  const tagStatsMap = new Map<string, { count: number; correct: number; total: number }>();

  // プレイモード別の集計用
  const modeCounts = new Map<string, number>();

  // ワードクラウド用の集計 (タグ / タイトルキーワード)
  // 1 attempt につき同一語1回のカウント。accuracy は tagStatsMap と同じく attempt 単位で score/totalQuestions を加算
  const tagCloudMap = new Map<string, { count: number; correct: number; total: number }>();
  const keywordCloudMap = new Map<string, { count: number; correct: number; total: number }>();
  // quizId -> 抽出済みキーワード。attempt ループでの再分かち書きを避けるキャッシュ
  const keywordCache = new Map<string, string[]>();

  attempts.forEach((att) => {
    totalCorrect += att.score || 0;
    totalQuestions += att.totalQuestions || 0;
    totalTime += att.elapsedSeconds || 0;
    if (att.quizId) {
      uniqueQuizzes.add(att.quizId);
    }

    // プレイモードカウント
    const label = modeLabels[att.mode] || att.mode;
    modeCounts.set(label, (modeCounts.get(label) || 0) + 1);

    // クイズのジャンル・タグの解決
    const quizInfo = att.quizId ? quizMap.get(att.quizId) : null;
    if (quizInfo) {
      // ジャンル集計
      if (quizInfo.genre) {
        const stats = genreStatsMap.get(quizInfo.genre) || { count: 0, correct: 0, total: 0 };
        stats.count += 1;
        stats.correct += att.score || 0;
        stats.total += att.totalQuestions || 0;
        genreStatsMap.set(quizInfo.genre, stats);
      }

      // タグ集計
      if (quizInfo.tags && Array.isArray(quizInfo.tags)) {
        quizInfo.tags.forEach((tag) => {
          if (!tag) return;
          const stats = tagStatsMap.get(tag) || { count: 0, correct: 0, total: 0 };
          stats.count += 1;
          stats.correct += att.score || 0;
          stats.total += att.totalQuestions || 0;
          tagStatsMap.set(tag, stats);
        });
      }

      // ワードクラウド用タグ集計 (1 attempt につき同一タグ1回のみ加算するため Set 化)
      if (quizInfo.tags && Array.isArray(quizInfo.tags)) {
        const uniqueTags = new Set(quizInfo.tags.filter((tag) => !!tag));
        uniqueTags.forEach((tag) => {
          addWordCloudCount(tagCloudMap, tag, att);
        });
      }

      // ワードクラウド用キーワード集計 (extractTitleKeywords はユニークな配列を返す)
      if (quizInfo.title && att.quizId) {
        let keywords = keywordCache.get(att.quizId);
        if (!keywords) {
          keywords = extractTitleKeywords(quizInfo.title);
          keywordCache.set(att.quizId, keywords);
        }
        keywords.forEach((keyword) => {
          addWordCloudCount(keywordCloudMap, keyword, att);
        });
      }
    }
  });

  const averageAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  const averageTime = totalPlays > 0 ? Math.round(totalTime / totalPlays) : 0;

  // 2. よくプレイするジャンル/タグのソート (最大5件)
  const frequentGenres = Array.from(genreStatsMap.entries())
    .map(([genreId, s]) => ({ genreId, count: s.count }))
    .sort((a, b) => b.count - a.count || a.genreId.localeCompare(b.genreId))
    .slice(0, 5);

  const frequentTags = Array.from(tagStatsMap.entries())
    .map(([tagName, s]) => ({ tagName, count: s.count }))
    .sort((a, b) => b.count - a.count || a.tagName.localeCompare(b.tagName))
    .slice(0, 5);

  // 3. 得意（正答率の高い）なジャンル/タグのソート (プレイ回数3回以上を対象、最大5件)
  const accurateGenres = Array.from(genreStatsMap.entries())
    .filter(([_, s]) => s.count >= 3)
    .map(([genreId, s]) => ({
      genreId,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      count: s.count,
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.count - a.count || a.genreId.localeCompare(b.genreId))
    .slice(0, 5);

  const accurateTags = Array.from(tagStatsMap.entries())
    .filter(([_, s]) => s.count >= 3)
    .map(([tagName, s]) => ({
      tagName,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
      count: s.count,
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.count - a.count || a.tagName.localeCompare(b.tagName))
    .slice(0, 5);

  // 4. ワードクラウドデータの整形 (count 降順・同数はテキスト昇順・上位最大30件)
  const tagCloud = buildWordCloudItems(tagCloudMap);
  const keywordCloud = buildWordCloudItems(keywordCloudMap);

  // 5. モード分布の整形
  const modeDistribution = Array.from(modeCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // 6. 日別プレイ回数の集計 (直近7日間)
  const dailyPlayCounts = calculateDailyPlayCounts(attempts, baseDate);

  return {
    totalPlays,
    totalCorrect,
    totalQuestions,
    averageAccuracy,
    totalTime,
    averageTime,
    uniqueQuizzesCount: uniqueQuizzes.size,
    dailyPlayCounts,
    modeDistribution,
    frequentGenres,
    frequentTags,
    accurateGenres,
    accurateTags,
    tagCloud,
    keywordCloud,
  };
}

// ワードクラウド集計マップに attempt 1回分の語カウントを加算するヘルパー
function addWordCloudCount(
  map: Map<string, { count: number; correct: number; total: number }>,
  word: string,
  att: PlayHistoryEntry
): void {
  const stats = map.get(word) || { count: 0, correct: 0, total: 0 };
  stats.count += 1;
  stats.correct += att.score || 0;
  stats.total += att.totalQuestions || 0;
  map.set(word, stats);
}

// 集計マップから WordCloudItem 配列を生成するヘルパー (count 降順・同数はテキスト昇順・上位最大30件)
function buildWordCloudItems(
  map: Map<string, { count: number; correct: number; total: number }>
): WordCloudItem[] {
  return Array.from(map.entries())
    .map(([text, s]) => ({
      text,
      count: s.count,
      accuracy: s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .slice(0, WORD_CLOUD_LIMIT);
}

// 7日間の空配列を生成するヘルパー
function generateEmptyDailyCounts(baseDate: Date): { label: string; value: number }[] {
  const list: { label: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate.getTime());
    d.setDate(baseDate.getDate() - i);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    list.push({ label, value: 0 });
  }
  return list;
}

// 日別プレイ回数を集計するヘルパー
function calculateDailyPlayCounts(attempts: PlayHistoryEntry[], baseDate: Date): { label: string; value: number }[] {
  const counts = generateEmptyDailyCounts(baseDate);

  attempts.forEach((att) => {
    if (!att.completedAt) return;
    const completedDate = new Date(att.completedAt);
    const label = `${completedDate.getMonth() + 1}/${completedDate.getDate()}`;

    const entry = counts.find((c) => c.label === label);
    if (entry) {
      entry.value += 1;
    }
  });

  return counts;
}
