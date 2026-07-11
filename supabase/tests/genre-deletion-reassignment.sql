-- ==========================================
-- genre-management-enhancement: delete_genre_with_reassignment 単体テスト
-- Task: 1.1
-- Requirements: 3.1, 3.2, 3.3, 3.7, 3.8
-- Boundary: DeleteGenreFunction
--
-- 検証対象(design.md「Testing Strategy > Unit Tests」5シナリオ + 削除対象不存在シナリオ):
--   1. 紐づくクイズ0件時、再割当てなしで削除される(3.2)
--   2. 紐づくクイズ1件以上・再割当て先指定時、一括UPDATE後に削除される(3.1)
--   3. 削除対象ジャンル不存在のとき genre-not-found 例外
--   4. 再割当て先未指定かつ紐づくクイズ1件以上のとき reassign-required 例外(3.8)
--   5. 存在しない再割当て先IDのとき invalid-reassign-target 例外(3.7)
--   6. 削除対象=再割当て先のとき same-genre 例外
--   異常系(3-6)では途中まで実行された変更がロールバックされ、DB状態が変更前のまま
--   維持されることも確認する(3.3)。
--
-- 実行方法:
--   docker exec -i supabase_db_quizetika psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 < supabase/tests/genre-deletion-reassignment.sql
--
-- 設計:
--   スクリプト全体を単一トランザクションで実行し、末尾で必ずROLLBACKする。
--   これにより挿入した全テストデータ(users/quizzes/metadata_genres行)は実行後に
--   DBへ一切残らない(自己クリーニング、再実行可能)。
--   各異常系シナリオは、例外送出が期待通りであることをSAVEPOINT + EXCEPTION
--   ハンドラで捕捉して検証した上で、SAVEPOINTへROLLBACKして後続シナリオに影響
--   させない(スクリプト全体はplain SQLの例外方式のため、pgTAPは未導入)。
-- ==========================================

BEGIN;

CREATE TEMP TABLE test_fixture (key TEXT PRIMARY KEY, value TEXT);

-- ==========================================
-- Setup: テスト用の author / genre 群 を作成
-- ==========================================
DO $$
DECLARE
    v_author_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO users (id, email, display_name)
    VALUES (
        v_author_id,
        'genre-deletion-test-' || v_author_id || '@example.test',
        'ジャンル削除テスト用ユーザー'
    );

    INSERT INTO metadata_genres (id, display_name, is_active)
    VALUES
        ('gd-test-empty', 'テスト空ジャンル', TRUE),
        ('gd-test-source', 'テスト削除対象ジャンル', TRUE),
        ('gd-test-target', 'テスト再割当て先ジャンル', TRUE),
        ('gd-test-source2', 'テスト削除対象ジャンル2', TRUE),
        ('gd-test-source3', 'テスト削除対象ジャンル3', TRUE),
        ('gd-test-source4', 'テスト削除対象ジャンル4', TRUE);

    INSERT INTO test_fixture (key, value) VALUES ('author_id', v_author_id::text);

    RAISE NOTICE 'Setup完了: author_id=%', v_author_id;
END $$;

-- ==========================================
-- Scenario 1: 紐づくクイズ0件時、再割当てなしで削除される(3.2)
-- ==========================================
DO $$
DECLARE
    v_result INTEGER;
BEGIN
    v_result := delete_genre_with_reassignment('gd-test-empty', NULL);

    IF v_result <> 0 THEN
        RAISE EXCEPTION 'Scenario 1 FAILED: 戻り値が0ではありません: %', v_result;
    END IF;

    IF EXISTS (SELECT 1 FROM metadata_genres WHERE id = 'gd-test-empty') THEN
        RAISE EXCEPTION 'Scenario 1 FAILED: gd-test-emptyが削除されていません';
    END IF;

    RAISE NOTICE 'PASS: Scenario 1 (0件時、再割当てなしで削除)';
END $$;

