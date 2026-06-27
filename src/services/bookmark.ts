import {
  doc,
  getDoc,
  query,
  where,
  getDocs,
  runTransaction,
  setDoc,
  type DocumentData,
  type DocumentReference,
  documentId,
} from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { bookmarksRef, quizzesRef, questionsRef, usersRef } from '../lib/firebase/firestore';
import {
  Bookmark,
  Quiz,
  Question,
  BookmarkFeed,
  BookmarkedQuestionEntry,
} from '../types';
import { assertParentQuizPublished, assertQuizBookmarkable } from '../lib/bookmark-validation';
import { createNotification } from './notification';

// テスト環境かどうかを判定するためのフラグ
// E2Eテスト実行時（NEXT_PUBLIC_ENVがtest）にのみtrueとなります
const isTestEnv = process.env.NEXT_PUBLIC_ENV === 'test';

// E2Eテスト時のお気に入りモックデータを保存するローカルストレージのキー
const MOCK_BOOKMARKS_KEY = 'quizetika_mock_bookmarks';

export class InvalidBookmarkTargetError extends Error {
  readonly code = 'INVALID_BOOKMARK_TARGET' as const;
  constructor(message = 'ブックマーク対象はクイズまたは問題のみです') {
    super(message);
    this.name = 'InvalidBookmarkTargetError';
  }
}

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

/** createConverter が本文から id を除去するため、ドキュメント ID で直接取得する */
async function fetchPublishedQuizzesByDocIds(quizIds: string[]): Promise<Quiz[]> {
  if (quizIds.length === 0) return [];
  const uniqueIds = [...new Set(quizIds)];
  const chunks = [];
  for (let i = 0; i < uniqueIds.length; i += 30) {
    chunks.push(uniqueIds.slice(i, i + 30));
  }
  const snaps = await Promise.all(
    chunks.map((chunk) => getDocs(query(quizzesRef, where(documentId(), 'in', chunk))))
  );
  const quizzes: Quiz[] = [];
  snaps.forEach((snap) => {
    snap.forEach((d) => {
      const quiz = d.data() as Quiz;
      if (quiz.status === 'published') {
        quizzes.push(quiz);
      }
    });
  });
  return quizzes;
}

async function assertQuestionBookmarkable(
  questionId: string,
  viewerUid: string
): Promise<Question> {
  const questionRef = doc(questionsRef, questionId);
  const questionSnap = await getDoc(questionRef);

  let question: Question;

  if (!questionSnap.exists()) {
    const parentQuizQuery = query(quizzesRef, where('questionIds', 'array-contains', questionId));
    const parentQuizSnap = await getDocs(parentQuizQuery);

    if (parentQuizSnap.empty) {
      throw new Error('Target document does not exist.');
    }

    const quizDoc = parentQuizSnap.docs[0];
    const quiz = quizDoc.data() as Quiz;

    assertParentQuizPublished(quiz.status);
    await assertQuizBookmarkable(quiz, viewerUid);

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
    await assertQuizBookmarkable(quiz, viewerUid);
  }

  return question;
}

/**
 * ブックマーク状態を判定する
 */
export async function isBookmarked(userId: string, targetId: string): Promise<boolean> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    return list.some((b: { userId: string; targetId: string }) => b.userId === userId && b.targetId === targetId);
  }
  const docId = getBookmarkDocId(userId, targetId);
  const docRef = doc(bookmarksRef, docId);
  const snap = await getDoc(docRef);
  return snap.exists();
}

/**
 * ブックマークをトグルする (登録/解除)
 */
