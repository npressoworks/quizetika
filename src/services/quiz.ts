import { createClient } from '@/lib/supabase/client';
import { Quiz, Question, PaginatedQuizResult, QuizExportPackage } from '../types';
import {
  validateQuizForPublish,
  validateQuizForDraft,
  normalizeTag,
  normalizeQuizQuestionsForSave,
} from './quiz-validation';
import { normalizeSearchText, searchTextIncludes } from '../lib/normalize-search-text';
import {
  assertAuthorOwnsQuestion,
  canDeleteQuestionDoc,
  isReferenceLinkQuestion,
  partitionQuestionsForSave,
} from '../lib/linked-question';
import {
  applyQuizMetadataFields,
  chunkIdsForInQuery,
  dedupeQuizzesById,
  expandGenreIdsForQuery,
  MetadataValidationError,
  resolveCanonicalGenreId,
  resolveCanonicalTagIds,
  sortQuizzesForList,
  type QuizListSort,
} from '../lib/metadata-resolution';
import type { GenreMetadata, TagMetadata } from '../types';
import {
  quizMatchesAllTags,
  type TagMatchSpec,
} from '../lib/quiz-tag-match';
import { applyFormatFilter } from '../lib/quiz-format-match';
import type { QuizFormat } from '../lib/quiz-format';
import { writeSearchLog } from '../lib/search-log';
import {
  HOME_FEED_PAGE_SIZE,
  SEARCH_MATERIALIZE_CAP,
  QuizFeedCursorError,
  buildSearchFingerprint,
  decodeQuizFeedCursor,
  decodeSearchOffsetCursor,
  encodeQuizFeedCursor,
  encodeSearchOffsetCursor,
  type QuizFeedTabKind,
} from '../lib/quiz-feed-cursor';
import {
  assertCanSetQuizVisibilitySync,
  isDiscoveryPublicQuiz,
  isFollowTimelineEligibleQuiz,
  normalizeQuizVisibilityForSave,
  resolveQuizVisibility,
} from '../lib/quiz-access';
import type { EntitlementUserFields } from './entitlement';
import { Database } from '@/lib/supabase/database.types';
import { mapQuestionRowToQuestion, mapQuestionToRow } from './question';

export type { QuizListSort } from '../lib/metadata-resolution';
export { QuizFeedCursorError } from '../lib/quiz-feed-cursor';

const supabase = createClient();

/** UUID 生成用の簡易ヘルパー */
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * データベースRowからQuizオブジェクトへマッピング
 */
