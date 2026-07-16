import { buildTwitterShareUrl, buildLineShareUrl } from '@/lib/social-share';

describe('social-share', () => {
  describe('buildTwitterShareUrl', () => {
    test('X投稿作成インテントURLの形式で返すこと', () => {
      const url = buildTwitterShareUrl('サンプルクイズ', 'https://example.com/quiz/abc123');
      expect(url.startsWith('https://twitter.com/intent/tweet?')).toBe(true);
    });

    test('タイトルとURLをencodeURIComponentでエンコードしtext/urlパラメータへ埋め込むこと', () => {
      const title = 'テスト「クイズ」&特殊文字 #タグ';
      const shareUrl = 'https://example.com/quiz/xyz?ref=share&x=1';
      const url = buildTwitterShareUrl(title, shareUrl);

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://twitter.com/intent/tweet');
      expect(parsed.searchParams.get('text')).toContain(title);
      expect(parsed.searchParams.get('url')).toBe(shareUrl);
      expect(url).toContain(encodeURIComponent(shareUrl));
    });

    test('空文字タイトルでも例外を投げず、投稿文にクイズタイトル部分が空で埋め込まれること', () => {
      const url = buildTwitterShareUrl('', 'https://example.com/quiz/empty-title');
      expect(url.startsWith('https://twitter.com/intent/tweet?')).toBe(true);
      const parsed = new URL(url);
      expect(parsed.searchParams.get('url')).toBe('https://example.com/quiz/empty-title');
    });

    test('副作用を持たず、同一入力に対して常に同一の出力を返すこと（純粋関数）', () => {
      const a = buildTwitterShareUrl('同じタイトル', 'https://example.com/quiz/pure');
      const b = buildTwitterShareUrl('同じタイトル', 'https://example.com/quiz/pure');
      expect(a).toBe(b);
    });
  });

  describe('buildLineShareUrl', () => {
    test('LINE共有インテントURLの形式で返すこと', () => {
      const url = buildLineShareUrl('https://example.com/quiz/abc123');
      expect(url.startsWith('https://social-plugins.line.me/lineit/share?')).toBe(true);
    });

    test('URLをencodeURIComponentでエンコードしurlパラメータへ埋め込むこと', () => {
      const shareUrl = 'https://example.com/quiz/xyz?ref=share&x=1';
      const url = buildLineShareUrl(shareUrl);

      const parsed = new URL(url);
      expect(parsed.origin + parsed.pathname).toBe('https://social-plugins.line.me/lineit/share');
      expect(parsed.searchParams.get('url')).toBe(shareUrl);
      expect(url).toContain(encodeURIComponent(shareUrl));
    });

    test('副作用を持たず、同一入力に対して常に同一の出力を返すこと（純粋関数）', () => {
      const a = buildLineShareUrl('https://example.com/quiz/pure');
      const b = buildLineShareUrl('https://example.com/quiz/pure');
      expect(a).toBe(b);
    });
  });
});
