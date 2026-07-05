-- supabase-governance: 残存する直接 Firestore 依存の排除（Task 4.2 / 4.3）
-- ジャンルアイコン生成・AI作問（チャット/問題生成/サムネイル生成）の日次利用回数を
-- Firestore の users/{uid}/authoring_limits・users/{uid}/dailyAiAuthoringCounts サブコレクションから
-- Supabase の単一テーブルへ統合する。サーバー専用（Admin クライアント経由）のため、
-- クライアントからの直接アクセスは RLS で全面禁止する。

CREATE TABLE daily_usage_counters (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    counter_key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    counter_date DATE NOT NULL,
    PRIMARY KEY (user_id, counter_key)
);

ALTER TABLE daily_usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_usage_counters_policy ON daily_usage_counters FOR ALL USING (FALSE);

-- 日次カウンタをアトミックにインクリメントする（日付が変わっていれば1にリセットしてから加算）
CREATE OR REPLACE FUNCTION handle_increment_daily_usage_counter(
  p_user_id UUID,
  p_counter_key TEXT,
  p_today DATE
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO daily_usage_counters (user_id, counter_key, count, counter_date)
  VALUES (p_user_id, p_counter_key, 1, p_today)
  ON CONFLICT (user_id, counter_key) DO UPDATE SET
    count = CASE
      WHEN daily_usage_counters.counter_date = p_today THEN daily_usage_counters.count + 1
      ELSE 1
    END,
    counter_date = p_today
  RETURNING count INTO v_count;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
