/** プレイ画面向けの経過時間表示（例: 45秒 / 3分05秒） */
export function formatPlayElapsedSeconds(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  if (minutes > 0) {
    return `${minutes}分${secs.toString().padStart(2, '0')}秒`;
  }

  return `${secs}秒`;
}

/** API 保存用に経過秒数を正規化する */
export function normalizeElapsedSeconds(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.floor(value), 86400));
}
