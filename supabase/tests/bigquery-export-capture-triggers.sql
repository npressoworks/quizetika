-- ==========================================
-- BigQuery Export Pipeline: キャプチャ層の統合テスト(ローカルSupabase)
-- Task: 4.2 (supabase-bigquery-export spec)
-- Requirements: 1.1, 2.2, 2.3, 4.1, 4.2, 4.4, 5.4
-- Boundary: CaptureTriggers, OutboxTable
--
-- 検証対象(design.md「Testing Strategy > Integration Tests」の4シナリオと対応):
--   1. handle_save_attempt実行 -> attempts INSERTイベントがanalytics_outboxに生成され、
--      payloadにquestion_answer_detailsが含まれること(1.1, 2.2, 2.3)
--   2. quizzes/questionsのUPDATE -> outboxイベントのpayloadにauthor_name/author_avatarが
--      キーとして一切含まれないこと(4.2)
--   3. usersのUPDATE -> analytics_outboxの行数が増加しないこと(4.1, 4.4)
--   4. attempts行のDELETE -> event_type='DELETE'のイベントがOLDスナップショットとともに
--      生成されること(5.4)
--
-- 実行方法:
--   ローカルSupabaseが起動している状態(`npx supabase start`)で、以下のいずれかで実行する。
--
--   (a) ホストからDBポート(54322)へ到達できる環境:
--       psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--         -v ON_ERROR_STOP=1 -f supabase/tests/bigquery-export-capture-triggers.sql
--
--   (b) ホスト -> Dockerコンテナのポートフォワーディングが機能しない環境
--       (このタスクの実装時点のサンドボックス環境で確認済みの既知の制約。
--        tasks.md「Implementation Notes」タスク3.1の注記、
--        tests/functions/bigquery-export/outbox.test.ts冒頭コメント参照):
--       docker exec -i supabase_db_quizetika psql -U postgres -d postgres \
--         -v ON_ERROR_STOP=1 < supabase/tests/bigquery-export-capture-triggers.sql
--
-- 設計:
--   スクリプト全体を単一トランザクションで実行し、末尾で必ずROLLBACKする。
--   これにより挿入した全テストデータ(users/quizzes/questions/quiz_questions/attempts/
--   analytics_outbox行)は実行後にDBへ一切残らない(自己クリーニング、再実行可能)。
--   各シナリオの「新規イベント」判定は、同一トランザクション内では列デフォルトの
--   now()(トランザクション開始時刻で固定)がタイムスタンプ順序の判定に使えないため、
--   「アクション実行前に存在したevent_idの集合」との差分(NOT IN相当)で行う。
--
--   アサーション失敗時はRAISE EXCEPTIONでスクリプト全体を即座に中断する
--   (pgTAP等の専用フレームワークは本リポジトリに未導入のため、プレーンSQL + 例外方式を採用)。
-- ==========================================

BEGIN;

-- シナリオ間でテストフィクスチャのIDを共有するための一時テーブル
-- (DOブロックはplpgsql変数をブロック外へ返せないため)
CREATE TEMP TABLE test_fixture (key TEXT PRIMARY KEY, value TEXT);

-- ==========================================
-- Setup: テスト用の author / quiz / question / quiz_questions を作成
-- ==========================================
DO $$
DECLARE
    v_author_id UUID := gen_random_uuid();
    v_quiz_id UUID := gen_random_uuid();
    v_question_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO users (id, email, display_name)
    VALUES (
        v_author_id,
        'bq-export-capture-test-' || v_author_id || '@example.test',
        'BQエクスポートテスト用ユーザー'
    );

    INSERT INTO quizzes (
        id, author_id, author_name, author_avatar,
        title, description, difficulty, genre, canonical_genre_id
    )
    VALUES (
        v_quiz_id, v_author_id, 'テスト用著者名', 'https://example.test/avatar.png',
        'BQエクスポート統合テスト用クイズ', 'capture triggerの統合テスト用フィクスチャ',
        3, 'game', 'game'
    );

    INSERT INTO questions (
        id, owner_quiz_id, author_id, author_name, author_avatar,
        type, question_text, explanation
    )
    VALUES (
        v_question_id, v_quiz_id, v_author_id, 'テスト用著者名', 'https://example.test/avatar.png',
        'single-choice', 'テスト設問文ですか?', 'テスト解説文です。'
    );

    INSERT INTO quiz_questions (quiz_id, question_id, display_order)
    VALUES (v_quiz_id, v_question_id, 1);

    INSERT INTO test_fixture (key, value) VALUES
        ('author_id', v_author_id::text),
        ('quiz_id', v_quiz_id::text),
        ('question_id', v_question_id::text);

    RAISE NOTICE 'Setup完了: author_id=%, quiz_id=%, question_id=%', v_author_id, v_quiz_id, v_question_id;
