-- =============================================================================
-- BigQuery 分析ビュー群: quizetika_analytics.raw_events を学習データセット向けに整形
-- =============================================================================
-- Spec: supabase-bigquery-export (Task 2.2, Boundary: AnalyticsViews)
-- Requirements: 2.6 (解答詳細と設問の結合識別子), 3.2 (プレイ時点の版との対応付け),
--               5.3 (重複排除情報の保持), 5.4 (削除の判別・提供除外)
--
-- 適用方法（例）:
--   bq query --project_id=<GCP_PROJECT_ID> --use_legacy_sql=false < scripts/bigquery/views.sql
--
-- 【重要】Windows bq CLIの既知の表示バグ:
--   日本語コメントを含む本ファイルをパイプ実行すると UnicodeEncodeError(cp932) が
--   表示上発生することがあるが、これは表示のみの問題でBigQueryジョブ自体は成功する。
--   成否は `bq ls -j -a` のジョブステータス、または `bq show` の対象ビュー存在確認で判定すること。
--
-- 冪等性: すべて CREATE OR REPLACE VIEW のため、複数回適用しても安全。
--
-- ビュー間の依存関係:
--   raw_events
--     -> v_dedup_events                          (event_id重複排除。以降のビューは必ずこれを経由する)
--       -> v_current_<table> (7個)                (PKごとの最新状態。DELETEが最新なら除外)
--          -> v_question_versions                 (questionsの版有効期間 valid_from/valid_to)
--             -> v_attempt_answers_training        (解答詳細UNNEST + プレイ時点の設問版と結合)
--          -> v_quality_signals                    (difficulty_votes/quiz_reviewsをquiz_id集約)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- v_dedup_events: event_idベースの重複排除（Req 5.3の最終防衛線）
-- -----------------------------------------------------------------------------
-- BigQuery insertAllのinsertId重複排除はベストエフォートに過ぎない(research.md)ため、
-- 同一event_idが複数行残るケースをここで確定的に1行へ畳み込む。
-- 複数行が残った場合はoccurred_atが新しい方を正としてtie-breakする
-- (配送トリガー/cron再送のいずれで送られても内容は同一event_idに対し不変のため実害はない)。
CREATE OR REPLACE VIEW `quizetika_analytics.v_dedup_events` AS
SELECT
  event_id,
  table_name,
  event_type,
  occurred_at,
  payload
