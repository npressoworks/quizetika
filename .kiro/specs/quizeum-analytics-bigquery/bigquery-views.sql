-- attempts テーブルから解答詳細（questionAnswerDetails）を UNNEST し、
-- 設問ごとの解答詳細行として展開する分析用ビューの作成 SQL

CREATE OR REPLACE VIEW `your_project.your_dataset.view_question_answer_details` AS
SELECT
  -- 試行メタデータ
  document_id AS attempt_id,
  timestamp AS synced_at,
  
  -- Attempt情報のパース (JSON値から展開)
  JSON_VALUE(data, '$.userId') AS user_id,
  JSON_VALUE(data, '$.quizId') AS quiz_id,
  JSON_VALUE(data, '$.mode') AS play_mode,
  CAST(JSON_VALUE(data, '$.score') AS INT64) AS attempt_score,
  CAST(JSON_VALUE(data, '$.totalQuestions') AS INT64) AS attempt_total_questions,
  CAST(JSON_VALUE(data, '$.elapsedSeconds') AS FLOAT64) AS attempt_total_elapsed_seconds,
  TIMESTAMP(JSON_VALUE(data, '$.completedAt')) AS completed_at,

  -- 各解答詳細 STRUCT/REPEATED をフラットに展開
  JSON_VALUE(detail, '$.questionId') AS question_id,
  JSON_VALUE(detail, '$.questionType') AS question_type,
  CAST(JSON_VALUE(detail, '$.isCorrect') AS BOOL) AS is_correct,
  CAST(JSON_VALUE(detail, '$.elapsedSeconds') AS FLOAT64) AS question_elapsed_seconds,
  CAST(JSON_VALUE(detail, '$.hintsUsedCount') AS INT64) AS hints_used_count,
  JSON_VALUE(detail, '$.selectedChoiceId') AS selected_choice_id,
  CAST(JSON_VALUE(detail, '$.choicesInteractionsCount') AS INT64) AS choices_interactions_count,
  JSON_VALUE(detail, '$.userAnswer') AS user_answer,
  CAST(JSON_VALUE(detail, '$.quickPressSeconds') AS FLOAT64) AS quick_press_seconds,
  CAST(JSON_VALUE(detail, '$.aiTurnCount') AS INT64) AS ai_turn_count,
  JSON_VALUE(detail, '$.truthSummary') AS truth_summary,
  JSON_VALUE(detail, '$.lateralPlayEndedStatus') AS lateral_play_ended_status,
  CAST(JSON_VALUE(detail, '$.answerChanged') AS BOOL) AS answer_changed,
  
  -- 配列データの展開 (JSON文字列から展開)
  ARRAY(
    SELECT JSON_VALUE(val) 
    FROM UNNEST(JSON_QUERY_ARRAY(detail, '$.choicesOrder')) AS val
  ) AS choices_order,
  
  ARRAY(
    SELECT JSON_VALUE(val) 
    FROM UNNEST(JSON_QUERY_ARRAY(detail, '$.initialItemOrder')) AS val
  ) AS initial_item_order,
  
  ARRAY(
    SELECT JSON_VALUE(val) 
    FROM UNNEST(JSON_QUERY_ARRAY(detail, '$.finalItemOrder')) AS val
  ) AS final_item_order

FROM
  `your_project.your_dataset.attempts_raw_latest`,
  UNNEST(JSON_QUERY_ARRAY(data, '$.questionAnswerDetails')) AS detail;
