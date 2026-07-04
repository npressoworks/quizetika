-- supabase-governance: ガバナンス系スキーマ是正 + RPC定義
-- Task 1.1: 既存プレースホルダーテーブルのALTERと新規テーブル作成、RLSポリシー是正
-- Task 1.2: 共有認可・重みヘルパーとコンテンツ通報RPC
-- Task 1.3: マージ・ジャンル新設投票RPC（可決時のクイズ一括書き換えを同期実行）
-- Task 1.4: BAN・UNBAN・レピュテーションリセットRPC

-- ==========================================
-- Task 1.1: 既存テーブルへの ALTER
-- ==========================================

-- flags: 同一報告者による重複通報を原子的に防止する
ALTER TABLE flags ADD CONSTRAINT flags_quiz_reporter_unique UNIQUE (quiz_id, reporter_id);

-- metadata_genres: metadata_tags と非対称だった updated_at を追加する
ALTER TABLE metadata_genres ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- merge_requests: 汎用プレースホルダー(details JSONB)から実際の業務要件に即した明示列へ是正する
ALTER TABLE merge_requests DROP COLUMN details;
ALTER TABLE merge_requests RENAME COLUMN created_by TO requester_id;
ALTER TABLE merge_requests ADD COLUMN target_type TEXT NOT NULL CHECK (target_type IN ('tag', 'genre'));
ALTER TABLE merge_requests ADD COLUMN source_id TEXT NOT NULL;
ALTER TABLE merge_requests ADD COLUMN target_id TEXT NOT NULL;
ALTER TABLE merge_requests ADD COLUMN reason TEXT NOT NULL DEFAULT '';
ALTER TABLE merge_requests ADD COLUMN votes_for_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merge_requests ADD COLUMN votes_against_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merge_requests ADD COLUMN weighted_votes_for INTEGER NOT NULL DEFAULT 0;
ALTER TABLE merge_requests ADD COLUMN weighted_votes_against INTEGER NOT NULL DEFAULT 0;
-- 同一 (source_id, target_id) の pending提案は常に高々1件
CREATE UNIQUE INDEX idx_merge_requests_pending_dedup ON merge_requests (source_id, target_id) WHERE status = 'pending';

-- genre_requests: 同様に明示列へ是正する
ALTER TABLE genre_requests DROP COLUMN details;
ALTER TABLE genre_requests RENAME COLUMN created_by TO requester_id;
ALTER TABLE genre_requests ADD COLUMN genre_id TEXT NOT NULL;
ALTER TABLE genre_requests ADD COLUMN display_name TEXT NOT NULL;
ALTER TABLE genre_requests ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE genre_requests ADD COLUMN icon_image_url TEXT;
ALTER TABLE genre_requests ADD COLUMN votes_for_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE genre_requests ADD COLUMN votes_against_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE genre_requests ADD COLUMN weighted_votes_for INTEGER NOT NULL DEFAULT 0;
ALTER TABLE genre_requests ADD COLUMN weighted_votes_against INTEGER NOT NULL DEFAULT 0;

-- ==========================================
-- Task 1.1: 新規テーブル
-- ==========================================

