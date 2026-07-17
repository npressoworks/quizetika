/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { submitGenreRequest } from '@/services/tagMerge';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  notFound: jest.fn(),
}));

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/services/tagMerge', () => ({
  submitGenreRequest: jest.fn(),
  voteGenreRequest: jest.fn(),
}));

jest.mock('@/lib/middleware-auth-cookies', () => ({
  isAdminUser: jest.fn().mockReturnValue(false),
}));

jest.mock('@/lib/governance-freeze', () => ({
  isGovernanceFrozen: jest.fn().mockReturnValue(false),
}));

const selectChain = {
  eq: jest.fn(),
};

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => selectChain),
    })),
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockSubmitGenreRequest = submitGenreRequest as jest.MockedFunction<typeof submitGenreRequest>;

import CommunityGenresPage from '@/app/community/genres/page';

describe('CommunityGenresPage - ジャンル申請後のポーリング一覧の即時反映', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    selectChain.eq.mockReturnValue({
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    mockUseAuth.mockReturnValue({
      user: {
        id: 'moderator-1',
        moderationTier: 'senior_moderator',
      } as any,
      authUser: { uid: 'moderator-1', getIdToken: jest.fn().mockResolvedValue('token') } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    mockSubmitGenreRequest.mockResolvedValue(undefined as any);

    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/genres/generate-icon') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ iconImageUrl: 'http://127.0.0.1:54321/storage/v1/object/public/genres/temp/ai.png' }),
        });
      }
      if (url === '/api/genres/migrate-icon') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ iconImageUrl: 'http://127.0.0.1:54321/storage/v1/object/public/genres/new-genre/icon.png' }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    }) as any;
  });

  test('申請送信直後にポーリング間隔を待たず投票待ち一覧が再取得されること', async () => {
    render(<CommunityGenresPage />);

    // マウント時の初回フェッチ
    await waitFor(() => expect(selectChain.eq).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('ジャンルID（英語・小文字・ハイフン区切り）'), {
      target: { value: 'new-genre' },
    });
    fireEvent.change(screen.getByLabelText('ジャンル名（日本語）'), {
      target: { value: '新ジャンル' },
    });
    fireEvent.change(screen.getByLabelText('説明'), {
      target: { value: 'テスト用の説明文です。' },
    });

    fireEvent.click(screen.getByRole('button', { name: /AIで生成/ }));
    await waitFor(() => expect(screen.getByAltText('アイコンプレビュー')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /ジャンルを申請する/ }));

    await waitFor(() => expect(mockSubmitGenreRequest).toHaveBeenCalled());

    // ポーリング(15秒)を待たずに一覧が再取得されていること
    await waitFor(() => expect(selectChain.eq).toHaveBeenCalledTimes(2));
  });
});
