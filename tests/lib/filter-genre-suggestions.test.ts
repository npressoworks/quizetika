import { filterGenreSuggestions } from '@/lib/filter-genre-suggestions';

const GENRES = [
  { id: 'programming', displayName: 'コンピュータ・IT' },
  { id: 'history', displayName: '歴史' },
  { id: 'science', displayName: '科学・宇宙' },
];

describe('filterGenreSuggestions', () => {
  it('空クエリでは先頭から maxResults 件を返す', () => {
    expect(filterGenreSuggestions(GENRES, '', 2)).toHaveLength(2);
  });

  it('displayName の部分一致でサジェストする', () => {
    const result = filterGenreSuggestions(GENRES, '歴');
    expect(result.map((g) => g.id)).toEqual(['history']);
  });

  it('genreId の前方一致を優先する', () => {
    const result = filterGenreSuggestions(GENRES, 'prog');
    expect(result[0]?.id).toBe('programming');
  });

  it('ひらがな入力でカタカナ displayName にマッチする', () => {
    const result = filterGenreSuggestions(GENRES, 'こんぴゅーた');
    expect(result.map((g) => g.id)).toEqual(['programming']);
  });
});
