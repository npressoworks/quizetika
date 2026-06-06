import {
  normalizeSearchText,
  searchTextEquals,
  searchTextIncludes,
  searchTextStartsWith,
} from '@/lib/normalize-search-text';

describe('normalizeSearchText', () => {
  it('カタカナをひらがなに正規化する', () => {
    expect(normalizeSearchText('コンピュータ')).toBe('こんぴゅーた');
    expect(normalizeSearchText('レキシ')).toBe('れきし');
  });

  it('ひらがな入力はそのまま比較できる', () => {
    expect(normalizeSearchText('れきし')).toBe('れきし');
  });

  it('大文字小文字を区別しない', () => {
    expect(normalizeSearchText('JavaScript')).toBe('javascript');
  });
});

describe('searchTextIncludes', () => {
  it('ひらがなクエリでカタカナ本文にマッチする', () => {
    expect(searchTextIncludes('コンピュータ・IT', 'こんぴゅーた')).toBe(true);
  });

  it('カタカナクエリでひらがな本文にマッチする', () => {
    expect(searchTextIncludes('うみがめのスープ', 'ウミガメ')).toBe(true);
  });
});

describe('searchTextStartsWith', () => {
  it('前方一致でも正規化する', () => {
    expect(searchTextStartsWith('コンピュータ・IT', 'こんぴゅーた')).toBe(true);
  });
});

describe('searchTextEquals', () => {
  it('ひらがなとカタカナを同一視する', () => {
    expect(searchTextEquals('ウミガメ', 'うみがめ')).toBe(true);
  });
});
