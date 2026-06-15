import { POST } from '@/app/api/quiz/ai-generate-thumbnail/route';
import { NextRequest } from 'next/server';

const mockVerify = jest.fn();
const mockResolveEntitlements = jest.fn();
const mockGenerateContent = jest.fn();
const mockUpload = jest.fn();
const mockRunTransaction = jest.fn(async (fn: (tx: { set: jest.Mock }) => Promise<void>) => {
  await fn({ set: jest.fn() });
});

const mockQuestionsRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) })) };
const mockThumbnailRef = { get: jest.fn(async () => ({ data: () => ({ count: 0, lastUpdatedDate: '2026-06-10' }) })) };

const mockDb = {
  collection: jest.fn((name: string) => {
    if (name === 'users') {
      return {
        doc: jest.fn(() => ({
          collection: jest.fn((sub: string) => {
            if (sub === 'dailyAiAuthoringCounts') {
              return {
                doc: jest.fn((docId: string) =>
                  docId === 'questions' ? mockQuestionsRef : mockThumbnailRef
                ),
              };
            }
            return { doc: jest.fn() };
          }),
        })),
      };
    }
    return { doc: jest.fn() };
  }),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
};

jest.mock('@/lib/firebase/auth-verify', () => ({
  extractBearerToken: () => 'token',
  verifyFirebaseIdToken: (...args: unknown[]) => mockVerify(...args),
}));

jest.mock('@/services/entitlement', () => ({
  resolveUserEntitlements: (...args: unknown[]) => mockResolveEntitlements(...args),
}));

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: (...args: unknown[]) => mockGenerateContent(...args),
    },
  })),
}));

jest.mock('@/services/storage-admin', () => ({
  uploadQuizCoverBuffer: (...args: unknown[]) => mockUpload(...args),
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

describe('POST /api/quiz/ai-generate-thumbnail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerify.mockResolvedValue('uid-pro');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: true,
      hasUnlimitedAiQuestions: true,
    });
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ inlineData: { data: Buffer.from('png').toString('base64'), mimeType: 'image/png' } }],
          },
        },
      ],
    });
    mockUpload.mockResolvedValue('https://storage.googleapis.com/bucket/quizzes/drafts/uid-pro/cover.png');
  });

  function makeRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost/api/quiz/ai-generate-thumbnail', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  test('成功時に thumbnailUrl と usage を返す', async () => {
    const res = await POST(
      makeRequest({
        title: 'テストクイズ',
        description: 'テスト説明文です',
        userId: 'uid-pro',
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thumbnailUrl).toContain('storage.googleapis.com');
    expect(body.usage).toBeDefined();
    expect(mockUpload).toHaveBeenCalled();
  });

  test('非 Pro は 403', async () => {
    mockVerify.mockResolvedValue('uid-free');
    mockResolveEntitlements.mockResolvedValue({
      hasPaidEntitlements: false,
      hasUnlimitedAiQuestions: false,
    });
    const res = await POST(
      makeRequest({
        title: 'テストクイズ',
        description: 'テスト説明文です',
        userId: 'uid-free',
      })
    );
    expect(res.status).toBe(403);
  });
});
