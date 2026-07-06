import {
  AlreadySubscribedError,
  createCheckoutSession,
  createPortalSession,
  getOrCreateStripeCustomer,
  NoActiveSubscriptionError,
  UserNotFoundError,
} from '@/services/subscription';

const mockCheckoutCreate = jest.fn();
const mockPortalCreate = jest.fn();
const mockCustomerCreate = jest.fn();
const mockResolveEntitlements = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
    customers: { create: mockCustomerCreate },
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
    userRows['uid-free'] = { stripe_customer_id: null };
    userRows['uid-pro'] = { stripe_customer_id: 'cus_existing' };

    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly_test';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly_test';

    mockCustomerCreate.mockResolvedValue({ id: 'cus_new' });
    mockCheckoutCreate.mockResolvedValue({ url: 'https://checkout.stripe.test/session' });
    mockPortalCreate.mockResolvedValue({ url: 'https://billing.stripe.test/portal' });
  });

  it('free ユーザーは Checkout URL を取得できる', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
    });

    const result = await createCheckoutSession({
      uid: 'uid-free',
      email: 'free@example.com',
      priceInterval: 'monthly',
    });

    expect(result.sessionUrl).toBe('https://checkout.stripe.test/session');
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        client_reference_id: 'uid-free',
      })
    );
  });

  it('既存有料契約者の Checkout は拒否される', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
    });

    await expect(
      createCheckoutSession({
        uid: 'uid-pro',
        email: 'pro@example.com',
        priceInterval: 'yearly',
      })
    ).rejects.toBeInstanceOf(AlreadySubscribedError);
  });

  it('active pro ユーザーは Portal URL を取得できる', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
    });

    const result = await createPortalSession({ uid: 'uid-pro' });
    expect(result.sessionUrl).toBe('https://billing.stripe.test/portal');
  });

  it('free ユーザーの Portal は 404 相当エラー', async () => {
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
    });

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
});