export function mapRowToQuiz(row: Database['public']['Tables']['quizzes']['Row']): Quiz {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar ?? '',
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    difficulty: row.difficulty,
    genre: row.genre,
    tags: row.tags ?? [],
    originalTags: row.original_tags ?? [],
    questionIds: row.question_ids ?? [],
    questions: (row.questions as any) ?? [],
    questionCount: row.question_count ?? 0,
    status: row.status as Quiz['status'],
    visibility: row.visibility as Quiz['visibility'],
    leaderboardFirstPlay: (row as any).leaderboard_first_play ?? [],
    leaderboardReplay: (row as any).leaderboard_replay ?? [],
    flagsCount: row.flags_count ?? 0,
    playCount: row.play_count ?? 0,
    bookmarksCount: row.bookmarks_count ?? 0,
    positiveCount: row.positive_count ?? 0,
    negativeCount: row.negative_count ?? 0,
    tempPositiveCount: row.temp_positive_count ?? 0,
    tempNegativeCount: row.temp_negative_count ?? 0,
    reviewScore: row.review_score,
    canonicalGenreId: row.canonical_genre_id ?? '',
    canonicalTagIds: row.canonical_tag_ids ?? [],
    format: (row.format as Quiz['format']) ?? undefined,
    isReviewMasked: row.is_review_masked ?? false,
    reviewBadge: (row.review_badge as Quiz['reviewBadge']) ?? null,
    activeResetRequestId: row.active_reset_request_id ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Quizオブジェクトの部分データからデータベースのアップデート用レコードへマッピング
 */
export function mapQuizToRow(quiz: Partial<Quiz>): Database['public']['Tables']['quizzes']['Update'] {
  const row: Database['public']['Tables']['quizzes']['Update'] = {};
  if (quiz.id !== undefined) row.id = quiz.id;
  if (quiz.authorId !== undefined) row.author_id = quiz.authorId;
  if (quiz.authorName !== undefined) row.author_name = quiz.authorName;
  if (quiz.authorAvatar !== undefined) row.author_avatar = quiz.authorAvatar ?? null;
  if (quiz.title !== undefined) row.title = quiz.title;
  if (quiz.description !== undefined) row.description = quiz.description;
  if (quiz.thumbnailUrl !== undefined) row.thumbnail_url = quiz.thumbnailUrl ?? null;
  if (quiz.difficulty !== undefined) row.difficulty = quiz.difficulty;
  if (quiz.genre !== undefined) row.genre = quiz.genre;
  if (quiz.tags !== undefined) row.tags = quiz.tags;
  if (quiz.originalTags !== undefined) row.original_tags = quiz.originalTags;
  if (quiz.questionIds !== undefined) row.question_ids = quiz.questionIds;
  if (quiz.questions !== undefined) row.questions = quiz.questions as any;
  if (quiz.questionCount !== undefined) row.question_count = quiz.questionCount;
  if (quiz.status !== undefined) row.status = quiz.status;
  if (quiz.visibility !== undefined) row.visibility = quiz.visibility;
  if (quiz.flagsCount !== undefined) row.flags_count = quiz.flagsCount;
  if (quiz.playCount !== undefined) row.play_count = quiz.playCount;
  if (quiz.bookmarksCount !== undefined) row.bookmarks_count = quiz.bookmarksCount;
  if (quiz.positiveCount !== undefined) row.positive_count = quiz.positiveCount;
  if (quiz.negativeCount !== undefined) row.negative_count = quiz.negativeCount;
  if (quiz.tempPositiveCount !== undefined) row.temp_positive_count = quiz.tempPositiveCount;
  if (quiz.tempNegativeCount !== undefined) row.temp_negative_count = quiz.tempNegativeCount;
  if (quiz.reviewScore !== undefined) row.review_score = quiz.reviewScore;
  if (quiz.canonicalGenreId !== undefined) row.canonical_genre_id = quiz.canonicalGenreId ?? null;
  if (quiz.canonicalTagIds !== undefined) row.canonical_tag_ids = quiz.canonicalTagIds;
  if (quiz.format !== undefined) row.format = quiz.format ?? null;
  if (quiz.isReviewMasked !== undefined) row.is_review_masked = quiz.isReviewMasked ?? null;
  if (quiz.reviewBadge !== undefined) row.review_badge = quiz.reviewBadge ?? null;
  if (quiz.activeResetRequestId !== undefined) row.active_reset_request_id = quiz.activeResetRequestId ?? null;
  if (quiz.createdAt !== undefined) row.created_at = quiz.createdAt.toISOString();
  if (quiz.updatedAt !== undefined) row.updated_at = quiz.updatedAt.toISOString();
  return row;
}

async function enforceVisibilityEntitlement(
  authorId: string,
  nextVisibility: ReturnType<typeof resolveQuizVisibility>,
  prevVisibility?: ReturnType<typeof resolveQuizVisibility>
): Promise<void> {
  const { data: userRow } = await supabase
    .from('users')
    .select('*')
    .eq('id', authorId)
    .maybeSingle();

  const fields: any = userRow
    ? {
        subscriptionTier: userRow.subscription_tier as any,
        stripeSubscriptionId: userRow.stripe_subscription_id ?? undefined,
        subscriptionStatus: userRow.subscription_status ?? undefined,
      }
    : {};
  assertCanSetQuizVisibilitySync(fields, nextVisibility, prevVisibility);
}

function filterDiscoveryQuizzes(quizzes: Quiz[]): Quiz[] {
  return quizzes.filter(isDiscoveryPublicQuiz);
}

function filterFollowTimelineQuizzes(quizzes: Quiz[]): Quiz[] {
  return quizzes.filter(isFollowTimelineEligibleQuiz);
}

export interface QuizFeedPageOptions {
  limit?: number;
  cursor?: string | null;
}

export interface SearchQuizzesPaginatedOptions {
  limit?: number;
  cursor?: string | null;
  userId?: string;
}

export interface SearchFilters {
  genreId?: string;
  tags?: string[];
  format?: QuizFormat;
  difficultyMin?: number;
  difficultyMax?: number;
  minQuestions?: number;
  maxQuestions?: number;
}

async function buildTagMatchSpecs(tags?: string[]): Promise<TagMatchSpec[]> {
  if (!tags?.length) return [];
  const normalized = [...new Set(tags.map(normalizeTag).filter((t) => t.length > 0))];
  const specs: TagMatchSpec[] = [];
  for (const normalizedInput of normalized) {
    const resolved = await resolveCanonicalTagIds([normalizedInput]);
    specs.push({
      normalizedInput,
      canonicalId: resolved[0] ?? normalizedInput,
    });
  }
  return specs;
}

function intersectQuizzesById(quizSets: Quiz[][]): Quiz[] {
  if (quizSets.length === 0) return [];
  const [first, ...rest] = quizSets;
  return first.filter((quiz) =>
    rest.every((set) => set.some((q) => q.id === quiz.id))
  );
}

/** 有効ジャンルマスタ（`isActive=true`）。ディスカバリーホームのジャンルカルーセルでも再利用。 */
export async function listActiveGenres(): Promise<GenreMetadata[]> {
  const { data, error } = await supabase
    .from('metadata_genres')
    .select('*')
    .eq('is_active', true);

  if (error || !data) return [];
  return data.map((d) => {
    return {
      id: d.id,
      displayName: d.display_name,
      description: d.description ?? undefined,
      iconImageUrl: d.icon_image_url,
      canonicalId: d.canonical_id,
      mergedGenreIds: d.merged_genre_ids ?? [],
      isActive: d.is_active,
    };
  });
}

/** 存続タグ（canonicalId 未設定）のみ。UI サジェスト用 */
export async function listActiveTags(): Promise<TagMetadata[]> {
  const { data, error } = await supabase
    .from('metadata_tags')
    .select('*')
    .is('canonical_id', null);

  if (error || !data) return [];
  
  const rows = data.map((d) => {
    return {
      id: d.id,
      tagName: d.tag_name ?? undefined,
      canonicalId: d.canonical_id,
      mergedTagIds: d.merged_tag_ids ?? [],
      createdBy: d.created_by ?? undefined,
      createdAt: new Date(d.created_at),
      updatedAt: new Date(d.updated_at),
    };
  });

  return rows.sort((a, b) => {
    const nameA = a.tagName ?? a.id;
    const nameB = b.tagName ?? b.id;
    const cmp = nameA.localeCompare(nameB, 'ja');
    return cmp !== 0 ? cmp : a.id.localeCompare(b.id, 'ja');
  });
}

async function queryPublishedByCanonicalGenre(
  canonicalGenreId: string,
  sort: QuizListSort,
  limitCount: number
): Promise<Quiz[]> {
  const orderField =
    sort === 'popular' ? 'play_count' : sort === 'trending' ? 'bookmarks_count' : 'created_at';

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .eq('canonical_genre_id', canonicalGenreId)
    .order(orderField, { ascending: false })
    .limit(limitCount);

  if (error || !data) return [];
  return filterDiscoveryQuizzes(data.map(mapRowToQuiz));
}

async function queryPublishedByGenreIn(genreIds: string[], limitCount: number): Promise<Quiz[]> {
  if (genreIds.length === 0) return [];

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .in('genre', genreIds)
    .limit(limitCount);

  if (error || !data) return [];
  return filterDiscoveryQuizzes(data.map(mapRowToQuiz));
}

async function queryPublishedByCanonicalTag(
  tagId: string,
  sort: QuizListSort,
  limitCount: number
): Promise<Quiz[]> {
  const orderField =
    sort === 'popular' ? 'play_count' : sort === 'trending' ? 'bookmarks_count' : 'created_at';

  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .contains('canonical_tag_ids', [tagId])
    .order(orderField, { ascending: false })
    .limit(limitCount);

  if (error || !data) return [];
  return filterDiscoveryQuizzes(data.map(mapRowToQuiz));
}

async function queryPublishedByLegacyTag(tag: string, limitCount: number): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .contains('tags', [tag])
    .limit(limitCount);

  if (error || !data) return [];
  return filterDiscoveryQuizzes(data.map(mapRowToQuiz));
}

