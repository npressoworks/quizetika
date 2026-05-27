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
} from 'firebase/firestore';
import { quizzesRef, followsRef } from '../lib/firebase/firestore';
import { Quiz } from '../types';

/**
 * 新規クイズを作成・投稿する
 */
export async function createQuiz(quiz: Omit<Quiz, 'id' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = new Date();
  const newQuiz: Omit<Quiz, 'id'> = {
    ...quiz,
    playCount: 0,
    bookmarksCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  
  // addDoc を使うことで Firestore が自動的にドキュメントIDを割り振る
  const docRef = await addDoc(quizzesRef, newQuiz as any);
  return docRef.id;
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
 */
export async function updateQuiz(quizId: string, data: Partial<Omit<Quiz, 'id' | 'authorId' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const docRef = doc(quizzesRef, quizId);
  await updateDoc(docRef, {
    ...data,
    updatedAt: new Date(),
  });
}

/**
 * クイズを削除する
 */
export async function deleteQuiz(quizId: string): Promise<void> {
  const docRef = doc(quizzesRef, quizId);
  await deleteDoc(docRef);
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
    where('isPublished', '==', true),
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
    where('isPublished', '==', true),
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
    where('isPublished', '==', true),
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
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc')
    );
  }
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * 特定ジャンルのクイズ一覧を取得
 */
export async function getQuizzesByGenre(genreName: string, limitCount: number = 10): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('isPublished', '==', true),
    where('genre', '==', genreName),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
}

/**
 * 特定タグのクイズ一覧を取得
 * Firestore の array-contains クエリを使用してタグ配列を検索
 */
export async function getQuizzesByTag(tag: string, limitCount: number = 10): Promise<Quiz[]> {
  const q = query(
    quizzesRef,
    where('isPublished', '==', true),
    where('tags', 'array-contains', tag),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => doc.data());
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
    where('isPublished', '==', true),
    where('authorId', 'in', targetIds),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  
  const snap = await getDocs(timelineQuery);
  return snap.docs.map((doc) => doc.data());
}
