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
  getDocs,
  increment,
  writeBatch,
  collection as firestoreCollection,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { quizzesRef, followsRef, bookmarksRef, questionsRef } from '../lib/firebase/firestore';
import { Quiz, Question } from '../types';
import { validateQuizForPublish, validateQuizForDraft, normalizeTag } from './quiz-validation';
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

export type { QuizListSort } from '../lib/metadata-resolution';

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
    where('canonicalGenreId', '==', canonicalGenreId),
    orderBy(orderField, 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

async function queryPublishedByGenreIn(genreIds: string[], limitCount: number): Promise<Quiz[]> {
  if (genreIds.length === 0) return [];
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('genre', 'in', genreIds),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
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
    where('canonicalTagIds', 'array-contains', tagId),
    orderBy(orderField, 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

async function queryPublishedByLegacyTag(tag: string, limitCount: number): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('tags', 'array-contains', tag),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
}

/**
 * 新規クイズを作成・投稿する
 * アトミックなバッチ処理により、各設問（questions）を個別の questions/{questionId} ドキュメントとして書き出します。
 * 親クイズ（quizzes）には、questionIds 配列および非正規化された設問配列を同期保存します。
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

  // 2. 設問の個別保存と ID の収集
  const questionIds: string[] = [];
  const processedQuestions: Question[] = [];

  const inputQuestions = quiz.questions || [];
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
 * 設問（questions）が更新データに含まれる場合、古い設問との差分を検出し、
 * 削除された設問を questions コレクションからアトミックに削除、
 * 新規設問の登録、および既存設問の更新を同期処理します。
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

  // もし questions が更新データに含まれている場合、設問の同期・差分削除を行う
  if (data.questions) {
    const oldQuestionIds = currentQuiz.questionIds || [];
    const newQuestionIds: string[] = [];
    const processedQuestions: Question[] = [];

    const candidateIds = data.questions
      .map((q) => q.id)
      .filter((id): id is string => !!id);
    const storedById = await loadQuestionsByIds([
      ...new Set([...oldQuestionIds, ...candidateIds]),
    ]);

    for (const q of data.questions) {
      if (isReferenceLinkQuestion(q) && q.id && !storedById.has(q.id)) {
        const snap = await getDoc(doc(questionsRef, q.id));
        if (snap.exists()) {
          storedById.set(q.id, snap.data() as Question);
        }
      }
    }

    const partition = partitionQuestionsForSave(
      data.questions,
      oldQuestionIds,
      storedById
    );

    for (const refId of partition.referenceOnlyIds) {
      const stored = storedById.get(refId);
      if (!stored) {
        throw new Error(`参照設問が見つかりません: ${refId}`);
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

  const inputQuestions = quizData.questions || [];
  const refCandidateIds = inputQuestions
    .filter((q) => isReferenceLinkQuestion(q) && q.id)
    .map((q) => q.id as string);
  const storedById = await loadQuestionsByIds(refCandidateIds);
  const partition = partitionQuestionsForSave(inputQuestions, [], storedById);

  for (const refId of partition.referenceOnlyIds) {
    const stored = storedById.get(refId);
    if (!stored) {
      throw new Error(`参照設問が見つかりません: ${refId}`);
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

/**
 * 新着クイズを取得 (公開中のみ)
 */
export async function getLatestQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * 人気ランキングクイズを取得 (プレイ数順、公開中のみ)
 */
export async function getPopularQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    orderBy('playCount', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * トレンドクイズを取得 (ブックマーク数順、公開中のみ)
 */
export async function getTrendingQuizzes(limitCount: number = 10): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('status', '==', 'published'),
    orderBy('bookmarksCount', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * 特定の作成者のクイズ一覧を取得
 * @param authorId 作成者のユーザーID
 * @param includeUnpublished 下書きも含めるか (本人のダッシュボード用)
 */
export async function getQuizzesByAuthor(authorId: string, includeUnpublished: boolean = false): Promise<Quiz[]> {
  let q;
  if (includeUnpublished) {
    q = query(
      quizzesRef,
      where('authorId', '==', authorId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      quizzesRef,
      where('authorId', '==', authorId),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
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
 * 複合条件で公開クイズを検索する
 */
export async function searchQuizzes(
  queryText: string,
  filters: SearchFilters = {}
): Promise<Quiz[]> {
  const trimmedQuery = queryText.trim();
  const hasQuery = normalizeSearchText(trimmedQuery).length > 0;
  const tagSpecs = await buildTagMatchSpecs(filters.tags);
  const hasTags = tagSpecs.length > 0;
  let base: Quiz[];

  if (hasQuery) {
    // 1. 各種条件に応じた Firestore クエリの並行実行
    const normalizedQuery = normalizeTag(queryText);

    const tagQuery = query(
      quizzesRef,
      where('status', '==', 'published'),
      where('tags', 'array-contains', normalizedQuery)
    );

    const authorQuery = query(
      quizzesRef,
      where('status', '==', 'published'),
      where('authorName', '==', queryText)
    );

    const [tagSnap, authorSnap, genreQuizzes, latestQuizzes] = await Promise.all([
      getDocs(tagQuery),
      getDocs(authorQuery),
      getQuizzesByGenre(queryText, 100).catch(() => []), // ジャンル名が存在しない場合に例外がスローされる可能性があるため catch する
      getLatestQuizzes(100),
    ]);

    const tagQuizzes = tagSnap.docs.map((d) => d.data());
    const authorQuizzes = authorSnap.docs.map((d) => d.data());

    // 2. クライアントサイドでのマージ・重複排除
    const rawMerged = [...tagQuizzes, ...authorQuizzes, ...genreQuizzes, ...latestQuizzes];
    base = dedupeQuizzesById(rawMerged);
  } else if (hasTags) {
    if (tagSpecs.length === 1) {
      base = await getQuizzesByTag(tagSpecs[0].normalizedInput, 100, 'latest');
    } else {
      const perTag = await Promise.all(
        tagSpecs.map((spec) => getQuizzesByTag(spec.normalizedInput, 100, 'latest'))
      );
      base = intersectQuizzesById(perTag);
    }
  } else {
    // queryText が空の場合は従来の単一ソース読み込み
    if (filters.genreId) {
      base = await getQuizzesByGenre(filters.genreId, 100, 'latest');
    } else {
      base = await getLatestQuizzes(100);
    }
  }

  // 3. アプリ（サービス）層での大文字小文字を区別しない部分一致フィルタおよび詳細条件フィルターの適用
  const matchedQuizzes = hasQuery
    ? base.filter((quiz) =>
        searchTextIncludes(quiz.title || '', trimmedQuery) ||
        searchTextIncludes(quiz.description || '', trimmedQuery) ||
        searchTextIncludes(quiz.authorName || '', trimmedQuery) ||
        searchTextIncludes(quiz.genre || '', trimmedQuery) ||
        (quiz.tags || []).some((t) => searchTextIncludes(t, trimmedQuery))
      )
    : base;

  // 詳細フィルターとジャンルフィルターの適用
  // filters.genreId が指定されている場合、マージされたジャンルも含むため expandGenreIdsForQuery を用いて判定する
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

  return finalQuizzes.filter((quiz) => {
    if (filters.difficultyMin != null && quiz.difficulty < filters.difficultyMin) return false;
    if (filters.difficultyMax != null && quiz.difficulty > filters.difficultyMax) return false;
    if (filters.minQuestions != null && quiz.questionCount < filters.minQuestions) return false;
    if (filters.maxQuestions != null && quiz.questionCount > filters.maxQuestions) return false;
    return true;
  });
}

/**
 * フォロー中ユーザーのタイムラインフィードを取得
 */
export async function getFollowedTimeline(followerId: string, limitCount: number = 20): Promise<Quiz[]> {
  // 1. フォローしているユーザーのID一覧を取得
  const followQuery = query(followsRef, where('followerId', '==', followerId));
  const followSnap = await getDocs(followQuery);
  const followingIds = followSnap.docs.map((doc) => doc.data().followingId);
  
  if (followingIds.length === 0) return [];
  
  // 2. フォロー中ユーザーの投稿クイズを取得 (公開中のみ)
  // IN クエリの制限 (最大30件) を考慮し、最新の30フォローユーザーに制限するか、バッチに分ける
  // ここでは簡単のために最大30人のフォロー中ユーザーの新着を対象にします
  const targetIds = followingIds.slice(0, 30);
  const timelineQuery = query(
    quizzesRef,
    where('status', '==', 'published'),
    where('authorId', 'in', targetIds),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snap = await getDocs(timelineQuery);
  return snap.docs.map((doc) => doc.data());
}
