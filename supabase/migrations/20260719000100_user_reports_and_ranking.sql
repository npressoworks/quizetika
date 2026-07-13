-- user_reportsテーブル・RLS・5種のRPC定義（BAN機能見直し: 通報ランキング・ティア引き下げ・BAN済み一覧）
-- Task 5.2: user_reports テーブル、RLS、handle_report_user / handle_downgrade_tier /
--           get_reported_users_ranking / get_banned_users / get_user_admin_logs

-- ==========================================
-- user_reports テーブル
-- ==========================================
CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  target_uid UUID NOT NULL REFERENCES users(id),
  category TEXT NOT NULL CHECK (category IN ('harassment', 'impersonation', 'spam', 'other')),
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 同一通報者・同一対象への未処理(open)通報は高々1件（重複防止・冪等性の担保）
CREATE UNIQUE INDEX user_reports_open_unique
  ON user_reports (reporter_id, target_uid)
  WHERE status = 'open';

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
-- admin_logs と同じ規約: クライアントからの直接SELECT/INSERT/UPDATEは一切許可しない。
-- 読み書きは本ファイルで定義する SECURITY DEFINER RPC 経由のみとする。
CREATE POLICY user_reports_policy ON user_reports FOR ALL USING (FALSE) WITH CHECK (FALSE);

-- ==========================================
-- RPC: handle_report_user
-- ユーザー本人への直接通報を受け付ける（自己通報拒否・カテゴリ検証・冪等な重複防止）
-- ==========================================
CREATE OR REPLACE FUNCTION handle_report_user(
  p_target_uid UUID,
  p_category TEXT,
  p_detail TEXT
) RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  IF auth.uid() = p_target_uid THEN
    RAISE EXCEPTION 'self-report';
  END IF;

  IF p_category NOT IN ('harassment', 'impersonation', 'spam', 'other') THEN
    RAISE EXCEPTION 'invalid-category';
  END IF;

  IF p_detail IS NULL OR length(trim(p_detail)) = 0 THEN
    RAISE EXCEPTION 'detail-required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  -- 既存のstatus='open'行がある場合は何もしない（冪等、同一通報者による多重カウント防止）
  INSERT INTO user_reports (reporter_id, target_uid, category, detail, status, created_at)
  VALUES (auth.uid(), p_target_uid, p_category, p_detail, 'open', now())
  ON CONFLICT (reporter_id, target_uid) WHERE status = 'open' DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: handle_downgrade_tier
