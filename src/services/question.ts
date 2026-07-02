import { createClient } from '@/lib/supabase/client';
import { Question, Quiz } from '../types';
import { toggleBookmark } from './bookmark';
import { Database } from '@/lib/supabase/database.types';

const supabase = createClient();

/**
 * データベースRowからQuestionオブジェクトへマッピング
 */
export function mapQuestionRowToQuestion(row: Database['public']['Tables']['questions']['Row']): Question {
  return {
    id: row.id,
    quizId: row.quiz_id ?? undefined,
    linkKind: (row.link_kind as Question['linkKind']) ?? undefined,
    authorId: row.author_id ?? undefined,
    authorName: row.author_name ?? undefined,
    authorAvatar: row.author_avatar ?? undefined,
    type: row.type as Question['type'],
    questionText: row.question_text,
    explanation: row.explanation,
    imageUrl: row.image_url,
    hint: row.hint,
    limitTime: row.limit_time,
    correctTextAnswerList: row.correct_text_answer_list ?? undefined,
    textInputMode: (row.text_input_mode as Question['textInputMode']) ?? undefined,
    textInputCharCount: row.text_input_char_count ?? undefined,
    choices: (row.choices as any) ?? undefined,
    sortingItems: (row.sorting_items as any) ?? undefined,
    associationHints: row.association_hints ?? undefined,
    aiContextDetails: row.ai_context_details ?? undefined,
    truthKeywords: row.truth_keywords ?? undefined,
    sourceUrl: row.source_url,
    correctCount: row.correct_count ?? 0,
    incorrectCount: row.incorrect_count ?? 0,
    bookmarksCount: row.bookmarks_count ?? undefined,
  };
}

/**
 * Questionオブジェクトの部分データからデータベースのアップデート用レコードへマッピング
 */
export function mapQuestionToRow(question: Partial<Question>): Database['public']['Tables']['questions']['Update'] {
  const row: Database['public']['Tables']['questions']['Update'] = {};
  if (question.id !== undefined) row.id = question.id;
  if (question.quizId !== undefined) row.quiz_id = question.quizId ?? null;
  if (question.linkKind !== undefined) row.link_kind = question.linkKind ?? null;
  if (question.authorId !== undefined) row.author_id = question.authorId ?? null;
  if (question.authorName !== undefined) row.author_name = question.authorName ?? null;
  if (question.authorAvatar !== undefined) row.author_avatar = question.authorAvatar ?? null;
  if (question.type !== undefined) row.type = question.type;
  if (question.questionText !== undefined) row.question_text = question.questionText;
  if (question.explanation !== undefined) row.explanation = question.explanation;
  if (question.imageUrl !== undefined) row.image_url = question.imageUrl ?? null;
  if (question.hint !== undefined) row.hint = question.hint ?? null;
  if (question.limitTime !== undefined) row.limit_time = question.limitTime ?? null;
  if (question.correctTextAnswerList !== undefined) row.correct_text_answer_list = question.correctTextAnswerList ?? null;
  if (question.textInputMode !== undefined) row.text_input_mode = question.textInputMode ?? null;
  if (question.textInputCharCount !== undefined) row.text_input_char_count = question.textInputCharCount ?? null;
  if (question.choices !== undefined) row.choices = question.choices as any;
  if (question.sortingItems !== undefined) row.sorting_items = question.sortingItems as any;
  if (question.associationHints !== undefined) row.association_hints = question.associationHints ?? null;
  if (question.aiContextDetails !== undefined) row.ai_context_details = question.aiContextDetails ?? null;
  if (question.truthKeywords !== undefined) row.truth_keywords = question.truthKeywords ?? null;
  if (question.sourceUrl !== undefined) row.source_url = question.sourceUrl ?? null;
  if (question.correctCount !== undefined) row.correct_count = question.correctCount;
  if (question.incorrectCount !== undefined) row.incorrect_count = question.incorrectCount;
  if (question.bookmarksCount !== undefined) row.bookmarks_count = question.bookmarksCount ?? null;
  return row;
}

/**
 * 指定されたIDの問題を1件取得する
 */
export async function getQuestion(id: string): Promise<Question | null> {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapQuestionRowToQuestion(data);
}

/**
 * 指定されたクイズIDに紐づくすべての問題を取得する
 * （順序はクイズの `questionIds` に準拠し、最新の統計情報を含む独立テーブルから取得）
 */
export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  const { data: quizData, error: quizError } = await supabase
    .from('quizzes')
    .select('*')
    .eq('id', quizId)
    .maybeSingle();

  if (quizError || !quizData) return [];

  const questionIds = quizData.question_ids || [];

  if (questionIds.length === 0) {
    // 移行期や古いクイズなどで questionIds が空だが questions 非正規化コピーがある場合はそこから解決
    return (quizData.questions as any as Question[]) || [];
  }

  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (questionsError || !questionsData) {
    return (quizData.questions as any as Question[]) || [];
  }

  const questions = questionsData.map((row) => mapQuestionRowToQuestion(row));

  // 個別ドキュメントの取得数が questionIds と一致しない（不整合がある）場合、親ドキュメントの非正規化コピーをフォールバックとして使用
  if (questions.length < questionIds.length && quizData.questions) {
    const fallback = quizData.questions as any as Question[];
    if (fallback.length > 0) return fallback;
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
  const { data: bookmarksData, error: bookmarksError } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('user_id', userId)
    .eq('target_type', 'question')
    .order('created_at', { ascending: false });

  if (bookmarksError || !bookmarksData || bookmarksData.length === 0) return [];

  const questionIds = bookmarksData.map((doc) => doc.target_id);

  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (questionsError || !questionsData) return [];

  const questions = questionsData.map((row) => mapQuestionRowToQuestion(row));

  // ブックマーク登録日時の降順に並ぶようソート
  const idToIndex = new Map(questionIds.map((id, index) => [id, index]));
  return questions.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
}
