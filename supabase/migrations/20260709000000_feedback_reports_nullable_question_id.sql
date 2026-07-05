-- ==========================================
-- feedback_reports.question_id を NULL 許容に変更する。
--
-- 経緯: クイズ結果画面の「クイズ全体の指摘」機能は、特定の問題に紐付かない
-- 指摘を表すためにアプリケーションコード側で 'unknown' という文字列の
-- センチネル値を question_id に設定していた。しかし question_id は
-- questions(id) への UUID 型の外部キーであり NOT NULL 制約があるため、
-- 'unknown' という非UUID文字列の INSERT が
-- `invalid input syntax for type uuid: "unknown"` エラーで必ず失敗し、
-- 「クイズ全体の指摘」機能が常に失敗する不具合を引き起こしていた。
--
-- 対応: question_id を NULL 許容にし、「特定の問題に紐付かない指摘」は
-- NULL で表現する（アプリケーションコード側の 'unknown' センチネルは廃止）。
-- ==========================================

ALTER TABLE feedback_reports ALTER COLUMN question_id DROP NOT NULL;