FROM (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY event_id
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.raw_events`
)
WHERE rn = 1;

-- -----------------------------------------------------------------------------
-- v_current_attempts: attempts の現在状態（PK = id）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_attempts` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY JSON_VALUE(payload, '$.id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'attempts'
)
SELECT
  JSON_VALUE(payload, '$.id')                                    AS id,
  JSON_VALUE(payload, '$.user_id')                                AS user_id,
  JSON_VALUE(payload, '$.quiz_id')                                AS quiz_id,
  JSON_VALUE(payload, '$.list_id')                                AS list_id,
  JSON_VALUE(payload, '$.mode')                                   AS mode,
  JSON_VALUE(payload, '$.session_id')                             AS session_id,
  SAFE_CAST(JSON_VALUE(payload, '$.score') AS INT64)              AS score,
  SAFE_CAST(JSON_VALUE(payload, '$.total_questions') AS INT64)    AS total_questions,
  SAFE_CAST(JSON_VALUE(payload, '$.elapsed_seconds') AS FLOAT64)  AS elapsed_seconds,
  JSON_QUERY(payload, '$.failed_question_ids')                    AS failed_question_ids,
  JSON_QUERY(payload, '$.question_answers')                       AS question_answers,
  JSON_QUERY(payload, '$.question_answer_details')                AS question_answer_details,
  SAFE_CAST(JSON_VALUE(payload, '$.difficulty_vote') AS INT64)    AS difficulty_vote,
  JSON_QUERY(payload, '$.ai_questions_history')                   AS ai_questions_history,
  JSON_QUERY(payload, '$.ai_truth_attempts')                      AS ai_truth_attempts,
  SAFE_CAST(JSON_VALUE(payload, '$.ai_turn_count') AS INT64)      AS ai_turn_count,
  SAFE_CAST(JSON_VALUE(payload, '$.ai_turn_limit') AS INT64)      AS ai_turn_limit,
  SAFE_CAST(JSON_VALUE(payload, '$.completed_at') AS TIMESTAMP)   AS completed_at,
  SAFE_CAST(JSON_VALUE(payload, '$.gave_up_lateral') AS BOOL)     AS gave_up_lateral,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_quizzes: quizzes の現在状態（PK = id）author_name/author_avatarは
-- キャプチャトリガー段階で既に除外済み(Req 4.2)のためpayloadに存在しない。
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_quizzes` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY JSON_VALUE(payload, '$.id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'quizzes'
)
SELECT
  JSON_VALUE(payload, '$.id')                                            AS id,
  JSON_VALUE(payload, '$.author_id')                                      AS author_id,
  JSON_VALUE(payload, '$.title')                                          AS title,
  JSON_VALUE(payload, '$.description')                                    AS description,
  JSON_VALUE(payload, '$.thumbnail_url')                                  AS thumbnail_url,
  JSON_VALUE(payload, '$.difficulty')                                     AS difficulty,
  JSON_VALUE(payload, '$.genre')                                          AS genre,
  SAFE_CAST(JSON_VALUE(payload, '$.question_count') AS INT64)             AS question_count,
  JSON_VALUE(payload, '$.status')                                         AS status,
  JSON_VALUE(payload, '$.visibility')                                     AS visibility,
  SAFE_CAST(JSON_VALUE(payload, '$.flags_count') AS INT64)                AS flags_count,
  SAFE_CAST(JSON_VALUE(payload, '$.play_count') AS INT64)                 AS play_count,
  SAFE_CAST(JSON_VALUE(payload, '$.bookmarks_count') AS INT64)            AS bookmarks_count,
  SAFE_CAST(JSON_VALUE(payload, '$.positive_count') AS INT64)             AS positive_count,
  SAFE_CAST(JSON_VALUE(payload, '$.negative_count') AS INT64)             AS negative_count,
  SAFE_CAST(JSON_VALUE(payload, '$.temp_positive_count') AS INT64)        AS temp_positive_count,
  SAFE_CAST(JSON_VALUE(payload, '$.temp_negative_count') AS INT64)        AS temp_negative_count,
  SAFE_CAST(JSON_VALUE(payload, '$.review_score') AS FLOAT64)             AS review_score,
  JSON_VALUE(payload, '$.review_badge')                                   AS review_badge,
  SAFE_CAST(JSON_VALUE(payload, '$.is_review_masked') AS BOOL)            AS is_review_masked,
  JSON_VALUE(payload, '$.active_reset_request_id')                        AS active_reset_request_id,
  JSON_VALUE(payload, '$.canonical_genre_id')                             AS canonical_genre_id,
  JSON_VALUE(payload, '$.format')                                         AS format,
  SAFE_CAST(JSON_VALUE(payload, '$.created_at') AS TIMESTAMP)             AS created_at,
  SAFE_CAST(JSON_VALUE(payload, '$.updated_at') AS TIMESTAMP)             AS updated_at,
  SAFE_CAST(JSON_VALUE(payload, '$.likes_count') AS INT64)                AS likes_count,
  SAFE_CAST(JSON_VALUE(payload, '$.difficulty_votes_sum') AS INT64)       AS difficulty_votes_sum,
  SAFE_CAST(JSON_VALUE(payload, '$.difficulty_votes_count') AS INT64)     AS difficulty_votes_count,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_questions: questions の現在状態（PK = id）author_name/author_avatarは
-- キャプチャトリガー段階で既に除外済み(Req 4.2)のためpayloadに存在しない。
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_questions` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY JSON_VALUE(payload, '$.id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'questions'
)
SELECT
  JSON_VALUE(payload, '$.id')                                             AS id,
  JSON_VALUE(payload, '$.owner_quiz_id')                                  AS owner_quiz_id,
  JSON_VALUE(payload, '$.link_kind')                                      AS link_kind,
  JSON_VALUE(payload, '$.author_id')                                      AS author_id,
  JSON_VALUE(payload, '$.type')                                           AS type,
  JSON_VALUE(payload, '$.question_text')                                  AS question_text,
  JSON_VALUE(payload, '$.explanation')                                    AS explanation,
  JSON_VALUE(payload, '$.image_url')                                      AS image_url,
  JSON_VALUE(payload, '$.hint')                                           AS hint,
  SAFE_CAST(JSON_VALUE(payload, '$.limit_time') AS INT64)                 AS limit_time,
  JSON_QUERY(payload, '$.correct_text_answer_list')                       AS correct_text_answer_list,
  JSON_VALUE(payload, '$.text_input_mode')                                AS text_input_mode,
  SAFE_CAST(JSON_VALUE(payload, '$.text_input_char_count') AS INT64)      AS text_input_char_count,
  JSON_QUERY(payload, '$.choices')                                        AS choices,
  JSON_QUERY(payload, '$.sorting_items')                                  AS sorting_items,
  JSON_QUERY(payload, '$.association_hints')                              AS association_hints,
  JSON_QUERY(payload, '$.ai_context_details')                             AS ai_context_details,
  JSON_QUERY(payload, '$.truth_keywords')                                 AS truth_keywords,
  JSON_VALUE(payload, '$.source_url')                                     AS source_url,
  SAFE_CAST(JSON_VALUE(payload, '$.correct_count') AS INT64)              AS correct_count,
  SAFE_CAST(JSON_VALUE(payload, '$.incorrect_count') AS INT64)            AS incorrect_count,
  SAFE_CAST(JSON_VALUE(payload, '$.bookmarks_count') AS INT64)            AS bookmarks_count,
  SAFE_CAST(JSON_VALUE(payload, '$.created_at') AS TIMESTAMP)             AS created_at,
  SAFE_CAST(JSON_VALUE(payload, '$.updated_at') AS TIMESTAMP)             AS updated_at,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_quiz_questions: quiz_questions の現在状態（複合PK = quiz_id + question_id）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_quiz_questions` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY
        JSON_VALUE(payload, '$.quiz_id'),
        JSON_VALUE(payload, '$.question_id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'quiz_questions'
)
SELECT
  JSON_VALUE(payload, '$.quiz_id')                              AS quiz_id,
  JSON_VALUE(payload, '$.question_id')                          AS question_id,
  SAFE_CAST(JSON_VALUE(payload, '$.display_order') AS INT64)    AS display_order,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_quiz_tags: quiz_tags の現在状態（複合PK = quiz_id + tag_id）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_quiz_tags` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY
        JSON_VALUE(payload, '$.quiz_id'),
        JSON_VALUE(payload, '$.tag_id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'quiz_tags'
)
SELECT
  JSON_VALUE(payload, '$.quiz_id')            AS quiz_id,
  JSON_VALUE(payload, '$.tag_id')             AS tag_id,
  JSON_VALUE(payload, '$.original_label')     AS original_label,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_difficulty_votes: difficulty_votes の現在状態（PK = id）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_difficulty_votes` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY JSON_VALUE(payload, '$.id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'difficulty_votes'
)
SELECT
  JSON_VALUE(payload, '$.id')                                    AS id,
  JSON_VALUE(payload, '$.user_id')                                AS user_id,
  JSON_VALUE(payload, '$.quiz_id')                                AS quiz_id,
  SAFE_CAST(JSON_VALUE(payload, '$.vote') AS INT64)               AS vote,
  SAFE_CAST(JSON_VALUE(payload, '$.created_at') AS TIMESTAMP)     AS created_at,
  SAFE_CAST(JSON_VALUE(payload, '$.updated_at') AS TIMESTAMP)     AS updated_at,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_current_quiz_reviews: quiz_reviews の現在状態（複合PK = reviewer_id + quiz_id）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_current_quiz_reviews` AS
WITH ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (
      PARTITION BY
        JSON_VALUE(payload, '$.reviewer_id'),
        JSON_VALUE(payload, '$.quiz_id')
      ORDER BY occurred_at DESC
    ) AS rn
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'quiz_reviews'
)
SELECT
  JSON_VALUE(payload, '$.reviewer_id')                          AS reviewer_id,
  JSON_VALUE(payload, '$.quiz_id')                              AS quiz_id,
  SAFE_CAST(JSON_VALUE(payload, '$.created_at') AS TIMESTAMP)   AS created_at,
  JSON_VALUE(payload, '$.type')                                 AS type,
  JSON_VALUE(payload, '$.reason')                               AS reason,
  SAFE_CAST(JSON_VALUE(payload, '$.updated_at') AS TIMESTAMP)   AS updated_at,
  event_id,
  occurred_at,
  payload
