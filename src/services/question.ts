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
import { questionsRef, bookmarksRef, quizListsRef, quizzesRef } from '../lib/firebase/firestore';
import { Question, Bookmark, QuizList, Quiz } from '../types';
import { toggleBookmark } from './bookmark';
import {
  assertListTypeOperation,
  assertParentQuizPublished,
  QuestionNotListAddableError,
} from '../lib/question-list-validation';

/**
  * 指定されたIDの設問を1件取得する
  */
export async function getQuestion(id: string): Promise<Question | null> {
  const docRef = doc(questionsRef, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data();
}

/**
  * 指定されたクイズIDに紐づくすべての設問を取得する
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

  for (const questionId of questionIds) {
    const snap = await getDoc(doc(questionsRef, questionId));
    if (snap.exists()) {
      questions.push(snap.data());
    }
  }

  // クイズが保持する本来の順序（questionIds配列のインデックス）通りにソートして返す
  const idToIndex = new Map(questionIds.map((id, index) => [id, index]));
  return questions.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}

/**
  * 設問を個別でブックマーク登録/解除する
  * @returns 変更後の状態 (true: 登録完了, false: 解除完了)
  */
export async function toggleBookmarkQuestion(userId: string, questionId: string): Promise<boolean> {
  return await toggleBookmark(userId, questionId, 'question');
}

/**
  * ユーザーがブックマークしたすべての設問（Questionオブジェクト）を取得
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

/**
  * ユーザーが所有するリストに特定の設問を追加する（アトミックなトランザクション）
  */
export async function addQuestionToList(listId: string, questionId: string): Promise<void> {
  const question = await getQuestion(questionId);
  if (!question?.quizId) {
    throw new Error('設問が見つかりません。');
  }
  const quizSnap = await getDoc(doc(quizzesRef, question.quizId));
  if (!quizSnap.exists()) {
    throw new Error('設問が見つかりません。');
  }
  const parentQuiz = quizSnap.data() as Quiz;
  assertParentQuizPublished(parentQuiz.status, QuestionNotListAddableError);

  const listDocRef = doc(quizListsRef, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listDocRef);
    if (!listSnap.exists()) {
      throw new Error('クイズリストが存在しません。');
    }

    const listData = listSnap.data() as QuizList;
    assertListTypeOperation(listData, 'question');
    const currentQuestionIds = listData.questionIds || [];

    if (!currentQuestionIds.includes(questionId)) {
      const newQuestionIds = [...currentQuestionIds, questionId];
      transaction.update(listDocRef, {
        questionIds: newQuestionIds,
        updatedAt: new Date(),
      } as any);
    }
  });
}

/**
  * ユーザーが所有するリストから特定の設問を削除する（アトミックなトランザクション）
  */
export async function removeQuestionFromList(listId: string, questionId: string): Promise<void> {
  const listDocRef = doc(quizListsRef, listId);

  await runTransaction(db, async (transaction) => {
    const listSnap = await transaction.get(listDocRef);
    if (!listSnap.exists()) {
      throw new Error('クイズリストが存在しません。');
    }

    const listData = listSnap.data() as QuizList;
    assertListTypeOperation(listData, 'question');
    const currentQuestionIds = listData.questionIds || [];

    if (currentQuestionIds.includes(questionId)) {
      const newQuestionIds = currentQuestionIds.filter((id) => id !== questionId);
      transaction.update(listDocRef, {
        questionIds: newQuestionIds,
        updatedAt: new Date(),
      } as any);
    }
  });
}
