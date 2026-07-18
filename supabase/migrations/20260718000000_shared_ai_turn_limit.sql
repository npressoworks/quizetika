-- 共通AIターン制限対応:
-- 真相判定（verify-truth）およびテストプレイのAI判定も handle_record_ai_turn で
-- 同一の二層日次カウンタ（per-quiz / global）を消費できるよう、NULL 許容に拡張する。
--   - p_attempt_id / p_history_entry が NULL: attempts への履歴追記・ターン加算をスキップ
--   - p_quiz_id が NULL: per-quiz カウントをスキップ（グローバルのみ加算。テストプレイ用）
CREATE OR REPLACE FUNCTION handle_record_ai_turn(
  p_attempt_id UUID,
  p_user_id UUID,
  p_quiz_id UUID,
  p_history_entry JSONB,
  p_per_quiz_limit INTEGER,
  p_global_limit INTEGER
) RETURNS TABLE(per_quiz_count INTEGER, global_count INTEGER) AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Asia/Tokyo')::date;
  v_per_quiz INTEGER := 0;
  v_global INTEGER;
BEGIN
  IF p_quiz_id IS NOT NULL THEN
    INSERT INTO ai_turn_counts_per_quiz (user_id, quiz_id, count, count_date)
    VALUES (p_user_id, p_quiz_id, 1, v_today)
    ON CONFLICT (user_id, quiz_id) DO UPDATE
    SET count = CASE WHEN ai_turn_counts_per_quiz.count_date = v_today THEN ai_turn_counts_per_quiz.count + 1 ELSE 1 END,
        count_date = v_today
    RETURNING count INTO v_per_quiz;

    -- 上限判定はこのアトミックな加算の直後に行うことで、事前チェックとRPC呼び出しの間のレースを閉じる
    IF p_per_quiz_limit IS NOT NULL AND v_per_quiz > p_per_quiz_limit THEN
      RAISE EXCEPTION 'per-quiz-limit-exceeded';
    END IF;
  END IF;

  INSERT INTO ai_turn_counts_global (user_id, count, count_date)
  VALUES (p_user_id, 1, v_today)
  ON CONFLICT (user_id) DO UPDATE
  SET count = CASE WHEN ai_turn_counts_global.count_date = v_today THEN ai_turn_counts_global.count + 1 ELSE 1 END,
      count_date = v_today
  RETURNING count INTO v_global;

  IF p_global_limit IS NOT NULL AND v_global > p_global_limit THEN
    RAISE EXCEPTION 'global-limit-exceeded';
  END IF;

  IF p_attempt_id IS NOT NULL AND p_history_entry IS NOT NULL THEN
    UPDATE attempts
    SET ai_questions_history = ai_questions_history || p_history_entry,
        ai_turn_count = ai_turn_count + 1
    WHERE id = p_attempt_id;
  END IF;

  RETURN QUERY SELECT v_per_quiz, v_global;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
