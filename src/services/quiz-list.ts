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

/**
 * 新しいクイズリスト（問題集）を作成する
 */
export async function createQuizList(
  list: Omit<QuizList, 'id' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = new Date();
  const newList: Omit<QuizList, 'id'> = {
    ...list,
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