/**
 * 新規クイズを作成・投稿する
 */
export async function createQuiz(
  quiz: Omit<Quiz, 'id' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const normalizedTags = (quiz.tags ?? []).map(normalizeTag).filter(Boolean);

  let canonicalGenreId = quiz.canonicalGenreId ?? '';
  let canonicalTagIds = quiz.canonicalTagIds ?? [];
  if (quiz.genre?.trim()) {
    const resolved = await applyQuizMetadataFields(
      quiz.genre,
      normalizedTags,
      quiz.authorId
    );
    canonicalGenreId = resolved.canonicalGenreId;
    canonicalTagIds = resolved.canonicalTagIds;
  }

  const quizId = generateUUID();

  // 問題の個別保存と ID の収集
  const questionIds: string[] = [];
  const processedQuestions: Question[] = [];
  const inputQuestions = quiz.questions || [];
  const effectiveStatus = quiz.status ?? 'draft';
  const nextVisibility = normalizeQuizVisibilityForSave(
    quiz.visibility,
    effectiveStatus
  );
  if (nextVisibility !== undefined) {
    await enforceVisibilityEntitlement(quiz.authorId, nextVisibility);
  }

  const questionInserts: Database['public']['Tables']['questions']['Insert'][] = [];
  for (const q of inputQuestions) {
    const qId = generateUUID();
    const fullQuestion: Question = {
      ...q,
      id: qId,
      quizId: quizId,
      authorId: quiz.authorId,
      authorName: quiz.authorName,
      authorAvatar: quiz.authorAvatar,
      bookmarksCount: q.bookmarksCount || 0,
      correctCount: q.correctCount || 0,
      incorrectCount: q.incorrectCount || 0,
    };

    questionInserts.push(mapQuestionToRow(fullQuestion) as Database['public']['Tables']['questions']['Insert']);
    questionIds.push(qId);
    processedQuestions.push(fullQuestion);
  }

  if (questionInserts.length > 0) {
    const { error: qError } = await supabase.from('questions').insert(questionInserts);
    if (qError) throw new Error(`問題の作成に失敗しました: ${qError.message}`);
  }

  // クイズの保存
  const newQuiz: Quiz = {
    ...(quiz as any),
    id: quizId,
    tags: normalizedTags.length > 0 ? normalizedTags : quiz.tags,
    canonicalGenreId,
    canonicalTagIds,
    questionIds,
    questions: processedQuestions,
    questionCount: processedQuestions.length,
    playCount: 0,
    bookmarksCount: 0,
    createdAt: now,
    updatedAt: now,
    ...(nextVisibility !== undefined ? { visibility: nextVisibility } : {}),
  };

  const { error: quizError } = await supabase
    .from('quizzes')
    .insert(mapQuizToRow(newQuiz) as Database['public']['Tables']['quizzes']['Insert']);

  if (quizError) {
    // ロールバック: 挿入した問題を削除
    if (questionIds.length > 0) {
      await supabase.from('questions').delete().in('id', questionIds);
    }
    throw new Error(`クイズの作成に失敗しました: ${quizError.message}`);
  }

  return quizId;
}

/**
 * クイズをIDで1件取得
 */
export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRowToQuiz(data);
}

/**
 * クイズ情報を更新する
 */
