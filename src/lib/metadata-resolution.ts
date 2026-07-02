import { createClient } from '@/lib/supabase/client';
import type { GenreMetadata, Quiz, TagMetadata } from '../types';
import { Database } from './supabase/database.types';

const supabase = createClient();

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

/**
 * データベースRowからGenreMetadataへマッピング
 */
export function mapGenreRowToMetadata(row: Database['public']['Tables']['metadata_genres']['Row']): GenreMetadata {
  return {
    id: row.id,
    displayName: row.display_name,
    description: row.description ?? undefined,
    iconImageUrl: row.icon_image_url,
    canonicalId: row.canonical_id,
    mergedGenreIds: row.merged_genre_ids ?? [],
    isActive: row.is_active,
    createdAt: new Date(row.created_at),
  };
}

/**
 * データベースRowからTagMetadataへマッピング
 */
export function mapTagRowToMetadata(row: Database['public']['Tables']['metadata_tags']['Row']): TagMetadata {
  return {
    id: row.id,
    tagName: row.tag_name ?? undefined,
    canonicalId: row.canonical_id,
    mergedTagIds: row.merged_tag_ids ?? [],
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** ID 配列をチャンク分割する */
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

function quizCreatedAtMs(val: unknown): number {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.toDate === 'function') {
      return (obj.toDate as () => Date)().getTime();
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000;
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const date = new Date(val);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

export function sortQuizzesForList(quizzes: Quiz[], sort: QuizListSort): Quiz[] {
  const copy = [...quizzes];
  if (sort === 'popular') {
    copy.sort((a, b) => b.playCount - a.playCount);
  } else if (sort === 'trending') {
    copy.sort((a, b) => b.bookmarksCount - a.bookmarksCount);
  } else {
    copy.sort((a, b) => quizCreatedAtMs(b.createdAt) - quizCreatedAtMs(a.createdAt));
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
  const { data, error } = await supabase
    .from('metadata_genres')
    .select('*')
    .eq('id', genreId)
    .maybeSingle();

  if (error || !data) return null;
  return mapGenreRowToMetadata(data);
}

async function fetchTagMaster(tagId: string): Promise<TagMetadata | null> {
  const { data, error } = await supabase
    .from('metadata_tags')
    .select('*')
    .eq('id', tagId)
    .maybeSingle();

  if (error || !data) return null;
  return mapTagRowToMetadata(data);
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
    
    // 存在確認と新規挿入を upsert や get/insert で行います。
    // RLS を考慮し、単一タグの maybeSingle で取得します。
    const { data: tagMaster, error } = await supabase
      .from('metadata_tags')
      .select('id')
      .eq('id', tagId)
      .maybeSingle();

    if (!tagMaster && !error) {
      await supabase.from('metadata_tags').insert({
        id: tagId,
        tag_name: tagId,
        canonical_id: null,
        merged_tag_ids: [],
        created_by: createdBy,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
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
