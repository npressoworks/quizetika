-- Migrate existing pro tier users to creator tier
UPDATE users
SET subscription_tier = 'creator'
WHERE subscription_tier = 'pro';
