-- supabase-storage-migration: quizzes/users/genres バケットを匿名閲覧可能にする
-- (ホーム・クイズ詳細・ジャンル一覧等は未ログインでも閲覧可能であり、
--  Firebase Storage の getDownloadURL() と同等の恒久公開URLを Supabase Storage でも提供するため)
--
-- 書き込み・削除は supabase-foundation 定義済みの既存RLSポリシー
-- (認証済みかつ非BANユーザー限定) のまま変更しない。
-- sns-logos は既に public: true のため対象外。

UPDATE storage.buckets
SET public = TRUE
WHERE id IN ('quizzes', 'users', 'genres');
