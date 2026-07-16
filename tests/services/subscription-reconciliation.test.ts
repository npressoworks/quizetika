import { reconcileSubscriptions } from '@/services/subscription-reconciliation';

const mockSubscriptionsList = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    subscriptions: {
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
    },
  }),
}));

const mockApplySubscriptionFromStripe = jest.fn().mockResolvedValue(undefined);
const mockClearPaidEntitlements = jest.fn().mockResolvedValue(undefined);

jest.mock('@/services/entitlement', () => ({
  applySubscriptionFromStripe: (...args: unknown[]) =>
    mockApplySubscriptionFromStripe(...args),
  clearPaidEntitlements: (...args: unknown[]) => mockClearPaidEntitlements(...args),
}));

jest.mock('@/lib/subscription-plans', () => ({
  priceIdToTier: (priceId: string) => {
    if (priceId === 'price_creator_monthly') return 'creator';
    if (priceId === 'price_player_monthly') return 'player';
    return null;
  },
}));

let usersData: Array<Record<string, unknown>> = [];
const mockAuditInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase/server', () => {
  return {
    createAdminClient: () => ({
      from: (table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              not: () => ({
                range: (from: number, to: number) => {
                  const page = usersData.slice(from, to + 1);
                  return Promise.resolve({ data: page, error: null });
                },
              }),
            }),
          };
        }
        if (table === 'billing_reconciliation_corrections') {
          return {
            insert: (payload: unknown) => mockAuditInsert(payload),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    }),
  };
});

describe('SubscriptionReconciliationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditInsert.mockResolvedValue({ error: null });
    usersData = [];
  });

  it('ローカルDBがcreator/activeだがStripe上に有効なサブスクリプションが無い場合、freeへ是正し監査レコードを1件挿入する', async () => {
    usersData = [
      {
        id: 'uid-1',
        stripe_customer_id: 'cus_1',
        subscription_tier: 'creator',
        subscription_status: 'active',
      },
    ];

    mockSubscriptionsList.mockResolvedValue({ data: [] });

    const result = await reconcileSubscriptions();

    expect(mockClearPaidEntitlements).toHaveBeenCalledWith('uid-1', 'cus_1');
    expect(mockApplySubscriptionFromStripe).not.toHaveBeenCalled();
    expect(mockAuditInsert).toHaveBeenCalledTimes(1);
    expect(mockAuditInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'uid-1',
        previous_tier: 'creator',
        previous_status: 'active',
        corrected_tier: 'free',
      })
    );
    expect(result.evaluatedCount).toBe(1);
    expect(result.correctedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
  });

  it('ローカルDBとStripe側の状態が一致している場合は何も書き込みを行わない', async () => {
    usersData = [
      {
        id: 'uid-2',
        stripe_customer_id: 'cus_2',
        subscription_tier: 'creator',
        subscription_status: 'active',
      },
    ];

    mockSubscriptionsList.mockResolvedValue({
      data: [
        {
          id: 'sub_1',
          status: 'active',
          created: 100,
          items: {
            data: [
              {
                price: { id: 'price_creator_monthly' },
                current_period_end: 1700000000,
              },
            ],
          },
        },
      ],
    });

    const result = await reconcileSubscriptions();

    expect(mockClearPaidEntitlements).not.toHaveBeenCalled();
    expect(mockApplySubscriptionFromStripe).not.toHaveBeenCalled();
    expect(mockAuditInsert).not.toHaveBeenCalled();
    expect(result.evaluatedCount).toBe(1);
    expect(result.correctedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });

  it('複数ユーザーのうち1人でStripe API呼び出しが失敗した場合、そのユーザーをスキップし残りの処理を継続する', async () => {
    usersData = [
      {
        id: 'uid-fail',
        stripe_customer_id: 'cus_fail',
        subscription_tier: 'creator',
        subscription_status: 'active',
      },
      {
        id: 'uid-3',
        stripe_customer_id: 'cus_3',
        subscription_tier: 'creator',
        subscription_status: 'active',
      },
    ];

    mockSubscriptionsList.mockImplementation(({ customer }: { customer: string }) => {
      if (customer === 'cus_fail') {
        return Promise.reject(new Error('Stripe API error'));
      }
      return Promise.resolve({ data: [] });
    });

    const result = await reconcileSubscriptions();

    expect(mockClearPaidEntitlements).toHaveBeenCalledTimes(1);
    expect(mockClearPaidEntitlements).toHaveBeenCalledWith('uid-3', 'cus_3');
    expect(result.evaluatedCount).toBe(2);
    expect(result.correctedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('ユーザー一覧取得自体が失敗した場合は処理を中断し例外を再スローする', async () => {
    jest.resetModules();
    jest.doMock('@/lib/stripe/server', () => ({
      getStripeClient: () => ({
        subscriptions: { list: (...args: unknown[]) => mockSubscriptionsList(...args) },
      }),
    }));
    jest.doMock('@/services/entitlement', () => ({
      applySubscriptionFromStripe: (...args: unknown[]) =>
        mockApplySubscriptionFromStripe(...args),
      clearPaidEntitlements: (...args: unknown[]) => mockClearPaidEntitlements(...args),
    }));
    jest.doMock('@/lib/subscription-plans', () => ({
      priceIdToTier: () => null,
    }));
    jest.doMock('@/lib/supabase/server', () => ({
      createAdminClient: () => ({
        from: () => ({
          select: () => ({
            not: () => ({
              range: () =>
                Promise.resolve({ data: null, error: { message: 'fatal db error' } }),
            }),
          }),
        }),
      }),
    }));

    const { reconcileSubscriptions: reconcileWithFatalError } = await import(
      '@/services/subscription-reconciliation'
    );

    await expect(reconcileWithFatalError()).rejects.toThrow();
  });
});
