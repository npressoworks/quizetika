'use client';

import React from 'react';
import type { WordCloudItem } from '@/lib/word-cloud';

interface WordCloudProps {
  items: WordCloudItem[]; // 空配列時の空状態表示は呼び出し側の責務
}

// フォントサイズの下限・上限（rem）。design.md Phase 42 Design Decision 1
const MIN_FONT_REM = 0.75;
const MAX_FONT_REM = 2.25;

// 正答率の色区分に必要な最小プレイ回数（要件 20.10, 20.11。要件 13.6 と同一閾値）
const MIN_COUNT_FOR_ACCURACY = 3;

/**
 * FNV-1a 32bit ハッシュ。語の文字列から決定的なソートキーを得る（要件 20.14）。
 * `Math.random` を使わないため SSR/hydration 安全で、再レンダーでも並びが変わらない。
 */
function fnv1aHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** sqrt スケールでフォントサイズ（rem）を算出する。高頻度語の支配を抑える（要件 20.9） */
function fontSizeRem(count: number, maxCount: number): number {
  if (maxCount <= 0) return MIN_FONT_REM; // 0 除算ガード
  const ratio = Math.sqrt(count / maxCount);
  return MIN_FONT_REM + (MAX_FONT_REM - MIN_FONT_REM) * ratio;
}

/** 正答率バケットに応じた色クラス（light/dark 両対応）。要件 20.10, 20.11 */
function colorClass(item: WordCloudItem): string {
  if (item.count < MIN_COUNT_FOR_ACCURACY) {
    return 'text-muted-foreground'; // データ不足
  }
  if (item.accuracy >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (item.accuracy >= 60) return 'text-primary';
  if (item.accuracy >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/** ホバー/フォーカス時のツールチップ文言（要件 20.13） */
function tooltipText(item: WordCloudItem): string {
  if (item.count < MIN_COUNT_FOR_ACCURACY) {
    return `${item.count}回プレイ・データ不足`;
  }
  return `${item.count}回プレイ・正答率${item.accuracy}%`;
}

/**
 * 自作 CSS ワードクラウド（依存ライブラリなし）
 *
 * - 語の大きさ = プレイ回数（sqrt スケール、0.75rem〜2.25rem）
 * - 語の色 = 正答率バケット（3回未満は muted）
 * - 並び = FNV-1a ハッシュによる決定的シャッフル
 */
export const WordCloud: React.FC<WordCloudProps> = ({ items }) => {
  if (items.length === 0) return null;

  const maxCount = items.reduce((max, item) => Math.max(max, item.count), 0);

  // ハッシュ値をキーに決定的にシャッフルする。ハッシュ衝突時は語の文字列で安定化
  const sorted = [...items].sort((a, b) => {
    const diff = fnv1aHash(a.text) - fnv1aHash(b.text);
    if (diff !== 0) return diff;
    return a.text.localeCompare(b.text, 'ja');
  });

  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 py-2">
      {sorted.map((item) => (
        <span
          key={item.text}
          title={tooltipText(item)}
          className={`font-bold leading-tight ${colorClass(item)}`}
          style={{ fontSize: `${fontSizeRem(item.count, maxCount)}rem` }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
};
