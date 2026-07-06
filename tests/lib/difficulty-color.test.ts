import { getDifficultyColor } from '@/lib/difficulty-color';

describe('getDifficultyColor', () => {
  it('難易度1のときは緑色を返すこと', () => {
    expect(getDifficultyColor(1)).toBe('light-dark(#16a34a, #4ade80)');
  });

  it('難易度5のときは赤色を返すこと', () => {
    expect(getDifficultyColor(5)).toBe('light-dark(#dc2626, #f87171)');
  });

  it('難易度3のときは中間色(黄〜琥珀色)を返すこと', () => {
    expect(getDifficultyColor(3)).toBe('light-dark(#ca8a04, #facc15)');
  });

  it('境界値や不正な入力値に対しても正しく動作すること', () => {
    // 1未満の入力は難易度1(緑)として扱う
    expect(getDifficultyColor(0)).toBe('light-dark(#16a34a, #4ade80)');
    // 5より大きい入力も上限5(赤)で丸められる
    expect(getDifficultyColor(6)).toBe('light-dark(#dc2626, #f87171)');
  });
});
