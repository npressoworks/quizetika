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
const mockSubscriptionsList = jest.fn();

jest.mock('@/services/entitlement', () => ({
  applySubscriptionFromStripe: (...args: unknown[]) => mockApply(...args),
  clearPaidEntitlements: (...args: unknown[]) => mockClear(...args),
}));

const mockResolveActiveSubscription = jest.fn();

jest.mock('@/services/duplicate-subscription-guard', () => ({
  resolveActiveSubscription: (...args: unknown[]) => mockResolveActiveSubscription(...args),
}));

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    customers: {
      retrieve: jest.fn().mockResolvedValue({
        deleted: false,
        metadata: { firebaseUid: 'uid-from-customer' },
      }),
    },
    subscriptions: {
      retrieve: jest.fn(),
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
    },
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
    process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
    process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
    process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
    process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';
    mockSubscriptionsList.mockResolvedValue({ data: [] });
    mockResolveActiveSubscription.mockResolvedValue({
      keptSubscriptionId: '',
      canceledSubscriptionIds: [],
    });
  });

  it('active creator subscription から snapshot を構築する', () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      items: {
        data: [
          {
            price: { id: 'price_creator_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    const snapshot = buildSnapshotFromSubscription(subscription, 'uid-1');
    expect(snapshot).toMatchObject({
      uid: 'uid-1',
      subscriptionTier: 'creator',
      stripeSubscriptionId: 'sub_1',
    });
  });

  it('past_due ステータスの creator subscription でも subscriptionTier は creator のまま維持される', () => {
    const subscription = {
      id: 'sub_past_due',
      customer: 'cus_1',
      status: 'past_due',
      items: {
        data: [
          {
            price: { id: 'price_creator_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    const snapshot = buildSnapshotFromSubscription(subscription, 'uid-1');
    expect(snapshot).toMatchObject({
      uid: 'uid-1',
      subscriptionTier: 'creator',
      subscriptionStatus: 'past_due',
    });
  });

  it('past_due ステータスの player subscription でも subscriptionTier は player のまま維持される', () => {
    const subscription = {
      id: 'sub_past_due_player',
      customer: 'cus_2',
      status: 'past_due',
      items: {
        data: [
          {
            price: { id: 'price_player_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: { userId: 'uid-2' },
    } as unknown as Stripe.Subscription;

    const snapshot = buildSnapshotFromSubscription(subscription, 'uid-2');
    expect(snapshot).toMatchObject({
      uid: 'uid-2',
      subscriptionTier: 'player',
      subscriptionStatus: 'past_due',
    });
  });

  it('subscription.updated で applySubscriptionFromStripe を呼ぶ', async () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      items: {
        data: [
          {
            price: { id: 'price_creator_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });

    await handleStripeSubscriptionEvent(subscription);
    expect(mockApply).toHaveBeenCalledTimes(1);
  });

  it('canceled subscription で clearPaidEntitlements を呼ぶ', async () => {
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'canceled',
      items: { data: [{ price: { id: 'price_creator_monthly_test' } }] },
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
      items: {
        data: [
          {
            price: { id: 'price_creator_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: {},
    } as unknown as Stripe.Subscription;

    mockSubscriptionsList.mockResolvedValue({ data: [subscription] });

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

  it('重複サブスクリプション検知により解約されたイベントの場合は適用をスキップする', async () => {
    const subscription = {
      id: 'sub_duplicate_canceled',
      customer: 'cus_1',
      status: 'active',
      items: {
        data: [
          {
            price: { id: 'price_creator_monthly_test' },
            current_period_end: 1782864000,
          },
        ],
      },
      metadata: { userId: 'uid-1' },
    } as unknown as Stripe.Subscription;

    mockResolveActiveSubscription.mockResolvedValue({
      keptSubscriptionId: 'sub_kept_older',
      canceledSubscriptionIds: ['sub_duplicate_canceled'],
    });

    await handleStripeSubscriptionEvent(subscription);
    expect(mockApply).not.toHaveBeenCalled();
  });
});

