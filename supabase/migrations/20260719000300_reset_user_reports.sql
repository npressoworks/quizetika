-- handle_reset_user_reports / get_user_open_report_count の2RPC定義
-- Task 11.2: ユーザー直接通報数のリセット（Requirement 12）
-- 20260719000200 で追加済みの admin_log_action_enum の 'report_reset' 値を参照する。
-- （enum値追加と同一トランザクションではないため、この時点で参照可能）

-- ==========================================
-- RPC: handle_reset_user_reports
-- 対象ユーザーへのユーザー直接通報（status='open'）を一括で解決済みにする
-- ==========================================
CREATE OR REPLACE FUNCTION handle_reset_user_reports(
  p_target_uid UUID,
  p_reason TEXT
) RETURNS VOID AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_target_uid) THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  IF p_reason IS NULL OR length(p_reason) < 10 THEN
    RAISE EXCEPTION 'reason-too-short';
  END IF;

  -- 対象に未処理の直接通報が0件の場合でもエラーにはせず、0件更新として正常終了する（冪等）
  UPDATE user_reports
  SET status = 'resolved'
  WHERE target_uid = p_target_uid AND status = 'open';

  -- quizzes テーブルへは一切書き込まない（クイズ通報累計 flags_count は対象外、Requirement 12.8）
  INSERT INTO admin_logs (target_uid, executor_id, action, reason)
  VALUES (p_target_uid, auth.uid(), 'report_reset', p_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RPC: get_user_open_report_count
-- 対象ユーザーの未処理（status='open'）直接通報件数を返す（Requirement 12.7の非活性化判定用）
-- ==========================================
CREATE OR REPLACE FUNCTION get_user_open_report_count(
  p_target_uid UUID
) RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM user_reports
  WHERE target_uid = p_target_uid AND status = 'open';

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
