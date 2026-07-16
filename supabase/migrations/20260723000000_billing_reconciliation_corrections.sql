CREATE TABLE billing_reconciliation_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    previous_tier TEXT NOT NULL,
    previous_status TEXT,
    corrected_tier TEXT NOT NULL,
    corrected_status TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE billing_reconciliation_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_reconciliation_corrections_policy
    ON billing_reconciliation_corrections FOR ALL USING (FALSE);
