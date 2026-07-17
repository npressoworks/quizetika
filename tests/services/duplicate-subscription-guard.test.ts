import { resolveActiveSubscription } from '@/services/duplicate-subscription-guard';

const mockSubscriptionsList = jest.fn();
const mockSubscriptionsCancel = jest.fn();
const mockInvoicesRetrieve = jest.fn();
const mockRefundsCreate = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    subscriptions: {
      list: (...args: unknown[]) => mockSubscriptionsList(...args),
      cancel: (...args: unknown[]) => mockSubscriptionsCancel(...args),
    },
    invoices: {
      retrieve: (...args: unknown[]) => mockInvoicesRetrieve(...args),
    },
    refunds: {
      create: (...args: unknown[]) => mockRefundsCreate(...args),
    },
  }),
}));

const mockDbInsert = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/supabase/server', () => {
  const chain: { insert: jest.Mock; then: jest.Mock } = {
    insert: jest.fn(() => chain),
    then: jest.fn((onFulfilled: any) => {
      return Promise.resolve(mockDbInsert()).then(onFulfilled);
    }),
  };

  return {
    createAdminClient: () => ({
      from: jest.fn(() => chain),
    }),
  };
});

describe('DuplicateSubscriptionGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('サブスクリプションが0または1つの場合は何もせず、そのIDを返す', async () => {
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_single', status: 'active', created: 100 }],
    });

    const result = await resolveActiveSubscription('cus_1', 'uid-1');
    expect(result).toEqual({
      keptSubscriptionId: 'sub_single',
      canceledSubscriptionIds: [],
    });
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('アクティブなサブスクリプションがなく、かつ初期契約ステータス（incompleteなど）の場合は何も解約せず空の kept ID と canceled ID 配列を返す', async () => {
    mockSubscriptionsList.mockResolvedValue({
      data: [{ id: 'sub_incomplete', status: 'incomplete', created: 100 }],
    });

    const result = await resolveActiveSubscription('cus_1', 'uid-1');
    expect(result).toEqual({
      keptSubscriptionId: '',
      canceledSubscriptionIds: [],
    });
    expect(mockSubscriptionsCancel).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('2つ以上の有効なサブスクリプションがある場合は、最古のものを残して他を解約し、返金・監査ログに記録する', async () => {
    const subOld = { id: 'sub_old', status: 'active', created: 100, latest_invoice: 'inv_old' };
    const subNew = { id: 'sub_new', status: 'active', created: 200, latest_invoice: 'inv_new' };

    mockSubscriptionsList.mockResolvedValue({
      data: [subNew, subOld], // 順番が逆でも動作するよう検証
    });

    mockInvoicesRetrieve.mockResolvedValue({
      id: 'inv_new',
      charge: 'ch_new',
      payment_intent: 'pi_new',
    });

    mockRefundsCreate.mockResolvedValue({
      amount: 980,
      currency: 'jpy',
    });

    const result = await resolveActiveSubscription('cus_1', 'uid-1');

    // 最古の 'sub_old' が保持され、'sub_new' が解約される
    expect(result).toEqual({
      keptSubscriptionId: 'sub_old',
      canceledSubscriptionIds: ['sub_new'],
    });

    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_new');
    expect(mockSubscriptionsCancel).not.toHaveBeenCalledWith('sub_old');

    expect(mockInvoicesRetrieve).toHaveBeenCalledWith('inv_new');
    expect(mockRefundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: 'pi_new' })
    );

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
  });
});
