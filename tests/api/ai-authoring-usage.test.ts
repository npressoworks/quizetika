import { GET } from '@/app/api/quiz/ai-authoring-usage/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();

const mockQuestionsSnap = { data: () => ({ count: 2, lastUpdatedDate: '2026-06-10' }) };
const mockThumbnailSnap = { data: () => ({ count: 1, lastUpdatedDate: '2026-06-10' }) };
const mockChatSnap = { data: () => ({ count: 3, lastUpdatedDate: '2026-06-10' }) };

const mockQuestionsRef = { get: jest.fn(async () => mockQuestionsSnap) };
const mockThumbnailRef = { get: jest.fn(async () => mockThumbnailSnap) };
const mockChatRef = { get: jest.fn(async () => mockChatSnap) };

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn((sub: string) => {
            if (sub === 'dailyAiAuthoringCounts') {
              return {
                doc: jest.fn((docId: string) => {
                  if (docId === 'questions') return mockQuestionsRef;
                  if (docId === 'thumbnail') return mockThumbnailRef;
                  return mockChatRef;
                }),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };
    }
    return { doc: jest.fn() };
  }),
};

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifySupabaseAccessToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
}));

jest.mock('@/lib/firebase/admin', () => ({
  getAdminFirestore: () => mockDb,
}));

jest.mock('@/services/ai-authoring-utils', () => {
  const actual = jest.requireActual('@/services/ai-authoring-utils');
  return {
    ...actual,
    getJstTodayString: () => '2026-06-10',
  };
});

describe('GET /api/quiz/ai-authoring-usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
  });

  test('Pro ユーザは 200 と usage を返す', async () => {
    const req = new NextRequest('http://localhost/api/quiz/ai-authoring-usage?userId=uid-pro');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions.usedToday).toBe(2);
    expect(body.thumbnail.usedToday).toBe(1);
    expect(body.chat.usedToday).toBe(3);
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const req = new NextRequest('http://localhost/api/quiz/ai-authoring-usage?userId=uid-free');
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('pro-required');
  });
});
