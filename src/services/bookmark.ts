import {
  doc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { bookmarksRef, quizzesRef, quizListsRef, questionsRef } from '../lib/firebase/firestore';
import { Bookmark, Quiz, QuizList, Question } from '../types';

// テスト環境かどうかを判定するためのフラグ
// E2Eテスト実行時（NEXT_PUBLIC_ENVがtest）にのみtrueとなります
const isTestEnv = process.env.NEXT_PUBLIC_ENV === 'test';

// E2Eテスト時のお気に入りモックデータを保存するローカルストレージのキー
const MOCK_BOOKMARKS_KEY = 'quizeum_mock_bookmarks';


/**
 * ブックマークのユニークなドキュメントIDを生成
 */
function getBookmarkDocId(userId: string, targetId: string): string {
  return `${userId}_${targetId}`;
}

/**
 * ブックマーク状態を判定する
 */
export async function isBookmarked(userId: string, targetId: string): Promise<boolean> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    return list.some((b: any) => b.userId === userId && b.targetId === targetId);
  }
  const docId = getBookmarkDocId(userId, targetId);
  const docRef = doc(bookmarksRef, docId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

/**
 * ブックマークをトグルする (登録/解除)
 * トランザクションを使用して、bookmarks コレクションの追加/削除と、対象ドキュメントの bookmarksCount の更新をアトミックに実行します。
 * @returns 変更後の状態 (true: 登録完了, false: 解除完了)
 */
export async function toggleBookmark(
  userId: string,
  targetId: string,
  targetType: 'quiz' | 'list' | 'question'
): Promise<boolean> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    const idx = list.findIndex((b: any) => b.userId === userId && b.targetId === targetId);
    let added = false;
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push({
        id: `${userId}_${targetId}`,
        userId,
        targetId,
        targetType,
        createdAt: new Date().toISOString()
      } as any);
      added = true;
    }
    localStorage.setItem(MOCK_BOOKMARKS_KEY, JSON.stringify(list));
    return added;
  }
  const bookmarkDocId = getBookmarkDocId(userId, targetId);
  const bookmarkDocRef = doc(bookmarksRef, bookmarkDocId);

  // 対象オブジェクトのドキュメント参照を取得
  let targetDocRef: any;
  if (targetType === 'quiz') {
    targetDocRef = doc(quizzesRef, targetId);
  } else if (targetType === 'list') {
    targetDocRef = doc(quizListsRef, targetId);
  } else {
    targetDocRef = doc(questionsRef, targetId);
  }

  return await runTransaction(db, async (transaction) => {
    const bookmarkSnap = await transaction.get(bookmarkDocRef);
    const targetSnap = await transaction.get(targetDocRef);

    if (!targetSnap.exists()) {
      throw new Error('Target document does not exist.');
    }

    const currentCount = (targetSnap.data() as any)?.bookmarksCount || 0;
    const isAlreadyBookmarked = bookmarkSnap.exists();

    if (isAlreadyBookmarked) {
      // 1. 既にブックマークされている場合は、ブックマークを削除
      transaction.delete(bookmarkDocRef);

      // 2. カウンタをデクリメント (0未満にならないようにガード)
      const newCount = Math.max(0, currentCount - 1);
      transaction.update(targetDocRef, { bookmarksCount: newCount });

      return false; // 解除完了
    } else {
      // 1. 新規にブックマークを登録
      const newBookmark: Bookmark = {
        id: bookmarkDocId,
        userId,
        targetId,
        targetType,
        createdAt: new Date(),
      };
      transaction.set(bookmarkDocRef, newBookmark as any);

      // 2. カウンタをインクリメント
      const newCount = currentCount + 1;
      transaction.update(targetDocRef, { bookmarksCount: newCount });

      return true; // 登録完了
    }
  });
}

/**
 * ユーザーがブックマークしたすべてのクイズ（Quizオブジェクト）を取得
 */
export async function getBookmarkedQuizzes(userId: string): Promise<Quiz[]> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    const targetIds = list.filter((b: any) => b.userId === userId && b.targetType === 'quiz').map((b: any) => b.targetId);
    return targetIds.map((id: string) => ({
      id,
      title: `[MOCK BOOKMARK] クイズ ${id}`,
      description: 'E2Eテストモッククイズ',
      genre: 'programming',
      tags: ['E2E'],
      questionCount: 5,
      difficulty: 3,
      playCount: 0,
      bookmarksCount: 1,
      authorId: 'e2e-test-uid-123456',
      authorName: 'テストユーザー',
      isPublished: true,
      status: 'published',
      questions: [],
      questionIds: []
    } as any));
  }
  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'quiz')
  );

  const snap = await getDocs(q);

  // メモリ上で createdAt (降順) でソートする
  const bookmarkDocs = snap.docs.map((doc) => doc.data());
  bookmarkDocs.sort((a, b) => {
    const getTime = (val: unknown): number => {
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
        return isNaN(date.getTime()) ? 0 : date.getTime();
      }
      return 0;
    };
    return getTime(b.createdAt) - getTime(a.createdAt);
  });

  const quizIds = bookmarkDocs.map((doc) => doc.targetId);

  if (quizIds.length === 0) return [];

  const quizzes: Quiz[] = [];
  const chunkSize = 10;
  for (let i = 0; i < quizIds.length; i += chunkSize) {
    const chunk = quizIds.slice(i, i + chunkSize);
    // 公開中のクイズのみに絞り込む (非公開クイズは除外)
    const quizQuery = query(
      quizzesRef,
      where('id', 'in', chunk),
      where('isPublished', '==', true)
    );
    const quizSnap = await getDocs(quizQuery);
    quizSnap.forEach((doc) => quizzes.push(doc.data()));
  }

  // 最新のブックマーク順を維持するためにソート
  const idToIndex = new Map(quizIds.map((id, index) => [id, index]));
  return quizzes.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}

/**
 * ユーザーがブックマークしたすべてのクイズリスト（QuizListオブジェクト）を取得
 */
export async function getBookmarkedLists(userId: string): Promise<QuizList[]> {
  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'list')
  );

  const snap = await getDocs(q);

  // メモリ上で createdAt (降順) でソートする
  const bookmarkDocs = snap.docs.map((doc) => doc.data());
  bookmarkDocs.sort((a, b) => {
    const getTime = (val: unknown): number => {
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
        return isNaN(date.getTime()) ? 0 : date.getTime();
      }
      return 0;
    };
    return getTime(b.createdAt) - getTime(a.createdAt);
  });

  const listIds = bookmarkDocs.map((doc) => doc.targetId);

  if (listIds.length === 0) return [];

  const lists: QuizList[] = [];
  const chunkSize = 10;
  for (let i = 0; i < listIds.length; i += chunkSize) {
    const chunk = listIds.slice(i, i + chunkSize);
    const listQuery = query(
      quizListsRef,
      where('id', 'in', chunk),
      where('isPublished', '==', true)
    );
    const listSnap = await getDocs(listQuery);
    listSnap.forEach((doc) => lists.push(doc.data()));
  }

  const idToIndex = new Map(listIds.map((id, index) => [id, index]));
  return lists.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}
