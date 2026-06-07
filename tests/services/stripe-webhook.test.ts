import type Stripe from 'stripe';
import {
  buildSnapshotFromSubscription,
  handleStripeSubscriptionEvent,
  isStripeEventProcessed,
  markStripeEventProcessed,
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

jest.mock('@/lib/firebase/admin', () => {
  const processed = new Set<string>();
  return {
    getAdminFirestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({ exists: name === 'stripe_processed_events' && processed.has(id) }),
          set: async () => {
            if (name === 'stripe_processed_events') processed.add(id);
          },
        }),
      }),
    }),
  };
});

describe('stripe-webhook service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      metadata: { firebaseUid: 'uid-1' },
    } as unknown as Stripe.Subscription;

    const snapshot = buildSnapshotFromSubscription(subscription, 'uid-1');
    expect(snapshot).toMatchObject({
      firebaseUid: 'uid-1',
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
      metadata: { firebaseUid: 'uid-1' },
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
      metadata: { firebaseUid: 'uid-1' },
    } as unknown as Stripe.Subscription;

    await handleStripeSubscriptionEvent(subscription);
    expect(mockClear).toHaveBeenCalledWith('uid-1', 'cus_1');
  });

  it('stripe_processed_events で冪等を記録する', async () => {
    expect(await isStripeEventProcessed('evt_1')).toBe(false);
    await markStripeEventProcessed('evt_1', 'customer.subscription.updated');
    expect(await isStripeEventProcessed('evt_1')).toBe(true);
  });
});
