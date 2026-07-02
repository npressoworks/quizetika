-- RPC functions for user follow and badge awards

CREATE OR REPLACE FUNCTION handle_follow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_doc_id TEXT;
  v_already_exists BOOLEAN;
BEGIN
  v_doc_id := p_follower_id::TEXT || '_' || p_following_id::TEXT;
  
  -- 重複チェック
  SELECT EXISTS(SELECT 1 FROM follows WHERE id = v_doc_id) INTO v_already_exists;
  IF v_already_exists THEN
    RETURN FALSE;
  END IF;
  
  -- フォローテーブルへ登録
  INSERT INTO follows (id, follower_id, following_id, created_at)
  VALUES (v_doc_id, p_follower_id, p_following_id, now());
  
  -- カウントの更新
  UPDATE users SET following_count = following_count + 1, updated_at = now() WHERE id = p_follower_id;
  UPDATE users SET followers_count = followers_count + 1, updated_at = now() WHERE id = p_following_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION handle_unfollow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_doc_id TEXT;
  v_exists BOOLEAN;
BEGIN
  v_doc_id := p_follower_id::TEXT || '_' || p_following_id::TEXT;
  
  -- 存在チェック
  SELECT EXISTS(SELECT 1 FROM follows WHERE id = v_doc_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN FALSE;
  END IF;
  
  -- フォローテーブルから削除
  DELETE FROM follows WHERE id = v_doc_id;
  
  -- カウントの更新
  UPDATE users SET following_count = GREATEST(0, following_count - 1), updated_at = now() WHERE id = p_follower_id;
  UPDATE users SET followers_count = GREATEST(0, followers_count - 1), updated_at = now() WHERE id = p_following_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION handle_check_and_award_badges(
  p_user_id UUID,
  p_badges JSONB
) RETURNS JSONB AS $$
DECLARE
  v_existing_badges JSONB;
  v_merged_badges JSONB;
BEGIN
  -- ロックを獲得しつつ既存バッジの取得
  SELECT badges INTO v_existing_badges FROM users WHERE id = p_user_id FOR UPDATE;
  
  -- NULL の場合は空配列にする
  IF v_existing_badges IS NULL THEN
    v_existing_badges := '[]'::JSONB;
  END IF;
  
  -- JSONB 配列結合
  v_merged_badges := v_existing_badges || p_badges;
  
  UPDATE users 
  SET badges = v_merged_badges, updated_at = now()
  WHERE id = p_user_id;
  
  RETURN p_badges;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
