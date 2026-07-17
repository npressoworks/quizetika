-- quizeum-governance-freeze: コミュニティガバナンス凍結マイグレーション
-- Task 2.1: 共有実行関数の抽出（execute_merge / register_genre）と
--           既存ガバナンスRPC 4種への凍結ゲート（governance-frozen）追加
-- 制約: DDL（CREATE OR REPLACE FUNCTION）のみで構成し、既存データへのDMLを含まない（Req 1.4）

-- ==========================================
-- Task 2.1 (1): 共有実行関数
-- 投票可決分岐（20260705000000_governance_normalization.sql の
-- handle_vote_merge_request / handle_vote_genre_request）から移設。動作は変更しない。
-- ==========================================

-- マージ実行: canonical書換 + merged_ids追記 + クイズ側の一括書き換え
-- （tag: quiz_tags付替 / genre: quizzes.genre・canonical_genre_id一括更新）
CREATE OR REPLACE FUNCTION execute_merge(
  p_target_type TEXT,
  p_source_id TEXT,
  p_target_id TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_target_type IS NULL OR p_source_id IS NULL OR p_target_id IS NULL THEN
    RAISE EXCEPTION 'invalid-argument';
  END IF;

  IF p_target_type = 'tag' THEN
    UPDATE metadata_tags SET canonical_id = p_target_id, updated_at = now() WHERE id = p_source_id;
    UPDATE metadata_tags SET merged_tag_ids = array_append(merged_tag_ids, p_source_id), updated_at = now() WHERE id = p_target_id;

    INSERT INTO quiz_tags (quiz_id, tag_id, original_label)
    SELECT quiz_id, p_target_id, original_label FROM quiz_tags WHERE tag_id = p_source_id
    ON CONFLICT (quiz_id, tag_id) DO NOTHING;
    DELETE FROM quiz_tags WHERE tag_id = p_source_id;
  ELSE
    UPDATE metadata_genres SET canonical_id = p_target_id, updated_at = now() WHERE id = p_source_id;
    UPDATE metadata_genres SET merged_genre_ids = array_append(merged_genre_ids, p_source_id), updated_at = now() WHERE id = p_target_id;

    UPDATE quizzes SET genre = p_target_id, canonical_genre_id = p_target_id, updated_at = now()
    WHERE canonical_genre_id = p_source_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ジャンル登録: metadata_genres へ INSERT（ID重複は unique violation / SQLSTATE 23505 で失敗）
CREATE OR REPLACE FUNCTION register_genre(
  p_genre_id TEXT,
  p_display_name TEXT,
  p_description TEXT,
  p_icon_image_url TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_genre_id IS NULL OR p_display_name IS NULL THEN
    RAISE EXCEPTION 'invalid-argument';
  END IF;

  INSERT INTO metadata_genres (id, display_name, description, icon_image_url, canonical_id, merged_genre_ids, is_active, updated_at)
  VALUES (p_genre_id, p_display_name, COALESCE(p_description, ''), p_icon_image_url, NULL, '{}', TRUE, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 共有実行関数は内部用（SECURITY DEFINER RPC からのみ呼び出す）。
-- 20260708000000 のデフォルト権限（ROUTINES への GRANT ALL）により PostgREST 経由で
-- 直接呼び出し可能になるため、クライアントロールから EXECUTE を剥奪する（Req 5.1）。
REVOKE EXECUTE ON FUNCTION execute_merge(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION register_genre(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ==========================================
-- Task 2.1 (2): 既存ガバナンスRPC 4種の凍結ゲート
-- 本体先頭で無条件に governance-frozen 例外を送出する（管理者含め全拒否 — Req 5.1, 5.2）。
-- シグネチャ・戻り値型は現行と同一に保つ（クライアント側ラッパー互換）。
-- ゲート以降の本体コードは到達不能だが、凍結解除時の復元マイグレーションの
-- 参照原本として残置する（可決分岐は共有実行関数呼び出しへ置換済み）。
-- ==========================================

-- マージ提案の起案（凍結ゲート付き）
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
  RAISE EXCEPTION 'governance-frozen';

  -- 以降は凍結中は到達不能（凍結解除時の復元参照用）
  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'banned';
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

-- マージ提案への投票（凍結ゲート付き。可決分岐は execute_merge へ移設済み）
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
  RAISE EXCEPTION 'governance-frozen';

  -- 以降は凍結中は到達不能（凍結解除時の復元参照用）
  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'banned';
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

  -- 複合PK制約により、同一投票者からの重複投票は一意制約違反として自動的に拒否される
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

-- ジャンル新設申請の起案（凍結ゲート付き）
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
  RAISE EXCEPTION 'governance-frozen';

  -- 以降は凍結中は到達不能（凍結解除時の復元参照用）
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

-- ジャンル新設申請への投票（凍結ゲート付き。可決分岐は register_genre へ移設済み）
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
  RAISE EXCEPTION 'governance-frozen';

  -- 以降は凍結中は到達不能（凍結解除時の復元参照用）
  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'banned';
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

-- ==========================================
-- Task 2.2: 管理者専用RPC 3種
-- handle_admin_execute_merge / handle_admin_resolve_merge_request / handle_admin_resolve_genre_request
-- 全て is_admin() ガード付き（非管理者は 'forbidden'）。凍結状態と独立して動作し、
-- 凍結解除後も管理者ツールとして残置する（design.md Key Decision 4）。
-- is_admin() ガードにより認可は関数内で強制されるため、共有実行関数と異なり
-- クライアントロールからの EXECUTE 剥奪（REVOKE）は行わない（design.md Implementation Notes）。
-- ==========================================

-- 管理者による新規マージの即時実行（Req 3.1, 3.2, 3.3）
-- same-id / circular 検証は handle_create_merge_request の検証ロジックを踏襲し、
-- merge_requests へ監査行（requester_id = 管理者UID, status = 'approved'）を残した上で
-- execute_merge を即時実行する。投票を経ないため各投票カウントは 0 のまま。
CREATE OR REPLACE FUNCTION handle_admin_execute_merge(
  p_target_type TEXT,
  p_source_id TEXT,
  p_target_id TEXT,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
  v_current TEXT;
  v_visited TEXT[] := ARRAY[p_target_id];
BEGIN
  IF NOT is_admin() THEN
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

  -- 監査行: 管理者の即時マージも merge_requests へ記録する（design.md Security Considerations）
  INSERT INTO merge_requests (target_type, source_id, target_id, requester_id, reason, status)
  VALUES (p_target_type, p_source_id, p_target_id, auth.uid(), COALESCE(p_reason, ''), 'approved')
  RETURNING id INTO v_request_id;

  PERFORM execute_merge(p_target_type, p_source_id, p_target_id);

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者による保留中マージ提案の単独処理（Req 3.4）
-- approve: execute_merge + status='approved' / reject: status='rejected'
CREATE OR REPLACE FUNCTION handle_admin_resolve_merge_request(
  p_request_id UUID,
  p_decision TEXT
) RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_source_id TEXT;
  v_target_id TEXT;
  v_target_type TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid-argument';
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

  IF p_decision = 'approve' THEN
    UPDATE merge_requests SET status = 'approved', updated_at = now() WHERE id = p_request_id;
    PERFORM execute_merge(v_target_type, v_source_id, v_target_id);
  ELSE
    UPDATE merge_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者による保留中ジャンル新設申請の単独処理（Req 4.2, 4.3）
-- approve: register_genre + status='approved'（ジャンルID重複は register_genre 内の
-- INSERT が SQLSTATE 23505 で失敗しそのまま伝播） / reject: status='rejected'
CREATE OR REPLACE FUNCTION handle_admin_resolve_genre_request(
  p_request_id UUID,
  p_decision TEXT
) RETURNS VOID AS $$
DECLARE
  v_status TEXT;
  v_genre_id TEXT;
  v_display_name TEXT;
  v_description TEXT;
  v_icon_image_url TEXT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'invalid-argument';
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

  IF p_decision = 'approve' THEN
    UPDATE genre_requests SET status = 'approved', updated_at = now() WHERE id = p_request_id;
    PERFORM register_genre(v_genre_id, v_display_name, v_description, v_icon_image_url);
  ELSE
    UPDATE genre_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
