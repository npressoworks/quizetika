import { extractTitleKeywords, WordCloudItem } from '@/lib/word-cloud';

describe('extractTitleKeywords - クイズタイトルからのキーワード抽出', () => {
  describe('ストップワード除外', () => {
    it('「クイズ」「検定」「初級」等の汎用語を除外すること', () => {
      // 「の」はひらがな1文字、「検定」「初級」はストップワードとして除外される
      expect(extractTitleKeywords('世界の国旗検定・初級')).toEqual(['世界', '国旗']);
    });

    it('「一問一答」「まとめ」を除外すること', () => {
      expect(extractTitleKeywords('一問一答 英単語まとめ')).toEqual(['英単語']);
    });

    it('「入門」「問題」を除外し、英単語は残すこと', () => {
      // 「集」は1文字のため除外される
      expect(extractTitleKeywords('JavaScript入門問題集')).toEqual(['JavaScript']);
    });
  });

  describe('短語・数字・記号・ひらがなのみの語の除外', () => {
    it('2文字未満の語を除外すること', () => {
      // 「史」「編」は1文字、「クイズ」はストップワード
      expect(extractTitleKeywords('日本史クイズ 戦国武将編')).toEqual(['日本', '戦国', '武将']);
    });

    it('数字のみの語と、ひらがなのみ2文字以下の語を除外すること', () => {
      // 「これ」「は」「です」はひらがなのみ2文字以下、「テスト」はストップワード、「123」は数字のみ
      expect(extractTitleKeywords('これはテストです123')).toEqual([]);
    });

    it('記号のみで構成されるタイトルからは何も抽出しないこと', () => {
      expect(extractTitleKeywords('!!! --- ???')).toEqual([]);
    });

    it('空文字列からは何も抽出しないこと', () => {
      expect(extractTitleKeywords('')).toEqual([]);
    });

    it('ひらがなのみでも3文字以上であれば抽出対象とすること', () => {
      expect(extractTitleKeywords('ことわざ 名言集')).toContain('ことわざ');
    });
  });

  describe('重複除去', () => {
    it('同一タイトル内に同じ語が複数回現れても1回だけ返すこと', () => {
      expect(extractTitleKeywords('戦国 戦国 武将')).toEqual(['戦国', '武将']);
    });
  });

  describe('Intl.Segmenter 未定義環境でのフォールバック', () => {
    // Intl.Segmenter を一時的に未定義にしてフォールバック経路を検証する
    const intlRef = Intl as { Segmenter?: typeof Intl.Segmenter };
    let originalSegmenter: typeof Intl.Segmenter | undefined;

    beforeEach(() => {
      originalSegmenter = intlRef.Segmenter;
      delete intlRef.Segmenter;
    });

    afterEach(() => {
      intlRef.Segmenter = originalSegmenter;
    });

    it('空白・記号区切りで語を抽出できること', () => {
      expect(extractTitleKeywords('JavaScript React 入門')).toEqual(['JavaScript', 'React']);
    });

    it('中黒などの記号でも区切られること', () => {
      expect(extractTitleKeywords('Vue・Nuxt クイズ')).toEqual(['Vue', 'Nuxt']);
    });

    it('フォールバックでもストップワード・数字のみの語を除外すること', () => {
      expect(extractTitleKeywords('歴史 問題 2024')).toEqual(['歴史']);
    });

    it('フォールバックでも重複を除去すること', () => {
      expect(extractTitleKeywords('英単語 英単語')).toEqual(['英単語']);
    });
  });
});

describe('WordCloudItem 型', () => {
  it('text / count / accuracy を持つオブジェクトとして利用できること', () => {
    const item: WordCloudItem = { text: '歴史', count: 5, accuracy: 80 };
    expect(item.text).toBe('歴史');
    expect(item.count).toBe(5);
    expect(item.accuracy).toBe(80);
  });
});
