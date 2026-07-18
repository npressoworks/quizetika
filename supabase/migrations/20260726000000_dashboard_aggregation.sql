-- dashboard-aggregation: リッチダッシュボード向け集計データ提供と試行ライフサイクル記録（Phase 44）
-- 本ファイルは試行ライフサイクル基盤（Task 31.1）を定義する。
-- 集計 RPC 群（get_player_dashboard_stats 等）は後続タスク（Task 31.2 / 31.3）で本ファイル末尾に追記する。

-- ==========================================
-- === Phase 44: attempt lifecycle（Task 31.1）===
-- ==========================================

-- attempts: 開始時刻・進行位置の列を追加する
-- started_at が NULL の行はライフサイクル記録導入前の世代（完了時のみ記録）を表し、
-- 完走率・離脱分析の母集団から自然に除外される（要件 40.10 / 41.4）
ALTER TABLE attempts ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE attempts ADD COLUMN answered_count INTEGER DEFAULT 0;

-- クリエイター側の期間集計用（クイズ×完了日時）
CREATE INDEX idx_attempts_quiz_completed ON attempts(quiz_id, completed_at);

-- 複数問一括モード（normal / exam / flashcard / review）の開始記録（要件 39.1 / 39.10）
-- my-quiz は1問単位契約（Phase 23）のため対象外、test-play は非永続のため対象外。
-- SECURITY INVOKER: attempts_all RLS（本人行のみ）が INSERT を制限するため、
-- p_user_id のなりすましは RLS 違反として拒否される。
CREATE OR REPLACE FUNCTION handle_start_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_mode TEXT,
  p_total_questions INTEGER
) RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
BEGIN
  IF p_mode NOT IN ('normal', 'exam', 'flashcard', 'review') THEN
    RAISE EXCEPTION 'ライフサイクル記録の対象外モードです: %', p_mode;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quizzes WHERE id = p_quiz_id) THEN
    RAISE EXCEPTION 'クイズが見つかりません: %', p_quiz_id;
  END IF;

  INSERT INTO attempts (
    user_id, quiz_id, mode, score, total_questions, elapsed_seconds,
    started_at, answered_count, completed_at
  ) VALUES (
    p_user_id, p_quiz_id, p_mode, 0, p_total_questions, 0,
    now(), 0, NULL
  ) RETURNING id INTO v_attempt_id;

  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 進行位置の反映（要件 39.3）
