import type { GenreMetadata } from '@/types';
import { normalizeSearchText } from '@/lib/normalize-search-text';

/** 複合検索パネル用: displayName / genreId で部分一致サジェスト */
export function filterGenreSuggestions(
  genres: Pick<GenreMetadata, 'id' | 'displayName'>[],
  query: string,
  maxResults = 8
): Pick<GenreMetadata, 'id' | 'displayName'>[] {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return genres.slice(0, maxResults);
  }

  const scored = genres
    .map((g) => {
      const name = normalizeSearchText(g.displayName);
      const id = normalizeSearchText(g.id);
      let rank = 3;
      if (id === needle || name === needle) rank = 0;
      else if (id.startsWith(needle) || name.startsWith(needle)) rank = 1;
      else if (name.includes(needle) || id.includes(needle)) rank = 2;
      else return null;
      return { genre: g, rank };
    })
    .filter((x): x is { genre: Pick<GenreMetadata, 'id' | 'displayName'>; rank: number } => x != null);

  scored.sort((a, b) => a.rank - b.rank || a.genre.displayName.localeCompare(b.genre.displayName, 'ja'));
  return scored.slice(0, maxResults).map((s) => s.genre);
}
