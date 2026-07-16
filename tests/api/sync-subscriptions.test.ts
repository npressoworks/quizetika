import { GET } from '@/app/api/cron/sync-subscriptions/route';
import { NextRequest } from 'next/server';

const mockReconcile = jest.fn();

jest.mock('@/services/subscription-reconciliation', () => ({
  reconcileSubscriptions: (...args: unknown[]) => mockReconcile(...args),
}));

function buildRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/cron/sync-subscriptions', {
    method: 'GET',
    headers,
  });
}

describe('GET /api/cron/sync-subscriptions', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('Authorization ヘッダーが無い場合は 401', async () => {
    process.env.CRON_SECRET = 'secret-value';
    const req = buildRequest();
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('Authorization ヘッダーの値が CRON_SECRET と一致しない場合は 401', async () => {
    process.env.CRON_SECRET = 'secret-value';
    const req = buildRequest({ Authorization: 'Bearer wrong-value' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('CRON_SECRET 自体が未設定の場合は正しい値を送っても 401（バイパス防止）', async () => {
    delete process.env.CRON_SECRET;
    const req = buildRequest({ Authorization: 'Bearer undefined' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('CRON_SECRET が空文字の場合も正しい値(空文字)を送っても 401（バイパス防止）', async () => {
    process.env.CRON_SECRET = '';
    const req = buildRequest({ Authorization: 'Bearer ' });
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(mockReconcile).not.toHaveBeenCalled();
  });

  it('正しい Authorization ヘッダーで 200 と reconcileSubscriptions() の戻り値がそのまま返る', async () => {
    process.env.CRON_SECRET = 'secret-value';
    const summary = { evaluatedCount: 10, correctedCount: 2, skippedCount: 1 };
    mockReconcile.mockResolvedValue(summary);

    const req = buildRequest({ Authorization: 'Bearer secret-value' });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(summary);
    expect(mockReconcile).toHaveBeenCalledTimes(1);
  });

  it('reconcileSubscriptions() が例外を投げた場合は 500', async () => {
    process.env.CRON_SECRET = 'secret-value';
    mockReconcile.mockRejectedValue(new Error('boom'));

    const req = buildRequest({ Authorization: 'Bearer secret-value' });
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