export async function updateQuiz(
  quizId: string,
  data: Partial<Omit<Quiz, 'id' | 'authorId' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const currentQuiz = await getQuiz(quizId);

  if (!currentQuiz) {
    throw new Error('クイズが見つかりません');
  }

  const now = new Date();
  const updatePayload: any = {
    ...data,
    updatedAt: now,
  };

  if (data.questions) {
    const normalizedQuestions = normalizeQuizQuestionsForSave(data.questions);
    const oldQuestionIds = currentQuiz.questionIds || [];
    const newQuestionIds: string[] = [];
    const processedQuestions: Question[] = [];

    const candidateIds = normalizedQuestions
      .map((q) => q.id)
      .filter((id): id is string => !!id);
    const storedById = await loadQuestionsByIds([
      ...new Set([...oldQuestionIds, ...candidateIds]),
    ]);

    for (const q of normalizedQuestions) {
      if (isReferenceLinkQuestion(q) && q.id && !storedById.has(q.id)) {
        const { data: qData } = await supabase
          .from('questions')
          .select('*')
          .eq('id', q.id)
          .maybeSingle();
        if (qData) {
          storedById.set(q.id, mapQuestionRowToQuestion(qData));
        }
      }
    }

    const partition = partitionQuestionsForSave(
      normalizedQuestions,
      oldQuestionIds,
      storedById
    );

    for (const refId of partition.referenceOnlyIds) {
      const stored = storedById.get(refId);
      if (!stored) {
        throw new Error(`参照問題が見つかりません: ${refId}`);
      }
      assertAuthorOwnsQuestion(currentQuiz.authorId, stored);
      newQuestionIds.push(refId);
      processedQuestions.push(stripEditorOnlyFields({ ...stored, id: refId }));
    }

    const questionInserts: Database['public']['Tables']['questions']['Insert'][] = [];
    const questionUpdates: { id: string; payload: Database['public']['Tables']['questions']['Update'] }[] = [];

    for (const q of partition.ownedToWrite) {
      let qId = q.id;
      const isExistingOwned =
        !!qId && oldQuestionIds.includes(qId) && !isReferenceLinkQuestion(q);

      if (!isExistingOwned || !qId) {
        qId = generateUUID();
      }

      const fullQuestion: Question = stripEditorOnlyFields({
        ...q,
        id: qId,
        quizId: quizId,
        authorId: currentQuiz.authorId,
        authorName: currentQuiz.authorName,
        authorAvatar: currentQuiz.authorAvatar,
        bookmarksCount: q.bookmarksCount || 0,
        correctCount: q.correctCount || 0,
        incorrectCount: q.incorrectCount || 0,
      });

      const row = mapQuestionToRow(fullQuestion);

      if (isExistingOwned && qId) {
        questionUpdates.push({ id: qId, payload: row });
      } else {
        questionInserts.push(row as Database['public']['Tables']['questions']['Insert']);
      }

      newQuestionIds.push(qId);
      processedQuestions.push(fullQuestion);
    }

    // データベースへの問題更新/挿入処理
    if (questionInserts.length > 0) {
      const { error: insError } = await supabase.from('questions').insert(questionInserts);
      if (insError) throw new Error(`問題の新規作成に失敗しました: ${insError.message}`);
    }

    for (const item of questionUpdates) {
      const { error: updError } = await supabase
        .from('questions')
        .update(item.payload)
        .eq('id', item.id);
      if (updError) throw new Error(`問題の更新に失敗しました: ${updError.message}`);
    }

    const deletedQuestionIds = oldQuestionIds.filter((id) => !newQuestionIds.includes(id));
    const finalDeletes: string[] = [];
    for (const dId of deletedQuestionIds) {
      const deletable = await canDeleteQuestionDoc(
        dId,
        quizId,
        findQuizIdsContainingQuestion
      );
      if (deletable) {
        finalDeletes.push(dId);
      }
    }

    if (finalDeletes.length > 0) {
      const { error: delError } = await supabase
        .from('questions')
        .delete()
        .in('id', finalDeletes);
      if (delError) console.error('問題の削除に失敗しました:', delError.message);
    }

    updatePayload.question_ids = newQuestionIds;
    updatePayload.questions = processedQuestions;
    updatePayload.question_count = processedQuestions.length;

    // クリーズオブジェクトへの逆インポート用フィールドもセット
    updatePayload.questionIds = newQuestionIds;
    updatePayload.questions = processedQuestions;
    updatePayload.questionCount = processedQuestions.length;
  }

  const mergedGenre = data.genre ?? currentQuiz.genre;
  const mergedTags = data.tags ?? currentQuiz.tags;
  const effectiveStatus = data.status ?? currentQuiz.status;
  const prevVisibility = resolveQuizVisibility(currentQuiz);
  const nextVisibility =
    data.visibility !== undefined
      ? data.visibility
      : normalizeQuizVisibilityForSave(undefined, effectiveStatus) ?? prevVisibility;

  if (data.visibility !== undefined || effectiveStatus === 'published') {
    await enforceVisibilityEntitlement(
      currentQuiz.authorId,
      nextVisibility,
      prevVisibility
    );
    updatePayload.visibility = nextVisibility;
  }

  if (data.genre !== undefined || data.tags !== undefined) {
    try {
      const { canonicalGenreId, canonicalTagIds } = await applyQuizMetadataFields(
        mergedGenre,
        mergedTags.map(normalizeTag).filter(Boolean),
        currentQuiz.authorId
      );
      updatePayload.tags = mergedTags.map(normalizeTag).filter(Boolean);
      updatePayload.canonical_genre_id = canonicalGenreId;
      updatePayload.canonical_tag_ids = canonicalTagIds;

      // 逆インポート用
      updatePayload.canonicalGenreId = canonicalGenreId;
      updatePayload.canonicalTagIds = canonicalTagIds;
    } catch (err) {
      if (err instanceof MetadataValidationError) {
        throw err;
      }
      throw err;
    }
  }

  if (effectiveStatus === 'published') {
    const merged: Quiz = { ...currentQuiz, ...updatePayload };
    const errors = validateQuizForPublish(merged);
    if (errors.length > 0) {
      throw new Error(
        `クイズの公開バリデーションに失敗しました: ${errors.map((e) => e.message).join('; ')}`
      );
    }
  } else if (
    data.genre !== undefined ||
    data.tags !== undefined ||
    data.title !== undefined ||
    data.questions !== undefined
  ) {
    const draftErrors = validateQuizForDraft({
      title: updatePayload.title ?? currentQuiz.title,
      genre: mergedGenre,
      questions: updatePayload.questions ?? currentQuiz.questions,
    });
    if (draftErrors.length > 0) {
      throw new Error(
        `下書き保存に失敗しました: ${draftErrors.map((e) => e.message).join('; ')}`
      );
    }
  }

  const { error: quizError } = await supabase
    .from('quizzes')
    .update(mapQuizToRow(cleanUndefined(updatePayload)))
    .eq('id', quizId);

  if (quizError) {
    throw new Error(`クイズの更新に失敗しました: ${quizError.message}`);
  }
}