-- ==========================================
-- Scenario 2: 紐づくクイズ1件以上・再割当て先指定時、一括UPDATE後に削除される(3.1)
-- ==========================================
DO $$
DECLARE
    v_author_id UUID;
    v_quiz_id_1 UUID := gen_random_uuid();
    v_quiz_id_2 UUID := gen_random_uuid();
    v_result INTEGER;
    v_genre_1 TEXT;
    v_canonical_1 TEXT;
    v_genre_2 TEXT;
    v_canonical_2 TEXT;
BEGIN
    SELECT value::uuid INTO v_author_id FROM test_fixture WHERE key = 'author_id';

    INSERT INTO quizzes (id, author_id, author_name, title, description, difficulty, genre, canonical_genre_id)
    VALUES
        (v_quiz_id_1, v_author_id, 'テスト著者', 'テストクイズ1', 'テスト説明1', 3, 'gd-test-source', 'gd-test-source'),
        (v_quiz_id_2, v_author_id, 'テスト著者', 'テストクイズ2', 'テスト説明2', 3, 'gd-test-source', 'gd-test-source');

    v_result := delete_genre_with_reassignment('gd-test-source', 'gd-test-target');

    IF v_result <> 2 THEN
        RAISE EXCEPTION 'Scenario 2 FAILED: 戻り値が2ではありません: %', v_result;
    END IF;

    IF EXISTS (SELECT 1 FROM metadata_genres WHERE id = 'gd-test-source') THEN
        RAISE EXCEPTION 'Scenario 2 FAILED: gd-test-sourceが削除されていません';
    END IF;

    SELECT genre, canonical_genre_id INTO v_genre_1, v_canonical_1 FROM quizzes WHERE id = v_quiz_id_1;
    SELECT genre, canonical_genre_id INTO v_genre_2, v_canonical_2 FROM quizzes WHERE id = v_quiz_id_2;

    IF v_genre_1 <> 'gd-test-target' OR v_canonical_1 <> 'gd-test-target' THEN
        RAISE EXCEPTION 'Scenario 2 FAILED: quiz1が再割当て先へ更新されていません(genre=%, canonical_genre_id=%)', v_genre_1, v_canonical_1;
    END IF;
    IF v_genre_2 <> 'gd-test-target' OR v_canonical_2 <> 'gd-test-target' THEN
        RAISE EXCEPTION 'Scenario 2 FAILED: quiz2が再割当て先へ更新されていません(genre=%, canonical_genre_id=%)', v_genre_2, v_canonical_2;
    END IF;

    RAISE NOTICE 'PASS: Scenario 2 (1件以上時、一括UPDATE後に削除)';
END $$;

-- ==========================================
-- Scenario 3: 削除対象ジャンル不存在のとき genre-not-found 例外
-- ==========================================
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM delete_genre_with_reassignment('gd-test-nonexistent', NULL);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'genre-not-found' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Scenario 3 FAILED: 期待外の例外メッセージ: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'Scenario 3 FAILED: genre-not-found例外が送出されませんでした';
    END IF;

    RAISE NOTICE 'PASS: Scenario 3 (削除対象ジャンル不存在 -> genre-not-found)';
END $$;

-- ==========================================
-- Scenario 4: 再割当て先未指定かつ紐づくクイズ1件以上のとき reassign-required 例外(3.8)
-- ロールバック確認: クイズのgenreとgd-test-source2レコードが変更前のまま維持される
-- ==========================================
DO $$
DECLARE
    v_author_id UUID;
    v_quiz_id UUID := gen_random_uuid();
    v_caught BOOLEAN := FALSE;
    v_genre TEXT;
