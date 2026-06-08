import { getFormatDescription, getFormatLabel } from '@/lib/quiz-format-labels';

describe('getFormatLabel', () => {
  it('既知の形式に日本語ラベルを返す', () => {
    expect(getFormatLabel('multiple-choice')).toBe('選択式');
    expect(getFormatLabel('text-input')).toBe('記述式');
    expect(getFormatLabel('lateral-thinking')).toBe('ウミガメのスープ');
    expect(getFormatLabel('mixed')).toBe('複合形式');
  });

  it('未知の形式はそのまま返す', () => {
    expect(getFormatLabel('custom-format')).toBe('custom-format');
  });
});

describe('getFormatDescription', () => {
  it('既知の形式に説明文を返す', () => {
    expect(getFormatDescription('multiple-choice')).toContain('選択肢');
    expect(getFormatDescription('lateral-thinking')).toContain('水平思考');
  });

  it('未知の形式はラベルを返す', () => {
    expect(getFormatDescription('custom-format')).toBe('custom-format');
  });
});