/**
 * クイズを削除する
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  // RLS に準拠し、子テーブルから安全に削除します
  await supabase.from('bookmarks').delete().eq('target_id', quizId);
  
  const { error } = await supabase
    .from('quizzes')
    .delete()
    .eq('id', quizId);

  if (error) {
    throw new Error(`クイズの削除に失敗しました: ${error.message}`);
  }
}

async function loadQuestionsByIds(ids: string[]): Promise<Map<string, Question>> {
  const map = new Map<string, Question>();
  if (ids.length === 0) return map;
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const { data } = await supabase
      .from('questions')
      .select('*')
      .in('id', chunk);

    if (data) {
      data.forEach((row) => {
        const q = mapQuestionRowToQuestion(row);
        map.set(q.id, q);
      });
    }
  }
  return map;
}

async function findQuizIdsContainingQuestion(questionId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('id')
    .contains('question_ids', [questionId]);

  if (error || !data) return [];
  return data.map((d) => d.id);
}

function stripEditorOnlyFields(question: Question): Question {
  const { linkKind: _linkKind, ...rest } = question;
  return rest as Question;
}

/**
 * オブジェクトから値が undefined のプロパティを再帰的に取り除く
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanUndefined) as any;
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        newObj[key] = cleanUndefined(val);
      }
    }
    return newObj;
  }
  return obj;
}

/**
 * クイズを下書き保存、または公開する統合関数。
 */
export async function saveQuiz(
  quizData: Omit<Quiz, 'id' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>,
  status: 'draft' | 'published'
): Promise<string> {
  const now = new Date();
  const normalizedTags = quizData.tags.map(normalizeTag).filter(Boolean);

  const quizId = generateUUID();

  const questionIds: string[] = [];
  const processedQuestions: Question[] = [];

  const inputQuestions = normalizeQuizQuestionsForSave(quizData.questions || []);
  const refCandidateIds = inputQuestions
    .filter((q) => isReferenceLinkQuestion(q) && q.id)
    .map((q) => q.id as string);
  const storedById = await loadQuestionsByIds(refCandidateIds);
  const partition = partitionQuestionsForSave(inputQuestions, [], storedById);

  for (const refId of partition.referenceOnlyIds) {
    const stored = storedById.get(refId);
    if (!stored) {
      throw new Error(`参照問題が見つかりません: ${refId}`);
    }
    assertAuthorOwnsQuestion(quizData.authorId, stored);
    questionIds.push(refId);
    processedQuestions.push(stripEditorOnlyFields({ ...stored, id: refId }));
  }

  const questionInserts: Database['public']['Tables']['questions']['Insert'][] = [];

  for (const q of partition.ownedToWrite) {
    const qId = generateUUID();
    const fullQuestion: Question = stripEditorOnlyFields({
      ...q,
      id: qId,
      quizId: quizId,
      authorId: quizData.authorId,
      authorName: quizData.authorName,
      authorAvatar: quizData.authorAvatar,
      bookmarksCount: q.bookmarksCount || 0,
      correctCount: q.correctCount || 0,
      incorrectCount: q.incorrectCount || 0,
    });
    
    questionInserts.push(mapQuestionToRow(fullQuestion) as Database['public']['Tables']['questions']['Insert']);
    questionIds.push(qId);
    processedQuestions.push(fullQuestion);
  }

  if (questionInserts.length > 0) {
    const { error: insError } = await supabase.from('questions').insert(questionInserts);
    if (insError) throw new Error(`問題の作成に失敗しました: ${insError.message}`);
  }

  let canonicalGenreId = '';
  let canonicalTagIds: string[] = [];

  try {
    const resolved = await applyQuizMetadataFields(
      quizData.genre,
      normalizedTags,
      quizData.authorId
    );
    canonicalGenreId = resolved.canonicalGenreId;
    canonicalTagIds = resolved.canonicalTagIds;
  } catch (err) {
    if (err instanceof MetadataValidationError) {
      throw err;
    }
    // ロールバック
    if (questionIds.length > 0) {
      await supabase.from('questions').delete().in('id', questionIds);
    }
    throw err;
  }

  const payload: Quiz = {
    ...(quizData as any),
    id: quizId,
    tags: normalizedTags,
    canonicalGenreId,
    canonicalTagIds,
    status,
    questionIds,
    questions: processedQuestions,
    questionCount: processedQuestions.length,
    playCount: 0,
    bookmarksCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const nextVisibility = normalizeQuizVisibilityForSave(quizData.visibility, status);
  if (nextVisibility !== undefined) {
    await enforceVisibilityEntitlement(quizData.authorId, nextVisibility);
    payload.visibility = nextVisibility;
  }

  if (status === 'published') {
    const errors = validateQuizForPublish(payload);
    if (errors.length > 0) {
      // ロールバック
      if (questionIds.length > 0) {
        await supabase.from('questions').delete().in('id', questionIds);
      }
      throw new Error(
        `クイズの公開バリデーションに失敗しました: ${errors.map((e) => e.message).join('; ')}`
      );
    }
  } else {
    const draftErrors = validateQuizForDraft(payload);
    if (draftErrors.length > 0) {
      // ロールバック
      if (questionIds.length > 0) {
        await supabase.from('questions').delete().in('id', questionIds);
      }
      throw new Error(
        `下書き保存に失敗しました: ${draftErrors.map((e) => e.message).join('; ')}`
      );
    }
  }

  const { error: quizError } = await supabase
    .from('quizzes')
    .insert(mapQuizToRow(cleanUndefined(payload)) as Database['public']['Tables']['quizzes']['Insert']);

  if (quizError) {
    // ロールバック
    if (questionIds.length > 0) {
      await supabase.from('questions').delete().in('id', questionIds);
    }
    throw new Error(`クイズの作成に失敗しました: ${quizError.message}`);
  }

  return quizId;
}

/**
 * 作成者の全クイズ（下書き含む）をエクスポート用パッケージとして返す
 */
export async function exportQuizzes(uid: string): Promise<QuizExportPackage> {
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('author_id', uid)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return { exportedAt: new Date().toISOString(), quizzes: [] };
  }

  return {
    exportedAt: new Date().toISOString(),
    quizzes: data.map(mapRowToQuiz),
  };
}

