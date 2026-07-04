-- supabase-gameplay: ゲームプレイ系スキーマの正規化（Task 1.1）
-- 既存テーブルのALTER（attempts / quiz_reviews / feedback_reports / quizzes）と
-- 新規テーブル（reactions / difficulty_votes / ai_turn_counts_per_quiz / ai_turn_counts_global）を定義する。
-- RPC 関数の定義は後続マイグレーション（Task 1.2 / 1.3）で行う。

-- ==========================================
-- attempts: 水平思考クイズの進行中セッションを表現できるようにする
-- ==========================================
ALTER TABLE attempts ALTER COLUMN completed_at DROP DEFAULT;
ALTER TABLE attempts ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE attempts ADD COLUMN gave_up_lateral BOOLEAN DEFAULT FALSE;

-- ==========================================
-- quiz_reviews: 良問/悪問の二値投票モデルへ是正し、複合主キー化する
-- ==========================================
ALTER TABLE quiz_reviews DROP CONSTRAINT quiz_reviews_pkey;
ALTER TABLE quiz_reviews DROP COLUMN id;
ALTER TABLE quiz_reviews DROP COLUMN rating;
ALTER TABLE quiz_reviews DROP COLUMN comment;
ALTER TABLE quiz_reviews ADD COLUMN type TEXT NOT NULL CHECK (type IN ('positive', 'negative'));
ALTER TABLE quiz_reviews ADD COLUMN reason TEXT;
ALTER TABLE quiz_reviews ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
ALTER TABLE quiz_reviews ADD PRIMARY KEY (reviewer_id, quiz_id);

-- ==========================================
-- feedback_reports: 同一報告者による同一問題への重複オープン報告を防止する
-- ==========================================
CREATE UNIQUE INDEX idx_feedback_reports_open_dedup
    ON feedback_reports (quiz_id, question_id, reporter_id)
    WHERE status = 'open';

-- ==========================================
-- quizzes: 本スペックが所有するゲームプレイ系集計列を追加する
-- ==========================================
ALTER TABLE quizzes ADD COLUMN likes_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE quizzes ADD COLUMN difficulty_votes_sum INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE quizzes ADD COLUMN difficulty_votes_count INTEGER DEFAULT 0 NOT NULL;

-- ==========================================
-- 新規テーブル
-- ==========================================

-- リアクション（いいねトグル）
CREATE TABLE reactions (
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('like')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (sender_id, quiz_id, type)
);
CREATE INDEX idx_reactions_receiver ON reactions(receiver_id);

