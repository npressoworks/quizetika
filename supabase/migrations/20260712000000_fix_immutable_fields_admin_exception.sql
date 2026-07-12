-- check_users_immutable_fields: 管理者（is_admin()）による特権フィールド更新を許可する例外を追加
-- （既存のコメント「特権管理者やサーバーサイド操作でない場合のみチェック」は元々意図されていたが、
--   実装が auth.role() のみをチェックしており is_admin() の判定が欠落していたバグを修正する。
--   handle_reset_user_reputation 等の SECURITY DEFINER RPC 内で管理者が reputation_score／
--   moderation_tier／subscription_tier を更新しようとしても auth.role() は 'authenticated' の
--   ままであるため、is_admin() の除外がないと管理者操作までブロックされてしまっていた）
CREATE OR REPLACE FUNCTION check_users_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- 特権管理者やサーバーサイド操作（service_role）でない場合のみチェックを実行する
    IF (auth.role() = 'authenticated' AND NOT is_admin()) THEN
        IF (NEW.moderation_tier IS DISTINCT FROM OLD.moderation_tier OR
            NEW.reputation_score IS DISTINCT FROM OLD.reputation_score OR
            NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier) THEN
            RAISE EXCEPTION 'Immutable fields modified';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
