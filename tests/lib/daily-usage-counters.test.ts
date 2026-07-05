import {
  readDailyUsageCount,
  incrementDailyUsageCount,
} from '@/lib/daily-usage-counters';

function createMockSupabase() {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(),
  };
  return {
    from: jest.fn(() => chain),
    rpc: jest.fn(),
    __chain: chain,
  };
}

describe('readDailyUsageCount', () => {
  test('カウンタ行が存在しない場合は0を返す', async () => {
    const supabase = createMockSupabase();
    supabase.__chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const count = await readDailyUsageCount(supabase as any, 'uid-1', 'chat', '2026-07-05');

    expect(count).toBe(0);
    expect(supabase.from).toHaveBeenCalledWith('daily_usage_counters');
  });

  test('日付が今日と異なる場合は0を返す（日次リセット）', async () => {
    const supabase = createMockSupabase();
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { count: 5, counter_date: '2026-07-04' },
      error: null,
    });

    const count = await readDailyUsageCount(supabase as any, 'uid-1', 'chat', '2026-07-05');

    expect(count).toBe(0);
  });

  test('日付が今日と一致する場合は保存されたカウントを返す', async () => {
    const supabase = createMockSupabase();
    supabase.__chain.maybeSingle.mockResolvedValue({
      data: { count: 3, counter_date: '2026-07-05' },
      error: null,
    });

    const count = await readDailyUsageCount(supabase as any, 'uid-1', 'chat', '2026-07-05');

    expect(count).toBe(3);
  });
});

describe('incrementDailyUsageCount', () => {
  test('RPC呼び出しに成功した場合は新しいカウントを返す', async () => {
    const supabase = createMockSupabase();
    supabase.rpc.mockResolvedValue({ data: 4, error: null });

    const count = await incrementDailyUsageCount(supabase as any, 'uid-1', 'chat', '2026-07-05');

    expect(count).toBe(4);
    expect(supabase.rpc).toHaveBeenCalledWith('handle_increment_daily_usage_counter', {
      p_user_id: 'uid-1',
      p_counter_key: 'chat',
      p_today: '2026-07-05',
    });
  });

  test('RPCがエラーを返した場合は例外を投げる', async () => {
    const supabase = createMockSupabase();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(
      incrementDailyUsageCount(supabase as any, 'uid-1', 'chat', '2026-07-05')
    ).rejects.toThrow('boom');
  });
});