export async function toggleBookmark(
  userId: string,
  targetId: string,
  targetType: 'quiz' | 'question'
): Promise<boolean> {
  if ((targetType as string) === 'list') {
    throw new InvalidBookmarkTargetError();
  }

  let questionForNotify: Question | null = null;
  if (targetType === 'question' && !isTestEnv) {
    questionForNotify = await assertQuestionBookmarkable(targetId, userId);
  }

  if (targetType === 'quiz' && !isTestEnv) {
    const quizSnap = await getDoc(doc(quizzesRef, targetId));
    if (!quizSnap.exists()) {
      throw new Error('Target document does not exist.');
    }
    const already = await isBookmarked(userId, targetId);
    if (!already) {
      await assertQuizBookmarkable(quizSnap.data() as Quiz, userId);
    }
  }

  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    const idx = list.findIndex((b: { userId: string; targetId: string }) => b.userId === userId && b.targetId === targetId);
    let added = false;
    if (idx !== -1) {
      list.splice(idx, 1);
    } else {
      list.push({
        id: `${userId}_${targetId}`,
        userId,
        targetId,
        targetType,
        createdAt: new Date().toISOString(),
      });
      added = true;
    }
    localStorage.setItem(MOCK_BOOKMARKS_KEY, JSON.stringify(list));
    return added;
  }
  const bookmarkDocId = getBookmarkDocId(userId, targetId);
  const bookmarkDocRef = doc(bookmarksRef, bookmarkDocId);

  const targetDocRef =
    targetType === 'quiz' ? doc(quizzesRef, targetId) : doc(questionsRef, targetId);

  // Firestore SDK はユニオン型の DocumentReference を受け付けないため DocumentData にキャストする
  const targetRef = targetDocRef as DocumentReference<DocumentData>;

  const added = await runTransaction(db, async (transaction) => {
    const bookmarkSnap = await transaction.get(bookmarkDocRef);
    const targetSnap = await transaction.get(targetRef);

    if (!targetSnap.exists()) {
      throw new Error('Target document does not exist.');
    }

    const currentCount = (targetSnap.data() as { bookmarksCount?: number })?.bookmarksCount || 0;
    const isAlreadyBookmarked = bookmarkSnap.exists();

    if (isAlreadyBookmarked) {
      transaction.delete(bookmarkDocRef);
      const newCount = Math.max(0, currentCount - 1);
      transaction.update(targetRef, { bookmarksCount: newCount });
      return false;
    }

    const newBookmark: Bookmark = {
      id: bookmarkDocId,
      userId,
      targetId,
      targetType,
      createdAt: new Date(),
    };
    transaction.set(bookmarkDocRef, newBookmark as Bookmark);

    const newCount = currentCount + 1;
    transaction.update(targetRef, { bookmarksCount: newCount });
    return true;
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
    const targetIds = list
      .filter((b: { userId: string; targetType: string }) => b.userId === userId && b.targetType === 'quiz')
      .map((b: { targetId: string }) => b.targetId);
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
      status: 'published',
      questions: [],
      questionIds: [],
    })) as Quiz[];
  }
  const q = query(
    bookmarksRef,
    where('userId', '==', userId),
    where('targetType', '==', 'quiz')
  );

  const snap = await getDocs(q);

  const bookmarkDocs = sortBookmarksByCreatedAtDesc(
    snap.docs.map((docSnap) => docSnap.data() as Bookmark)
  );

  const quizIds = bookmarkDocs.map((docSnap) => docSnap.targetId);

  if (quizIds.length === 0) return [];

  const quizzes = await fetchPublishedQuizzesByDocIds(quizIds);

  const idToIndex = new Map(quizIds.map((id, index) => [id, index]));
  return quizzes.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}

/**
 * ブックマークした問題を親クイズメタ付きで取得（公開親のみ）
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

  if (bookmarkDocs.length === 0) return [];

  // 1. 問題IDを一括取得
  const questionIds = [...new Set(bookmarkDocs.map((bm) => bm.targetId))];
  const questionMap = new Map<string, Question>();
  if (questionIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < questionIds.length; i += 30) {
      chunks.push(questionIds.slice(i, i + 30));
    }
    const snaps = await Promise.all(
      chunks.map((chunk) => getDocs(query(questionsRef, where(documentId(), 'in', chunk))))
    );
    snaps.forEach((s) => {
      s.forEach((d) => {
        questionMap.set(d.id, d.data() as Question);
      });
    });
  }

  // 2. クイズIDを一括取得
  const quizIds = [
    ...new Set(
      Array.from(questionMap.values())
        .map((q) => q.quizId)
        .filter(Boolean)
    ),
  ];
  const quizMap = new Map<string, Quiz>();
  if (quizIds.length > 0) {
    const chunks = [];
    for (let i = 0; i < quizIds.length; i += 30) {
      chunks.push(quizIds.slice(i, i + 30));
    }
    const snaps = await Promise.all(
      chunks.map((chunk) => getDocs(query(quizzesRef, where(documentId(), 'in', chunk))))
    );
    snaps.forEach((s) => {
      s.forEach((d) => {
        quizMap.set(d.id, d.data() as Quiz);
      });
    });
  }

  // 3. エントリの構築
  const entries: BookmarkedQuestionEntry[] = [];
  for (const bm of bookmarkDocs) {
    const question = questionMap.get(bm.targetId);
    if (!question || !question.quizId) continue;
    const quiz = quizMap.get(question.quizId);
    if (!quiz || quiz.status !== 'published') continue;

    entries.push({
      question,
      parentQuizId: quiz.id,
      parentQuizTitle: quiz.title,
      bookmarkedAt:
        bm.createdAt instanceof Date
          ? bm.createdAt
          : new Date(bookmarkCreatedAtMs(bm.createdAt)),
      genreId: quiz.canonicalGenreId ?? quiz.genre ?? 'general',
      difficulty: quiz.difficulty ?? 3,
      tags: quiz.tags ?? [],
      format: question.type,
    });
  }
  return entries;
}

/**
 * クイズ・問題の2分類ブックマーク一覧
 */
export async function getBookmarkFeed(userId: string): Promise<BookmarkFeed> {
  const [quizzes, questions] = await Promise.all([
    getBookmarkedQuizzes(userId),
    enrichBookmarkedQuestions(userId),
  ]);
  return { quizzes, questions };
}
