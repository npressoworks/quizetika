-- supabase-gameplay: 残存する直接 Firestore 依存の排除（Task 4.1）に伴うRPC追加
-- attempt.ts / review.ts に残っていた Firestore 依存関数（弱点克服の間違い問題管理、
-- 指摘レポートの内容編集）を Supabase RPC ベースへ移行するために必要な関数を定義する。

-- ==========================================
-- 弱点克服プレイ: 正解した問題を過去の間違いリストからアトミックに除去し、
-- ユーザーの合計間違い数を減算する
-- ==========================================
CREATE OR REPLACE FUNCTION handle_remove_failed_questions(
  p_user_id UUID,
  p_quiz_id UUID,
  p_solved_question_ids UUID[]
) RETURNS VOID AS $$
BEGIN
  UPDATE attempts
  SET failed_question_ids = (
    SELECT COALESCE(array_agg(fid), '{}')
    FROM unnest(failed_question_ids) AS fid
    WHERE fid <> ALL(p_solved_question_ids)
  )
  WHERE user_id = p_user_id AND quiz_id = p_quiz_id;

  UPDATE users
  SET total_failed_questions_count = GREATEST(0, total_failed_questions_count - array_length(p_solved_question_ids, 1))
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- ユーザーの合計間違い問題数をアトミックに加減算する（0未満にはならない）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_adjust_failed_questions_count(
  p_user_id UUID,
  p_delta INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET total_failed_questions_count = GREATEST(0, total_failed_questions_count + p_delta)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 指摘レポートの内容編集（報告者本人のみ、openステータスのもののみ）
-- feedback_reports_update RLSポリシーは creator_id のみを許可するため、
-- 報告者自身による編集は SECURITY DEFINER RPC で明示的に許可する
-- ==========================================
CREATE OR REPLACE FUNCTION handle_update_feedback_report(
  p_report_id UUID,
  p_reporter_id UUID,
  p_category TEXT,
  p_content TEXT
) RETURNS VOID AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  UPDATE feedback_reports
  SET category = p_category, content = p_content
  WHERE id = p_report_id AND reporter_id = p_reporter_id AND status = 'open'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'レポートが見つかりません: %', p_report_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
