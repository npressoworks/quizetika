-- supabase-core-data: Firestore 由来の非正規化構造を RDB に最適化された正規化構造へ移行する
-- Phase 1 (Additive) + Phase 2 (Backfill) + Phase 3 (Cutover 準備としての RPC 再定義)
-- 旧列の削除 (Phase 4) は 20260703000100_core_data_cleanup.sql で行う

-- ==========================================
-- Phase 1: 中間テーブル・カタログテーブルの追加
-- ==========================================

-- バッジカタログ（src/services/user.ts の BADGE_DEFINITIONS と同期させるマスタ）
CREATE TABLE badges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_name TEXT NOT NULL
);

INSERT INTO badges (id, title, description, icon_name) VALUES
    ('play_10', '初挑戦者', '10回クイズに挑戦した', 'play-circle'),
    ('play_50', '常連プレイヤー', '50回クイズに挑戦した', 'zap'),
    ('play_100', '百戦錬磨', '100回クイズに挑戦した', 'star'),
    ('play_500', 'クイズ狂', '500回クイズに挑戦した', 'award'),
    ('play_1000', 'レジェンドプレイヤー', '1000回クイズに挑戦した', 'crown'),
    ('create_1', 'クイズクリエイター', '初めてクイズを公開した', 'pencil'),
    ('create_10', '多作クリエイター', '10個のクイズを公開した', 'book-open'),
    ('create_50', '知識の伝道師', '50個のクイズを公開した', 'library'),
    ('followers_10', '人気者', '10人にフォローされた', 'users'),
    ('followers_100', 'インフルエンサー', '100人にフォローされた', 'trending-up'),
    ('followers_1000', 'クイズ界のスター', '1000人にフォローされた', 'sparkles');

-- ユーザー獲得バッジ（旧 users.badges JSONB を正規化）
CREATE TABLE user_badges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT REFERENCES badges(id) ON DELETE RESTRICT NOT NULL,
    unlocked_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, badge_id)
);

