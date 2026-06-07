import { POST } from '@/app/api/webhooks/stripe/route';
import { NextRequest } from 'next/server';

const mockConstructEvent = jest.fn();
const mockIsProcessed = jest.fn();
const mockMarkProcessed = jest.fn();
const mockHandleSubscription = jest.fn();

jest.mock('@/lib/stripe/server', () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: (...args: unknown[]) => mockConstructEvent(...args) },
  }),
  getStripeWebhookSecret: () => 'whsec_test',
}));

jest.mock('@/services/stripe-webhook', () => ({
  isStripeEventProcessed: (...args: unknown[]) => mockIsProcessed(...args),
  markStripeEventProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  handleCheckoutSessionCompleted: jest.fn(),
  handleInvoicePaymentFailed: jest.fn(),
  handleStripeSubscriptionEvent: (...args: unknown[]) => mockHandleSubscription(...args),
}));

describe('POST /api/webhooks/stripe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsProcessed.mockResolvedValue(false);
    mockMarkProcessed.mockResolvedValue(undefined);
    mockHandleSubscription.mockResolvedValue(undefined);
  });

  it('署名なしは 400', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('署名検証失敗は 400', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'sig_test' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('subscription.updated でハンドラを呼び冪等記録する', async () => {
    mockConstructEvent.mockReturnValue({
      id: 'evt_123',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_1' } },
    });
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{"id":"evt_123"}',
      headers: { 'stripe-signature': 'sig_test' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleSubscription).toHaveBeenCalled();
    expect(mockMarkProcessed).toHaveBeenCalledWith('evt_123', 'customer.subscription.updated');
  });

  it('重複 eventId は処理をスキップする', async () => {
    mockIsProcessed.mockResolvedValue(true);
    mockConstructEvent.mockReturnValue({
      id: 'evt_dup',
      type: 'customer.subscription.updated',
      data: { object: {} },
    });
    const req = new NextRequest('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'sig_test' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockHandleSubscription).not.toHaveBeenCalled();
  });
});
