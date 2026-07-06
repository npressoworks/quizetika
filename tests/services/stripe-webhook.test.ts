import type Stripe from 'stripe';
import {
  buildSnapshotFromSubscription,
  handleStripeSubscriptionEvent,
  isStripeEventProcessed,
  markStripeEventProcessed,
  resolveUidFromSubscription,
} from '@/services/stripe-webhook';

const mockApply = jest.fn();
const mockClear = jest.fn();

jest.mock('@/services/entitlement', () => ({
  applySubscriptionFromStripe: (...args: unknown[]) => mockApply(...args),
  clearPaidEntitlements: (...args: unknown[]) => mockClear(...args),
}));

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        deleted: false,
        metadata: { firebaseUid: 'uid-from-customer' },
      }),
    },
    subscriptions: { retrieve: jest.fn() },
  }),
}));

const processed = new Set<string>();

jest.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    let pendingEventId: string | null = null;
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn((_col: string, value: string) => {
        pendingEventId = value;
        return chain;
      }),
      insert: jest.fn((payload: { event_id: string }) => {
        chain.__insertId = payload.event_id;
        return chain;
      }),
      maybeSingle: jest.fn(() =>
        Promise.resolve({
          data: pendingEventId && processed.has(pendingEventId) ? { event_id: pendingEventId } : null,
          error: null,
        })
      ),
      then: jest.fn((onFulfilled: any) => {
        if (chain.__insertId) processed.add(chain.__insertId);
        return Promise.resolve({ error: null }).then(onFulfilled);
      }),
    };
    return chain;
  };

  return {
    createAdminClient: () => ({
      from: jest.fn(() => createChain()),
    }),
  };
});

describe('stripe-webhook service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    processed.clear();
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';
  });

  it('active pro subscription から snapshot を構築する', () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      current_period_end: 1782864000,
      items: { data: [{ price: { id: 'price_monthly_test' } }] },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    const snapshot = buildSnapshotFromSubscription(subscription, 'uid-1');
    expect(snapshot).toMatchObject({
      uid: 'uid-1',
      subscriptionTier: 'pro',
      isPremium: true,
      stripeSubscriptionId: 'sub_1',
    });
  });

  it('subscription.updated で applySubscriptionFromStripe を呼ぶ', async () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      current_period_end: 1782864000,
      items: { data: [{ price: { id: 'price_monthly_test' } }] },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    await handleStripeSubscriptionEvent(subscription);
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it('canceled subscription で clearPaidEntitlements を呼ぶ', async () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'canceled',
      items: { data: [{ price: { id: 'price_monthly_test' } }] },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    await handleStripeSubscriptionEvent(subscription);
    expect(mockClear).toHaveBeenCalledWith('uid-1', 'cus_1');
  });

  it('resolveUidFromSubscription は metadata.userId を優先する', () => {
    const subscription = {
      metadata: { userId: 'uid-new', firebaseUid: 'uid-old' },
    } as unknown as Stripe.Subscription;

    expect(resolveUidFromSubscription(subscription)).toBe('uid-new');
  });

  it('resolveUidFromSubscription は metadata.userId が無い既存顧客ケースで metadata.firebaseUid にフォールバックする', () => {
    const subscription = {
      metadata: { firebaseUid: 'uid-legacy' },
    } as unknown as Stripe.Subscription;

    expect(resolveUidFromSubscription(subscription)).toBe('uid-legacy');
  });

  it('subscription.metadata に UID がない既存顧客は Customer の metadata.firebaseUid フォールバックで解決される', async () => {
    const subscription = {
      id: 'sub_legacy',
      customer: 'cus_legacy',
      status: 'active',
      current_period_end: 1782864000,
      items: { data: [{ price: { id: 'price_monthly_test' } }] },
      metadata: {},
    } as unknown as Stripe.Subscription;

    await handleStripeSubscriptionEvent(subscription);

    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ uid: 'uid-from-customer' })
    );
  });

  it('stripe_processed_events で冪等を記録する', async () => {
    expect(await isStripeEventProcessed('evt_1')).toBe(false);
    await markStripeEventProcessed('evt_1', 'customer.subscription.updated');
    expect(await isStripeEventProcessed('evt_1')).toBe(true);
  });
});
