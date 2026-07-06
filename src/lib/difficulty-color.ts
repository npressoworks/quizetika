/**
 * 難易度（1〜5）の値から、対応するカラーコードを算出します。
 * 難易度1（緑）から 5（赤）まで5段階で変化します。
 * ライト/ダーク両テーマで視認性を確保するため、`light-dark()` で
 * テーマごとに明度・彩度を調整した色を返します
 * （純色のHSLだと特に黄系がくすんで見づらいため）。
 *
 * @param difficulty 難易度数値（1〜5）
 * @returns CSSカラー文字列（例：'light-dark(#16a34a, #4ade80)'）
 */
const DIFFICULTY_COLORS: Record<number, { light: string; dark: string }> = {
  1: { light: '#16a34a', dark: '#4ade80' }, // green
  2: { light: '#65a30d', dark: '#a3e635' }, // lime
  3: { light: '#ca8a04', dark: '#facc15' }, // amber
  4: { light: '#ea580c', dark: '#fb923c' }, // orange
  5: { light: '#dc2626', dark: '#f87171' }, // red
};

export function getDifficultyColor(difficulty: number): string {
  // 1〜5 の範囲に補正
  const safeDifficulty = Math.min(5, Math.max(1, Math.round(difficulty)));

  const { light, dark } = DIFFICULTY_COLORS[safeDifficulty];
  return `light-dark(${light}, ${dark})`;
}
