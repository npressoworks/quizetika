-- supabase-governance: NGワードマスタ管理機能の追加（Phase 39）
-- Task 5.1: NGワードマスタのスキーマとCRUD RPCのマイグレーション

-- ==========================================
-- Task 5.1: 新規テーブル
-- ==========================================

-- NGワードマスタ（クイズ公開時に検知する禁止語句）
CREATE TABLE ng_words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT NOT NULL,
    normalized_word TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
-- 大文字・小文字を区別しない重複登録をDB制約レベルで防止する
CREATE UNIQUE INDEX idx_ng_words_normalized_word ON ng_words (normalized_word);

-- ==========================================
-- Task 5.1: RLS
-- ==========================================
ALTER TABLE ng_words ENABLE ROW LEVEL SECURITY;

-- ng_words: クイズ公開時検証(quizetika-core)およびクライアント側事前検証UIの双方から読み取れるよう全員に許可し、書き込みはRPC限定
CREATE POLICY ng_words_read ON ng_words FOR SELECT USING (TRUE);

-- ==========================================
-- Task 5.1: NGワードマスタ CRUD RPC
-- ==========================================

-- NGワードの新規登録
CREATE OR REPLACE FUNCTION handle_create_ng_word(
  p_word TEXT
) RETURNS ng_words AS $$
DECLARE
  v_normalized TEXT;
  v_row ng_words;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  v_normalized := lower(trim(p_word));
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'empty-word';
  END IF;

  INSERT INTO ng_words (word, normalized_word, is_active)
  VALUES (trim(p_word), v_normalized, TRUE)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NGワードの表記編集
CREATE OR REPLACE FUNCTION handle_update_ng_word(
  p_id UUID,
  p_word TEXT
) RETURNS ng_words AS $$
DECLARE
  v_normalized TEXT;
  v_row ng_words;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  v_normalized := lower(trim(p_word));
  IF v_normalized = '' THEN
    RAISE EXCEPTION 'empty-word';
  END IF;

  UPDATE ng_words SET word = trim(p_word), normalized_word = v_normalized, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NGワードの有効/無効切替
CREATE OR REPLACE FUNCTION handle_set_ng_word_active(
  p_id UUID,
  p_is_active BOOLEAN
) RETURNS ng_words AS $$
DECLARE
  v_row ng_words;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'permission-denied';
  END IF;

  UPDATE ng_words SET is_active = p_is_active, updated_at = now()
  WHERE id = p_id
  RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'target-not-found';
  END IF;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