/**
 * クイズの挑戦回数（プレイ回数）をインクリメント
 */
export async function incrementPlayCount(quizId: string): Promise<void> {
  const current = await getQuiz(quizId);
  if (!current) return;

  await supabase
    .from('quizzes')
    .update({ play_count: (current.playCount ?? 0) + 1 })
    .eq('id', quizId);
}

/* ==========================================================================
   クイズ一覧・フィード・クエリ機能
   ========================================================================== */

const SEARCH_POOL_SIZE = 100;

type QuizFeedOrderField = 'createdAt' | 'playCount' | 'bookmarksCount';

function orderFieldForTabKind(kind: QuizFeedTabKind): QuizFeedOrderField {
  if (kind === 'popular') return 'playCount';
  if (kind === 'trending') return 'bookmarksCount';
  return 'createdAt';
}

function quizSortKeyValue(quiz: Quiz, field: QuizFeedOrderField): number {
  if (field === 'createdAt') {
    const d = quiz.createdAt;
    if (!d) return Date.now();
    if (d instanceof Date) return d.getTime();
    const ms = new Date(d as unknown as string).getTime();
    return isNaN(ms) ? Date.now() : ms;
  }
  if (field === 'playCount') return quiz.playCount ?? 0;
  return quiz.bookmarksCount ?? 0;
}

function paginateQuizRows(
  rows: Quiz[],
  pageSize: number,
  kind: QuizFeedTabKind
): PaginatedQuizResult {
  const hasMore = rows.length > pageSize;
  const items = hasMore ? rows.slice(0, pageSize) : rows;
  const orderField = orderFieldForTabKind(kind);
  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1];
    nextCursor = encodeQuizFeedCursor({
      v: 1,
      kind,
      quizId: last.id,
      sortKey: quizSortKeyValue(last, orderField),
    });
  }
  return { items, nextCursor };
}

/** PostgreSQL 向けのカーソルフィルタ適用 */
async function applyCursorFilter(
  queryBuilder: any,
  cursor: string,
  kind: QuizFeedTabKind
) {
  const decoded = decodeQuizFeedCursor(cursor, kind);
  const { data: cursorQuiz, error } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', decoded.quizId)
    .maybeSingle();

  if (error || !cursorQuiz) {
    throw new QuizFeedCursorError('Invalid cursor');
  }

  const orderField = orderFieldForTabKind(kind);
  const dbOrderField = orderField === 'playCount' ? 'play_count' : orderField === 'bookmarksCount' ? 'bookmarks_count' : 'created_at';
  const val = cursorQuiz[dbOrderField];

  return queryBuilder.or(`${dbOrderField}.lt."${val}",and(${dbOrderField}.eq."${val}",id.lt."${cursorQuiz.id}")`);
}

async function fetchPublishedTabPage(
  kind: QuizFeedTabKind,
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  const pageSize = options.limit ?? HOME_FEED_PAGE_SIZE;
  const orderField = orderFieldForTabKind(kind);
  const dbOrderField = orderField === 'playCount' ? 'play_count' : orderField === 'bookmarksCount' ? 'bookmarks_count' : 'created_at';

  let q = supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .eq('visibility', 'public');

  if (options.cursor) {
    q = await applyCursorFilter(q, options.cursor, kind);
  }

  const { data, error } = await q
    .order(dbOrderField, { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (error || !data) return { items: [], nextCursor: null };

  return paginateQuizRows(
    filterDiscoveryQuizzes(data.map(mapRowToQuiz)),
    pageSize,
    kind
  );
}

export async function getLatestQuizzesPage(
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  return fetchPublishedTabPage('latest', options);
}

export async function getPopularQuizzesPage(
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  return fetchPublishedTabPage('popular', options);
}

export async function getTrendingQuizzesPage(
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  return fetchPublishedTabPage('trending', options);
}

/**
 * 新着クイズを取得 (公開中のみ)。
 */
export async function getLatestQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const page = await getLatestQuizzesPage({ limit: limitCount });
  return page.items;
}

/**
 * 人気ランキングクイズを取得 (プレイ数順、公開中のみ)
 */
export async function getPopularQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const page = await getPopularQuizzesPage({ limit: limitCount });
  return page.items;
}