BEGIN
    SELECT value::uuid INTO v_author_id FROM test_fixture WHERE key = 'author_id';

    INSERT INTO quizzes (id, author_id, author_name, title, description, difficulty, genre, canonical_genre_id)
    VALUES (v_quiz_id, v_author_id, 'テスト著者', 'テストクイズ3', 'テスト説明3', 3, 'gd-test-source2', 'gd-test-source2');

    BEGIN
        PERFORM delete_genre_with_reassignment('gd-test-source2', NULL);
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'reassign-required' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Scenario 4 FAILED: 期待外の例外メッセージ: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'Scenario 4 FAILED: reassign-required例外が送出されませんでした';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM metadata_genres WHERE id = 'gd-test-source2') THEN
        RAISE EXCEPTION 'Scenario 4 FAILED: 例外後にgd-test-source2が削除されています(ロールバック未実施)';
    END IF;

    SELECT genre INTO v_genre FROM quizzes WHERE id = v_quiz_id;
    IF v_genre <> 'gd-test-source2' THEN
        RAISE EXCEPTION 'Scenario 4 FAILED: 例外後にクイズのgenreが変更されています(ロールバック未実施): %', v_genre;
    END IF;

    RAISE NOTICE 'PASS: Scenario 4 (再割当て先未指定+クイズ有 -> reassign-required、ロールバック確認)';
END $$;

-- ==========================================
-- Scenario 5: 存在しない再割当て先IDのとき invalid-reassign-target 例外(3.7)
-- ロールバック確認: クイズのgenreとgd-test-source3レコードが変更前のまま維持される
-- ==========================================
DO $$
DECLARE
    v_author_id UUID;
    v_quiz_id UUID := gen_random_uuid();
    v_caught BOOLEAN := FALSE;
    v_genre TEXT;
BEGIN
    SELECT value::uuid INTO v_author_id FROM test_fixture WHERE key = 'author_id';

    INSERT INTO quizzes (id, author_id, author_name, title, description, difficulty, genre, canonical_genre_id)
    VALUES (v_quiz_id, v_author_id, 'テスト著者', 'テストクイズ4', 'テスト説明4', 3, 'gd-test-source3', 'gd-test-source3');

    BEGIN
        PERFORM delete_genre_with_reassignment('gd-test-source3', 'gd-test-nonexistent-target');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'invalid-reassign-target' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Scenario 5 FAILED: 期待外の例外メッセージ: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'Scenario 5 FAILED: invalid-reassign-target例外が送出されませんでした';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM metadata_genres WHERE id = 'gd-test-source3') THEN
        RAISE EXCEPTION 'Scenario 5 FAILED: 例外後にgd-test-source3が削除されています(ロールバック未実施)';
    END IF;

    SELECT genre INTO v_genre FROM quizzes WHERE id = v_quiz_id;
    IF v_genre <> 'gd-test-source3' THEN
        RAISE EXCEPTION 'Scenario 5 FAILED: 例外後にクイズのgenreが変更されています(ロールバック未実施): %', v_genre;
    END IF;

    RAISE NOTICE 'PASS: Scenario 5 (存在しない再割当て先ID -> invalid-reassign-target、ロールバック確認)';
END $$;

-- ==========================================
-- Scenario 6: 削除対象=再割当て先のとき same-genre 例外
-- ロールバック確認: gd-test-source4レコードが変更前のまま維持される
-- ==========================================
DO $$
DECLARE
    v_caught BOOLEAN := FALSE;
BEGIN
    BEGIN
        PERFORM delete_genre_with_reassignment('gd-test-source4', 'gd-test-source4');
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM = 'same-genre' THEN
            v_caught := TRUE;
        ELSE
            RAISE EXCEPTION 'Scenario 6 FAILED: 期待外の例外メッセージ: %', SQLERRM;
        END IF;
    END;

    IF NOT v_caught THEN
        RAISE EXCEPTION 'Scenario 6 FAILED: same-genre例外が送出されませんでした';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM metadata_genres WHERE id = 'gd-test-source4') THEN
        RAISE EXCEPTION 'Scenario 6 FAILED: 例外後にgd-test-source4が削除されています(ロールバック未実施)';
    END IF;

    RAISE NOTICE 'PASS: Scenario 6 (削除対象=再割当て先 -> same-genre、ロールバック確認)';
END $$;

-- ==========================================
-- クリーンアップ: 全テストデータをロールバックし、DBを実行前の状態に戻す
-- ==========================================
ROLLBACK;

SELECT 'ALL 6 SCENARIOS PASSED (transaction rolled back, no residual test data)' AS result;