END $$;

-- ==========================================
-- Scenario 1: handle_save_attempt実行 -> attempts INSERTイベント生成
-- (question_answer_details含む) — Requirements 1.1, 2.2, 2.3
-- ==========================================
DO $$
DECLARE
    v_author_id UUID;
    v_quiz_id UUID;
    v_question_id UUID;
    v_before_ids UUID[];
    v_attempt_id UUID;
    v_event_id UUID;
    v_payload JSONB;
BEGIN
    SELECT value::uuid INTO v_author_id FROM test_fixture WHERE key = 'author_id';
    SELECT value::uuid INTO v_quiz_id FROM test_fixture WHERE key = 'quiz_id';
    SELECT value::uuid INTO v_question_id FROM test_fixture WHERE key = 'question_id';

    SELECT COALESCE(array_agg(event_id), ARRAY[]::uuid[]) INTO v_before_ids FROM analytics_outbox;

    -- mode='test-play'はhandle_save_attempt内でleaderboard登録処理をスキップする
    -- (supabase-gameplay境界のRPCロジックであり本specでは変更しない。既存の書き込み経路を
    -- そのまま使うことで「handle_save_attempt実行」を文字通り満たす)
    v_attempt_id := handle_save_attempt(
        v_author_id,
        v_quiz_id,
        'test-play',
        1,
        1,
        12.5,
        ARRAY[]::uuid[],
        jsonb_build_array(jsonb_build_object('questionId', v_question_id, 'correct', true)),
        jsonb_build_array(jsonb_build_object(
            'questionId', v_question_id,
            'correct', true,
            'elapsedSeconds', 5,
            'hintUsed', false,
            'answerChanged', false,
            'choiceOrder', jsonb_build_array(0, 1, 2, 3)
        ))
    );

    INSERT INTO test_fixture (key, value) VALUES ('attempt_id', v_attempt_id::text);

    SELECT event_id, payload INTO v_event_id, v_payload
    FROM analytics_outbox
    WHERE event_id <> ALL (v_before_ids)
      AND table_name = 'attempts'
      AND event_type = 'INSERT'
      AND (payload ->> 'id')::uuid = v_attempt_id
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Scenario 1 FAILED: handle_save_attempt実行後にattempts INSERTイベントがanalytics_outboxに見つかりません(attempt_id=%)', v_attempt_id;
    END IF;

    IF v_payload -> 'question_answer_details' IS NULL
        OR jsonb_typeof(v_payload -> 'question_answer_details') <> 'array'
        OR jsonb_array_length(v_payload -> 'question_answer_details') <> 1 THEN
        RAISE EXCEPTION 'Scenario 1 FAILED: payload.question_answer_details が期待する配列(要素数1)ではありません: %', v_payload -> 'question_answer_details';
    END IF;

    IF (v_payload -> 'question_answer_details' -> 0 ->> 'questionId') <> v_question_id::text THEN
        RAISE EXCEPTION 'Scenario 1 FAILED: question_answer_details[0].questionId が投入値と一致しません: %', v_payload -> 'question_answer_details' -> 0;
    END IF;

    RAISE NOTICE 'PASS: Scenario 1 (handle_save_attempt -> attempts INSERTイベント生成、question_answer_details含む) event_id=%', v_event_id;
END $$;

-- ==========================================
-- Scenario 2: quizzes/questions UPDATE -> payloadにauthor_name/author_avatarが
-- キーとして存在しない — Requirement 4.2
-- ==========================================
DO $$
DECLARE
    v_quiz_id UUID;
    v_question_id UUID;
    v_before_ids UUID[];
    v_event_id UUID;
    v_payload JSONB;