-- マージ提案への投票（votedUserIds/votes配列の正規化）
CREATE TABLE merge_request_votes (
    request_id UUID REFERENCES merge_requests(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    opinion TEXT NOT NULL CHECK (opinion IN ('for', 'against')),
    weight INTEGER NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (request_id, voter_id)
);

-- ジャンル新設申請への投票
CREATE TABLE genre_request_votes (
    request_id UUID REFERENCES genre_requests(id) ON DELETE CASCADE NOT NULL,
    voter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    opinion TEXT NOT NULL CHECK (opinion IN ('for', 'against')),
    weight INTEGER NOT NULL,
    voted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (request_id, voter_id)
);

-- Stripe Webhook 冪等性台帳
CREATE TABLE stripe_processed_events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- レピュテーション加算上限（users/{uid}/reputationLimits/{senderId} 相当）
CREATE TABLE reputation_limits (
    author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    total_delta INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (author_id, sender_id)
);

-- ==========================================
-- Task 1.1: RLS
-- ==========================================
ALTER TABLE merge_request_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE genre_request_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY merge_request_votes_read ON merge_request_votes FOR SELECT USING (TRUE);
CREATE POLICY genre_request_votes_read ON genre_request_votes FOR SELECT USING (TRUE);
-- 書き込みは SECURITY DEFINER RPC 経由のみ許可し、クライアントからの直接書き込みは拒否する

CREATE POLICY stripe_processed_events_policy ON stripe_processed_events FOR ALL USING (FALSE); -- service_role のみアクセス可
CREATE POLICY reputation_limits_read ON reputation_limits FOR SELECT
    USING (auth.uid() = author_id OR auth.uid() = sender_id);

-- 既存 RLS の是正: merge_requests / genre_requests への直接書き込みを禁止し RPC 経由に一本化する
-- （現行ポリシーは「モデレータ以上のみ書き込み可」だが、実際の業務規則は「BANされていない任意ユーザーが提案・投票可」であり不整合のため）
DROP POLICY IF EXISTS merge_requests_write ON merge_requests;
DROP POLICY IF EXISTS genre_requests_write ON genre_requests;

-- ==========================================
-- Task 1.2: 共有ヘルパー関数
-- ==========================================

-- role='admin' または moderation_tier='admin' を統一的に判定する
-- (既存コードの isAdminUser() と対称。reputation.ts が moderation_tier のみを見ていた不整合を解消)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'admin' OR moderation_tier = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- コンテンツ審査権限（シニアモデレータ以上、または管理者）を判定する
CREATE OR REPLACE FUNCTION is_moderator_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND (moderation_tier = 'senior_moderator' OR role = 'admin' OR moderation_tier = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- モデレーションティアに応じた投票重みを解決する
CREATE OR REPLACE FUNCTION resolve_vote_weight(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_tier moderation_tier_enum;
BEGIN
  SELECT moderation_tier INTO v_tier FROM users WHERE id = p_user_id;
  RETURN CASE WHEN v_tier = 'senior_moderator' THEN 2 ELSE 1 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================
-- Task 1.2: コンテンツ通報・審査 RPC
-- ==========================================

-- コンテンツ通報（同一報告者の重複を冪等に無視し、閾値到達で自動保留する）
CREATE OR REPLACE FUNCTION handle_flag_content(
  p_quiz_id UUID,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  IF NOT is_not_banned() THEN
    RAISE EXCEPTION 'banned';
  END IF;

  INSERT INTO flags (quiz_id, reporter_id, reason)
  VALUES (p_quiz_id, auth.uid(), p_reason)
  ON CONFLICT (quiz_id, reporter_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN; -- 既に通報済み（冪等）
  END IF;

  UPDATE quizzes SET flags_count = flags_count + 1 WHERE id = p_quiz_id
  RETURNING flags_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'クイズが見つかりません: %', p_quiz_id;
  END IF;

  IF v_new_count >= 5 THEN
    UPDATE quizzes SET status = 'suspended' WHERE id = p_quiz_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者によるコンテンツ審査（公開復帰 または 永久削除）
CREATE OR REPLACE FUNCTION handle_resolve_flag(
  p_quiz_id UUID,
  p_action TEXT
) RETURNS VOID AS $$
DECLARE
  v_author_id UUID;
  v_title TEXT;
BEGIN
  IF NOT is_moderator_or_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  IF p_action = 'restore' THEN
    UPDATE quizzes SET status = 'published', flags_count = 0, updated_at = now() WHERE id = p_quiz_id;
  ELSIF p_action = 'delete' THEN
    SELECT author_id, title INTO v_author_id, v_title FROM quizzes WHERE id = p_quiz_id;
    IF v_author_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, content)
      VALUES (v_author_id, 'コンテンツが削除されました', 'コミュニティガイドライン違反のため、「' || COALESCE(v_title, '') || '」が削除されました。');
    END IF;
    DELETE FROM quizzes WHERE id = p_quiz_id;
  ELSE
    RAISE EXCEPTION 'invalid-action: %', p_action;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Task 1.3: マージ・ジャンル新設投票 RPC
-- ==========================================

-- マージ提案の起案（循環参照チェック + 自動賛成票）
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

-- マージ提案への投票（可決/否決時はクイズ側の一括書き換えまで同期完結する）
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

    IF v_target_type = 'tag' THEN
      UPDATE metadata_tags SET canonical_id = v_target_id, updated_at = now() WHERE id = v_source_id;
      UPDATE metadata_tags SET merged_tag_ids = array_append(merged_tag_ids, v_source_id), updated_at = now() WHERE id = v_target_id;

      INSERT INTO quiz_tags (quiz_id, tag_id, original_label)
      SELECT quiz_id, v_target_id, original_label FROM quiz_tags WHERE tag_id = v_source_id
      ON CONFLICT (quiz_id, tag_id) DO NOTHING;
      DELETE FROM quiz_tags WHERE tag_id = v_source_id;
    ELSE
      UPDATE metadata_genres SET canonical_id = v_target_id, updated_at = now() WHERE id = v_source_id;
      UPDATE metadata_genres SET merged_genre_ids = array_append(merged_genre_ids, v_source_id), updated_at = now() WHERE id = v_target_id;

      UPDATE quizzes SET genre = v_target_id, canonical_genre_id = v_target_id, updated_at = now()
      WHERE canonical_genre_id = v_source_id;
    END IF;
  ELSIF v_weighted_against >= 5 THEN
    UPDATE merge_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ジャンル新設申請の起案
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

-- ジャンル新設申請への投票（可決時はジャンルマスタへ登録するまで同期完結する）
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

    INSERT INTO metadata_genres (id, display_name, description, icon_image_url, canonical_id, merged_genre_ids, is_active, updated_at)
    VALUES (v_genre_id, v_display_name, COALESCE(v_description, ''), v_icon_image_url, NULL, '{}', TRUE, now());
  ELSIF v_weighted_against >= 5 THEN
    UPDATE genre_requests SET status = 'rejected', updated_at = now() WHERE id = p_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- Task 1.4: BAN・UNBAN・レピュテーションリセット RPC
-- ==========================================

-- 管理者によるBAN
CREATE OR REPLACE FUNCTION handle_ban_user(
  p_target_uid UUID,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;
  IF length(p_reason) < 10 THEN
    RAISE EXCEPTION 'reason-too-short';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  UPDATE users SET is_banned = TRUE, banned_reason = p_reason, banned_at = now(), updated_at = now()
  WHERE id = p_target_uid;

  INSERT INTO admin_logs (target_uid, executor_id, action, reason)
  VALUES (p_target_uid, auth.uid(), 'ban', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者によるUNBAN
CREATE OR REPLACE FUNCTION handle_unban_user(
  p_target_uid UUID
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  UPDATE users SET is_banned = FALSE, banned_reason = NULL, banned_at = NULL, updated_at = now()
  WHERE id = p_target_uid;

  INSERT INTO admin_logs (target_uid, executor_id, action)
  VALUES (p_target_uid, auth.uid(), 'unban');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 管理者による信頼スコア・ティア強制リセット
CREATE OR REPLACE FUNCTION handle_reset_user_reputation(
  p_target_uid UUID,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;
  IF length(p_reason) < 10 THEN
    RAISE EXCEPTION 'reason-too-short';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  UPDATE users SET reputation_score = 0, moderation_tier = 'newcomer', updated_at = now()
  WHERE id = p_target_uid;

  INSERT INTO admin_logs (target_uid, executor_id, action, reason)
  VALUES (p_target_uid, auth.uid(), 'reputation_reset', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
