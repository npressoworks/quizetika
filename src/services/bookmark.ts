import {
  doc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
  orderBy,
  setDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { bookmarksRef, quizzesRef, quizListsRef, questionsRef, usersRef } from '../lib/firebase/firestore';
import {
  Bookmark,
  Quiz,
  QuizList,
  Question,
  BookmarkFeed,
  BookmarkedQuestionEntry,
} from '../types';
import { assertParentQuizPublished } from '../lib/question-list-validation';
import { createNotification } from './notification';

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

function bookmarkCreatedAtMs(val: unknown): number {
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
}

function sortBookmarksByCreatedAtDesc(bookmarkDocs: Bookmark[]): Bookmark[] {
  return [...bookmarkDocs].sort(
    (a, b) => bookmarkCreatedAtMs(b.createdAt) - bookmarkCreatedAtMs(a.createdAt)
  );
}

async function assertQuestionBookmarkable(questionId: string): Promise<Question> {
  const questionRef = doc(questionsRef, questionId);
  const questionSnap = await getDoc(questionRef);

  let question: Question;

  if (!questionSnap.exists()) {
    // 設問ドキュメントが存在しない場合、親クイズの非正規化データから検索してオンデマンドで復元する
    const parentQuizQuery = query(quizzesRef, where('questionIds', 'array-contains', questionId));
    const parentQuizSnap = await getDocs(parentQuizQuery);

    if (parentQuizSnap.empty) {
      throw new Error('Target document does not exist.');
    }

    const quizDoc = parentQuizSnap.docs[0];
    const quiz = quizDoc.data() as Quiz;

    assertParentQuizPublished(quiz.status);

    const foundQuestion = quiz.questions?.find((q) => q.id === questionId);
    if (!foundQuestion) {
      throw new Error('Target document does not exist.');
    }

    const restoredQuestion: Question = {
      ...foundQuestion,
      id: questionId,
      quizId: quiz.id,
      authorId: quiz.authorId,
      authorName: quiz.authorName,
      authorAvatar: quiz.authorAvatar || '',
      bookmarksCount: foundQuestion.bookmarksCount || 0,
      correctCount: foundQuestion.correctCount || 0,
      incorrectCount: foundQuestion.incorrectCount || 0,
    };

    await setDoc(questionRef, restoredQuestion);
    question = restoredQuestion;
  } else {
    question = questionSnap.data() as Question;
    if (!question.quizId) {
      throw new Error('Target document does not exist.');
    }
    const quizSnap = await getDoc(doc(quizzesRef, question.quizId));
    if (!quizSnap.exists()) {
      throw new Error('Target document does not exist.');
    }
    const quiz = quizSnap.data() as Quiz;
    assertParentQuizPublished(quiz.status);
  }

  return question;
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
  let questionForNotify: Question | null = null;
  if (targetType === 'question' && !isTestEnv) {
    questionForNotify = await assertQuestionBookmarkable(targetId);
  }

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

  const added = await runTransaction(db, async (transaction) => {
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

  if (
    added &&
    targetType === 'question' &&
    questionForNotify?.authorId &&
    questionForNotify.authorId !== userId
  ) {
    const senderSnap = await getDoc(doc(usersRef, userId));
    const sender = senderSnap.exists() ? senderSnap.data() : null;
    await createNotification({
      userId: questionForNotify.authorId,
      type: 'bookmark',
      senderId: userId,
      senderName: (sender as { displayName?: string })?.displayName ?? 'ユーザー',
      senderAvatar: (sender as { avatarUrl?: string })?.avatarUrl ?? '',
      targetId: questionForNotify.id,
      targetTitle: questionForNotify.questionText.slice(0, 80),
    });
  }

  return added;
}

/**
 * ユーザーがブックマークしたクイズ ID のみ取得（ホームの星表示など軽量用途）
 */
export async function getBookmarkedQuizIds(userId: string): Promise<string[]> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    return list
      .filter((b: { userId: string; targetType: string }) => b.userId === userId && b.targetType === 'quiz')
      .map((b: { targetId: string }) => b.targetId);
  }

  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'quiz')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => (d.data() as Bookmark).targetId);
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
  const bookmarkDocs = sortBookmarksByCreatedAtDesc(
    snap.docs.map((doc) => doc.data() as Bookmark)
  );

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
      where('status', '==', 'published')
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
  const bookmarkDocs = sortBookmarksByCreatedAtDesc(
    snap.docs.map((doc) => doc.data() as Bookmark)
  );

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

/**
 * ブックマークした設問を親クイズメタ付きで取得（公開親のみ）
 */
export async function enrichBookmarkedQuestions(
  userId: string
): Promise<BookmarkedQuestionEntry[]> {
  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'question')
  );
  const snap = await getDocs(q);
  const bookmarkDocs = sortBookmarksByCreatedAtDesc(
    snap.docs.map((d) => d.data() as Bookmark)
  );

  const entries: BookmarkedQuestionEntry[] = [];
  for (const bm of bookmarkDocs) {
    const questionSnap = await getDoc(doc(questionsRef, bm.targetId));
    if (!questionSnap.exists()) continue;
    const question = questionSnap.data() as Question;
    if (!question.quizId) continue;
    const quizSnap = await getDoc(doc(quizzesRef, question.quizId));
    if (!quizSnap.exists()) continue;
    const quiz = quizSnap.data() as Quiz;
    if (quiz.status !== 'published') continue;
    entries.push({
      question,
      parentQuizId: quiz.id,
      parentQuizTitle: quiz.title,
      bookmarkedAt:
        bm.createdAt instanceof Date
          ? bm.createdAt
          : new Date(bookmarkCreatedAtMs(bm.createdAt)),
    });
  }
  return entries;
}

/**
 * クイズ・リスト・設問の3分類ブックマーク一覧
 */
export async function getBookmarkFeed(userId: string): Promise<BookmarkFeed> {
  const [quizzes, lists, questions] = await Promise.all([
    getBookmarkedQuizzes(userId),
    getBookmarkedLists(userId),
    enrichBookmarkedQuestions(userId),
  ]);
  return { quizzes, lists, questions };
}