-- 本人の未完了行のみを対象とする（SECURITY INVOKER + attempts_all RLS）。
-- answered_count は単調増加（GREATEST）かつ 0..total_questions に収める。
-- 該当行がない場合は何もしない（fire-and-forget 前提、要件 39.9）。
CREATE OR REPLACE FUNCTION handle_update_attempt_progress(
  p_attempt_id UUID,
  p_answered_count INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE attempts
  SET answered_count = GREATEST(
        COALESCE(answered_count, 0),
        LEAST(GREATEST(COALESCE(p_answered_count, 0), 0), total_questions)
      )
  WHERE id = p_attempt_id AND completed_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 通常クイズ完了の保存に後方互換の p_attempt_id を追加する（要件 39.2 / 39.5 / 39.6）
-- p_attempt_id 指定時は開始時に記録した同一行を完了状態へ UPDATE し、
-- 未指定・該当行なし（オフライン同期等）は従来どおり INSERT する。
-- 既存の二重検証・リーダーボード振り分け・プレイ数加算は両パスで維持する。
-- パラメータ追加によりシグネチャが変わるため、旧関数を先に DROP する。
DROP FUNCTION handle_save_attempt(UUID, UUID, TEXT, INTEGER, INTEGER, NUMERIC, UUID[], JSONB, JSONB);

CREATE FUNCTION handle_save_attempt(
  p_user_id UUID,
  p_quiz_id UUID,
  p_mode TEXT,
  p_score INTEGER,
  p_total_questions INTEGER,
  p_elapsed_seconds NUMERIC,
  p_failed_question_ids UUID[],
  p_question_answers JSONB,
  p_question_answer_details JSONB,
  p_attempt_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_attempt_id UUID;
  v_author_id UUID;
  v_display_name TEXT;
  v_actual_total INTEGER;
  v_invalid_count INTEGER;
  v_prior_completed_count INTEGER;
  v_board TEXT;
  v_lifecycle_mode BOOLEAN;
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

  v_lifecycle_mode := p_mode IN ('normal', 'exam', 'flashcard', 'review');

  -- 開始時に記録した本人の未完了行があれば、その行を完了状態へ更新する（要件 39.2 / 39.5）
  IF p_attempt_id IS NOT NULL THEN
    UPDATE attempts
    SET mode = p_mode,
        score = p_score,
        total_questions = p_total_questions,
        elapsed_seconds = p_elapsed_seconds,
        failed_question_ids = p_failed_question_ids,
        question_answers = p_question_answers,
        question_answer_details = p_question_answer_details,
        answered_count = p_total_questions,
        completed_at = now()
    WHERE id = p_attempt_id AND user_id = p_user_id AND quiz_id = p_quiz_id AND completed_at IS NULL
    RETURNING id INTO v_attempt_id;
  END IF;

  -- 未指定・該当行なしは従来どおり新規挿入（後方互換・オフライン同期、要件 39.6）
  -- ライフサイクル対象モードは started_at = completed_at として開始と完了が揃った試行に数える
  IF v_attempt_id IS NULL THEN
    INSERT INTO attempts (
      user_id, quiz_id, mode, score, total_questions, elapsed_seconds,
      failed_question_ids, question_answers, question_answer_details,
      started_at, answered_count, completed_at
    ) VALUES (
      p_user_id, p_quiz_id, p_mode, p_score, p_total_questions, p_elapsed_seconds,
      p_failed_question_ids, p_question_answers, p_question_answer_details,
      CASE WHEN v_lifecycle_mode THEN now() ELSE NULL END,
      CASE WHEN v_lifecycle_mode THEN p_total_questions ELSE 0 END,
      now()
    ) RETURNING id INTO v_attempt_id;
  END IF;

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

-- 水平思考クイズ: 進行中セッション開始に started_at の設定を追加する（要件 39.7）
-- 既存の開始時レコードをライフサイクル記録と同一規則で完走率集計に統合可能にする
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
    ai_turn_count, ai_turn_limit, started_at, completed_at
  ) VALUES (
    p_user_id, p_quiz_id, 'normal', 0, p_total_questions, 0, 0, p_ai_turn_limit, now(), NULL
  ) RETURNING id INTO v_attempt_id;
  RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- === get_player_dashboard_stats (Task 31.2) ===
-- =============================================
CREATE OR REPLACE FUNCTION get_player_dashboard_stats(
  p_period TEXT,
  p_genre_id UUID DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_question_type TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_today DATE;
  v_min_date DATE;
  v_kpi JSONB;
  v_trend JSONB;
  v_genre_breakdown JSONB;
  v_tag_breakdown JSONB;
  v_mode_breakdown JSONB;
  v_format_breakdown JSONB;
  v_strengths JSONB;
  v_weaknesses JSONB;
  v_tag_cloud JSONB;
  v_title_stats JSONB;
  v_streak_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未認証の呼び出しです';
  END IF;

  v_today := (timezone('Asia/Tokyo', now()))::date;

  -- 期間の設定 (JST基準)
  IF p_period = '7d' THEN
    v_min_date := v_today - 6;
  ELSIF p_period = '30d' THEN
    v_min_date := v_today - 29;
  ELSIF p_period = '90d' THEN
    v_min_date := v_today - 89;
  ELSIF p_period = 'all' THEN
    v_min_date := '1970-01-01'::date;
  ELSE
    RAISE EXCEPTION '無効な期間指定です: %', p_period;
  END IF;

  -- ストリークの計算
  DECLARE
    v_date DATE;
    v_expected_date DATE;
    v_c RECORD;
  BEGIN
    v_streak_days := 0;
    v_expected_date := v_today;
    
    FOR v_c IN 
      SELECT DISTINCT (timezone('Asia/Tokyo', a.completed_at))::date AS play_date
      FROM attempts a
      LEFT JOIN quizzes q ON a.quiz_id = q.id
      WHERE a.user_id = v_user_id
        AND a.completed_at IS NOT NULL
        AND a.mode <> 'test-play'
        -- フィルタ適用後の母集団でストリークを算出
        AND (p_mode IS NULL OR a.mode = p_mode)
        AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
        AND (p_tag IS NULL OR p_tag = ANY(q.tags))
        AND (p_question_type IS NULL OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
          WHERE d->>'questionType' = p_question_type
        ))
      ORDER BY play_date DESC
    LOOP
      v_date := v_c.play_date;
      
      -- 最初の要素が今日でも昨日でもない場合、ストリークは0
      IF v_streak_days = 0 AND v_date < v_today - 1 THEN
        EXIT;
      END IF;
      
      IF v_streak_days = 0 THEN
        v_streak_days := 1;
        v_expected_date := v_date - 1;
      ELSIF v_date = v_expected_date THEN
        v_streak_days := v_streak_days + 1;
        v_expected_date := v_date - 1;
      ELSIF v_date < v_expected_date THEN
        EXIT;
      END IF;
    END LOOP;
  END;

  -- 1. KPI の算出
  SELECT json_build_object(
    'totalPlays', COUNT(a.id),
    'averageAccuracy', CASE 
      WHEN p_question_type IS NOT NULL THEN
        COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), 0)
      ELSE
        COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), 0)
      END,
    'averageTimeSeconds', CASE
      WHEN p_question_type IS NOT NULL THEN
        COALESCE(ROUND(AVG((SELECT AVG((d->>'elapsedSeconds')::numeric) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type))), 0)
      ELSE
        COALESCE(ROUND(AVG(a.elapsed_seconds)), 0)
      END,
    'totalTimeSeconds', CASE
      WHEN p_question_type IS NOT NULL THEN
        COALESCE(ROUND(SUM((SELECT SUM((d->>'elapsedSeconds')::numeric) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type))), 0)
      ELSE
        COALESCE(ROUND(SUM(a.elapsed_seconds)), 0)
      END,
    'uniqueQuizCount', COUNT(DISTINCT a.quiz_id),
    'streakDays', v_streak_days
  ) INTO v_kpi
  FROM attempts a
  LEFT JOIN quizzes q ON a.quiz_id = q.id
  WHERE a.user_id = v_user_id
    AND a.completed_at IS NOT NULL
    AND a.mode <> 'test-play'
    AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
    AND (p_mode IS NULL OR a.mode = p_mode)
    AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
    AND (p_tag IS NULL OR p_tag = ANY(q.tags))
    AND (p_question_type IS NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
      WHERE d->>'questionType' = p_question_type
    ));

  -- 2. トレンドデータの算出
  IF p_period IN ('7d', '30d') THEN
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'FMMM/FMDD') AS label,
        COUNT(a.id) AS plays,
        CASE 
          WHEN p_question_type IS NOT NULL THEN
            COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), NULL)
          ELSE
            COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), NULL)
          END AS accuracy
      FROM generate_series(v_min_date, v_today, '1 day'::interval) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.tags
        FROM attempts a_sub
        LEFT JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE a_sub.user_id = v_user_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_mode IS NULL OR a_sub.mode = p_mode)
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = p_genre_id)
          AND (p_tag IS NULL OR p_tag = ANY(q_sub.tags))
          AND (p_question_type IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(a_sub.question_answer_details) AS d 
            WHERE d->>'questionType' = p_question_type
          ))
      ) a ON (timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  ELSIF p_period = '90d' THEN
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'YYYY-MM-DD') AS label,
        COUNT(a.id) AS plays,
        CASE 
          WHEN p_question_type IS NOT NULL THEN
            COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), NULL)
          ELSE
            COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), NULL)
          END AS accuracy
      FROM generate_series(date_trunc('week', v_min_date)::date, date_trunc('week', v_today)::date, '1 week'::interval) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.tags
        FROM attempts a_sub
        LEFT JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE a_sub.user_id = v_user_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_mode IS NULL OR a_sub.mode = p_mode)
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = p_genre_id)
          AND (p_tag IS NULL OR p_tag = ANY(q_sub.tags))
          AND (p_question_type IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(a_sub.question_answer_details) AS d 
            WHERE d->>'questionType' = p_question_type
          ))
      ) a ON date_trunc('week', timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  ELSE -- all
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'YYYY-MM') AS label,
        COUNT(a.id) AS plays,
        CASE 
          WHEN p_question_type IS NOT NULL THEN
            COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), NULL)
          ELSE
            COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), NULL)
          END AS accuracy
      FROM generate_series(
        COALESCE(
          (SELECT date_trunc('month', MIN(timezone('Asia/Tokyo', a_min.completed_at)))::date 
           FROM attempts a_min 
           WHERE a_min.user_id = v_user_id AND a_min.completed_at IS NOT NULL AND a_min.mode <> 'test-play'), 
          date_trunc('month', v_today)::date
        ), 
        date_trunc('month', v_today)::date, 
        '1 month'::interval
      ) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.tags
        FROM attempts a_sub
        LEFT JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE a_sub.user_id = v_user_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_mode IS NULL OR a_sub.mode = p_mode)
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = p_genre_id)
          AND (p_tag IS NULL OR p_tag = ANY(q_sub.tags))
          AND (p_question_type IS NULL OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(a_sub.question_answer_details) AS d 
            WHERE d->>'questionType' = p_question_type
          ))
      ) a ON date_trunc('month', timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  END IF;

  v_trend := COALESCE(v_trend, '[]'::jsonb);

  -- 3. 内訳データの算出
  -- 3.1 ジャンル別内訳
  SELECT json_agg(t) INTO v_genre_breakdown
  FROM (
    SELECT 
      q.canonical_genre_id AS key,
      COUNT(a.id) AS plays,
      CASE 
        WHEN p_question_type IS NOT NULL THEN
          COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), 0)
        ELSE
          COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), 0)
        END AS accuracy
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND q.canonical_genre_id IS NOT NULL
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
    GROUP BY q.canonical_genre_id
    ORDER BY plays DESC, key ASC
  ) t;
  v_genre_breakdown := COALESCE(v_genre_breakdown, '[]'::jsonb);

  -- 3.2 タグ別内訳
  SELECT json_agg(t) INTO v_tag_breakdown
  FROM (
    SELECT 
      unnested_tag AS key,
      COUNT(a.id) AS plays,
      CASE 
        WHEN p_question_type IS NOT NULL THEN
          COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), 0)
        ELSE
          COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), 0)
        END AS accuracy
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id,
    LATERAL unnest(q.tags) AS unnested_tag
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND unnested_tag <> ''
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
    GROUP BY unnested_tag
    ORDER BY plays DESC, key ASC
  ) t;
  v_tag_breakdown := COALESCE(v_tag_breakdown, '[]'::jsonb);

  -- 3.3 モード別内訳
  SELECT json_agg(t) INTO v_mode_breakdown
  FROM (
    SELECT 
      a.mode AS key,
      COUNT(a.id) AS plays,
      CASE 
        WHEN p_question_type IS NOT NULL THEN
          COALESCE(ROUND(100.0 * SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type AND (d->>'isCorrect')::boolean)) / NULLIF(SUM((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE d->>'questionType' = p_question_type)), 0)), 0)
        ELSE
          COALESCE(ROUND(100.0 * SUM(COALESCE((SELECT COUNT(*) FROM jsonb_array_elements(a.question_answer_details) AS d WHERE (d->>'isCorrect')::boolean), a.score)) / NULLIF(SUM(COALESCE(jsonb_array_length(a.question_answer_details), a.total_questions)), 0)), 0)
        END AS accuracy
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
    GROUP BY a.mode
    ORDER BY plays DESC, key ASC
  ) t;
  v_mode_breakdown := COALESCE(v_mode_breakdown, '[]'::jsonb);

  -- 3.4 設問形式別内訳
  SELECT json_agg(t) INTO v_format_breakdown
  FROM (
    SELECT 
      d.key AS key,
      COUNT(DISTINCT a.id) AS plays,
      COALESCE(ROUND(100.0 * COUNT(CASE WHEN d.is_correct THEN 1 END) / NULLIF(COUNT(*), 0)), 0) AS accuracy
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id,
    LATERAL (
      SELECT 
        (detail->>'questionType') AS key,
        (detail->>'isCorrect')::boolean AS is_correct
      FROM jsonb_array_elements(a.question_answer_details) AS detail
    ) d
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR d.key = p_question_type)
    GROUP BY d.key
    ORDER BY plays DESC, key ASC
  ) t;
  v_format_breakdown := COALESCE(v_format_breakdown, '[]'::jsonb);

  -- 4. 得意・苦手ジャンルの算出 (母数3件以上)
  SELECT json_agg(t) INTO v_strengths
  FROM (
    SELECT * 
    FROM jsonb_to_recordset(v_genre_breakdown) AS x(key TEXT, plays INTEGER, accuracy INTEGER)
    WHERE plays >= 3
    ORDER BY accuracy DESC, plays DESC, key ASC
    LIMIT 5
  ) t;
  v_strengths := COALESCE(v_strengths, '[]'::jsonb);

  SELECT json_agg(t) INTO v_weaknesses
  FROM (
    SELECT * 
    FROM jsonb_to_recordset(v_genre_breakdown) AS x(key TEXT, plays INTEGER, accuracy INTEGER)
    WHERE plays >= 3
    ORDER BY accuracy ASC, plays DESC, key ASC
    LIMIT 5
  ) t;
  v_weaknesses := COALESCE(v_weaknesses, '[]'::jsonb);

  -- 5. ワードクラウドタグデータ
  SELECT json_agg(t) INTO v_tag_cloud
  FROM (
    SELECT 
      unnested_tag AS text,
      COUNT(DISTINCT a.id) AS plays,
      SUM(a.score) AS correct,
      SUM(a.total_questions) AS total
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id,
    LATERAL unnest(q.tags) AS unnested_tag
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND unnested_tag <> ''
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
    GROUP BY unnested_tag
    ORDER BY plays DESC, text ASC
    LIMIT 30
  ) t;
  v_tag_cloud := COALESCE(v_tag_cloud, '[]'::jsonb);

  -- 6. クイズタイトル別集計
  SELECT json_agg(t) INTO v_title_stats
  FROM (
    SELECT 
      q.title AS title,
      COUNT(a.id) AS plays,
      SUM(a.score) AS correct,
      SUM(a.total_questions) AS total
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
    GROUP BY q.title
    ORDER BY plays DESC, title ASC
    LIMIT 30
  ) t;
  v_title_stats := COALESCE(v_title_stats, '[]'::jsonb);

  RETURN json_build_object(
    'kpi', v_kpi,
    'trend', v_trend,
    'genreBreakdown', v_genre_breakdown,
    'tagBreakdown', v_tag_breakdown,
    'modeBreakdown', v_mode_breakdown,
    'formatBreakdown', v_format_breakdown,
    'strengths', v_strengths,
    'weaknesses', v_weaknesses,
    'tagCloud', v_tag_cloud,
    'titleStats', v_title_stats
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ===================================================
-- === get_player_drilldown_history (Task 31.2) ===
-- ===================================================
CREATE OR REPLACE FUNCTION get_player_drilldown_history(
  p_period TEXT,
  p_genre_id UUID DEFAULT NULL,
  p_tag TEXT DEFAULT NULL,
  p_question_type TEXT DEFAULT NULL,
  p_mode TEXT DEFAULT NULL,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_today DATE;
  v_min_date DATE;
  v_items JSONB;
  v_next_cursor TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '未認証の呼び出しです';
  END IF;

  v_today := (timezone('Asia/Tokyo', now()))::date;

  IF p_period = '7d' THEN
    v_min_date := v_today - 6;
  ELSIF p_period = '30d' THEN
    v_min_date := v_today - 29;
  ELSIF p_period = '90d' THEN
    v_min_date := v_today - 89;
  ELSIF p_period = 'all' THEN
    v_min_date := '1970-01-01'::date;
  ELSE
    RAISE EXCEPTION '無効な期間指定です: %', p_period;
  END IF;

  SELECT json_agg(t) INTO v_items
  FROM (
    SELECT 
      a.id::text AS id,
      a.quiz_id::text AS "quizId",
      q.title AS "quizTitle",
      a.score AS score,
      a.total_questions AS "totalQuestions",
      a.mode AS mode,
      to_char(timezone('UTC', a.completed_at), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS "completedAt",
      a.elapsed_seconds AS "elapsedSeconds"
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE a.user_id = v_user_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_mode IS NULL OR a.mode = p_mode)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_tag IS NULL OR p_tag = ANY(q.tags))
      AND (p_question_type IS NULL OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(a.question_answer_details) AS d 
        WHERE d->>'questionType' = p_question_type
      ))
      AND (p_cursor IS NULL OR a.completed_at < p_cursor)
    ORDER BY a.completed_at DESC, a.id DESC
    LIMIT p_limit + 1
  ) t;

  v_items := COALESCE(v_items, '[]'::jsonb);

  IF jsonb_array_length(v_items) > p_limit THEN
    v_next_cursor := (v_items->p_limit->>'completedAt')::timestamptz;
    
    SELECT jsonb_agg(value) INTO v_items
    FROM jsonb_array_elements(v_items) WITH ORDINALITY
    WHERE ordinality <= p_limit;
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN json_build_object(
    'items', v_items,
    'nextCursor', to_char(timezone('UTC', v_next_cursor), 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"')
  );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ====================================================
-- === get_creator_dashboard_stats (Task 31.3) ===
-- ====================================================
CREATE OR REPLACE FUNCTION get_creator_dashboard_stats(
  p_period TEXT,
  p_genre_id UUID DEFAULT NULL,
  p_format TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_author_id UUID;
  v_today DATE;
  v_min_date DATE;
  v_kpi JSONB;
  v_trend JSONB;
  v_quiz_ranking JSONB;
  v_format_breakdown JSONB;
BEGIN
  v_author_id := auth.uid();
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION '未認証の呼び出しです';
  END IF;

  v_today := (timezone('Asia/Tokyo', now()))::date;

  IF p_period = '7d' THEN
    v_min_date := v_today - 6;
  ELSIF p_period = '30d' THEN
    v_min_date := v_today - 29;
  ELSIF p_period = '90d' THEN
    v_min_date := v_today - 89;
  ELSIF p_period = 'all' THEN
    v_min_date := '1970-01-01'::date;
  ELSE
    RAISE EXCEPTION '無効な期間指定です: %', p_period;
  END IF;

  -- 1. KPI の算出
  SELECT json_build_object(
    'plays', COUNT(a.id),
    'uniquePlayers', COUNT(DISTINCT a.user_id),
    'bookmarksGained', COALESCE((
      SELECT COUNT(*) FROM bookmarks bm
      WHERE bm.target_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
        AND bm.target_type = 'quiz'
        AND (p_period = 'all' OR (timezone('Asia/Tokyo', bm.created_at))::date >= v_min_date)
    ), 0),
    'reviewsGained', COALESCE((
      SELECT COUNT(*) FROM quiz_reviews r
      WHERE r.quiz_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
        AND (p_period = 'all' OR (timezone('Asia/Tokyo', r.created_at))::date >= v_min_date)
    ), 0),
    'averageRating', (
      SELECT ROUND(AVG(r.rating)::numeric, 1) FROM quiz_reviews r
      WHERE r.quiz_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
        AND (p_period = 'all' OR (timezone('Asia/Tokyo', r.created_at))::date >= v_min_date)
    ),
    'completionRate', COALESCE(ROUND(100.0 * COUNT(CASE WHEN a.completed_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(CASE WHEN a.started_at IS NOT NULL THEN 1 END), 0)), NULL),
    'lifecycleSampleSize', COUNT(CASE WHEN a.started_at IS NOT NULL THEN 1 END)
  ) INTO v_kpi
  FROM attempts a
  JOIN quizzes q ON a.quiz_id = q.id
  WHERE q.author_id = v_author_id
    AND a.completed_at IS NOT NULL
    AND a.mode <> 'test-play'
    AND a.mode IN ('normal', 'exam', 'flashcard', 'review')
    AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
    AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
    AND (p_format IS NULL OR q.format = p_format)
    AND (p_visibility IS NULL OR COALESCE(q.visibility, 'public') = p_visibility);

  -- 2. トレンドデータの算出
  IF p_period IN ('7d', '30d') THEN
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'FMMM/FMDD') AS label,
        COUNT(DISTINCT a.id) AS plays,
        COALESCE((
          SELECT COUNT(*) FROM bookmarks bm
          WHERE bm.target_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND bm.target_type = 'quiz'
            AND (timezone('Asia/Tokyo', bm.created_at))::date = g.dt::date
        ), 0) AS bookmarks,
        COALESCE((
          SELECT COUNT(*) FROM quiz_reviews r
          WHERE r.quiz_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND (timezone('Asia/Tokyo', r.created_at))::date = g.dt::date
        ), 0) AS reviews
      FROM generate_series(v_min_date, v_today, '1 day'::interval) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.format, q_sub.visibility
        FROM attempts a_sub
        JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE q_sub.author_id = v_author_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = p_genre_id)
          AND (p_format IS NULL OR q_sub.format = p_format)
          AND (p_visibility IS NULL OR COALESCE(q_sub.visibility, 'public') = p_visibility)
      ) a ON (timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  ELSIF p_period = '90d' THEN
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'YYYY-MM-DD') AS label,
        COUNT(DISTINCT a.id) AS plays,
        COALESCE((
          SELECT COUNT(*) FROM bookmarks bm
          WHERE bm.target_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND bm.target_type = 'quiz'
            AND date_trunc('week', timezone('Asia/Tokyo', bm.created_at))::date = g.dt::date
        ), 0) AS bookmarks,
        COALESCE((
          SELECT COUNT(*) FROM quiz_reviews r
          WHERE r.quiz_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND date_trunc('week', timezone('Asia/Tokyo', r.created_at))::date = g.dt::date
        ), 0) AS reviews
      FROM generate_series(date_trunc('week', v_min_date)::date, date_trunc('week', v_today)::date, '1 week'::interval) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.format, q_sub.visibility
        FROM attempts a_sub
        JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE q_sub.author_id = v_author_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = q_sub.id)
          AND (p_format IS NULL OR q_sub.format = p_format)
          AND (p_visibility IS NULL OR COALESCE(q_sub.visibility, 'public') = p_visibility)
      ) a ON date_trunc('week', timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  ELSE -- all
    SELECT json_agg(t) INTO v_trend
    FROM (
      SELECT 
        to_char(g.dt, 'YYYY-MM') AS label,
        COUNT(DISTINCT a.id) AS plays,
        COALESCE((
          SELECT COUNT(*) FROM bookmarks bm
          WHERE bm.target_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND bm.target_type = 'quiz'
            AND date_trunc('month', timezone('Asia/Tokyo', bm.created_at))::date = g.dt::date
        ), 0) AS bookmarks,
        COALESCE((
          SELECT COUNT(*) FROM quiz_reviews r
          WHERE r.quiz_id IN (SELECT id FROM quizzes WHERE author_id = v_author_id)
            AND date_trunc('month', timezone('Asia/Tokyo', r.created_at))::date = g.dt::date
        ), 0) AS reviews
      FROM generate_series(
        COALESCE(
          (SELECT date_trunc('month', MIN(timezone('Asia/Tokyo', a_min.completed_at)))::date 
           FROM attempts a_min 
           JOIN quizzes q_min ON a_min.quiz_id = q_min.id
           WHERE q_min.author_id = v_author_id AND a_min.completed_at IS NOT NULL AND a_min.mode <> 'test-play'), 
          date_trunc('month', v_today)::date
        ), 
        date_trunc('month', v_today)::date, 
        '1 month'::interval
      ) AS g(dt)
      LEFT JOIN (
        SELECT a_sub.*, q_sub.canonical_genre_id, q_sub.format, q_sub.visibility
        FROM attempts a_sub
        JOIN quizzes q_sub ON a_sub.quiz_id = q_sub.id
        WHERE q_sub.author_id = v_author_id
          AND a_sub.completed_at IS NOT NULL
          AND a_sub.mode <> 'test-play'
          AND (p_genre_id IS NULL OR q_sub.canonical_genre_id = p_genre_id)
          AND (p_format IS NULL OR q_sub.format = p_format)
          AND (p_visibility IS NULL OR COALESCE(q_sub.visibility, 'public') = p_visibility)
      ) a ON date_trunc('month', timezone('Asia/Tokyo', a.completed_at))::date = g.dt::date
      GROUP BY g.dt
      ORDER BY g.dt
    ) t;
  END IF;

  v_trend := COALESCE(v_trend, '[]'::jsonb);

  -- 3. クイズ別ランキングの算出
  SELECT json_agg(t) INTO v_quiz_ranking
  FROM (
    SELECT 
      q.id::text AS "quizId",
      q.title AS title,
      COUNT(a.id) AS plays,
      COALESCE(ROUND(100.0 * SUM(COALESCE(a.score, 0)) / NULLIF(SUM(COALESCE(a.total_questions, 0)), 0)), 0) AS "averageAccuracy",
      COALESCE((
        SELECT COUNT(*) FROM bookmarks bm 
        WHERE bm.target_id = q.id AND bm.target_type = 'quiz'
          AND (p_period = 'all' OR (timezone('Asia/Tokyo', bm.created_at))::date >= v_min_date)
      ), 0) AS bookmarks,
      COALESCE((
        SELECT COUNT(*) FROM quiz_reviews r 
        WHERE r.quiz_id = q.id
          AND (p_period = 'all' OR (timezone('Asia/Tokyo', r.created_at))::date >= v_min_date)
      ), 0) AS reviews
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id
    WHERE q.author_id = v_author_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_format IS NULL OR q.format = p_format)
      AND (p_visibility IS NULL OR COALESCE(q.visibility, 'public') = p_visibility)
    GROUP BY q.id, q.title
    ORDER BY plays DESC, "quizId" ASC
    LIMIT 10
  ) t;
  v_quiz_ranking := COALESCE(v_quiz_ranking, '[]'::jsonb);

  -- 4. 設問形式別内訳の算出
  SELECT json_agg(t) INTO v_format_breakdown
  FROM (
    SELECT 
      d.key AS key,
      COUNT(DISTINCT a.id) AS plays,
      COALESCE(ROUND(100.0 * COUNT(CASE WHEN d.is_correct THEN 1 END) / NULLIF(COUNT(*), 0)), 0) AS accuracy
    FROM attempts a
    JOIN quizzes q ON a.quiz_id = q.id,
    LATERAL (
      SELECT 
        (detail->>'questionType') AS key,
        (detail->>'isCorrect')::boolean AS is_correct
      FROM jsonb_array_elements(a.question_answer_details) AS detail
    ) d
    WHERE q.author_id = v_author_id
      AND a.completed_at IS NOT NULL
      AND a.mode <> 'test-play'
      AND (p_period = 'all' OR (timezone('Asia/Tokyo', a.completed_at))::date >= v_min_date)
      AND (p_genre_id IS NULL OR q.canonical_genre_id = p_genre_id)
      AND (p_format IS NULL OR q.format = p_format)
      AND (p_visibility IS NULL OR COALESCE(q.visibility, 'public') = p_visibility)
    GROUP BY d.key
    ORDER BY plays DESC, key ASC
  ) t;
  v_format_breakdown := COALESCE(v_format_breakdown, '[]'::jsonb);

  RETURN json_build_object(
    'kpi', v_kpi,
    'trend', v_trend,
    'quizRanking', v_quiz_ranking,
    'formatBreakdown', v_format_breakdown
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_creator_dashboard_stats(TEXT, UUID, TEXT, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION get_creator_dashboard_stats(TEXT, UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_creator_dashboard_stats(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ====================================================
-- === get_creator_quiz_analysis (Task 31.3) ===
-- ====================================================
CREATE OR REPLACE FUNCTION get_creator_quiz_analysis(
  p_quiz_id UUID,
  p_period TEXT
) RETURNS JSONB AS $$
DECLARE
  v_author_id UUID;
  v_today DATE;
  v_min_date DATE;
  v_score_dist JSONB;
  v_dropoff_dist JSONB;
  v_completion_rate INTEGER;
  v_lifecycle_sample_size INTEGER;
BEGIN
  v_author_id := auth.uid();
  IF v_author_id IS NULL THEN
    RAISE EXCEPTION '未認証の呼び出しです';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM quizzes WHERE id = p_quiz_id AND author_id = v_author_id) THEN
    RAISE EXCEPTION '閲覧権限がないか、クイズが存在しません';
  END IF;

  v_today := (timezone('Asia/Tokyo', now()))::date;

  IF p_period = '7d' THEN
    v_min_date := v_today - 6;
  ELSIF p_period = '30d' THEN
    v_min_date := v_today - 29;
  ELSIF p_period = '90d' THEN
    v_min_date := v_today - 89;
  ELSIF p_period = 'all' THEN
    v_min_date := '1970-01-01'::date;
  ELSE
    RAISE EXCEPTION '無効な期間指定です: %', p_period;
  END IF;

  -- 1. スコア分布 (5つの割合バケット)
  SELECT json_agg(t) INTO v_score_dist
  FROM (
    SELECT 
      b.bucket AS bucket,
      COUNT(a.id) AS count
    FROM (
      SELECT '0-20%' AS bucket UNION ALL
      SELECT '20-40%' AS bucket UNION ALL
      SELECT '41-60%' AS bucket UNION ALL
      SELECT '61-80%' AS bucket UNION ALL
      SELECT '81-100%' AS bucket
    ) b
    LEFT JOIN (
      SELECT 
        id,
        CASE 
          WHEN total_questions = 0 THEN '0-20%'
          WHEN score::numeric / total_questions::numeric * 100 <= 20 THEN '0-20%'
          WHEN score::numeric / total_questions::numeric * 100 <= 40 THEN '20-40%'
          WHEN score::numeric / total_questions::numeric * 100 <= 60 THEN '41-60%'
          WHEN score::numeric / total_questions::numeric * 100 <= 80 THEN '61-80%'
          ELSE '81-100%'
        END AS accuracy_bucket
      FROM attempts
      WHERE quiz_id = p_quiz_id
        AND completed_at IS NOT NULL
        AND mode <> 'test-play'
        AND (p_period = 'all' OR (timezone('Asia/Tokyo', completed_at))::date >= v_min_date)
    ) a ON b.bucket = a.accuracy_bucket
    GROUP BY b.bucket
    ORDER BY CASE b.bucket
      WHEN '0-20%' THEN 1
      WHEN '20-40%' THEN 2
      WHEN '41-60%' THEN 3
      WHEN '61-80%' THEN 4
      ELSE 5
    END
  ) t;

  v_score_dist := COALESCE(v_score_dist, '[]'::jsonb);

  -- 2. 完走率・サンプル数
  SELECT 
    COALESCE(ROUND(100.0 * COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) / NULLIF(COUNT(CASE WHEN started_at IS NOT NULL THEN 1 END), 0)), NULL),
    COUNT(CASE WHEN started_at IS NOT NULL THEN 1 END)
  INTO v_completion_rate, v_lifecycle_sample_size
  FROM attempts
  WHERE quiz_id = p_quiz_id
    AND mode <> 'test-play'
    AND mode IN ('normal', 'exam', 'flashcard', 'review')
    AND (p_period = 'all' OR (timezone('Asia/Tokyo', COALESCE(completed_at, started_at)))::date >= v_min_date);

  -- 3. 離脱分布の算出
  DECLARE
    v_total_questions INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_total_questions FROM quiz_questions WHERE quiz_id = p_quiz_id;
    
    SELECT json_agg(t) INTO v_dropoff_dist
    FROM (
      SELECT 
        idx.q_idx AS "questionIndex",
        COUNT(a.id) AS count
      FROM generate_series(1, v_total_questions) AS idx(q_idx)
      LEFT JOIN (
        SELECT 
          id,
          (answered_count + 1) AS dropoff_idx
        FROM attempts
        WHERE quiz_id = p_quiz_id
          AND started_at IS NOT NULL
          AND completed_at IS NULL
          AND mode <> 'test-play'
          AND mode IN ('normal', 'exam', 'flashcard', 'review')
          AND (p_period = 'all' OR (timezone('Asia/Tokyo', started_at))::date >= v_min_date)
          AND answered_count >= 0
          AND answered_count < total_questions
      ) a ON idx.q_idx = a.dropoff_idx
      GROUP BY idx.q_idx
      ORDER BY idx.q_idx ASC
    ) t;
  END;

  v_dropoff_dist := COALESCE(v_dropoff_dist, '[]'::jsonb);

  RETURN json_build_object(
    'scoreDistribution', v_score_dist,
    'dropoffDistribution', v_dropoff_dist,
    'completionRate', v_completion_rate,
    'lifecycleSampleSize', v_lifecycle_sample_size
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION get_creator_quiz_analysis(UUID, TEXT) FROM public;
REVOKE EXECUTE ON FUNCTION get_creator_quiz_analysis(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION get_creator_quiz_analysis(UUID, TEXT) TO authenticated;
