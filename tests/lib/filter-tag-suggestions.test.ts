import { filterTagSuggestions } from '@/lib/filter-tag-suggestions';

const tags = [
  { id: 'javascript', tagName: 'JavaScript' },
  { id: 'js', tagName: 'JS' },
  { id: 'web', tagName: 'Web開発' },
];

describe('filterTagSuggestions', () => {
  it('空クエリでは先頭から maxResults 件を返す', () => {
    expect(filterTagSuggestions(tags, '', 2)).toHaveLength(2);
  });

  it('id の部分一致を優先する', () => {
    const result = filterTagSuggestions(tags, 'java');
    expect(result[0]?.id).toBe('javascript');
  });

  it('大文字小文字を区別しない', () => {
    const result = filterTagSuggestions(tags, 'JAVASCRIPT');
    expect(result.some((t) => t.id === 'javascript')).toBe(true);
  });

  it('tagName でもマッチする', () => {
    const result = filterTagSuggestions(tags, 'web開発');
    expect(result.some((t) => t.id === 'web')).toBe(true);
  });

  it('ひらがな入力でカタカナ tagName にマッチする', () => {
    const kanaTags = [{ id: 'turtle', tagName: 'ウミガメのスープ' }];
    const result = filterTagSuggestions(kanaTags, 'うみがめ');
    expect(result.map((t) => t.id)).toEqual(['turtle']);
  });
});
