-- genre-management-enhancement: ジャンル削除 + 既存クイズ再割当てRPC
-- Task 1.1: delete_genre_with_reassignment PL/pgSQL関数
-- Requirements: 3.1, 3.2, 3.3, 3.7, 3.8
-- Boundary: DeleteGenreFunction
--
-- 削除対象ジャンルに紐づく既存クイズを指定の再割当て先へ一括更新し、その後ジャンル
-- レコードを削除する処理を単一トランザクションで実行する。
-- 途中で例外が発生した場合、それ以前のUPDATE/DELETEはすべて自動ロールバックされる(3.3)。
--
-- SECURITY DEFINERは付与しない: 呼び出し元はcreateAdminClient()(service role)経由の
-- みのため、RLSは実行時点で既にバイパスされている(design.md「DeleteGenreFunction
-- Implementation Notes」参照)。

CREATE OR REPLACE FUNCTION delete_genre_with_reassignment(
    p_genre_id TEXT,
    p_reassign_to_id TEXT DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_affected_count INTEGER;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM metadata_genres WHERE id = p_genre_id) THEN
        RAISE EXCEPTION 'genre-not-found';
    END IF;

    IF p_reassign_to_id IS NOT NULL AND p_reassign_to_id = p_genre_id THEN
        RAISE EXCEPTION 'same-genre';
    END IF;

    SELECT count(*) INTO v_affected_count
    FROM quizzes
    WHERE canonical_genre_id = p_genre_id;

    IF v_affected_count > 0 THEN
        IF p_reassign_to_id IS NULL THEN
            RAISE EXCEPTION 'reassign-required';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM metadata_genres WHERE id = p_reassign_to_id) THEN
            RAISE EXCEPTION 'invalid-reassign-target';
        END IF;

        UPDATE quizzes
        SET genre = p_reassign_to_id,
            canonical_genre_id = p_reassign_to_id,
            updated_at = now()
        WHERE canonical_genre_id = p_genre_id;
    END IF;

    DELETE FROM metadata_genres WHERE id = p_genre_id;

    RETURN v_affected_count;
END;
$$;
