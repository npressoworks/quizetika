import {
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  increment,
  writeBatch,
  collection as firestoreCollection,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef, followsRef, bookmarksRef, questionsRef, usersRef } from '../lib/firebase/firestore';
import { Quiz, Question, PaginatedQuizResult } from '../types';
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

export type { QuizListSort } from '../lib/metadata-resolution';
export { QuizFeedCursorError } from '../lib/quiz-feed-cursor';

async function enforceVisibilityEntitlement(
  authorId: string,
  nextVisibility: ReturnType<typeof resolveQuizVisibility>,
  prevVisibility?: ReturnType<typeof resolveQuizVisibility>
): Promise<void> {
  const userSnap = await getDoc(doc(usersRef, authorId));
  const fields: EntitlementUserFields = userSnap.exists()
    ? (userSnap.data() as EntitlementUserFields)
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
  const genresRef = firestoreCollection(db, 'metadata_genres');
  const q = query(genresRef, where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as GenreMetadata;
    return { ...data, id: d.id };
  });
}

/** 存続タグ（canonicalId 未設定）のみ。UI サジェスト用 */
export async function listActiveTags(): Promise<TagMetadata[]> {
  const tagsRef = firestoreCollection(db, 'metadata_tags');
  const q = query(tagsRef, where('canonicalId', '==', null));
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => {
    const data = d.data() as TagMetadata;
    return { ...data, id: d.id };
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
    sort === 'popular' ? 'playCount' : sort === 'trending' ? 'bookmarksCount' : 'createdAt';
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    where('canonicalGenreId', '==', canonicalGenreId),
    orderBy(orderField, 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return filterDiscoveryQuizzes(snap.docs.map((d) => d.data()));
}

async function queryPublishedByGenreIn(genreIds: string[], limitCount: number): Promise<Quiz[]> {
  if (genreIds.length === 0) return [];
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    where('genre', 'in', genreIds),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return filterDiscoveryQuizzes(snap.docs.map((d) => d.data()));
}

async function queryPublishedByCanonicalTag(
  tagId: string,
  sort: QuizListSort,
  limitCount: number
): Promise<Quiz[]> {
  const orderField =
    sort === 'popular' ? 'playCount' : sort === 'trending' ? 'bookmarksCount' : 'createdAt';
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    where('canonicalTagIds', 'array-contains', tagId),
    orderBy(orderField, 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return filterDiscoveryQuizzes(snap.docs.map((d) => d.data()));
}

async function queryPublishedByLegacyTag(tag: string, limitCount: number): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    where('tags', 'array-contains', tag),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return filterDiscoveryQuizzes(snap.docs.map((d) => d.data()));
}

/**
 * 新規クイズを作成・投稿する
 * アトミックなバッチ処理により、各問題（questions）を個別の questions/{questionId} ドキュメントとして書き出します。
 * 親クイズ（quizzes）には、questionIds 配列および非正規化された問題配列を同期保存します。
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

  // 1. 新しいクイズドキュメントIDを事前に取得
  const quizDocRef = doc(quizzesRef);
  const quizId = quizDocRef.id;

  const batch = writeBatch(db);

  // 2. 問題の個別保存と ID の収集
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

  for (const q of inputQuestions) {
    const qDocRef = doc(questionsRef);
    const qId = qDocRef.id;

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

    // questions コレクションに保存
    batch.set(qDocRef, fullQuestion);

    questionIds.push(qId);
    processedQuestions.push(fullQuestion);
  }

  // 3. クイズドキュメントの作成
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

  batch.set(quizDocRef, newQuiz);

  // 4. バッチコミット
  await batch.commit();

  return quizId;
}

/**
 * クイズをIDで1件取得
 */
export async function getQuiz(quizId: string): Promise<Quiz | null> {
  const docRef = doc(quizzesRef, quizId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * クイズ情報を更新する
 * 問題（questions）が更新データに含まれる場合、古い問題との差分を検出し、
 * 削除された問題を questions コレクションからアトミックに削除、
 * 新規問題の登録、および既存問題の更新を同期処理します。
 */
export async function updateQuiz(
  quizId: string,
  data: Partial<Omit<Quiz, 'id' | 'authorId' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const quizDocRef = doc(quizzesRef, quizId);
  const currentQuiz = await getQuiz(quizId);

  if (!currentQuiz) {
    throw new Error('クイズが見つかりません');
  }

  const batch = writeBatch(db);
  const now = new Date();

  // 更新ペイロードの作成
  const updatePayload: any = {
    ...data,
    updatedAt: now,
  };

  // もし questions が更新データに含まれている場合、問題の同期・差分削除を行う
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
        const snap = await getDoc(doc(questionsRef, q.id));
        if (snap.exists()) {
          storedById.set(q.id, snap.data() as Question);
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

    for (const q of partition.ownedToWrite) {
      let qId = q.id;
      const isExistingOwned =
        !!qId && oldQuestionIds.includes(qId) && !isReferenceLinkQuestion(q);

      let qDocRef;
      if (isExistingOwned && qId) {
        qDocRef = doc(questionsRef, qId);
      } else {
        qDocRef = doc(questionsRef);
        qId = qDocRef.id;
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

      batch.set(qDocRef, fullQuestion);
      newQuestionIds.push(qId);
      processedQuestions.push(fullQuestion);
    }

    const deletedQuestionIds = oldQuestionIds.filter((id) => !newQuestionIds.includes(id));
    for (const dId of deletedQuestionIds) {
      const deletable = await canDeleteQuestionDoc(
        dId,
        quizId,
        findQuizIdsContainingQuestion
      );
      if (deletable) {
        batch.delete(doc(questionsRef, dId));
      }
    }

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

  batch.update(quizDocRef, updatePayload);
  await batch.commit();
}

/**
 * クイズを削除する
 * 関連するブックマークを非同期でクリーンアップする
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  const docRef = doc(quizzesRef, quizId);
  // Firestore の writeBatch で関連ブックマークをまとめて削除 (最大500件)
  const bmQuery = query(bookmarksRef, where('targetId', '==', quizId));
  const bmSnap = await getDocs(bmQuery);
  const batch = writeBatch(db);
  bmSnap.docs.forEach((bmDoc) => batch.delete(bmDoc.ref));
  batch.delete(docRef);
  await batch.commit();
}

/* ==========================================================================
   クイズ保存・公開 (バリデーション付き)
   ========================================================================== */

/**
 * クイズの保存エクスポート型
 */
export interface QuizExportPackage {
  exportedAt: string;
  quizzes: Quiz[];
}

async function loadQuestionsByIds(ids: string[]): Promise<Map<string, Question>> {
  const map = new Map<string, Question>();
  if (ids.length === 0) return map;
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const snap = await getDocs(query(questionsRef, where('id', 'in', chunk)));
    snap.forEach((d) => {
      const q = d.data() as Question;
      map.set(q.id, q);
    });
  }
  return map;
}

async function findQuizIdsContainingQuestion(questionId: string): Promise<string[]> {
  const snap = await getDocs(
    query(quizzesRef, where('questionIds', 'array-contains', questionId))
  );
  return snap.docs.map((d) => d.id);
}

function stripEditorOnlyFields(question: Question): Question {
  const { linkKind: _linkKind, ...rest } = question;
  return rest as Question;
}

/**
 * クイズを下書き保存、または公開する統合関数。
 * - status = 'draft': タイトル・ジャンル・問題文必須 + メタデータ解決
 * - status = 'published': validateQuizForPublish による完全バリデーションを実行
 *
 * @param quizData クイズデータ（id/playCount/bookmarksCount/createdAt/updatedAt を除く）
 * @param status 'draft' | 'published'
 * @returns 作成または更新されたクイズのID
 * @throws 公開時バリデーションエラー、またはNGワード検出時
 */
export async function saveQuiz(
  quizData: Omit<Quiz, 'id' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>,
  status: 'draft' | 'published'
): Promise<string> {
  const now = new Date();

  // タグを正規化（常に適用）
  const normalizedTags = quizData.tags.map(normalizeTag).filter(Boolean);

  const quizDocRef = doc(quizzesRef);
  const quizId = quizDocRef.id;

  const batch = writeBatch(db);

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

  for (const q of partition.ownedToWrite) {
    const qDocRef = doc(questionsRef);
    const qId = qDocRef.id;
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
    batch.set(qDocRef, fullQuestion);
    questionIds.push(qId);
    processedQuestions.push(fullQuestion);
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
      throw new Error(
        `クイズの公開バリデーションに失敗しました: ${errors.map((e) => e.message).join('; ')}`
      );
    }
  } else {
    const draftErrors = validateQuizForDraft(payload);
    if (draftErrors.length > 0) {
      throw new Error(
        `下書き保存に失敗しました: ${draftErrors.map((e) => e.message).join('; ')}`
      );
    }
  }

  batch.set(quizDocRef, payload);
  await batch.commit();

  return quizId;
}

/**
 * 作成者の全クイズ（下書き含む）をエクスポート用パッケージとして返す
 * @param uid 作成者のユーザーID
 * @returns QuizExportPackage（JSONダウンロード用）
 */
export async function exportQuizzes(uid: string): Promise<QuizExportPackage> {
  const q = query(quizzesRef, where('authorId', '==', uid), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const quizzes = snap.docs.map((d) => d.data());
  return {
    exportedAt: new Date().toISOString(),
    quizzes,
  };
}

/**
 * クイズの挑戦回数（プレイ回数）をインクリメント
 */
export async function incrementPlayCount(quizId: string): Promise<void> {
  const docRef = doc(quizzesRef, quizId);
  await updateDoc(docRef, {
    playCount: increment(1),
  });
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
    if (typeof d === 'object' && d !== null && 'seconds' in d) {
      return (d as { seconds: number }).seconds * 1000;
    }
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

async function fetchPublishedTabPage(
  kind: QuizFeedTabKind,
  options: QuizFeedPageOptions = {}
): Promise<PaginatedQuizResult> {
  const pageSize = options.limit ?? HOME_FEED_PAGE_SIZE;
  const orderField = orderFieldForTabKind(kind);
  const baseConstraints = [
    where('status', '==', 'published'),
    where('visibility', '==', 'public'),
    orderBy(orderField, 'desc'),
  ] as const;

  let q;
  if (options.cursor) {
    const decoded = decodeQuizFeedCursor(options.cursor, kind);
    const cursorSnap = await getDoc(doc(quizzesRef, decoded.quizId));
    if (!cursorSnap.exists()) {
      throw new QuizFeedCursorError('Invalid cursor');
    }
    q = query(quizzesRef, ...baseConstraints, startAfter(cursorSnap), limit(pageSize + 1));
  } else {
    q = query(quizzesRef, ...baseConstraints, limit(pageSize + 1));
  }

  const snap = await getDocs(q);
  return paginateQuizRows(
    filterDiscoveryQuizzes(snap.docs.map((d) => d.data())),
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
 * ディスカバリーホーム新着カルーセルは `DISCOVERY_CAROUSEL_SIZE` 件で呼び出し、
 * 検索画面 `tab=latest` の先頭ページ（`getLatestQuizzesPage`）と同一ソート規則。
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
 * ディスカバリーホームおすすめカルーセルは `DISCOVERY_CAROUSEL_SIZE` 件で呼び出し、
 * 検索画面 `tab=trending` の先頭ページ（`getTrendingQuizzesPage`）と同一ソート規則。
 */
export async function getTrendingQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const page = await getTrendingQuizzesPage({ limit: limitCount });
  return page.items;
}

/**
 * 特定の作成者のクイズ一覧を取得
 * @param authorId 作成者のユーザーID
 * @param includeUnpublished 下書きも含めるか (本人のダッシュボード用)
 */
const getTimestampTime = (val: any): number => {
  if (!val) return 0;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      return val.toDate().getTime();
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
};

export async function getQuizzesByAuthor(authorId: string, includeUnpublished: boolean = false): Promise<Quiz[]> {
  let q;
  if (includeUnpublished) {
    q = query(
      quizzesRef,
      where('authorId', '==', authorId)
    );
  } else {
    q = query(
      quizzesRef,
      where('authorId', '==', authorId),
      where('status', '==', 'published')
    );
  }
  const snap = await getDocs(q);
  const rows = snap.docs.map((doc) => doc.data());

  rows.sort((a, b) => getTimestampTime(b.createdAt) - getTimestampTime(a.createdAt));

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

  const baseConstraints = includeUnpublished
    ? [
        where('authorId', '==', authorId),
        orderBy('createdAt', 'desc'),
      ]
    : [
        where('authorId', '==', authorId),
        where('status', '==', 'published'),
        where('visibility', '==', 'public'),
        orderBy('createdAt', 'desc'),
      ];

  let q;
  if (options.cursor) {
    const decoded = decodeQuizFeedCursor(options.cursor, 'author');
    const cursorSnap = await getDoc(doc(quizzesRef, decoded.quizId));
    if (!cursorSnap.exists()) {
      throw new QuizFeedCursorError('Invalid cursor');
    }
    q = query(quizzesRef, ...baseConstraints, startAfter(cursorSnap), limit(pageSize + 1));
  } else {
    q = query(quizzesRef, ...baseConstraints, limit(pageSize + 1));
  }

  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => d.data());
  const filteredRows = includeUnpublished ? rows : filterDiscoveryQuizzes(rows);

  return paginateQuizRows(filteredRows, pageSize, 'author');
}


/**
 * 特定ジャンルのクイズ一覧を取得（C2: canonical 優先 + genre in フォールバック）
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
 * 特定タグのクイズ一覧を取得（canonicalTagIds 優先 + tags フォールバック）
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
 * 複合検索パイプライン: マージ・フィルタ・AND 合成（ページング／非ページング共有）
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

    const tagQuery = query(
      quizzesRef,
      where('status', '==', 'published'),
      where('tags', 'array-contains', normalizedQuery),
      limit(SEARCH_POOL_SIZE)
    );

    const authorQuery = query(
      quizzesRef,
      where('status', '==', 'published'),
      where('authorName', '==', queryText),
      limit(SEARCH_POOL_SIZE)
    );

    const [tagSnap, authorSnap, genreQuizzes, latestQuizzes] = await Promise.all([
      getDocs(tagQuery),
      getDocs(authorQuery),
      getQuizzesByGenre(queryText, SEARCH_POOL_SIZE).catch(() => []),
      getLatestQuizzes(SEARCH_POOL_SIZE),
    ]);

    const tagQuizzes = tagSnap.docs.map((d) => d.data());
    const authorQuizzes = authorSnap.docs.map((d) => d.data());

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

  const followQuery = query(followsRef, where('followerId', '==', followerId));
  const followSnap = await getDocs(followQuery);
  const followingIds = followSnap.docs.map((d) => d.data().followingId);

  if (followingIds.length === 0) {
    return { items: [], nextCursor: null };
  }

  const targetIds = followingIds.slice(0, 30);
  const baseConstraints = [
    where('status', '==', 'published'),
    where('authorId', 'in', targetIds),
    orderBy('createdAt', 'desc'),
  ] as const;

  let q;
  if (options.cursor) {
    const decoded = decodeQuizFeedCursor(options.cursor, kind);
    const cursorSnap = await getDoc(doc(quizzesRef, decoded.quizId));
    if (!cursorSnap.exists()) {
      throw new QuizFeedCursorError('Invalid cursor');
    }
    q = query(quizzesRef, ...baseConstraints, startAfter(cursorSnap), limit(pageSize + 1));
  } else {
    q = query(quizzesRef, ...baseConstraints, limit(pageSize + 1));
  }

  const snap = await getDocs(q);
  return paginateQuizRows(
    filterFollowTimelineQuizzes(snap.docs.map((d) => d.data())),
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