BEGIN
    SELECT value::uuid INTO v_quiz_id FROM test_fixture WHERE key = 'quiz_id';
    SELECT value::uuid INTO v_question_id FROM test_fixture WHERE key = 'question_id';

    -- quizzes UPDATE
    SELECT COALESCE(array_agg(event_id), ARRAY[]::uuid[]) INTO v_before_ids FROM analytics_outbox;
    UPDATE quizzes SET title = title || '(更新済み)' WHERE id = v_quiz_id;

    SELECT event_id, payload INTO v_event_id, v_payload
    FROM analytics_outbox
    WHERE event_id <> ALL (v_before_ids)
      AND table_name = 'quizzes'
      AND event_type = 'UPDATE'
      AND (payload ->> 'id')::uuid = v_quiz_id
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Scenario 2a FAILED: quizzes UPDATE後にoutboxイベントが見つかりません(quiz_id=%)', v_quiz_id;
    END IF;

    IF v_payload ? 'author_name' OR v_payload ? 'author_avatar' THEN
        RAISE EXCEPTION 'Scenario 2a FAILED: quizzesイベントのpayloadにauthor_name/author_avatarキーが含まれています: %', v_payload;
    END IF;

    RAISE NOTICE 'PASS: Scenario 2a (quizzes UPDATE -> payloadにauthor_name/author_avatarキーが存在しない) event_id=%', v_event_id;

    -- questions UPDATE
    SELECT COALESCE(array_agg(event_id), ARRAY[]::uuid[]) INTO v_before_ids FROM analytics_outbox;
    UPDATE questions SET question_text = question_text || '(更新済み)' WHERE id = v_question_id;

    SELECT event_id, payload INTO v_event_id, v_payload
    FROM analytics_outbox
    WHERE event_id <> ALL (v_before_ids)
      AND table_name = 'questions'
      AND event_type = 'UPDATE'
      AND (payload ->> 'id')::uuid = v_question_id
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Scenario 2b FAILED: questions UPDATE後にoutboxイベントが見つかりません(question_id=%)', v_question_id;
    END IF;

    IF v_payload ? 'author_name' OR v_payload ? 'author_avatar' THEN
        RAISE EXCEPTION 'Scenario 2b FAILED: questionsイベントのpayloadにauthor_name/author_avatarキーが含まれています: %', v_payload;
    END IF;

    RAISE NOTICE 'PASS: Scenario 2b (questions UPDATE -> payloadにauthor_name/author_avatarキーが存在しない) event_id=%', v_event_id;
END $$;

-- ==========================================
-- Scenario 3: users UPDATE -> analytics_outboxの行数が増加しない
-- (トリガー未設置の構造的保証) — Requirements 4.1, 4.4
-- ==========================================
DO $$
DECLARE
    v_author_id UUID;
    v_count_before BIGINT;
    v_count_after BIGINT;
BEGIN
    SELECT value::uuid INTO v_author_id FROM test_fixture WHERE key = 'author_id';

    SELECT count(*) INTO v_count_before FROM analytics_outbox;
    UPDATE users SET bio = 'capture trigger統合テストによる更新' WHERE id = v_author_id;
    SELECT count(*) INTO v_count_after FROM analytics_outbox;

    IF v_count_after <> v_count_before THEN
        RAISE EXCEPTION 'Scenario 3 FAILED: users UPDATE後にanalytics_outbox行数が増加しました(before=%, after=%)', v_count_before, v_count_after;
    END IF;

    RAISE NOTICE 'PASS: Scenario 3 (users UPDATE -> outbox行数不変) count=%', v_count_after;
END $$;

-- ==========================================
-- Scenario 4: attempts DELETE -> DELETEイベント生成(OLDスナップショット) — Requirement 5.4
-- ==========================================
DO $$
DECLARE
    v_attempt_id UUID;
    v_before_ids UUID[];
    v_event_id UUID;
    v_payload JSONB;
BEGIN
    SELECT value::uuid INTO v_attempt_id FROM test_fixture WHERE key = 'attempt_id';

    SELECT COALESCE(array_agg(event_id), ARRAY[]::uuid[]) INTO v_before_ids FROM analytics_outbox;
    DELETE FROM attempts WHERE id = v_attempt_id;

    SELECT event_id, payload INTO v_event_id, v_payload
    FROM analytics_outbox
    WHERE event_id <> ALL (v_before_ids)
      AND table_name = 'attempts'
      AND event_type = 'DELETE'
      AND (payload ->> 'id')::uuid = v_attempt_id
    LIMIT 1;

    IF v_event_id IS NULL THEN
        RAISE EXCEPTION 'Scenario 4 FAILED: attempts DELETE後にDELETEイベントが見つかりません(attempt_id=%)', v_attempt_id;
    END IF;

    IF (v_payload ->> 'score')::int <> 1 THEN
        RAISE EXCEPTION 'Scenario 4 FAILED: DELETEイベントのpayloadが削除直前のOLDスナップショットと一致しません: %', v_payload;
    END IF;

    RAISE NOTICE 'PASS: Scenario 4 (attempts DELETE -> DELETEイベント生成、OLDスナップショット含む) event_id=%', v_event_id;
END $$;

-- ==========================================
-- クリーンアップ: 全テストデータをロールバックし、DBを実行前の状態に戻す
-- ==========================================
ROLLBACK;

SELECT 'ALL 4 SCENARIOS PASSED (transaction rolled back, no residual test data)' AS result;
