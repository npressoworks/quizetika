-- admin_log_action_enum に report_reset 値を追加する専用マイグレーション
-- PostgreSQLでは ALTER TYPE ... ADD VALUE で追加した新しいenum値を、
-- 同一トランザクション内で（RPC定義等から）参照することができないため、
-- このファイルでは値の追加のみを行い、report_reset を参照するRPC定義は含めない。
-- （report_reset を利用する RPC は後続のマイグレーションで定義する）
-- 既存の tier_downgrade 追加時（20260719000000）と同じ理由。
ALTER TYPE admin_log_action_enum ADD VALUE 'report_reset';
