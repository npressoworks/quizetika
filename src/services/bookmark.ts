import { createClient } from '../lib/supabase/client';
import {
  Bookmark,
  Quiz,
  Question,
  BookmarkFeed,
  BookmarkedQuestionEntry,
} from '../types';
import { assertParentQuizPublished, assertQuizBookmarkable } from '../lib/bookmark-validation';
import { createNotification } from './notification';
import { Database } from '../lib/supabase/database.types';
import { mapRowToQuiz } from './quiz';
import { mapQuestionRowToQuestion } from './question';

const supabase = createClient();

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

function mapRowToBookmark(row: Database['public']['Tables']['bookmarks']['Row']): Bookmark {
  return {
    userId: row.user_id,
    targetId: row.target_id,
    targetType: row.target_type as 'quiz' | 'question',
    createdAt: new Date(row.created_at),
  };
}

/** ドキュメント ID で直接取得する */
async function fetchPublishedQuizzesByDocIds(quizIds: string[]): Promise<Quiz[]> {
  if (quizIds.length === 0) return [];
  const uniqueIds = [...new Set(quizIds)];
  
  const quizzes: Quiz[] = [];
  // Supabase で id 一括取得
  const { data, error } = await supabase
    .from('quizzes')
    .select('*')
    .in('id', uniqueIds);

  if (error || !data) return [];

  data.forEach((row) => {
    const quiz = mapRowToQuiz(row);
    if (quiz.status === 'published') {
      quizzes.push(quiz);
    }
  });
  return quizzes;
}

async function assertQuestionBookmarkable(
  questionId: string,
  viewerUid: string
): Promise<Question> {
  const { data: questionRow } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .maybeSingle();

  if (!questionRow) {
    throw new Error('Target document does not exist.');
  }

  const question = mapQuestionRowToQuestion(questionRow);
  if (!question.quizId) {
    throw new Error('Target document does not exist.');
  }

  const { data: quizRow } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', question.quizId)
    .maybeSingle();
  if (!quizRow) {
    throw new Error('Target document does not exist.');
  }
  const quiz = mapRowToQuiz(quizRow);
  assertParentQuizPublished(quiz.status);
  await assertQuizBookmarkable(quiz, viewerUid);

  return question;
}

/**
 * ブックマーク状態を判定する
 * `targetType` は省略可能（既存呼び出し元との互換性のため）。省略時は `target_id` のみで検索する。
 */
export async function isBookmarked(
  userId: string,
  targetId: string,
  targetType?: 'quiz' | 'question'
): Promise<boolean> {
  if (isTestEnv) {
    const list = JSON.parse(localStorage.getItem(MOCK_BOOKMARKS_KEY) || '[]');
    return list.some((b: { userId: string; targetId: string }) => b.userId === userId && b.targetId === targetId);
  }

  let query = supabase
    .from('bookmarks')
    .select('user_id')
    .eq('user_id', userId)
    .eq('target_id', targetId);

  if (targetType) {
    query = query.eq('target_type', targetType);
  }

  const { data, error } = await query.maybeSingle();
  return !!data && !error;
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
  let quizForNotify: Quiz | null = null;
  if (targetType === 'question' && !isTestEnv) {
    questionForNotify = await assertQuestionBookmarkable(targetId, userId);
  }

  if (targetType === 'quiz' && !isTestEnv) {
    const { data: quizRow } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', targetId)
      .maybeSingle();

    if (!quizRow) {
      throw new Error('Target document does not exist.');
    }
    quizForNotify = mapRowToQuiz(quizRow);
    const already = await isBookmarked(userId, targetId);
    if (!already) {
      await assertQuizBookmarkable(quizForNotify, userId);
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

  // RPC の呼び出しでアトミックにトグル
  const { data: added, error } = await (supabase as any).rpc('handle_bookmark_toggle', {
    p_user_id: userId,
    p_target_id: targetId,
    p_target_type: targetType,
  });

  if (error) {
    throw new Error(`ブックマーク処理のRPC実行に失敗しました: ${error.message}`);
  }

  if (added) {
    const { data: senderRow } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();

    const senderName = senderRow?.display_name ?? 'ユーザー';
    const senderAvatar = senderRow?.avatar_url ?? '';

    if (targetType === 'question' && questionForNotify?.authorId && questionForNotify.authorId !== userId) {
      await createNotification({
        userId: questionForNotify.authorId,
        type: 'bookmark',
        senderId: userId,
        senderName,
        senderAvatar,
        targetId: questionForNotify.id,
        targetTitle: questionForNotify.questionText.slice(0, 80),
      });
    } else if (targetType === 'quiz' && quizForNotify?.authorId && quizForNotify.authorId !== userId) {
      await createNotification({
        userId: quizForNotify.authorId,
        type: 'bookmark',
        senderId: userId,
        senderName,
        senderAvatar,
        targetId: quizForNotify.id,
        targetTitle: quizForNotify.title,
      });
    }
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

  const { data, error } = await supabase
    .from('bookmarks')
    .select('target_id')
    .eq('user_id', userId)
    .eq('target_type', 'quiz');

  if (error || !data) return [];
  return data.map((d) => d.target_id);
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

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .eq('target_type', 'quiz')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const bookmarkDocs = data.map(mapRowToBookmark);
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
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .eq('target_type', 'question')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  const bookmarkDocs = data.map(mapRowToBookmark);

  if (bookmarkDocs.length === 0) return [];

  // 1. 問題IDを一括取得
  const questionIds = [...new Set(bookmarkDocs.map((bm) => bm.targetId))];
  const questionMap = new Map<string, Question>();
  if (questionIds.length > 0) {
    const { data: questionsData } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds);

    if (questionsData) {
      questionsData.forEach((row) => {
        const q = mapQuestionRowToQuestion(row);
        questionMap.set(q.id, q);
      });
    }
  }

  // 2. クイズIDを一括取得
  const quizIds = [
    ...new Set(
      Array.from(questionMap.values())
        .map((q) => q.quizId)
        .filter(Boolean)
    ),
  ] as string[];
  const quizMap = new Map<string, Quiz>();
  if (quizIds.length > 0) {
    const { data: quizzesData } = await supabase
      .from('quizzes')
      .select('*')
      .in('id', quizIds);

    if (quizzesData) {
      quizzesData.forEach((row) => {
        const quiz = mapRowToQuiz(row);
        quizMap.set(quiz.id, quiz);
      });
    }
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
      bookmarkedAt: bm.createdAt,
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
