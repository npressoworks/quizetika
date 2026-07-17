-- quizeum-governance-freeze: 凍結解除用の復元マイグレーション雛形
-- 既存ガバナンスRPC 4種を元の挙動に復旧させる。
-- ただし、セキュリティ向上のため、元々の「誰でも起案・投票可能（is_not_banned()のみ）」だった認可を、
-- 本来の設計意図である「モデレーターまたは管理者のみ（is_moderator_or_admin()）」に強化して復元する。
-- （ジャンル申請のみは一般ユーザーも行えるよう is_not_banned() のまま維持する）
-- このファイルは migrations ディレクトリ外の雛形であり、自動適用はされません。

-- ==========================================
-- 1. マージ提案の起案（復元版：is_moderator_or_adminガード付き）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_create_merge_request(
  p_target_type TEXT,
  p_source_id TEXT,
  p_target_id TEXT,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_weight INTEGER;
  v_current TEXT;
  v_visited TEXT[] := ARRAY[p_target_id];
BEGIN
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'same-id';
  END IF;

  IF p_target_type = 'tag' THEN
    SELECT canonical_id INTO v_current FROM metadata_tags WHERE id = p_target_id;
  ELSE
    SELECT canonical_id INTO v_current FROM metadata_genres WHERE id = p_target_id;
  END IF;

  WHILE v_current IS NOT NULL LOOP
    IF v_current = p_source_id THEN
      RAISE EXCEPTION 'circular-merge';
    END IF;
    IF v_current = ANY(v_visited) THEN
      EXIT;
    END IF;
    v_visited := array_append(v_visited, v_current);

    IF p_target_type = 'tag' THEN
      SELECT canonical_id INTO v_current FROM metadata_tags WHERE id = v_current;
    ELSE
      SELECT canonical_id INTO v_current FROM metadata_genres WHERE id = v_current;
    END IF;
  END LOOP;

  v_weight := resolve_vote_weight(auth.uid());

  INSERT INTO merge_requests (target_type, source_id, target_id, requester_id, reason, votes_for_count, weighted_votes_for)
  VALUES (p_target_type, p_source_id, p_target_id, auth.uid(), p_reason, 1, v_weight)
  RETURNING id INTO v_request_id;

  INSERT INTO merge_request_votes (request_id, voter_id, opinion, weight)
  VALUES (v_request_id, auth.uid(), 'for', v_weight);

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. マージ提案への投票（復元版：is_moderator_or_adminガード付き）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_vote_merge_request(
  p_request_id UUID,
  p_opinion TEXT
) RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_source_id TEXT;
  v_target_id TEXT;
  v_target_type TEXT;
  v_weight INTEGER;
  v_weighted_for INTEGER;
  v_weighted_against INTEGER;
BEGIN
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status, source_id, target_id, target_type
  INTO v_status, v_source_id, v_target_id, v_target_type
  FROM merge_requests WHERE id = p_request_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'request-not-found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'already-resolved';
  END IF;

  v_weight := resolve_vote_weight(auth.uid());

  INSERT INTO merge_request_votes (request_id, voter_id, opinion, weight)
  VALUES (p_request_id, auth.uid(), CASE WHEN p_opinion = 'approve' THEN 'for' ELSE 'against' END, v_weight);

  UPDATE merge_requests SET
    votes_for_count = votes_for_count + CASE WHEN p_opinion = 'approve' THEN 1 ELSE 0 END,
    votes_against_count = votes_against_count + CASE WHEN p_opinion = 'approve' THEN 0 ELSE 1 END,
    weighted_votes_for = weighted_votes_for + CASE WHEN p_opinion = 'approve' THEN v_weight ELSE 0 END,
    weighted_votes_against = weighted_votes_against + CASE WHEN p_opinion = 'approve' THEN 0 ELSE v_weight END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING weighted_votes_for, weighted_votes_against INTO v_weighted_for, v_weighted_against;

  IF v_weighted_for >= 5 AND v_weighted_for::NUMERIC / (v_weighted_for + v_weighted_against) >= 0.7 THEN
    UPDATE merge_requests SET status = 'approved', updated_at = now() WHERE id = p_request_id;
    PERFORM execute_merge(v_target_type, v_source_id, v_target_id);
  ELSIF v_weighted_against >= 5 THEN
    UPDATE merge_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 3. ジャンル新設申請の起案（復元版：is_not_bannedのみ）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_submit_genre_request(
  p_genre_id TEXT,
  p_display_name TEXT,
  p_description TEXT,
  p_icon_image_url TEXT
) RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_weight INTEGER;
BEGIN
  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'banned';
  END IF;

  v_weight := resolve_vote_weight(auth.uid());

  INSERT INTO genre_requests (genre_id, display_name, description, icon_image_url, requester_id, votes_for_count, weighted_votes_for)
  VALUES (p_genre_id, p_display_name, p_description, p_icon_image_url, auth.uid(), 1, v_weight)
  RETURNING id INTO v_request_id;

  INSERT INTO genre_request_votes (request_id, voter_id, opinion, weight)
  VALUES (v_request_id, auth.uid(), 'for', v_weight);

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 4. ジャンル新設申請への投票（復元版：is_moderator_or_adminガード付き）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_vote_genre_request(
  p_request_id UUID,
  p_opinion TEXT
) RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_genre_id TEXT;
  v_display_name TEXT;
  v_description TEXT;
  v_icon_image_url TEXT;
  v_weight INTEGER;
  v_weighted_for INTEGER;
  v_weighted_against INTEGER;
BEGIN
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT status, genre_id, display_name, description, icon_image_url
  INTO v_status, v_genre_id, v_display_name, v_description, v_icon_image_url
  FROM genre_requests WHERE id = p_request_id FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'request-not-found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'already-resolved';
  END IF;

  v_weight := resolve_vote_weight(auth.uid());

  INSERT INTO genre_request_votes (request_id, voter_id, opinion, weight)
  VALUES (p_request_id, auth.uid(), CASE WHEN p_opinion = 'approve' THEN 'for' ELSE 'against' END, v_weight);

  UPDATE genre_requests SET
    votes_for_count = votes_for_count + CASE WHEN p_opinion = 'approve' THEN 1 ELSE 0 END,
    votes_against_count = votes_against_count + CASE WHEN p_opinion = 'approve' THEN 0 ELSE 1 END,
    weighted_votes_for = weighted_votes_for + CASE WHEN p_opinion = 'approve' THEN v_weight ELSE 0 END,
    weighted_votes_against = weighted_votes_against + CASE WHEN p_opinion = 'approve' THEN 0 ELSE v_weight END,
    updated_at = now()
  WHERE id = p_request_id
  RETURNING weighted_votes_for, weighted_votes_against INTO v_weighted_for, v_weighted_against;

  IF v_weighted_for >= 5 AND v_weighted_for::NUMERIC / (v_weighted_for + v_weighted_against) >= 0.8 THEN
    UPDATE genre_requests SET status = 'approved', updated_at = now() WHERE id = p_request_id;
    PERFORM register_genre(v_genre_id, v_display_name, v_description, v_icon_image_url);
  ELSIF v_weighted_against >= 5 THEN
    UPDATE genre_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
