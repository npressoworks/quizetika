-- ==========================================
-- public スキーマの基本権限（GRANT）を是正する。
--
-- 経緯: anon/authenticated/service_role には TRUNCATE/REFERENCES/TRIGGER のみが
-- 付与されており、SELECT/INSERT/UPDATE/DELETE の基本権限がどのテーブルにも
-- 付与されていなかった。RLS ポリシーは既に SELECT/INSERT/UPDATE/DELETE を
-- 前提に定義されているため（例: quiz_reviews_read 等）、これは元々意図された
-- RPCオンリー設計ではなく、テーブル作成時に Supabase 標準の基本GRANTが
-- 一度も実行されていなかった見落としである。
--
-- RLS はテーブルレベルの GRANT があって初めて評価されるため、この GRANT 欠落は
-- 新規ユーザーのプロフィール作成（クライアント側 upsert）を含む複数の
-- クライアント直接アクセスパスを恒常的に失敗させていた。
-- ==========================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- 今後このマイグレーション以降に作成されるテーブル/シーケンス/関数にも同様に適用する
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
