import { readFileSync } from 'fs';
import { join } from 'path';

describe('firestore.rules billing field protection', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');

  it('課金フィールドの owner 変更禁止ヘルパーが定義されている', () => {
    expect(rules).toContain('function billingFieldsUnchanged()');
    expect(rules).toContain('function billingFieldsSafeOnCreate()');
    expect(rules).toContain('subscriptionTier');
    expect(rules).toContain('isPremium');
    expect(rules).toContain('stripeCustomerId');
  });

  it('users 更新ルールで billingFieldsUnchanged を参照する', () => {
    expect(rules).toContain('&& billingFieldsUnchanged()');
  });

  it('stripe_processed_events はクライアントアクセス不可', () => {
    expect(rules).toContain('match /stripe_processed_events/{eventId}');
    expect(rules).toMatch(/stripe_processed_events[\s\S]*allow read, write: if false/);
  });
});