/**
 * トレンドクイズを取得 (ブックマーク数順、公開中のみ)。
 */
export async function getTrendingQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const page = await getTrendingQuizzesPage({ limit: limitCount });
  return page.items;
}

/**
 * 特定の作成者のクイズ一覧を取得
 */
export async function getQuizzesByAuthor(authorId: string, includeUnpublished: boolean = false): Promise<Quiz[]> {
  let q = supabase
    .from('quizzes')
    .select('*')
    .eq('author_id', authorId);

  if (!includeUnpublished) {
    q = q.eq('status', 'published');
  }

  const { data, error } = await q.order('created_at', { ascending: false });

  if (error || !data) return [];
  const rows = data.map(mapRowToQuiz);

  if (!includeUnpublished) {
    return filterDiscoveryQuizzes(rows);
  }
  return rows;
}

interface AuthorQuizPageOptions {
  limit?: number;
  cursor?: string | null;
  includeUnpublished?: boolean;
}

/**
 * 特定の作成者のクイズ一覧をカーソルベースで段階取得
 */
export async function getQuizzesByAuthorPage(
  authorId: string,
  options: AuthorQuizPageOptions = {}
): Promise<PaginatedQuizResult> {
  const pageSize = options.limit ?? HOME_FEED_PAGE_SIZE;
  const includeUnpublished = options.includeUnpublished ?? false;

  let q = supabase
    .from('quizzes')
    .select('*')
    .eq('author_id', authorId);

  if (!includeUnpublished) {
    q = q.eq('status', 'published').eq('visibility', 'public');
  }

  if (options.cursor) {
    q = await applyCursorFilter(q, options.cursor, 'author');
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (error || !data) return { items: [], nextCursor: null };

  const rows = data.map(mapRowToQuiz);
  const filteredRows = includeUnpublished ? rows : filterDiscoveryQuizzes(rows);

  return paginateQuizRows(filteredRows, pageSize, 'author');
}

/**
 * 特定ジャンルのクイズ一覧を取得
 */
export async function getQuizzesByGenre(
  genreName: string,
  limitCount: number = 10,
  sort: QuizListSort = 'latest'
): Promise<Quiz[]> {
  const canonicalId = await resolveCanonicalGenreId(genreName);
  const expandIds = await expandGenreIdsForQuery(genreName);

  const canonicalRows = await queryPublishedByCanonicalGenre(canonicalId, sort, limitCount);
  const merged = new Map(canonicalRows.map((q) => [q.id, q]));

  for (const chunk of chunkIdsForInQuery(expandIds)) {
    const legacyRows = await queryPublishedByGenreIn(chunk, limitCount);
    legacyRows.forEach((q) => merged.set(q.id, q));
  }

  return sortQuizzesForList(dedupeQuizzesById([...merged.values()]), sort).slice(0, limitCount);
}

/**
 * 特定タグのクイズ一覧を取得
 */
export async function getQuizzesByTag(
  tag: string,
  limitCount: number = 10,
  sort: QuizListSort = 'latest'
): Promise<Quiz[]> {
  const normalized = normalizeTag(tag);
  const canonicalTagId = await resolveCanonicalTagIds([normalized]).then((ids) => ids[0] ?? normalized);

  const canonicalRows = await queryPublishedByCanonicalTag(canonicalTagId, sort, limitCount);
  const merged = new Map(canonicalRows.map((q) => [q.id, q]));

  const legacyRows = await queryPublishedByLegacyTag(normalized, limitCount);
  legacyRows.forEach((q) => merged.set(q.id, q));

  if (normalized !== canonicalTagId) {
    const legacyCanonical = await queryPublishedByLegacyTag(canonicalTagId, limitCount);
    legacyCanonical.forEach((q) => merged.set(q.id, q));
  }

  return sortQuizzesForList(dedupeQuizzesById([...merged.values()]), sort).slice(0, limitCount);
}

/**
 * 複合検索パイプライン
 */
export async function materializeSearchQuizzes(
  queryText: string,
  filters: SearchFilters = {}
): Promise<Quiz[]> {
  const trimmedQuery = queryText.trim();
  const hasQuery = normalizeSearchText(trimmedQuery).length > 0;
  const tagSpecs = await buildTagMatchSpecs(filters.tags);
  const hasTags = tagSpecs.length > 0;
  let base: Quiz[];

  if (hasQuery) {
    const normalizedQuery = normalizeTag(queryText);

    // タグ検索、作成者検索、ジャンル検索、最新新着
    const { data: tagData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('status', 'published')
      .contains('tags', [normalizedQuery])
      .limit(SEARCH_POOL_SIZE);

    const { data: authorData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('status', 'published')
      .eq('author_name', queryText)
      .limit(SEARCH_POOL_SIZE);

    const genreQuizzes = await getQuizzesByGenre(queryText, SEARCH_POOL_SIZE).catch(() => []);
    const latestQuizzes = await getLatestQuizzes(SEARCH_POOL_SIZE);

    const tagQuizzes = tagData ? tagData.map(mapRowToQuiz) : [];
    const authorQuizzes = authorData ? authorData.map(mapRowToQuiz) : [];

    const rawMerged = [...tagQuizzes, ...authorQuizzes, ...genreQuizzes, ...latestQuizzes];
    base = dedupeQuizzesById(rawMerged);
  } else if (hasTags) {
    if (tagSpecs.length === 1) {
      base = await getQuizzesByTag(tagSpecs[0].normalizedInput, SEARCH_POOL_SIZE, 'latest');
    } else {
      const perTag = await Promise.all(
        tagSpecs.map((spec) => getQuizzesByTag(spec.normalizedInput, SEARCH_POOL_SIZE, 'latest'))
      );
      base = intersectQuizzesById(perTag);
    }
  } else if (filters.genreId) {
    base = await getQuizzesByGenre(filters.genreId, SEARCH_POOL_SIZE, 'latest');
  } else {
    base = await getLatestQuizzes(SEARCH_POOL_SIZE);
  }

  const matchedQuizzes = hasQuery
    ? base.filter(
        (quiz) =>
          searchTextIncludes(quiz.title || '', trimmedQuery) ||
          searchTextIncludes(quiz.description || '', trimmedQuery) ||
          searchTextIncludes(quiz.authorName || '', trimmedQuery) ||
          searchTextIncludes(quiz.genre || '', trimmedQuery) ||
          (quiz.tags || []).some((t) => searchTextIncludes(t, trimmedQuery))
      )
    : base;

  let finalQuizzes = matchedQuizzes;

  if (hasTags) {
    finalQuizzes = finalQuizzes.filter((quiz) => quizMatchesAllTags(quiz, tagSpecs));
  }

  if (filters.genreId) {
    const expandedGenreIds = new Set(await expandGenreIdsForQuery(filters.genreId));
    finalQuizzes = finalQuizzes.filter((quiz) => {
      if (expandedGenreIds.has(quiz.genre)) return true;
      if (quiz.canonicalGenreId && expandedGenreIds.has(quiz.canonicalGenreId)) return true;
      return false;
    });
  }

  if (filters.format) {
    finalQuizzes = applyFormatFilter(finalQuizzes, filters.format);
  }

  const filtered = finalQuizzes.filter((quiz) => {
    if (filters.difficultyMin != null && quiz.difficulty < filters.difficultyMin) return false;
    if (filters.difficultyMax != null && quiz.difficulty > filters.difficultyMax) return false;
    if (filters.minQuestions != null && quiz.questionCount < filters.minQuestions) return false;
    if (filters.maxQuestions != null && quiz.questionCount > filters.maxQuestions) return false;
    return true;
  });

  return sortQuizzesForList(dedupeQuizzesById(filterDiscoveryQuizzes(filtered)), 'latest');
}

/**
 * 複合条件で公開クイズを検索する
 */
export async function searchQuizzes(
  queryText: string,
  filters: SearchFilters = {},
  userId?: string
): Promise<Quiz[]> {
  if (userId) {
    writeSearchLog(userId, queryText, filters.tags, filters.genreId);
  }
  return materializeSearchQuizzes(queryText, filters);
}

/**
 * 複合検索の段階的取得
 */
export async function searchQuizzesPaginated(
  queryText: string,
  filters: SearchFilters = {},
  options: SearchQuizzesPaginatedOptions = {}
): Promise<PaginatedQuizResult> {
  const pageSize = options.limit ?? HOME_FEED_PAGE_SIZE;
  const fingerprint = buildSearchFingerprint(queryText, filters);

  if (options.userId) {
    writeSearchLog(options.userId, queryText, filters.tags, filters.genreId);
  }

  const materialized = (await materializeSearchQuizzes(queryText, filters)).slice(
    0,
    SEARCH_MATERIALIZE_CAP
  );

  let offset = 0;
  if (options.cursor) {
    offset = decodeSearchOffsetCursor(options.cursor, fingerprint);
  }

  if (offset >= materialized.length) {
    return { items: [], nextCursor: null };
  }

  const items = materialized.slice(offset, offset + pageSize);
  const nextOffset = offset + items.length;
  const nextCursor =
    nextOffset < materialized.length
      ? encodeSearchOffsetCursor(nextOffset, fingerprint)
      : null;

  return { items, nextCursor };
}

/**
 * フォロー中ユーザーのタイムラインフィードを段階的取得
 */
export async function getFollowedTimelinePage(
  followerId: string,
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  if (!followerId) {
    return { items: [], nextCursor: null };
  }

  const pageSize = options.limit ?? HOME_FEED_PAGE_SIZE;
  const kind: QuizFeedTabKind = 'timeline';

  const { data: followsData, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', followerId);

  if (followsError || !followsData || followsData.length === 0) {
    return { items: [], nextCursor: null };
  }

  const followingIds = followsData.map((d) => d.following_id);
  const targetIds = followingIds.slice(0, 30);

  let q = supabase
    .from('quizzes')
    .select('*')
    .eq('status', 'published')
    .in('author_id', targetIds);

  if (options.cursor) {
    q = await applyCursorFilter(q, options.cursor, kind);
  }

  const { data, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (error || !data) return { items: [], nextCursor: null };

  return paginateQuizRows(
    filterFollowTimelineQuizzes(data.map(mapRowToQuiz)),
    pageSize,
    kind
  );
}

/**
 * フォロー中ユーザーのタイムラインフィードを取得
 */
export async function getFollowedTimeline(followerId: string, limitCount: number = 20): Promise<Quiz[]> {
  const page = await getFollowedTimelinePage(followerId, { limit: limitCount });
  return page.items;
}
