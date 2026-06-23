export const HOME_FEED_PAGE_SIZE = 20;
/** ディスカバリーホームのトレンド／新着カルーセル件数（検索タブ先頭ページとは別上限） */
export const DISCOVERY_CAROUSEL_SIZE = 10;
export const SEARCH_MATERIALIZE_CAP = 200;

export type QuizFeedTabKind = 'latest' | 'popular' | 'trending' | 'timeline' | 'author';

export class QuizFeedCursorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuizFeedCursorError';
  }
}

interface QuizFeedCursorPayload {
  v: 1;
  kind: QuizFeedTabKind;
  quizId: string;
  sortKey: number;
}

interface SearchOffsetCursorPayload {
  v: 1;
  offset: number;
  fingerprint: string;
}

function encodePayload(payload: unknown): string {
  const json = JSON.stringify(payload);
  // ブラウザ環境ではbtoaを使用（BufferのBase64URLは未対応の場合があるため）
  if (typeof window !== 'undefined') {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Node.js環境ではBufferを使用
  return Buffer.from(json, 'utf8').toString('base64url');
}

function decodePayload<T>(cursor: string): T {
  try {
    let json: string;
    // ブラウザ環境ではatobを使用
    if (typeof window !== 'undefined') {
      const padded = cursor.replace(/-/g, '+').replace(/_/g, '/');
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      json = new TextDecoder().decode(bytes);
    } else {
      // Node.js環境ではBufferを使用
      json = Buffer.from(cursor, 'base64url').toString('utf8');
    }
    return JSON.parse(json) as T;
  } catch {
    throw new QuizFeedCursorError('Invalid cursor');
  }
}

export function encodeQuizFeedCursor(payload: QuizFeedCursorPayload): string {
  return encodePayload(payload);
}

export function decodeQuizFeedCursor(
  cursor: string,
  expectedKind: QuizFeedTabKind
): QuizFeedCursorPayload {
  const decoded = decodePayload<QuizFeedCursorPayload>(cursor);
  if (
    decoded.v !== 1 ||
    decoded.kind !== expectedKind ||
    !decoded.quizId ||
    typeof decoded.sortKey !== 'number'
  ) {
    console.error('[decodeQuizFeedCursor] Validation failed:', {
      cursor,
      expectedKind,
      decoded,
    });
    throw new QuizFeedCursorError('Invalid cursor');
  }
  return decoded;
}

export interface SearchFingerprintFilters {
  genreId?: string;
  tags?: string[];
  format?: string;
  difficultyMin?: number | null;
  difficultyMax?: number | null;
  minQuestions?: number | null;
  maxQuestions?: number | null;
}

export function buildSearchFingerprint(queryText: string, filters: SearchFingerprintFilters): string {
  const normalized = {
    queryText: queryText.trim(),
    filters: {
      genreId: filters.genreId ?? '',
      tags: [...(filters.tags ?? [])].sort(),
      format: filters.format ?? '',
      difficultyMin: filters.difficultyMin ?? null,
      difficultyMax: filters.difficultyMax ?? null,
      minQuestions: filters.minQuestions ?? null,
      maxQuestions: filters.maxQuestions ?? null,
    },
  };
  const str = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

export function encodeSearchOffsetCursor(offset: number, fingerprint: string): string {
  return encodePayload({ v: 1, offset, fingerprint } satisfies SearchOffsetCursorPayload);
}

export function decodeSearchOffsetCursor(cursor: string, fingerprint: string): number {
  const decoded = decodePayload<SearchOffsetCursorPayload>(cursor);
  if (
    decoded.v !== 1 ||
    typeof decoded.offset !== 'number' ||
    decoded.offset < 0 ||
    decoded.fingerprint !== fingerprint
  ) {
    throw new QuizFeedCursorError('Invalid cursor');
  }
  return decoded.offset;
}
