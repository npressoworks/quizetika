-- RPC function for bookmark toggling with atomic counter updates

CREATE OR REPLACE FUNCTION handle_bookmark_toggle(
  p_user_id UUID,
  p_target_id UUID,
  p_target_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_doc_id TEXT;
  v_already_exists BOOLEAN;
  v_target_exists BOOLEAN;
BEGIN
  v_doc_id := p_user_id::TEXT || '_' || p_target_id::TEXT;
  
  -- 対象の存在チェック
  IF p_target_type = 'quiz' THEN
    SELECT EXISTS(SELECT 1 FROM quizzes WHERE id = p_target_id) INTO v_target_exists;
  ELSIF p_target_type = 'question' THEN
    SELECT EXISTS(SELECT 1 FROM questions WHERE id = p_target_id) INTO v_target_exists;
  ELSE
    RAISE EXCEPTION 'Invalid bookmark target type';
  END IF;

  IF NOT v_target_exists THEN
    RAISE EXCEPTION 'Target document does not exist.';
  END IF;

  -- ブックマークが存在するかチェック
  SELECT EXISTS(SELECT 1 FROM bookmarks WHERE id = v_doc_id) INTO v_already_exists;
  
  IF v_already_exists THEN
    -- ブックマーク削除
    DELETE FROM bookmarks WHERE id = v_doc_id;
    
    -- クイズまたは問題のカウント更新
    IF p_target_type = 'quiz' THEN
      UPDATE quizzes SET bookmarks_count = GREATEST(0, COALESCE(bookmarks_count, 0) - 1), updated_at = now() WHERE id = p_target_id;
    ELSIF p_target_type = 'question' THEN
      UPDATE questions SET bookmarks_count = GREATEST(0, COALESCE(bookmarks_count, 0) - 1) WHERE id = p_target_id;
    END IF;
    
    RETURN FALSE; -- 解除された
  ELSE
    -- ブックマーク追加
    INSERT INTO bookmarks (id, user_id, target_id, target_type, created_at)
    VALUES (v_doc_id, p_user_id, p_target_id, p_target_type, now());
    
    -- クイズまたは問題의 カウント更新
    IF p_target_type = 'quiz' THEN
      UPDATE quizzes SET bookmarks_count = COALESCE(bookmarks_count, 0) + 1, updated_at = now() WHERE id = p_target_id;
    ELSIF p_target_type = 'question' THEN
      UPDATE questions SET bookmarks_count = COALESCE(bookmarks_count, 0) + 1 WHERE id = p_target_id;
    END IF;
    
    RETURN TRUE; -- 登録された
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
