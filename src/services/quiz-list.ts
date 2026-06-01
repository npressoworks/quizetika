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
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { quizListsRef, quizzesRef } from '../lib/firebase/firestore';
import { QuizList, Quiz } from '../types';
import { reorderQuizIds, buildListExportPackage, QuizListExportPackage } from './quiz-list-utils';

/**
 * 新しいリストを作成する
 */
export async function createQuizList(
  list: Omit<QuizList, 'id' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const newList: Omit<QuizList, 'id'> = {
    ...list,
    questionIds: list.questionIds || [], // 設問ID配列を初期化（デフォルトは空配列）
    bookmarksCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(quizListsRef, newList as any);
  return docRef.id;
}

/**
 * クイズリストをIDで1件取得
 */
export async function getQuizList(listId: string): Promise<QuizList | null> {
  const docRef = doc(quizListsRef, listId);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * クイズリストのメタ情報を更新する
 */
export async function updateQuizList(
  listId: string,
  data: Partial<Omit<QuizList, 'id' | 'authorId' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const docRef = doc(quizListsRef, listId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date(),
  });
}

/**
 * クイズリストを削除する
 */
export async function deleteQuizList(listId: string): Promise<void> {
  const docRef = doc(quizListsRef, listId);
  await deleteDoc(docRef);
}

/**
 * リストにクイズを追加する
 */
export async function addQuizToList(listId: string, quizId: string): Promise<void> {
  const docRef = doc(quizListsRef, listId);
  await updateDoc(docRef, {
    quizIds: arrayUnion(quizId),
    updatedAt: new Date(),
  });
}

/**
 * リストからクイズを除外する
 */
export async function removeQuizFromList(listId: string, quizId: string): Promise<void> {
  const docRef = doc(quizListsRef, listId);
  await updateDoc(docRef, {
    quizIds: arrayRemove(quizId),
    updatedAt: new Date(),
  });
}

/* ==========================================================================
   クイズリストの取得機能
   ========================================================================== */

/**
 * 新着の公開クイズリストを取得
 */
export async function getLatestQuizLists(limitCount: number = 10): Promise<QuizList[]> {
  const q = query(
    quizListsRef,
    where('isPublished', '==', true),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * 特定のユーザーが作成したクイズリスト一覧を取得
 */
export async function getQuizListsByAuthor(
  authorId: string,
  includeUnpublished: boolean = false
): Promise<QuizList[]> {
  let q;
  if (includeUnpublished) {
    q = query(
      quizListsRef,
      where('authorId', '==', authorId),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      quizListsRef,
      where('authorId', '==', authorId),
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * リストに含まれるすべてのクイズオブジェクトを取得する
 */
export async function getQuizzesInList(listId: string): Promise<Quiz[]> {
  const list = await getQuizList(listId);
  if (!list || !list.quizIds || list.quizIds.length === 0) return [];
  
  const quizIds = list.quizIds;
  const quizzes: Quiz[] = [];
  
  // IN クエリの制限 (最大30件) を考慮し、10件ずつのチャンクに分割して並行取得
  const chunkSize = 10;
  for (let i = 0; i < quizIds.length; i += chunkSize) {
    const chunk = quizIds.slice(i, i + chunkSize);
    const q = query(quizzesRef, where('id', 'in', chunk));
    const snap = await getDocs(q);
    snap.forEach((doc) => quizzes.push(doc.data()));
  }
  
  // 元の quizIds の順序に合わせて並び替える (Firestore の IN クエリは順序を保証しないため)
  const quizMap = new Map(quizzes.map((q) => [q.id, q]));
  return quizIds
    .map((id) => quizMap.get(id))
    .filter((q): q is Quiz => !!q);
}

/* ==========================================================================
   リストの並び替えおよびエクスポート
   ========================================================================== */

/**
 * クイズリスト内のクイズID順序を並び替える（ドラッグ&ドロップ対応）
 * @param listId 対象のリストID
 * @param newOrder 新しい順序のクイズID配列
 */
export async function reorderQuizList(listId: string, newOrder: string[]): Promise<void> {
  const list = await getQuizList(listId);
  if (!list) throw new Error(`リストが見つかりません: listId=${listId}`);

  const reordered = reorderQuizIds(list.quizIds, newOrder);
  const docRef = doc(quizListsRef, listId);
  await updateDoc(docRef, {
    quizIds: reordered,
    updatedAt: new Date(),
  });
}

/**
 * クイズリストをエクスポートする
 * - 作成者自身のクイズ: フルデータを含む
 * - 他者のクイズ: IDのみを参照
 *
 * @param listId リストID
 * @param authorId リスト作成者のユーザーID
 * @returns QuizListExportPackage
 */
export async function exportQuizList(
  listId: string,
  authorId: string
): Promise<QuizListExportPackage> {
  const list = await getQuizList(listId);
  if (!list) throw new Error(`リストが見つかりません: listId=${listId}`);

  const allQuizzes = await getQuizzesInList(listId);
  const ownedQuizzes = allQuizzes.filter((q) => q.authorId === authorId);
  const externalQuizIds = allQuizzes
    .filter((q) => q.authorId !== authorId)
    .map((q) => q.id);

  return buildListExportPackage(list, ownedQuizzes, externalQuizIds);
}
