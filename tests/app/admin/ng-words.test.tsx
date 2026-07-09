/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';

// jsdom は PointerEvent を実装していないため、base-ui の Switch コンポーネントが
// 内部で発火する PointerEvent 生成に失敗する。テスト用に軽量ポリフィルを注入する。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/link', () => {
  return function MockLink({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('@/context/auth-context', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// 対象の画面コンポーネントをロード
import AdminNgWordsPage from '@/app/admin/ng-words/page';

describe('AdminNgWordsPage - NGワードマスタ管理UI', () => {
  const mockGetIdToken = jest.fn().mockResolvedValue('admin-token');

  const initialNgWords = [
    {
      id: 'ngword-1',
      word: '禁止語句A',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => initialNgWords,
    });
  });

  test('非管理者のアクセス時に /not-found へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        moderationTier: 'newcomer',
      } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminNgWordsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/not-found');
    });
  });

  test('未ログイン時にログイン画面へリダイレクトされること', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminNgWordsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/admin/ng-words');
    });
  });

  test('認証情報確認中はローディングインジケータを表示すること', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      authUser: null,
      loading: true,
      refreshUser: jest.fn(),
    });

    render(<AdminNgWordsPage />);

    expect(screen.getByText(/認証情報を確認しています/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('管理者のアクセス時にNGワード一覧と登録フォームが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminNgWordsPage />);

    await waitFor(() => {
      expect(screen.getByText('禁止語句A')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/NGワード/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /追加/ })).toBeInTheDocument();
  });

  test('空文字・空白のみの語句を送信するとインライン検証エラーが表示されAPIが呼ばれないこと', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminNgWordsPage />);

    await screen.findByText('禁止語句A');

    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

    const input = screen.getByLabelText(/NGワード/);
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /追加/ }));

    expect(
      await screen.findByText(/空文字または空白のみでは登録できません|語句を入力してください/)
    ).toBeInTheDocument();

    // POST は呼ばれていないこと（初期GET以外の呼び出しがないこと）
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
  });

  test('新規登録が成功すると一覧に即時反映され成功メッセージが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const newWord = {
      id: 'ngword-2',
      word: '新規禁止語',
      isActive: true,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/admin/ng-words' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: newWord }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => initialNgWords });
    });
    global.fetch = fetchMock;

    render(<AdminNgWordsPage />);
    await screen.findByText('禁止語句A');

    fireEvent.change(screen.getByLabelText(/NGワード/), {
      target: { value: '新規禁止語' },
    });
    fireEvent.click(screen.getByRole('button', { name: /追加/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ng-words',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ word: '新規禁止語' }),
        })
      );
    });

    expect(await screen.findByText('新規禁止語')).toBeInTheDocument();
    expect(screen.getByText(/登録しました|追加しました/)).toBeInTheDocument();
  });

  test('重複語句の登録時に409エラーで「この語句はすでに登録されています」が表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/admin/ng-words' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({
            error: 'duplicate',
            message: 'この語句はすでに登録されています。',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => initialNgWords });
    });
    global.fetch = fetchMock;

    render(<AdminNgWordsPage />);
    await screen.findByText('禁止語句A');

    fireEvent.change(screen.getByLabelText(/NGワード/), {
      target: { value: '禁止語句A' },
    });
    fireEvent.click(screen.getByRole('button', { name: /追加/ }));

    expect(
      await screen.findByText('この語句はすでに登録されています。')
    ).toBeInTheDocument();
  });

  test('既存NGワードの編集保存でPATCHが呼ばれ一覧が更新されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const updatedWord = {
      id: 'ngword-1',
      word: '編集後語句',
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    };

    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/admin/ng-words/ngword-1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: updatedWord }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => initialNgWords });
    });
    global.fetch = fetchMock;

    render(<AdminNgWordsPage />);
    await screen.findByText('禁止語句A');

    fireEvent.click(screen.getByRole('button', { name: /編集/ }));

    const editInput = screen.getByDisplayValue('禁止語句A');
    fireEvent.change(editInput, { target: { value: '編集後語句' } });
    fireEvent.click(screen.getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ng-words/ngword-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ word: '編集後語句' }),
        })
      );
    });

    expect(await screen.findByText('編集後語句')).toBeInTheDocument();
  });

  test('有効/無効トグル操作でPATCHが呼ばれ一覧の状態が即座に反映されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const toggledWord = {
      id: 'ngword-1',
      word: '禁止語句A',
      isActive: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-03T00:00:00.000Z',
    };

    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/admin/ng-words/ngword-1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: toggledWord }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => initialNgWords });
    });
    global.fetch = fetchMock;

    render(<AdminNgWordsPage />);
    await screen.findByText('禁止語句A');

    const toggle = screen.getByTestId('ngword-toggle-ngword-1');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ng-words/ngword-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ isActive: false }),
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('無効')).toBeInTheDocument();
    });
  });

  test('編集操作が失敗した場合エラーアラートが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', moderationTier: 'admin' } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/admin/ng-words/ngword-1' && options?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({
            error: 'internal-error',
            message: 'サーバー内部エラーが発生しました。',
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => initialNgWords });
    });
    global.fetch = fetchMock;

    render(<AdminNgWordsPage />);
    await screen.findByText('禁止語句A');

    const toggle = screen.getByTestId('ngword-toggle-ngword-1');
    fireEvent.click(toggle);

    expect(
      await screen.findByText(/サーバー内部エラーが発生しました/)
    ).toBeInTheDocument();
  });
});
