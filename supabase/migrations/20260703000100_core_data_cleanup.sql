-- supabase-core-data: Phase 4 (Cleanup)
-- 20260703000000_core_data_normalization.sql でのカットオーバー完了後、
-- Firestore 由来の非正規化列（JSONB 複製・配列列）を物理削除する。
-- 事前条件: サービス層 (user.ts, quiz.ts, question.ts) が正規化テーブルのみを参照していること。

ALTER TABLE users
    DROP COLUMN IF EXISTS badges,
    DROP COLUMN IF EXISTS followed_genres;

ALTER TABLE quizzes
    DROP COLUMN IF EXISTS tags,
    DROP COLUMN IF EXISTS original_tags,
    DROP COLUMN IF EXISTS canonical_tag_ids,
    DROP COLUMN IF EXISTS question_ids,
    DROP COLUMN IF EXISTS questions;