-- 難易度星投票
CREATE TABLE difficulty_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    vote INTEGER NOT NULL CHECK (vote BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- ログイン済みユーザーは quiz あたり1票のみ（匿名行は対象外）
CREATE UNIQUE INDEX idx_difficulty_votes_user_quiz
    ON difficulty_votes (user_id, quiz_id) WHERE user_id IS NOT NULL;

-- AI対話 日次ターンカウンタ（クイズ単位）
CREATE TABLE ai_turn_counts_per_quiz (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    count_date DATE NOT NULL,
    PRIMARY KEY (user_id, quiz_id)
);

-- AI対話 日次ターンカウンタ（全体）
CREATE TABLE ai_turn_counts_global (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    count INTEGER NOT NULL DEFAULT 0,
    count_date DATE NOT NULL
);

-- ==========================================
-- RLS
-- ==========================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE difficulty_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_turn_counts_per_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_turn_counts_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY reactions_read ON reactions FOR SELECT USING (TRUE);
CREATE POLICY reactions_write ON reactions FOR ALL
    USING (auth.uid() = sender_id AND is_not_banned());

CREATE POLICY difficulty_votes_read ON difficulty_votes FOR SELECT USING (TRUE);
-- INSERT: ログイン済みユーザーは自分の投票のみ、匿名投票（user_id IS NULL）も許可する
CREATE POLICY difficulty_votes_insert ON difficulty_votes FOR INSERT
    WITH CHECK ((auth.uid() = user_id OR user_id IS NULL) AND is_not_banned());
-- UPDATE/DELETE: 匿名行（user_id IS NULL）は誰も更新・削除できない（自分の行のみ対象）
CREATE POLICY difficulty_votes_update ON difficulty_votes FOR UPDATE
    USING (auth.uid() = user_id AND is_not_banned());
CREATE POLICY difficulty_votes_delete ON difficulty_votes FOR DELETE
    USING (auth.uid() = user_id AND is_not_banned());

CREATE POLICY ai_turn_counts_per_quiz_read ON ai_turn_counts_per_quiz FOR SELECT
    USING (auth.uid() = user_id);
CREATE POLICY ai_turn_counts_global_read ON ai_turn_counts_global FOR SELECT
    USING (auth.uid() = user_id);
-- 書き込みは SECURITY DEFINER RPC 経由のみ許可し、クライアントからの直接書き込みは拒否する（Task 1.2で定義）

-- ==========================================
-- RPC: リーダーボード・アテンプト・AI対話関連（Task 1.2）
-- ==========================================

-- 内部共有関数: リーダーボードへの自己ベスト反映（新記録が厳密に優れている場合のみ差し替え）
CREATE OR REPLACE FUNCTION record_leaderboard_entry(
  p_quiz_id UUID,
  p_user_id UUID,
  p_display_name TEXT,
  p_score INTEGER,
  p_elapsed_seconds NUMERIC,
  p_board TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO leaderboard_entries (quiz_id, user_id, display_name, score, elapsed_seconds, type, completed_at)
  VALUES (p_quiz_id, p_user_id, p_display_name, p_score, p_elapsed_seconds, p_board, now())
  ON CONFLICT (quiz_id, user_id, type) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      score = EXCLUDED.score,
      elapsed_seconds = EXCLUDED.elapsed_seconds,
      completed_at = EXCLUDED.completed_at
  WHERE EXCLUDED.score > leaderboard_entries.score
     OR (EXCLUDED.score = leaderboard_entries.score AND EXCLUDED.elapsed_seconds < leaderboard_entries.elapsed_seconds);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 内部専用関数: display_name を任意の値で直接呼び出せないよう、クライアントからの直接RPC実行を禁止する
REVOKE EXECUTE ON FUNCTION record_leaderboard_entry(UUID, UUID, TEXT, INTEGER, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

-- 通常クイズ完了の保存（対不正検証 + アテンプト保存 + playCount + リーダーボード）
CREATE OR REPLACE FUNCTION handle_save_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_mode TEXT,
  p_score INTEGER,
  p_total_questions INTEGER,
  p_elapsed_seconds NUMERIC,
  p_failed_question_ids UUID[],
  p_question_answers JSONB,
  p_question_answer_details JSONB
) RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
  v_author_id UUID;
  v_display_name TEXT;
  v_actual_total INTEGER;
  v_invalid_count INTEGER;
  v_prior_completed_count INTEGER;
  v_board TEXT;
BEGIN
  SELECT author_id INTO v_author_id FROM quizzes WHERE id = p_quiz_id;
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION 'クイズが見つかりません: %', p_quiz_id;
  END IF;

  -- 表示名はクライアント供給値を信用せず、サーバー側で導出する（なりすまし防止）
  SELECT COALESCE(display_name, '名無しさん') INTO v_display_name FROM users WHERE id = p_user_id;

  SELECT COUNT(*) INTO v_actual_total FROM quiz_questions WHERE quiz_id = p_quiz_id;
  IF p_mode NOT IN ('my-quiz', 'question-list', 'list') AND p_total_questions <> v_actual_total THEN
    RAISE EXCEPTION '問題数が一致しません';
  END IF;

  SELECT COUNT(*) INTO v_invalid_count
  FROM unnest(p_failed_question_ids) AS fid
  WHERE NOT EXISTS (SELECT 1 FROM quiz_questions WHERE quiz_id = p_quiz_id AND question_id = fid);
  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION '不正な問題IDが含まれています';
  END IF;

  INSERT INTO attempts (
    user_id, quiz_id, mode, score, total_questions, elapsed_seconds,
    failed_question_ids, question_answers, question_answer_details, completed_at
  ) VALUES (
    p_user_id, p_quiz_id, p_mode, p_score, p_total_questions, p_elapsed_seconds,
    p_failed_question_ids, p_question_answers, p_question_answer_details, now()
  ) RETURNING id INTO v_attempt_id;

  UPDATE quizzes SET play_count = play_count + 1, updated_at = now() WHERE id = p_quiz_id;

  IF p_mode NOT IN ('test-play', 'exam', 'flashcard') AND p_user_id <> v_author_id THEN
    SELECT COUNT(*) INTO v_prior_completed_count
    FROM attempts
    WHERE user_id = p_user_id AND quiz_id = p_quiz_id AND completed_at IS NOT NULL AND id <> v_attempt_id;

    v_board := CASE WHEN v_prior_completed_count = 0 THEN 'first_play' ELSE 'replay' END;
    PERFORM record_leaderboard_entry(p_quiz_id, p_user_id, v_display_name, p_score, p_elapsed_seconds, v_board);
  END IF;

  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 水平思考クイズ: 進行中セッション開始
CREATE OR REPLACE FUNCTION handle_start_lateral_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_total_questions INTEGER,
  p_ai_turn_limit INTEGER
) RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  INSERT INTO attempts (
    user_id, quiz_id, mode, score, total_questions, elapsed_seconds,
    ai_turn_count, ai_turn_limit, completed_at
  ) VALUES (
    p_user_id, p_quiz_id, 'normal', 0, p_total_questions, 0, 0, p_ai_turn_limit, NULL
  ) RETURNING id INTO v_attempt_id;
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 水平思考クイズ: AI対話ターンのアトミックな記録（日次カウンタのレース是正 + 上限のアトミックな強制）
-- p_per_quiz_limit / p_global_limit に NULL を渡すと無制限（Pro等の hasUnlimitedAiQuestions 相当）として扱う
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
  v_per_quiz INTEGER;
  v_global INTEGER;
BEGIN
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

  INSERT INTO ai_turn_counts_global (user_id, count, count_date)
  VALUES (p_user_id, 1, v_today)
  ON CONFLICT (user_id) DO UPDATE
  SET count = CASE WHEN ai_turn_counts_global.count_date = v_today THEN ai_turn_counts_global.count + 1 ELSE 1 END,
      count_date = v_today
  RETURNING count INTO v_global;

  IF p_global_limit IS NOT NULL AND v_global > p_global_limit THEN
    RAISE EXCEPTION 'global-limit-exceeded';
  END IF;

  UPDATE attempts
  SET ai_questions_history = ai_questions_history || p_history_entry,
      ai_turn_count = ai_turn_count + 1
  WHERE id = p_attempt_id;

  RETURN QUERY SELECT v_per_quiz, v_global;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 水平思考クイズ: 真相判定結果の記録（合格時のみ完了・リーダーボード反映）
CREATE OR REPLACE FUNCTION handle_complete_lateral_attempt(
  p_attempt_id UUID,
  p_user_id UUID,
  p_quiz_id UUID,
  p_is_correct BOOLEAN,
  p_truth_attempt JSONB,
  p_elapsed_seconds NUMERIC,
  p_total_questions INTEGER
) RETURNS VOID AS $$
DECLARE
  v_author_id UUID;
  v_display_name TEXT;
  v_prior_completed_count INTEGER;
  v_board TEXT;
BEGIN
  UPDATE attempts
  SET ai_truth_attempts = ai_truth_attempts || p_truth_attempt
  WHERE id = p_attempt_id AND completed_at IS NULL;

  IF NOT p_is_correct THEN
    RETURN;
  END IF;

  UPDATE attempts
  SET completed_at = now(), score = p_total_questions, failed_question_ids = '{}',
      elapsed_seconds = p_elapsed_seconds
  WHERE id = p_attempt_id;

  SELECT author_id INTO v_author_id FROM quizzes WHERE id = p_quiz_id;
  UPDATE quizzes SET play_count = play_count + 1, updated_at = now() WHERE id = p_quiz_id;

  IF p_user_id <> v_author_id THEN
    -- 表示名はクライアント供給値を信用せず、サーバー側で導出する（なりすまし防止）
    SELECT COALESCE(display_name, '名無しさん') INTO v_display_name FROM users WHERE id = p_user_id;

    SELECT COUNT(*) INTO v_prior_completed_count
    FROM attempts
    WHERE user_id = p_user_id AND quiz_id = p_quiz_id AND completed_at IS NOT NULL AND id <> p_attempt_id;

    v_board := CASE WHEN v_prior_completed_count = 0 THEN 'first_play' ELSE 'replay' END;
    PERFORM record_leaderboard_entry(p_quiz_id, p_user_id, v_display_name, p_total_questions, p_elapsed_seconds, v_board);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 水平思考クイズ: 諦め（ギブアップ）
CREATE OR REPLACE FUNCTION handle_give_up_lateral_attempt(
  p_attempt_id UUID,
  p_quiz_id UUID,
  p_elapsed_seconds NUMERIC
) RETURNS VOID AS $$
DECLARE
  v_already_completed BOOLEAN;
BEGIN
  SELECT completed_at IS NOT NULL INTO v_already_completed FROM attempts WHERE id = p_attempt_id;
  IF v_already_completed THEN
    RAISE EXCEPTION 'already-completed';
  END IF;

  UPDATE attempts
  SET completed_at = now(), score = 0, gave_up_lateral = TRUE, elapsed_seconds = p_elapsed_seconds
  WHERE id = p_attempt_id;

  UPDATE quizzes SET play_count = play_count + 1, updated_at = now() WHERE id = p_quiz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: レビュー・評価・リアクション関連（Task 1.3）
-- ==========================================

-- レビュー投稿（良問/悪問の二値投票）
CREATE OR REPLACE FUNCTION handle_submit_review(
  p_reviewer_id UUID,
  p_quiz_id UUID,
  p_type TEXT,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_old_type TEXT;
  v_positive INTEGER;
  v_negative INTEGER;
BEGIN
  SELECT type INTO v_old_type FROM quiz_reviews WHERE reviewer_id = p_reviewer_id AND quiz_id = p_quiz_id;

  IF v_old_type IS NOT NULL AND v_old_type = p_type THEN
    RETURN; -- 同一票の再送信は無視
  END IF;

  INSERT INTO quiz_reviews (reviewer_id, quiz_id, type, reason, updated_at)
  VALUES (p_reviewer_id, p_quiz_id, p_type, p_reason, now())
  ON CONFLICT (reviewer_id, quiz_id) DO UPDATE
  SET type = p_type, reason = p_reason, updated_at = now();

  UPDATE quizzes SET
    positive_count = positive_count
      + CASE WHEN p_type = 'positive' THEN 1 ELSE 0 END
      - CASE WHEN v_old_type = 'positive' THEN 1 ELSE 0 END,
    negative_count = negative_count
      + CASE WHEN p_type = 'negative' THEN 1 ELSE 0 END
      - CASE WHEN v_old_type = 'negative' THEN 1 ELSE 0 END
  WHERE id = p_quiz_id
  RETURNING positive_count, negative_count INTO v_positive, v_negative;

  UPDATE quizzes SET
    review_score = CASE WHEN v_positive + v_negative = 0 THEN NULL ELSE v_positive::NUMERIC / (v_positive + v_negative) END,
    updated_at = now()
  WHERE id = p_quiz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- レビュー取消
CREATE OR REPLACE FUNCTION handle_retract_review(
  p_reviewer_id UUID,
  p_quiz_id UUID
) RETURNS VOID AS $$
DECLARE
  v_type TEXT;
  v_positive INTEGER;
  v_negative INTEGER;
BEGIN
  DELETE FROM quiz_reviews WHERE reviewer_id = p_reviewer_id AND quiz_id = p_quiz_id RETURNING type INTO v_type;
  IF v_type IS NULL THEN
    RETURN;
  END IF;

  UPDATE quizzes SET
    positive_count = GREATEST(0, positive_count - CASE WHEN v_type = 'positive' THEN 1 ELSE 0 END),
    negative_count = GREATEST(0, negative_count - CASE WHEN v_type = 'negative' THEN 1 ELSE 0 END)
  WHERE id = p_quiz_id
  RETURNING positive_count, negative_count INTO v_positive, v_negative;

  UPDATE quizzes SET
    review_score = CASE WHEN v_positive + v_negative = 0 THEN NULL ELSE v_positive::NUMERIC / (v_positive + v_negative) END,
    updated_at = now()
  WHERE id = p_quiz_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 難易度星投票
CREATE OR REPLACE FUNCTION handle_submit_difficulty_vote(
  p_quiz_id UUID,
  p_user_id UUID,
  p_vote INTEGER
) RETURNS VOID AS $$
DECLARE
  v_old_vote INTEGER;
BEGIN
  IF p_vote < 1 OR p_vote > 5 THEN
    RAISE EXCEPTION '評価は1から5の範囲で指定してください';
  END IF;

  IF p_user_id IS NOT NULL THEN
    SELECT vote INTO v_old_vote FROM difficulty_votes WHERE user_id = p_user_id AND quiz_id = p_quiz_id;

    INSERT INTO difficulty_votes (user_id, quiz_id, vote, updated_at)
    VALUES (p_user_id, p_quiz_id, p_vote, now())
    ON CONFLICT (user_id, quiz_id) WHERE user_id IS NOT NULL DO UPDATE
    SET vote = p_vote, updated_at = now();

    IF v_old_vote IS NULL THEN
      UPDATE quizzes SET difficulty_votes_sum = difficulty_votes_sum + p_vote,
                          difficulty_votes_count = difficulty_votes_count + 1
      WHERE id = p_quiz_id;
    ELSE
      UPDATE quizzes SET difficulty_votes_sum = difficulty_votes_sum + (p_vote - v_old_vote)
      WHERE id = p_quiz_id;
    END IF;
  ELSE
    INSERT INTO difficulty_votes (user_id, quiz_id, vote) VALUES (NULL, p_quiz_id, p_vote);
    UPDATE quizzes SET difficulty_votes_sum = difficulty_votes_sum + p_vote,
                        difficulty_votes_count = difficulty_votes_count + 1
    WHERE id = p_quiz_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- いいねトグル
CREATE OR REPLACE FUNCTION handle_toggle_reaction(
  p_sender_id UUID,
  p_quiz_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_receiver_id UUID;
  v_exists BOOLEAN;
BEGIN
  -- 受信者（クイズ作成者）はクライアント供給値を信用せず、サーバー側で導出する（なりすまし防止）
  SELECT author_id INTO v_receiver_id FROM quizzes WHERE id = p_quiz_id;
  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'クイズが見つかりません: %', p_quiz_id;
  END IF;

  IF p_sender_id = v_receiver_id THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM reactions WHERE sender_id = p_sender_id AND quiz_id = p_quiz_id AND type = 'like'
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM reactions WHERE sender_id = p_sender_id AND quiz_id = p_quiz_id AND type = 'like';
    UPDATE quizzes SET likes_count = GREATEST(0, likes_count - 1) WHERE id = p_quiz_id;
    UPDATE users SET total_reactions_count = GREATEST(0, total_reactions_count - 1) WHERE id = v_receiver_id;
    RETURN FALSE;
  ELSE
    INSERT INTO reactions (sender_id, receiver_id, quiz_id, type) VALUES (p_sender_id, v_receiver_id, p_quiz_id, 'like');
    UPDATE quizzes SET likes_count = likes_count + 1 WHERE id = p_quiz_id;
    UPDATE users SET total_reactions_count = total_reactions_count + 1 WHERE id = v_receiver_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
