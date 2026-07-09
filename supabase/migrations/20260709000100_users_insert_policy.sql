-- ==========================================
-- users テーブルに INSERT ポリシーを追加する。
--
-- 経緯: users テーブルには users_read (SELECT) と users_update (UPDATE) の
-- RLS ポリシーのみが定義されており、INSERT ポリシーが存在しなかった。
-- RLS はデフォルトで全操作を拒否するため、新規ユーザーの初回ログイン時に
-- クライアントサイド (anon/authenticated ロール) から自分の users 行を
-- 作成しようとすると
-- `new row violates row-level security policy for table "users"`
-- で必ず失敗していた。
--
-- 対応: users_update と同じ auth.uid() = id の条件で INSERT を許可し、
-- ユーザーは自分自身の行のみ作成できるようにする。
-- ==========================================

CREATE POLICY users_insert ON users FOR INSERT
    WITH CHECK (auth.uid() = id);
