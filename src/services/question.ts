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
import { questionsRef, bookmarksRef, quizzesRef } from '../lib/firebase/firestore';
import { Question, Bookmark, Quiz } from '../types';
import { toggleBookmark } from './bookmark';

/**
  * 指定されたIDの問題を1件取得する
  */
export async function getQuestion(id: string): Promise<Question | null> {
  const docRef = doc(questionsRef, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
  * 指定されたクイズIDに紐づくすべての問題を取得する
  * （順序はクイズの `questionIds` に準拠し、最新の統計情報を含む独立コレクションから取得）
  */
export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  const quizDocRef = doc(quizzesRef, quizId);
  const quizSnap = await getDoc(quizDocRef);
  if (!quizSnap.exists()) return [];

  const quizData = quizSnap.data();
  const questionIds = quizData.questionIds || [];

  if (questionIds.length === 0) {
    // 移行期や古いクイズなどで questionIds が空だが questions 非正規化コピーがある場合はそこから解決
    return quizData.questions || [];
  }

  const questions: Question[] = [];
  const chunkSize = 30; // Firestore `in` クエリの上限サイズ

  for (let i = 0; i < questionIds.length; i += chunkSize) {
    const chunk = questionIds.slice(i, i + chunkSize);
    const questionQuery = query(questionsRef, where('id', 'in', chunk));
    const questionSnap = await getDocs(questionQuery);
    questionSnap.forEach((docSnap) => {
      questions.push(docSnap.data());
    });
  }

  // 個別ドキュメントの取得数が questionIds と一致しない（不整合がある）場合、親ドキュメントの非正規化コピーをフォールバックとして使用
  if (questions.length < questionIds.length && quizData.questions && quizData.questions.length > 0) {
    return quizData.questions;
  }

  // クイズが保持する本来の順序（questionIds配列のインデックス）通りにソートして返す
  const idToIndex = new Map(questionIds.map((id, index) => [id, index]));
  return questions.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}

/**
  * 問題を個別でブックマーク登録/解除する
  * @returns 変更後の状態 (true: 登録完了, false: 解除完了)
  */
export async function toggleBookmarkQuestion(userId: string, questionId: string): Promise<boolean> {
  return await toggleBookmark(userId, questionId, 'question');
}

/**
  * ユーザーがブックマークしたすべての問題（Questionオブジェクト）を取得
  */
export async function getBookmarkedQuestions(userId: string): Promise<Question[]> {
  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'question')
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

  const questionIds = bookmarkDocs.map((doc) => doc.targetId);

  if (questionIds.length === 0) return [];

  const questions: Question[] = [];
  const chunkSize = 10;
  for (let i = 0; i < questionIds.length; i += chunkSize) {
    const chunk = questionIds.slice(i, i + chunkSize);
    const questionQuery = query(questionsRef, where('id', 'in', chunk));
    const questionSnap = await getDocs(questionQuery);
    questionSnap.forEach((doc) => questions.push(doc.data()));
  }

  // ブックマーク登録日時の降順に並ぶようソート
  const idToIndex = new Map(questionIds.map((id, index) => [id, index]));
  return questions.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}
