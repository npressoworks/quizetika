-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- カスタム列挙型の定義
CREATE TYPE moderation_tier_enum AS ENUM ('newcomer', 'contributor', 'moderator', 'senior_moderator', 'admin');
CREATE TYPE quiz_visibility_enum AS ENUM ('public', 'private', 'followers');
CREATE TYPE quiz_status_enum AS ENUM ('draft', 'published', 'suspended');
CREATE TYPE feedback_report_category_enum AS ENUM ('typo', 'fact', 'alternative');
CREATE TYPE feedback_report_status_enum AS ENUM ('open', 'resolved', 'rejected');
CREATE TYPE bookmark_target_type_enum AS ENUM ('quiz', 'question');
CREATE TYPE announcement_category_enum AS ENUM ('info', 'maintenance', 'update', 'bug', 'important');
CREATE TYPE admin_log_action_enum AS ENUM ('reputation_reset', 'ban', 'unban');

-- 1. users テーブル
CREATE TABLE users (
    id UUID PRIMARY KEY, -- Auth.users.id と紐付け
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    bio TEXT DEFAULT '',
    followed_genres TEXT[] DEFAULT '{}',
    badges JSONB DEFAULT '[]',
    created_quizzes_count INTEGER DEFAULT 0,
    total_play_count INTEGER DEFAULT 0,
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    total_reactions_count INTEGER DEFAULT 0,
    moderation_tier moderation_tier_enum DEFAULT 'newcomer',
    role TEXT,
    reputation_history JSONB DEFAULT '[]',
    last_reputation_calculated_at TIMESTAMPTZ,
    total_failed_questions_count INTEGER DEFAULT 0,
    delete_status TEXT DEFAULT 'active' CHECK (delete_status IN ('active', 'delete_pending')),
    is_banned BOOLEAN DEFAULT FALSE,
    banned_reason TEXT,
    banned_at TIMESTAMPTZ,
    subscription_tier TEXT DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    current_period_end TIMESTAMPTZ,
    is_premium BOOLEAN DEFAULT FALSE,
    sns_links JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. quizzes テーブル
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    thumbnail_url TEXT,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    genre TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    original_tags TEXT[] DEFAULT '{}',
    question_ids UUID[] DEFAULT '{}',
    questions JSONB DEFAULT '[]',
    question_count INTEGER DEFAULT 0,
    status quiz_status_enum DEFAULT 'draft' NOT NULL,
    visibility quiz_visibility_enum DEFAULT 'public' NOT NULL,
    flags_count INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    bookmarks_count INTEGER DEFAULT 0,
    positive_count INTEGER DEFAULT 0,
    negative_count INTEGER DEFAULT 0,
    temp_positive_count INTEGER DEFAULT 0,
    temp_negative_count INTEGER DEFAULT 0,
    review_score NUMERIC,
    review_badge TEXT,
    is_review_masked BOOLEAN DEFAULT FALSE,
    active_reset_request_id TEXT,
    canonical_genre_id TEXT NOT NULL,
    canonical_tag_ids TEXT[] DEFAULT '{}',
    format TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. questions テーブル
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    link_kind TEXT DEFAULT 'owned',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT,
    author_avatar TEXT,
    type TEXT NOT NULL,
    question_text TEXT NOT NULL,
    explanation TEXT NOT NULL,
    image_url TEXT,
    hint TEXT,
    limit_time INTEGER,
    correct_text_answer_list TEXT[] DEFAULT '{}',
    text_input_mode TEXT,
    text_input_char_count INTEGER,
    choices JSONB DEFAULT '[]',
    sorting_items JSONB DEFAULT '[]',
    association_hints TEXT[] DEFAULT '{}',
    ai_context_details TEXT,
    truth_keywords TEXT[] DEFAULT '{}',
    source_url TEXT,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    bookmarks_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. attempts テーブル
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    list_id UUID,
    mode TEXT NOT NULL,
    session_id TEXT,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    elapsed_seconds NUMERIC NOT NULL,
    failed_question_ids UUID[] DEFAULT '{}',
    question_answers JSONB DEFAULT '[]',
    question_answer_details JSONB DEFAULT '[]',
    difficulty_vote INTEGER,
    ai_questions_history JSONB DEFAULT '[]',
    ai_truth_attempts JSONB DEFAULT '[]',
    ai_turn_count INTEGER DEFAULT 0,
    ai_turn_limit INTEGER,
    completed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. follows テーブル
CREATE TABLE follows (
    id TEXT PRIMARY KEY, -- follower_id + '_' + following_id
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. bookmarks テーブル
CREATE TABLE bookmarks (
    id TEXT PRIMARY KEY, -- user_id + '_' + target_id
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    target_id UUID NOT NULL,
    target_type bookmark_target_type_enum NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. feedback_reports テーブル
CREATE TABLE feedback_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    quiz_title TEXT NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    selected_choice_text TEXT,
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    category feedback_report_category_enum NOT NULL,
    content TEXT NOT NULL,
    status feedback_report_status_enum DEFAULT 'open' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. quiz_reviews テーブル
CREATE TABLE quiz_reviews (
    id TEXT PRIMARY KEY, -- reviewer_id + '_' + quiz_id
    reviewer_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 9. notifications テーブル
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. announcements テーブル
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category announcement_category_enum NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL
);

-- 11. admin_logs テーブル
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_uid UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    executor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action admin_log_action_enum NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 12. search_logs
CREATE TABLE search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    query TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 13. flags テーブル
CREATE TABLE flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 14. quiz_lists
CREATE TABLE quiz_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    quiz_ids UUID[] DEFAULT '{}',
    list_type TEXT CHECK (list_type IN ('quiz', 'question')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 15. daily_ai_authoring_counts
CREATE TABLE daily_ai_authoring_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    date DATE DEFAULT CURRENT_DATE NOT NULL,
    count INTEGER DEFAULT 0 NOT NULL,
    UNIQUE(user_id, date)
);

-- 16. leaderboard_entries (quizzes.leaderboard の正規化)
CREATE TABLE leaderboard_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    display_name TEXT NOT NULL,
    score INTEGER NOT NULL,
    elapsed_seconds NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('first_play', 'replay')),
    completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(quiz_id, user_id, type)
);

-- ==========================================
-- インデックスの定義
-- ==========================================

-- クイズ検索・フィルタ・ソート用複合インデックス
CREATE INDEX idx_quizzes_search ON quizzes(status, canonical_genre_id, created_at DESC);
CREATE INDEX idx_quizzes_popularity ON quizzes(status, canonical_genre_id, play_count DESC);
CREATE INDEX idx_quizzes_bookmarks ON quizzes(status, canonical_genre_id, bookmarks_count DESC);

-- クイズタグ検索用 GIN インデックス
CREATE INDEX idx_quizzes_tag_ids ON quizzes USING gin(canonical_tag_ids);

-- アテンプト履歴取得インデックス
CREATE INDEX idx_attempts_user_history ON attempts(user_id, completed_at DESC);

-- 作者別クイズ取得インデックス
CREATE INDEX idx_quizzes_author_history ON quizzes(author_id, status, visibility, created_at DESC);

-- 外部キー向けインデックス
CREATE INDEX idx_quizzes_author_id ON quizzes(author_id);
CREATE INDEX idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX idx_attempts_quiz_id ON attempts(quiz_id);

-- ==========================================
-- 共通ヘルパー関数 & RPC 定義
-- ==========================================

CREATE OR REPLACE FUNCTION is_not_banned()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND is_banned = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

