import {
  markdownToPlainText,
  closePartialMarkdownForDisplay,
  buildQuickPressDisplayMarkdown,
} from '@/lib/markdown-typewriter';

describe('markdownToPlainText', () => {
  it('strips bold, italic, and link syntax', () => {
    expect(markdownToPlainText('**A** and *B* [C](https://x.test)')).toBe(
      'A and B C'
    );
  });
});

describe('closePartialMarkdownForDisplay', () => {
  it('closes incomplete bold without showing trailing asterisks in plain output', () => {
    expect(markdownToPlainText(closePartialMarkdownForDisplay('**hel'))).toBe(
      'hel'
    );
  });

  it('removes incomplete link syntax', () => {
    expect(markdownToPlainText(closePartialMarkdownForDisplay('[lab'))).toBe(
      'lab'
    );
  });
});

describe('buildQuickPressDisplayMarkdown', () => {
  it('reveals visible characters without raw markdown markers in plain form', () => {
    const md = buildQuickPressDisplayMarkdown('問題：', '**早押し**', 2);
    expect(md).toContain('問題：');
    expect(markdownToPlainText(md)).toBe('問題：早押');
    expect(markdownToPlainText(md)).not.toContain('*');
  });
});