-- モデレータティアーを、現在より厳密に下位のティアへのみ変更する
-- ==========================================
CREATE OR REPLACE FUNCTION handle_downgrade_tier(
  p_target_uid UUID,
  p_new_tier moderation_tier_enum,
  p_reason TEXT
) RETURNS VOID AS $$
DECLARE
  v_current_tier moderation_tier_enum;
  v_current_rank INTEGER;
  v_new_rank INTEGER;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  IF p_reason IS NULL OR length(p_reason) < 10 THEN
    RAISE EXCEPTION 'reason-too-short';
  END IF;

  SELECT moderation_tier INTO v_current_tier FROM users WHERE id = p_target_uid;
  IF v_current_tier IS NULL THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  -- newcomer(0) < contributor(1) < moderator(2) < senior_moderator(3) < admin(4)
  v_current_rank := CASE v_current_tier
    WHEN 'newcomer' THEN 0
    WHEN 'contributor' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'senior_moderator' THEN 3
    WHEN 'admin' THEN 4
    ELSE 0
  END;
  v_new_rank := CASE p_new_tier
    WHEN 'newcomer' THEN 0
    WHEN 'contributor' THEN 1
    WHEN 'moderator' THEN 2
    WHEN 'senior_moderator' THEN 3
    WHEN 'admin' THEN 4
    ELSE 0
  END;

  IF v_new_rank >= v_current_rank THEN
    RAISE EXCEPTION 'invalid-tier-downgrade';
  END IF;

  UPDATE users SET moderation_tier = p_new_tier, updated_at = now()
  WHERE id = p_target_uid;

  INSERT INTO admin_logs (target_uid, executor_id, action, reason)
  VALUES (p_target_uid, auth.uid(), 'tier_downgrade', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: get_reported_users_ranking
-- 総通報数（著者クイズのflags_count合算 + user_reports合算）降順のユーザー一覧を返す
-- ==========================================
CREATE OR REPLACE FUNCTION get_reported_users_ranking(
  p_limit INT,
  p_offset INT
) RETURNS TABLE (
  uid UUID,
  display_name TEXT,
  moderation_tier moderation_tier_enum,
  is_banned BOOLEAN,
  total_report_count BIGINT,
  latest_report_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  RETURN QUERY
  WITH quiz_flags AS (
    -- クイズ単位の通報タイムスタンプは個別に記録されていないため、
    -- 「著者への通報が発生し得た最新時刻」の代替指標として quizzes.updated_at を用いる
    -- （flags_count > 0 のクイズに限定し、更新日時を通報寄与時刻の近似値として扱う。research.md参照）
    SELECT
      q.author_id AS target_uid,
      SUM(q.flags_count) AS report_count,
      MAX(q.updated_at) FILTER (WHERE q.flags_count > 0) AS latest_at
    FROM quizzes q
    WHERE q.flags_count > 0
    GROUP BY q.author_id
  ),
  direct_reports AS (
    SELECT
      ur.target_uid AS target_uid,
      COUNT(*) AS report_count,
      MAX(ur.created_at) AS latest_at
    FROM user_reports ur
    WHERE ur.status = 'open'
    GROUP BY ur.target_uid
  ),
  combined AS (
    SELECT
      u.id AS target_uid,
      COALESCE(qf.report_count, 0) + COALESCE(dr.report_count, 0) AS total_report_count,
      GREATEST(qf.latest_at, dr.latest_at) AS latest_report_at
    FROM users u
    LEFT JOIN quiz_flags qf ON qf.target_uid = u.id
    LEFT JOIN direct_reports dr ON dr.target_uid = u.id
    WHERE COALESCE(qf.report_count, 0) + COALESCE(dr.report_count, 0) > 0
  )
  SELECT
    c.target_uid AS uid,
    u.display_name,
    u.moderation_tier,
    u.is_banned,
    c.total_report_count,
    c.latest_report_at
  FROM combined c
  JOIN users u ON u.id = c.target_uid
  ORDER BY c.total_report_count DESC, c.latest_report_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================
-- RPC: get_banned_users
-- BAN済みユーザー一覧を、実行者情報を含めて返す（日時フィルタ・キーワード検索対応）
-- ==========================================
CREATE OR REPLACE FUNCTION get_banned_users(
  p_limit INT,
  p_offset INT,
  p_banned_from TIMESTAMPTZ,
  p_banned_to TIMESTAMPTZ,
  p_keyword TEXT
) RETURNS TABLE (
  uid UUID,
  display_name TEXT,
  banned_reason TEXT,
  banned_at TIMESTAMPTZ,
  banned_by_executor_id UUID
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  RETURN QUERY
  WITH latest_ban_log AS (
    SELECT DISTINCT ON (al.target_uid)
      al.target_uid,
      al.executor_id
    FROM admin_logs al
    WHERE al.action = 'ban'
    ORDER BY al.target_uid, al.created_at DESC
  )
  SELECT
    u.id AS uid,
    u.display_name,
    u.banned_reason,
    u.banned_at,
    lbl.executor_id AS banned_by_executor_id
  FROM users u
  LEFT JOIN latest_ban_log lbl ON lbl.target_uid = u.id
  WHERE u.is_banned = TRUE
    AND (p_banned_from IS NULL OR u.banned_at >= p_banned_from)
    AND (p_banned_to IS NULL OR u.banned_at <= p_banned_to)
    AND (
      p_keyword IS NULL OR length(trim(p_keyword)) = 0
      OR u.id::TEXT ILIKE '%' || p_keyword || '%'
      OR u.display_name ILIKE '%' || p_keyword || '%'
    )
  ORDER BY u.banned_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==========================================
-- RPC: get_user_admin_logs
-- 対象ユーザーの監査ログ履歴を降順で返す
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_admin_logs(
  p_target_uid UUID
) RETURNS TABLE (
  id UUID,
  action admin_log_action_enum,
  executor_id UUID,
  reason TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  RETURN QUERY
  SELECT al.id, al.action, al.executor_id, al.reason, al.created_at
  FROM admin_logs al
  WHERE al.target_uid = p_target_uid
  ORDER BY al.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
