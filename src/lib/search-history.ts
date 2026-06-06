const RECENT_GENRES_KEY = 'quizeum_recent_search_genres';
const RECENT_KEYWORDS_KEY = 'quizeum_recent_search_words';

const MAX_RECENT_GENRES = 3;
const MAX_RECENT_KEYWORDS = 5;

/**
 * localStorage から直近の検索ジャンル履歴を取得する
 */
export function getRecentGenres(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_GENRES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to get recent genres:', error);
    return [];
  }
}

/**
 * 検索したジャンルを直近履歴に保存する (重複排除・先頭挿入・最大3件)
 */
export function saveRecentGenre(genreId: string): void {
  if (typeof window === 'undefined' || !genreId || typeof genreId !== 'string') {
    return;
  }
  try {
    const cleaned = genreId.trim();
    if (cleaned.length === 0) return;

    const current = getRecentGenres();
    // 重複を排除
    const filtered = current.filter((g) => g !== cleaned);
    // 先頭に追加し、最大3件に制限する
    const next = [cleaned, ...filtered].slice(0, MAX_RECENT_GENRES);

    window.localStorage.setItem(RECENT_GENRES_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to save recent genre:', error);
  }
}

/**
 * localStorage から直近の検索ワード・タグ履歴を取得する
 */
export function getRecentKeywords(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RECENT_KEYWORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to get recent keywords:', error);
    return [];
  }
}

/**
 * 検索キーワード・タグを直近履歴に保存する (重複排除・先頭挿入・最大5件)
 */
export function saveRecentKeyword(keywordOrTag: string): void {
  if (typeof window === 'undefined' || !keywordOrTag || typeof keywordOrTag !== 'string') {
    return;
  }
  try {
    const cleaned = keywordOrTag.trim();
    if (cleaned.length === 0) return;

    const current = getRecentKeywords();
    // 重複を排除
    const filtered = current.filter((k) => k !== cleaned);
    // 先頭に追加し、最大5件に制限する
    const next = [cleaned, ...filtered].slice(0, MAX_RECENT_KEYWORDS);

    window.localStorage.setItem(RECENT_KEYWORDS_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to save recent keyword:', error);
  }
}