FROM ranked
WHERE rn = 1 AND event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_question_versions: questions の版有効期間（Req 3.1/3.2 プレイ時点整合性の基盤）
-- -----------------------------------------------------------------------------
-- questions は追記専用のraw_events上でid別に複数のINSERT/UPDATE/DELETEイベントを
-- 持ちうる。ある版のvalid_fromはそのイベントのoccurred_at、valid_toは同一idの
-- 「次」のイベント(UPDATEでもDELETEでも良い)のoccurred_at。最新の版で以後イベントが
-- 無ければvalid_toはNULL(現在も有効)とする。
-- DELETEイベント自体は「内容の版」ではなく削除境界を表すため、LEADによる
-- valid_to計算の材料としてのみ使い、最終出力からは除外する
-- (直前の版のvalid_toがDELETE時刻に正しく設定されるため、削除以降の時間帯は
-- どの版にもマッチしなくなり、5.4の「削除済みデータの提供除外」と整合する)。
CREATE OR REPLACE VIEW `quizetika_analytics.v_question_versions` AS
WITH versions AS (
  SELECT
    JSON_VALUE(payload, '$.id')                                             AS id,
    event_type,
    occurred_at                                                             AS valid_from,
    LEAD(occurred_at) OVER (
      PARTITION BY JSON_VALUE(payload, '$.id')
      ORDER BY occurred_at
    )                                                                       AS valid_to,
    JSON_VALUE(payload, '$.owner_quiz_id')                                  AS owner_quiz_id,
    JSON_VALUE(payload, '$.link_kind')                                      AS link_kind,
    JSON_VALUE(payload, '$.author_id')                                      AS author_id,
    JSON_VALUE(payload, '$.type')                                           AS type,
    JSON_VALUE(payload, '$.question_text')                                  AS question_text,
    JSON_VALUE(payload, '$.explanation')                                    AS explanation,
    JSON_VALUE(payload, '$.image_url')                                      AS image_url,
    JSON_VALUE(payload, '$.hint')                                           AS hint,
    SAFE_CAST(JSON_VALUE(payload, '$.limit_time') AS INT64)                 AS limit_time,
    JSON_QUERY(payload, '$.correct_text_answer_list')                       AS correct_text_answer_list,
    JSON_VALUE(payload, '$.text_input_mode')                                AS text_input_mode,
    SAFE_CAST(JSON_VALUE(payload, '$.text_input_char_count') AS INT64)      AS text_input_char_count,
    JSON_QUERY(payload, '$.choices')                                        AS choices,
    JSON_QUERY(payload, '$.sorting_items')                                  AS sorting_items,
    JSON_QUERY(payload, '$.association_hints')                              AS association_hints,
    JSON_QUERY(payload, '$.ai_context_details')                             AS ai_context_details,
    JSON_QUERY(payload, '$.truth_keywords')                                 AS truth_keywords,
    JSON_VALUE(payload, '$.source_url')                                     AS source_url,
    event_id,
    payload
  FROM `quizetika_analytics.v_dedup_events`
  WHERE table_name = 'questions'
)
SELECT
  id,
  valid_from,
  valid_to,
  owner_quiz_id,
  link_kind,
  author_id,
  type,
  question_text,
  explanation,
  image_url,
  hint,
  limit_time,
  correct_text_answer_list,
  text_input_mode,
  text_input_char_count,
  choices,
  sorting_items,
  association_hints,
  ai_context_details,
  truth_keywords,
  source_url,
  event_id,
  payload
