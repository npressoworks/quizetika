/**
 * 難易度（1〜5）の値から、対応するHSLカラーコードを算出します。
 * 難易度1（緑）から 5（赤）まで、30度ずつのステップで滑らかに変化します。
 *
 * @param difficulty 難易度数値（1〜5）
 * @returns HSLカラーコード文字列（例：'hsl(120, 100%, 45%)'）
 */
export function getDifficultyColor(difficulty: number): string {
  // 1〜5 の範囲に補正
  const safeDifficulty = Math.min(5, Math.max(1, difficulty));
  
  // 難易度1のとき Hue=120(緑)、難易度5のとき Hue=0(赤)
  const hue = Math.max(0, 120 - (safeDifficulty - 1) * 30);
  
  return `hsl(${hue}, 100%, 45%)`;
}
