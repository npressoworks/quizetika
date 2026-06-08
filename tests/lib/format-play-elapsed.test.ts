import { formatPlayElapsedSeconds, normalizeElapsedSeconds } from '@/lib/format-play-elapsed';

describe('formatPlayElapsedSeconds', () => {
  it('60秒未満は秒のみ表示する', () => {
    expect(formatPlayElapsedSeconds(0)).toBe('0秒');
    expect(formatPlayElapsedSeconds(45)).toBe('45秒');
  });

  it('60秒以上は分秒で表示する', () => {
    expect(formatPlayElapsedSeconds(65)).toBe('1分05秒');
    expect(formatPlayElapsedSeconds(125)).toBe('2分05秒');
  });
});

describe('normalizeElapsedSeconds', () => {
  it('不正値はフォールバックを返す', () => {
    expect(normalizeElapsedSeconds(undefined, 10)).toBe(10);
    expect(normalizeElapsedSeconds('abc', 5)).toBe(5);
  });

  it('0〜86400の範囲に丸める', () => {
    expect(normalizeElapsedSeconds(-3)).toBe(0);
    expect(normalizeElapsedSeconds(90.9)).toBe(90);
    expect(normalizeElapsedSeconds(100000)).toBe(86400);
  });
});
