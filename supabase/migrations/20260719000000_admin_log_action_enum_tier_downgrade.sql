-- admin_log_action_enum に tier_downgrade 値を追加する専用マイグレーション
-- PostgreSQLでは ALTER TYPE ... ADD VALUE で追加した新しいenum値を、
-- 同一トランザクション内で（RPC定義等から）参照することができないため、
-- このファイルでは値の追加のみを行い、tier_downgrade を参照するRPC定義は含めない。
-- （tier_downgrade を利用する RPC は後続のマイグレーションで定義する）
ALTER TYPE admin_log_action_enum ADD VALUE 'tier_downgrade';
