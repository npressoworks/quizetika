import { getDifficultyColor } from '@/lib/difficulty-color';

describe('getDifficultyColor', () => {
  it('難易度1のときは緑色(HSL色相120)を返すこと', () => {
    expect(getDifficultyColor(1)).toBe('hsl(120, 100%, 45%)');
  });

  it('難易度5のときは赤色(HSL色相0)を返すこと', () => {
    expect(getDifficultyColor(5)).toBe('hsl(0, 100%, 45%)');
  });

  it('難易度3のときは中間色(HSL色相60)を返すこと', () => {
    expect(getDifficultyColor(3)).toBe('hsl(60, 100%, 45%)');
  });

  it('境界値や不正な入力値に対しても正しく動作すること', () => {
    // 1未満の入力は難易度1(色相120)として扱う
    expect(getDifficultyColor(0)).toBe('hsl(120, 100%, 45%)');
    // 5より大きい入力も下限0(赤)で丸められる
    expect(getDifficultyColor(6)).toBe('hsl(0, 100%, 45%)');
  });
});
