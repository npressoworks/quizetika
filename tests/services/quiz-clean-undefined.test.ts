import { cleanUndefined } from '@/services/quiz';

describe('cleanUndefined', () => {
  it('値が undefined のプロパティを再帰的に削除すること', () => {
    const input = {
      title: 'テストクイズ',
      description: undefined,
      difficulty: 3,
      tags: ['react', undefined, 'nextjs'],
      questions: [
        {
          id: 'q1',
          questionText: '問題1',
          imageUrl: undefined,
          hint: null,
          choices: [
            { id: 'c1', choiceText: '選択肢1', isCorrect: true },
            { id: 'c2', choiceText: undefined, isCorrect: false }
          ]
        }
      ]
    };

    const expected = {
      title: 'テストクイズ',
      difficulty: 3,
      tags: ['react', undefined, 'nextjs'],
      questions: [
        {
          id: 'q1',
          questionText: '問題1',
          hint: null,
          choices: [
            { id: 'c1', choiceText: '選択肢1', isCorrect: true },
            { id: 'c2', isCorrect: false }
          ]
        }
      ]
    };

    expect(cleanUndefined(input)).toEqual(expected);
  });

  it('プリミティブ値や null をそのまま返すこと', () => {
    expect(cleanUndefined(null)).toBeNull();
    expect(cleanUndefined(undefined)).toBeUndefined();
    expect(cleanUndefined(42)).toBe(42);
    expect(cleanUndefined('string')).toBe('string');
    expect(cleanUndefined(true)).toBe(true);
  });
});
