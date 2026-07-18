/**
 * テストプレイ用 AI真相判定API のユニットテスト
 * POST /api/quiz/test-verify-truth
 *
 * 本番 verify-truth と同一のプロンプト・判定ロジックを、attempt 非連動で提供し、
 * 全クイズ横断の日次AIターン制限のみ消費することを検証する。
 */

import { POST } from '@/app/api/quiz/test-verify-truth/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockGenerateContent = jest.fn();
const mockRpc = jest.fn();
const mockResolveUserEntitlements = jest.fn();

function todayJstString(): string {
  const d = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(d.getTime() + jstOffset);
  const yyyy = jstDate.getUTCFullYear();
  const mm = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(jstDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const TODAY = todayJstString();

let globalResolveValue: { data: unknown; error: unknown } = { data: null, error: null };

function createChain(resolveValue: { data: unknown; error: unknown }) {
  const chain: any = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(resolveValue)),
    then: (onFulfilled: any, onRejected: any) =>
      Promise.resolve(resolveValue).then(onFulfilled, onRejected),
  };
  return chain;
}

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: jest.fn((table: string) => {
      if (table === 'ai_turn_counts_global') return createChain(globalResolveValue);
      return createChain({ data: null, error: null });
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveUserEntitlements(...args),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
  Type: { OBJECT: 'OBJECT', STRING: 'STRING' },
}));

function buildRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/quiz/test-verify-truth', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
  });
}

const validBody = {
  aiContextDetails: '男は遭難しウミガメのスープを飲んだ',
  truthKeywords: ['ウミガメ', '遭難'],
  truthSummary: '男は遭難していて、ウミガメのスープの真実に気づいた',
};

describe('POST /api/quiz/test-verify-truth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-1');
    mockResolveUserEntitlements.mockResolvedValue({ hasUnlimitedAiQuestions: false });
    globalResolveValue = { data: null, error: null };
    mockRpc.mockResolvedValue({ data: null, error: null });
  });

  it('本番と同一のプロンプトで Gemini を呼び出し、合否を返す', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"verdict":"CORRECT"}' });

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isCorrect).toBe(true);
    expect(body.advice).toBeNull();

    const prompt = mockGenerateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain('ウミガメ');
    expect(prompt).toContain('文字列の完全一致を合格条件としない');
  });

  it('不合格時は固定アドバイスを返す', async () => {
    mockGenerateContent.mockResolvedValue({
      text: '{"verdict":"INCORRECT","reason":"MISSING_ESSENCE"}',
    });

    const res = await POST(buildRequest(validBody));
    const body = await res.json();
    expect(body.isCorrect).toBe(false);
    expect(body.advice).toBe('必須要素が足りていません。');
  });

  it('グローバル日次カウンタのみを消費する（per-quiz・履歴は対象外）', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"verdict":"CORRECT"}' });

    await POST(buildRequest(validBody));

    expect(mockRpc).toHaveBeenCalledWith(
      'handle_record_ai_turn',
      expect.objectContaining({
        p_attempt_id: null,
        p_quiz_id: null,
        p_history_entry: null,
        p_per_quiz_limit: null,
        p_global_limit: 150,
      })
    );
  });

  it('グローバル日次上限に達している場合は Gemini を呼ばず 429 を返す', async () => {
    globalResolveValue = { data: { count: 150, count_date: TODAY }, error: null };

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe('limit-exceeded');
    expect(body.limitType).toBe('global-daily');
    expect(mockGenerateContent).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('認証失敗時は 401 を返す', async () => {
    mockVerify.mockResolvedValue(null);

    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('裏設定または真相要約が欠けている場合は 400 を返す', async () => {
    const res = await POST(
      buildRequest({ aiContextDetails: '', truthSummary: '要約' })
    );
    expect(res.status).toBe(400);
  });
});