FROM versions
WHERE event_type != 'DELETE';

-- -----------------------------------------------------------------------------
-- v_attempt_answers_training: 学習データセット用フラットビュー（Req 2.6, 3.2）
-- -----------------------------------------------------------------------------
-- v_current_attempts の question_answer_details(JSON配列)を1解答=1行にUNNESTし、
-- 各解答のquestionIdを、attemptのcompleted_atがvalid_from/valid_toの区間に
-- 収まるv_question_versionsの版と結合する。これにより「プレイ時点で実際に
-- 出題されていた設問内容」を、後からの編集に影響されずに再現する。
CREATE OR REPLACE VIEW `quizetika_analytics.v_attempt_answers_training` AS
WITH answers AS (
  SELECT
    a.id            AS attempt_id,
    a.user_id,
    a.quiz_id,
    a.list_id,
    a.mode,
    a.session_id,
    a.completed_at,
    ans             AS answer
  FROM `quizetika_analytics.v_current_attempts` AS a,
    UNNEST(JSON_QUERY_ARRAY(a.question_answer_details)) AS ans
  WHERE a.completed_at IS NOT NULL
)
SELECT
  answers.attempt_id,
  answers.user_id,
  answers.quiz_id,
  answers.list_id,
  answers.mode,
  answers.session_id,
  answers.completed_at,
  JSON_VALUE(answers.answer, '$.questionId')                                        AS question_id,
  JSON_VALUE(answers.answer, '$.questionType')                                      AS answered_question_type,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.isCorrect') AS BOOL)                      AS is_correct,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.elapsedSeconds') AS FLOAT64)              AS answer_elapsed_seconds,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.hintsUsedCount') AS INT64)                AS hints_used_count,
  JSON_VALUE(answers.answer, '$.selectedChoiceId')                                  AS selected_choice_id,
  JSON_QUERY(answers.answer, '$.choicesOrder')                                      AS choices_order,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.choicesInteractionsCount') AS INT64)      AS choices_interactions_count,
  JSON_VALUE(answers.answer, '$.userAnswer')                                        AS user_answer,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.quickPressSeconds') AS FLOAT64)           AS quick_press_seconds,
  JSON_QUERY(answers.answer, '$.initialItemOrder')                                  AS initial_item_order,
  JSON_QUERY(answers.answer, '$.finalItemOrder')                                    AS final_item_order,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.aiTurnCount') AS INT64)                   AS answer_ai_turn_count,
  JSON_VALUE(answers.answer, '$.truthSummary')                                      AS truth_summary,
  JSON_VALUE(answers.answer, '$.lateralPlayEndedStatus')                            AS lateral_play_ended_status,
  SAFE_CAST(JSON_VALUE(answers.answer, '$.answerChanged') AS BOOL)                  AS answer_changed,
  qv.type                                                                           AS question_type,
  qv.question_text,
  qv.explanation,
  qv.image_url                                                                      AS question_image_url,
  qv.hint                                                                           AS question_hint,
  qv.limit_time                                                                     AS question_limit_time,
  qv.correct_text_answer_list,
  qv.text_input_mode,
  qv.text_input_char_count,
  qv.choices                                                                        AS question_choices,
  qv.sorting_items                                                                  AS question_sorting_items,
  qv.association_hints                                                              AS question_association_hints,
  qv.ai_context_details                                                             AS question_ai_context_details,
  qv.truth_keywords                                                                 AS question_truth_keywords,
  qv.source_url                                                                     AS question_source_url,
  qv.valid_from                                                                     AS question_version_valid_from,
  qv.valid_to                                                                       AS question_version_valid_to
