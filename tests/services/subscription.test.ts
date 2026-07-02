import {
  AlreadySubscribedError,
  createCheckoutSession,
  createPortalSession,
  getOrCreateStripeCustomer,
  NoActiveSubscriptionError,
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

jest.mock('@/lib/firebase/admin', () => {
  const userDocs: Record<string, object> = {};
  const mockSet = jest.fn(async (data: object) => {
    const uid = mockDoc.mock.lastCall?.[0];
    if (uid) userDocs[uid] = { ...userDocs[uid], ...data };
  });
  const mockGet = jest.fn(async () => {
    const key = mockDoc.mock.lastCall?.[0];
    return {
      exists: true,
      data: () => (key ? userDocs[key] : {}) ?? {},
    };
  });
  const mockDoc = jest.fn((uid: string) => {
    if (!userDocs[uid]) userDocs[uid] = { email: 'user@example.com' };
    return { get: mockGet, set: mockSet };
  });
  const mockCollection = jest.fn(() => ({ doc: mockDoc }));
  return {
    getAdminFirestore: () => ({ collection: mockCollection }),
    __userDocs: userDocs,
    __mockDoc: mockDoc,
  };
});

describe('SubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const admin = jest.requireMock('@/lib/firebase/admin');
    admin.__userDocs['uid-free'] = { email: 'free@example.com' };
    admin.__userDocs['uid-pro'] = {
      email: 'pro@example.com',
      stripeCustomerId: 'cus_existing',
    };

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

  it('Stripe Customer を新規作成して永続化する', async () => {
    const customerId = await getOrCreateStripeCustomer('uid-free', 'free@example.com');
    expect(customerId).toBe('cus_new');
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'free@example.com',
        metadata: { firebaseUid: 'uid-free' },
      })
    );
  });
});
