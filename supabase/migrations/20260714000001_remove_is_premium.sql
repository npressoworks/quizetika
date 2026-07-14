-- usersテーブルから不要となったis_premiumカラムを削除します。
ALTER TABLE users DROP COLUMN IF EXISTS is_premium;
