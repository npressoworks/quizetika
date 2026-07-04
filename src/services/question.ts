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
    quizId: row.owner_quiz_id ?? undefined,
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
  if (question.quizId !== undefined) row.owner_quiz_id = question.quizId ?? null;
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
 * （`quiz_questions` 中間テーブルの `display_order` に準拠して並び替える）
 */
export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  const { data: linkRows, error: linkError } = await supabase
    .from('quiz_questions')
    .select('question_id, display_order')
    .eq('quiz_id', quizId)
    .order('display_order', { ascending: true });

  if (linkError || !linkRows || linkRows.length === 0) return [];

  const questionIds = linkRows.map((row) => row.question_id);
  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (questionsError || !questionsData) return [];

  const questionMap = new Map(questionsData.map((row) => [row.id, mapQuestionRowToQuestion(row)]));

  return linkRows
    .map((row) => questionMap.get(row.question_id))
    .filter((q): q is Question => !!q);
}

/**
 * 複数クイズ分の問題一覧を一括取得する（N+1 回避用）
 */
export async function getQuizQuestionsBulk(quizIds: string[]): Promise<Map<string, Question[]>> {
  const map = new Map<string, Question[]>();
  if (quizIds.length === 0) return map;

  const { data: linkRows, error: linkError } = await supabase
    .from('quiz_questions')
    .select('quiz_id, question_id, display_order')
    .in('quiz_id', [...new Set(quizIds)])
    .order('display_order', { ascending: true });

  if (linkError || !linkRows || linkRows.length === 0) return map;

  const questionIds = [...new Set(linkRows.map((row) => row.question_id))];
  const { data: questionsData } = await supabase.from('questions').select('*').in('id', questionIds);
  const questionMap = new Map((questionsData ?? []).map((row) => [row.id, mapQuestionRowToQuestion(row)]));

  for (const link of linkRows) {
    const question = questionMap.get(link.question_id);
    if (!question) continue;
    const arr = map.get(link.quiz_id) ?? [];
    arr.push(question);
    map.set(link.quiz_id, arr);
  }
  return map;
}

/**
 * クイズ内の問題の表示順序を並び替える（要件 2.3）
 */
export async function updateQuestionOrder(
  quizId: string,
  orderedQuestionIds: string[]
): Promise<void> {
  const { error } = await supabase.rpc('handle_reorder_questions', {
    p_quiz_id: quizId,
    p_question_ids: orderedQuestionIds,
  });

  if (error) {
    throw new Error(`問題の並び替えに失敗しました: ${error.message}`);
  }
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
