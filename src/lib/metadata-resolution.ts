import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import type { GenreMetadata, Quiz, TagMetadata } from '../types';

export const IN_QUERY_CHUNK_SIZE = 10;

export {
  MERGE_MIN_APPROVE_WEIGHT,
  MERGE_MIN_APPROVE_RATE,
  GENRE_MIN_APPROVE_WEIGHT,
  GENRE_MIN_APPROVE_RATE,
} from './metadata-governance';

export type QuizListSort = 'latest' | 'popular' | 'trending';

export class MetadataValidationError extends Error {
  readonly code = 'validation-error';

  constructor(
    message: string,
    public readonly field: 'genre' | 'tags'
  ) {
    super(message);
    this.name = 'MetadataValidationError';
  }
}

const metadataGenresCollection = 'metadata_genres';
const metadataTagsCollection = 'metadata_tags';

/** Firestore `in` クエリ用に ID 配列をチャンク分割する */
export function chunkIdsForInQuery(
  ids: string[],
  chunkSize: number = IN_QUERY_CHUNK_SIZE
): string[][] {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    chunks.push(unique.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * canonicalId チェーンを辿り最終 ID を返す。循環参照時は例外。
 */
export function walkCanonicalIdChain(
  startId: string,
  getCanonicalId: (id: string) => string | null | undefined
): string {
  const visited = new Set<string>();
  let current = startId;

  while (true) {
    if (visited.has(current)) {
      throw new Error('循環参照が検出されました');
    }
    visited.add(current);
    const next = getCanonicalId(current);
    if (!next || next === current) {
      return current;
    }
    current = next;
  }
}

export function dedupeQuizzesById(quizzes: Quiz[]): Quiz[] {
  const map = new Map<string, Quiz>();
  for (const q of quizzes) {
    if (q.id) map.set(q.id, q);
  }
  return [...map.values()];
}

export function sortQuizzesForList(quizzes: Quiz[], sort: QuizListSort): Quiz[] {
  const copy = [...quizzes];
  if (sort === 'popular') {
    copy.sort((a, b) => b.playCount - a.playCount);
  } else if (sort === 'trending') {
    copy.sort((a, b) => b.bookmarksCount - a.bookmarksCount);
  } else {
    copy.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  return copy;
}

export function quizMatchesGenreFilter(quiz: Quiz, expandedIds: Set<string>): boolean {
  if (expandedIds.has(quiz.genre)) return true;
  if (quiz.canonicalGenreId && expandedIds.has(quiz.canonicalGenreId)) return true;
  return false;
}

function isGenreActive(data: GenreMetadata & { isEnabled?: boolean }): boolean {
  if (data.isActive === false) return false;
  if ((data as { isEnabled?: boolean }).isEnabled === false) return false;
  return true;
}

async function fetchGenreMaster(genreId: string): Promise<GenreMetadata | null> {
  const snap = await getDoc(doc(db, metadataGenresCollection, genreId));
  if (!snap.exists()) return null;
  const data = snap.data() as GenreMetadata & { isEnabled?: boolean };
  return { ...data, id: genreId };
}

async function fetchTagMaster(tagId: string): Promise<TagMetadata | null> {
  const snap = await getDoc(doc(db, metadataTagsCollection, tagId));
  if (!snap.exists()) return null;
  const data = snap.data() as TagMetadata;
  return { ...data, id: tagId };
}

export async function resolveCanonicalGenreId(genreId: string): Promise<string> {
  const cache = new Map<string, string | null>();

  const getCanonical = async (id: string): Promise<string | null | undefined> => {
    if (cache.has(id)) return cache.get(id);
    const master = await fetchGenreMaster(id);
    const canonical = master?.canonicalId ?? null;
    cache.set(id, canonical);
    return canonical;
  };

  const visited = new Set<string>();
  let current = genreId;

  while (true) {
    if (visited.has(current)) {
      throw new Error('循環参照が検出されました');
    }
    visited.add(current);
    const next = await getCanonical(current);
    if (!next || next === current) {
      return current;
    }
    current = next;
  }
}

export async function resolveCanonicalTagIds(tagIds: string[]): Promise<string[]> {
  const resolved: string[] = [];
  const seen = new Set<string>();

  for (const tagId of tagIds) {
    if (!tagId) continue;
    const canonical = await resolveCanonicalTagId(tagId);
    if (!seen.has(canonical)) {
      seen.add(canonical);
      resolved.push(canonical);
    }
  }
  return resolved;
}

async function resolveCanonicalTagId(tagId: string): Promise<string> {
  const cache = new Map<string, string | null>();
  const getCanonical = async (id: string): Promise<string | null | undefined> => {
    if (cache.has(id)) return cache.get(id);
    const master = await fetchTagMaster(id);
    const canonical = master?.canonicalId ?? null;
    cache.set(id, canonical);
    return canonical;
  };

  const visited = new Set<string>();
  let current = tagId;

  while (true) {
    if (visited.has(current)) {
      throw new Error('循環参照が検出されました');
    }
    visited.add(current);
    const next = await getCanonical(current);
    if (!next || next === current) {
      return current;
    }
    current = next;
  }
}

export async function expandGenreIdsForQuery(genreId: string): Promise<string[]> {
  const canonicalId = await resolveCanonicalGenreId(genreId);
  const master = await fetchGenreMaster(canonicalId);
  const merged = master?.mergedGenreIds ?? [];
  return [...new Set([canonicalId, genreId, ...merged])];
}

export async function assertActiveGenre(genreId: string): Promise<void> {
  if (!genreId?.trim()) {
    throw new MetadataValidationError('ジャンルを選択してください', 'genre');
  }
  const master = await fetchGenreMaster(genreId.trim());
  if (!master || !isGenreActive(master)) {
    throw new MetadataValidationError(
      '選択されたジャンルはマスタに存在しないか、無効です',
      'genre'
    );
  }
}

export async function ensureTagMasters(
  tagIds: string[],
  createdBy: string
): Promise<void> {
  const now = new Date();
  for (const tagId of tagIds) {
    if (!tagId) continue;
    const ref = doc(db, metadataTagsCollection, tagId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: tagId,
        tagName: tagId,
        canonicalId: null,
        mergedTagIds: [],
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
}

export async function applyQuizMetadataFields(
  genre: string,
  tags: string[],
  authorId: string
): Promise<{ canonicalGenreId: string; canonicalTagIds: string[] }> {
  await assertActiveGenre(genre);
  await ensureTagMasters(tags, authorId);
  const canonicalGenreId = await resolveCanonicalGenreId(genre);
  const canonicalTagIds = await resolveCanonicalTagIds(tags);
  return { canonicalGenreId, canonicalTagIds };
}