FROM answers
LEFT JOIN `quizetika_analytics.v_question_versions` AS qv
  ON qv.id = JSON_VALUE(answers.answer, '$.questionId')
  AND answers.completed_at >= qv.valid_from
  AND (qv.valid_to IS NULL OR answers.completed_at < qv.valid_to);

-- -----------------------------------------------------------------------------
-- v_quality_signals: quiz_id単位の品質シグナル集約（difficulty_votes + quiz_reviews）
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW `quizetika_analytics.v_quality_signals` AS
WITH votes_agg AS (
  SELECT
    quiz_id,
    COUNT(*)                                        AS difficulty_votes_count,
    SUM(vote)                                        AS difficulty_votes_sum,
    AVG(vote)                                        AS difficulty_votes_avg
  FROM `quizetika_analytics.v_current_difficulty_votes`
  GROUP BY quiz_id
),
reviews_agg AS (
  SELECT
    quiz_id,
    COUNT(*)                                                          AS reviews_count,
    COUNTIF(type = 'positive')                                        AS positive_reviews_count,
    COUNTIF(type = 'negative')                                        AS negative_reviews_count,
    COUNTIF(reason IS NOT NULL AND reason != '')                      AS reviews_with_reason_count
  FROM `quizetika_analytics.v_current_quiz_reviews`
  GROUP BY quiz_id
)
SELECT
  COALESCE(votes_agg.quiz_id, reviews_agg.quiz_id)   AS quiz_id,
  votes_agg.difficulty_votes_count,
  votes_agg.difficulty_votes_sum,
  votes_agg.difficulty_votes_avg,
  reviews_agg.reviews_count,
  reviews_agg.positive_reviews_count,
  reviews_agg.negative_reviews_count,
  reviews_agg.reviews_with_reason_count
FROM votes_agg
FULL OUTER JOIN reviews_agg USING (quiz_id);
