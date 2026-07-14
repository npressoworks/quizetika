-- users テーブルの delete_status チェック制約を更新し、'deleted' を許容するように変更
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_delete_status_check;
ALTER TABLE users ADD CONSTRAINT users_delete_status_check CHECK (delete_status IN ('active', 'delete_pending', 'deleted'));
