import {
  AlreadySubscribedError,
  DowngradeNotAllowedError,
  SamePlanError,
  createCheckoutSession,
  createPortalSession,
  getOrCreateStripeCustomer,
  changeSubscriptionPlan,
  NoActiveSubscriptionError,
  UserNotFoundError,
} from '@/services/subscription';

const mockCheckoutCreate = jest.fn();
const mockPortalCreate = jest.fn();
const mockCustomerCreate = jest.fn();
const mockSubscriptionsList = jest.fn();
const mockSubscriptionsUpdate = jest.fn();
const mockResolveEntitlements = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    customers: { create: mockCustomerCreate },
    subscriptions: {
      list: mockSubscriptionsList,
      update: mockSubscriptionsUpdate,
    },
  }),
  getAppBaseUrl: () => 'http://localhost:3000',
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
}));

const userRows: Record<string, { stripe_customer_id: string | null }> = {};

jest.mock('@/lib/supabase/server', () => {
  const createChain = () => {
    let pendingUid: string | null = null;
    const chain: any = {
      select: jest.fn(() => chain),
      eq: jest.fn((_col: string, value: string) => {
        pendingUid = value;
        return chain;
      }),
      update: jest.fn((payload: Record<string, unknown>) => {
        chain.__updatePayload = payload;
        return chain;
      }),
      maybeSingle: jest.fn(() =>
        Promise.resolve({ data: pendingUid ? userRows[pendingUid] ?? null : null, error: null })
      ),
      then: jest.fn((onFulfilled: any) => {
        if (chain.__updatePayload && pendingUid) {
          userRows[pendingUid] = { ...userRows[pendingUid], ...chain.__updatePayload } as any;
        }
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

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(userRows).forEach((k) => delete userRows[k]);
    userRows['uid-free'] = { stripe_customer_id: null, stripe_subscription_id: null };
    userRows['uid-pro'] = { stripe_customer_id: 'cus_existing', stripe_subscription_id: 'sub_existing' };

    process.env.STRIPE_PRICE_PLAYER_MONTHLY = 'price_player_monthly_test';
    process.env.STRIPE_PRICE_PLAYER_YEARLY = 'price_player_yearly_test';
    process.env.STRIPE_PRICE_CREATOR_MONTHLY = 'price_creator_monthly_test';
    process.env.STRIPE_PRICE_CREATOR_YEARLY = 'price_creator_yearly_test';

    mockCustomerCreate.mockResolvedValue({ id: 'cus_new' });
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.test/portal' });
    mockSubscriptionsList.mockResolvedValue({ data: [] });
  });

  it('free ユーザーは Checkout URL を取得できる', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
    });

    const result = await createCheckoutSession({
      uid: 'uid-free',
      email: 'free@example.com',
      priceInterval: 'monthly',
      plan: 'player',
    });

    expect(result.sessionUrl).toBe('https://checkout.stripe.test/session');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        client_reference_id: 'uid-free',
        line_items: [{ price: 'price_player_monthly_test', quantity: 1 }],
      })
    );
  });

  it('既存有料契約者の Checkout は拒否される', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      subscriptionTier: 'creator',
    });

    await expect(
      createCheckoutSession({
        uid: 'uid-pro',
        email: 'pro@example.com',
        priceInterval: 'yearly',
        plan: 'creator',
      })
    ).rejects.toBeInstanceOf(AlreadySubscribedError);
  });

  it('Creator 契約中に Player への Checkout (ダウングレード) は拒否される', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      subscriptionTier: 'creator',
    });

    await expect(
      createCheckoutSession({
        uid: 'uid-pro',
        email: 'pro@example.com',
        priceInterval: 'monthly',
        plan: 'player',
      })
    ).rejects.toBeInstanceOf(DowngradeNotAllowedError);
  });

  it('Stripe 上に既にアクティブなサブスクリプションがある場合は Checkout 拒否（ライブチェック）', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
    });

    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_live_already', status: 'active' }],
    });

    await expect(
      createCheckoutSession({
        uid: 'uid-pro',
        email: 'pro@example.com',
        priceInterval: 'monthly',
        plan: 'creator',
      })
    ).rejects.toBeInstanceOf(AlreadySubscribedError);
  });

  it('stripe_customer_id を持つユーザーは Portal URL を取得できる', async () => {
    const result = await createPortalSession({ uid: 'uid-pro' });
    expect(result.sessionUrl).toBe('https://billing.stripe.test/portal');
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'cus_existing',
        flow_data: {
          type: 'subscription_update',
          subscription_update: {
            subscription: 'sub_existing',
          },
        },
      })
    );
  });

  it('stripe_customer_id を持たないユーザーの Portal はエラー', async () => {
    await expect(createPortalSession({ uid: 'uid-free' })).rejects.toBeInstanceOf(
      NoActiveSubscriptionError
    );
  });

  it('存在しないユーザーは UserNotFoundError', async () => {
    await expect(getOrCreateStripeCustomer('uid-missing', 'x@example.com')).rejects.toBeInstanceOf(
      UserNotFoundError
    );
  });

  it('Stripe Customer を新規作成して永続化する', async () => {
    const customerId = await getOrCreateStripeCustomer('uid-free', 'free@example.com');
    expect(customerId).toBe('cus_new');
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'free@example.com',
        metadata: { userId: 'uid-free' },
      })
    );
    expect(userRows['uid-free'].stripe_customer_id).toBe('cus_new');
  });

  describe('changeSubscriptionPlan', () => {
    it('有料プラン未加入の場合は NoActiveSubscriptionError', async () => {
      mockResolveEntitlements.mockResolvedValue({
        hasPaidEntitlements: false,
      });

      await expect(changeSubscriptionPlan('uid-free', 'creator')).rejects.toBeInstanceOf(
        NoActiveSubscriptionError
      );
    });

    it('同一プラン指定時は SamePlanError', async () => {
      mockResolveEntitlements.mockResolvedValue({
        hasPaidEntitlements: true,
        subscriptionTier: 'creator',
      });

      await expect(changeSubscriptionPlan('uid-pro', 'creator')).rejects.toBeInstanceOf(
        SamePlanError
      );
    });

    it('正しくプラン更新が Stripe に対してリクエストされる', async () => {
      mockResolveEntitlements.mockResolvedValue({
        hasPaidEntitlements: true,
        subscriptionTier: 'player',
      });

      mockSubscriptionsList.mockResolvedValue({
        data: [
          {
            id: 'sub_test',
            status: 'active',
            created: 1000,
            items: {
              data: [
                {
                  id: 'item_test',
                  price: { id: 'price_player_monthly_test' },
                },
              ],
            },
          },
        ],
      });

      mockSubscriptionsUpdate.mockResolvedValue({
        items: {
          data: [
            {
              price: { id: 'price_creator_monthly_test' },
            },
          ],
        },
      });

      const newTier = await changeSubscriptionPlan('uid-pro', 'creator');
      expect(newTier).toBe('creator');
      expect(mockSubscriptionsUpdate).toHaveBeenCalledWith(
        'sub_test',
        expect.objectContaining({
          items: [{ id: 'item_test', price: 'price_creator_monthly_test' }],
          proration_behavior: 'create_prorations',
        })
      );
    });
  });
});
