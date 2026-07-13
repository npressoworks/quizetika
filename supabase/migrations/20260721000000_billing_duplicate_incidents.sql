CREATE TABLE billing_duplicate_subscription_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    kept_subscription_id TEXT NOT NULL,
    canceled_subscription_id TEXT NOT NULL,
    refunded_amount INTEGER,
    refund_currency TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE billing_duplicate_subscription_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_duplicate_subscription_incidents_policy
    ON billing_duplicate_subscription_incidents FOR ALL USING (FALSE);