-- ユーザーのフォロー中ジャンル（旧 users.followed_genres TEXT[] を正規化）
CREATE TABLE user_genre_follows (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    genre_id TEXT REFERENCES metadata_genres(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (user_id, genre_id)
);

-- クイズタグの多対多関連（旧 quizzes.tags / original_tags / canonical_tag_ids TEXT[] を正規化）
CREATE TABLE quiz_tags (
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    tag_id TEXT REFERENCES metadata_tags(id) ON DELETE RESTRICT NOT NULL,
    original_label TEXT NOT NULL,
    PRIMARY KEY (quiz_id, tag_id)
);
CREATE INDEX idx_quiz_tags_tag_id ON quiz_tags(tag_id);

-- クイズと問題の多対多関連 + 表示順序（旧 quizzes.question_ids / questions JSONB を正規化）
CREATE TABLE quiz_questions (
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    display_order INTEGER NOT NULL,
    PRIMARY KEY (quiz_id, question_id),
    UNIQUE (quiz_id, display_order) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_quiz_questions_question_id ON quiz_questions(question_id);

-- ==========================================
-- Phase 2: 旧データの正規化テーブルへのバックフィル
-- ==========================================

-- users.badges (JSONB) -> user_badges
INSERT INTO user_badges (user_id, badge_id, unlocked_at)
SELECT u.id, elem->>'id', COALESCE((elem->>'unlockedAt')::timestamptz, now())
FROM users u, jsonb_array_elements(COALESCE(u.badges, '[]'::jsonb)) elem
WHERE elem->>'id' IN (SELECT id FROM badges)
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- users.followed_genres (TEXT[]) -> user_genre_follows
INSERT INTO user_genre_follows (user_id, genre_id)
SELECT u.id, genre
FROM users u, unnest(COALESCE(u.followed_genres, '{}'::text[])) AS genre
WHERE genre IN (SELECT id FROM metadata_genres)
ON CONFLICT (user_id, genre_id) DO NOTHING;

-- quizzes.canonical_tag_ids / original_tags (TEXT[]) -> quiz_tags
INSERT INTO quiz_tags (quiz_id, tag_id, original_label)
SELECT q.id, t.tag_id, COALESCE(o.original_label, t.tag_id)
FROM quizzes q
CROSS JOIN LATERAL unnest(COALESCE(q.canonical_tag_ids, '{}'::text[])) WITH ORDINALITY AS t(tag_id, ord)
LEFT JOIN LATERAL (
    SELECT ot AS original_label, ordinality AS ord2
    FROM unnest(COALESCE(q.original_tags, '{}'::text[])) WITH ORDINALITY AS o(ot, ordinality)
) o ON o.ord2 = t.ord
WHERE t.tag_id IN (SELECT id FROM metadata_tags)
ON CONFLICT (quiz_id, tag_id) DO NOTHING;

-- quizzes.question_ids (UUID[]) -> quiz_questions（配列インデックスを display_order とする）
INSERT INTO quiz_questions (quiz_id, question_id, display_order)
SELECT q.id, t.question_id, t.ord - 1
FROM quizzes q
CROSS JOIN LATERAL unnest(COALESCE(q.question_ids, '{}'::uuid[])) WITH ORDINALITY AS t(question_id, ord)
WHERE t.question_id IN (SELECT id FROM questions)
ON CONFLICT (quiz_id, question_id) DO NOTHING;

-- ==========================================
-- Phase 3: questions.quiz_id の意味分離（所有クイズ参照への改称）
-- ==========================================
-- 旧 ON DELETE CASCADE のままだと、クイズ削除時に他クイズから quiz_questions 経由で
-- 参照共有されている問題まで巻き添えで削除されてしまうため、SET NULL に変更し、
-- 実際の削除判断はアプリケーション層（quiz.ts の deleteQuiz）に委譲する。
ALTER TABLE questions RENAME COLUMN quiz_id TO owner_quiz_id;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_quiz_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_owner_quiz_id_fkey
    FOREIGN KEY (owner_quiz_id) REFERENCES quizzes(id) ON DELETE SET NULL;

CREATE INDEX idx_questions_owner_quiz_id ON questions(owner_quiz_id);

-- ==========================================
-- Phase 3: follows / bookmarks の複合主キー化
-- ==========================================
ALTER TABLE follows DROP CONSTRAINT follows_pkey;
ALTER TABLE follows DROP COLUMN id;
ALTER TABLE follows ADD PRIMARY KEY (follower_id, following_id);

ALTER TABLE bookmarks DROP CONSTRAINT bookmarks_pkey;
ALTER TABLE bookmarks DROP COLUMN id;
ALTER TABLE bookmarks ADD PRIMARY KEY (user_id, target_id, target_type);

-- ==========================================
-- Phase 3: RPC 関数の複合キー対応再定義・新設
-- ==========================================

CREATE OR REPLACE FUNCTION handle_follow_user(
  p_follower_id UUID,
  p_following_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_inserted BOOLEAN := FALSE;
BEGIN
  INSERT INTO follows (follower_id, following_id, created_at)
  VALUES (p_follower_id, p_following_id, now())
  ON CONFLICT (follower_id, following_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF NOT v_inserted THEN
    RETURN FALSE;
  END IF;

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
  v_deleted BOOLEAN := FALSE;
BEGIN
  DELETE FROM follows WHERE follower_id = p_follower_id AND following_id = p_following_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF NOT v_deleted THEN
    RETURN FALSE;
  END IF;

  UPDATE users SET following_count = GREATEST(0, following_count - 1), updated_at = now() WHERE id = p_follower_id;
  UPDATE users SET followers_count = GREATEST(0, followers_count - 1), updated_at = now() WHERE id = p_following_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 署名変更 (JSONB -> TEXT[] / JSONB -> TEXT[]) のため一度 DROP してから再作成する
DROP FUNCTION IF EXISTS handle_check_and_award_badges(UUID, JSONB);

CREATE OR REPLACE FUNCTION handle_check_and_award_badges(
  p_user_id UUID,
  p_badge_ids TEXT[]
) RETURNS TEXT[] AS $$
DECLARE
  v_awarded TEXT[];
BEGIN
  INSERT INTO user_badges (user_id, badge_id, unlocked_at)
  SELECT p_user_id, b, now() FROM unnest(p_badge_ids) AS b
  ON CONFLICT (user_id, badge_id) DO NOTHING
  RETURNING badge_id INTO v_awarded;

  RETURN COALESCE(v_awarded, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION handle_bookmark_toggle(
  p_user_id UUID,
  p_target_id UUID,
  p_target_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_already_exists BOOLEAN;
  v_target_exists BOOLEAN;
BEGIN
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

  SELECT EXISTS(
    SELECT 1 FROM bookmarks
    WHERE user_id = p_user_id AND target_id = p_target_id AND target_type = p_target_type::bookmark_target_type_enum
  ) INTO v_already_exists;

  IF v_already_exists THEN
    DELETE FROM bookmarks
    WHERE user_id = p_user_id AND target_id = p_target_id AND target_type = p_target_type::bookmark_target_type_enum;

    IF p_target_type = 'quiz' THEN
      UPDATE quizzes SET bookmarks_count = GREATEST(0, COALESCE(bookmarks_count, 0) - 1), updated_at = now() WHERE id = p_target_id;
    ELSE
      UPDATE questions SET bookmarks_count = GREATEST(0, COALESCE(bookmarks_count, 0) - 1) WHERE id = p_target_id;
    END IF;

    RETURN FALSE;
  ELSE
    INSERT INTO bookmarks (user_id, target_id, target_type, created_at)
    VALUES (p_user_id, p_target_id, p_target_type::bookmark_target_type_enum, now());

    IF p_target_type = 'quiz' THEN
      UPDATE quizzes SET bookmarks_count = COALESCE(bookmarks_count, 0) + 1, updated_at = now() WHERE id = p_target_id;
    ELSE
      UPDATE questions SET bookmarks_count = COALESCE(bookmarks_count, 0) + 1 WHERE id = p_target_id;
    END IF;

    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新設: 問題並び替え（要件 2.3 を初めて実装する RPC）
CREATE OR REPLACE FUNCTION handle_reorder_questions(
  p_quiz_id UUID,
  p_question_ids UUID[]
) RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE quiz_questions AS qq
  SET display_order = ordering.ord
  FROM (
    SELECT unnest(p_question_ids) AS question_id, generate_series(0, array_length(p_question_ids, 1) - 1) AS ord
  ) AS ordering
  WHERE qq.quiz_id = p_quiz_id AND qq.question_id = ordering.question_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> array_length(p_question_ids, 1) THEN
    RAISE EXCEPTION 'Question set does not match quiz_questions membership for quiz %', p_quiz_id;
  END IF;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- RLS: 新規テーブルのポリシー定義
-- ==========================================
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_genre_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY badges_read ON badges FOR SELECT USING (TRUE);

CREATE POLICY user_badges_read ON user_badges FOR SELECT USING (TRUE);
-- 書き込みは handle_check_and_award_badges (SECURITY DEFINER) 経由のみ許可し、クライアントからの直接書き込みは拒否する

CREATE POLICY user_genre_follows_read ON user_genre_follows FOR SELECT USING (TRUE);
CREATE POLICY user_genre_follows_write ON user_genre_follows FOR ALL
    USING (auth.uid() = user_id AND is_not_banned())
    WITH CHECK (auth.uid() = user_id AND is_not_banned());

CREATE POLICY quiz_tags_read ON quiz_tags FOR SELECT USING (TRUE);
CREATE POLICY quiz_tags_write ON quiz_tags FOR ALL
    USING (
        is_not_banned()
        AND EXISTS (SELECT 1 FROM quizzes WHERE id = quiz_tags.quiz_id AND author_id = auth.uid())
    );

CREATE POLICY quiz_questions_read ON quiz_questions FOR SELECT USING (TRUE);
CREATE POLICY quiz_questions_write ON quiz_questions FOR ALL
    USING (
        is_not_banned()
        AND EXISTS (SELECT 1 FROM quizzes WHERE id = quiz_questions.quiz_id AND author_id = auth.uid())
    );
