/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select/AlertDialog コンポーネントが内部で使用するイベント生成・API 呼び出しに
// 失敗する。テスト用に軽量ポリフィルを注入する。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useAuth } from '@/context/auth-context';
import { validateGenreIconFile } from '@/lib/genre-icon-upload';
import { uploadImage } from '@/services/storage';

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

jest.mock('@/services/storage', () => ({
  uploadImage: jest.fn(),
  getGenreIconPath: jest.fn().mockReturnValue('genres/test-genre/icon_123.png'),
}));

jest.mock('@/lib/genre-icon-upload', () => ({
  validateGenreIconFile: jest.fn(),
  GENRE_ICON_ACCEPT: '.png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif',
}));

jest.mock('@/lib/seed-genres-access', () => ({
  assertSeedGenresAccess: jest.fn().mockResolvedValue({ id: 'admin-1' }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUploadImage = uploadImage as jest.MockedFunction<typeof uploadImage>;
const mockValidateGenreIconFile = validateGenreIconFile as jest.MockedFunction<typeof validateGenreIconFile>;

// 対象の画面コンポーネントをロード
import AdminGenresPage from '@/app/admin/genres/page';

describe('AdminGenresPage - ジャンル直接管理UI', () => {
  const mockGetIdToken = jest.fn().mockResolvedValue('admin-token');

  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadImage.mockResolvedValue('https://example.com/icon.png');
    mockValidateGenreIconFile.mockReturnValue({ ok: true });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'genre-1',
          displayName: '歴史',
          description: '歴史に関する問題',
          iconImageUrl: 'https://example.com/genre-1.png',
          isActive: true,
        },
      ],
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

    render(<AdminGenresPage />);

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

    render(<AdminGenresPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?redirect=/admin/genres');
    });
  });

  test('管理者のアクセス時にフォームと一覧テーブルが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminGenresPage />);

    // ロード完了まで待つ
    await waitFor(() => {
      expect(screen.getByText('歴史')).toBeInTheDocument();
    });

    // フォームの主要な入力要素があること
    expect(screen.getByLabelText(/ジャンルID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/ジャンル名/)).toBeInTheDocument();
    expect(screen.getByLabelText(/説明/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ジャンルを追加/ })).toBeInTheDocument();
  });

  test('不適切な画像ファイル選択時にインラインエラーが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    mockValidateGenreIconFile.mockReturnValue({
      ok: false,
      error: 'PNG, JPEG, GIF ファイルのみアップロード可能です。',
    });

    render(<AdminGenresPage />);

    // ロード完了を待つ
    await screen.findByText('歴史');

    const fileInput = screen.getByLabelText(/アイコン画像/) as HTMLInputElement;
    const file = new File(['mock content'], 'test.svg', { type: 'image/svg+xml' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockValidateGenreIconFile).toHaveBeenCalledWith(file);
    expect(
      screen.getByText('PNG, JPEG, GIF ファイルのみアップロード可能です。')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ジャンルを追加/ })).toBeDisabled();
  });

  test('正常なジャンル入力とアイコン画像での送信により、追加処理と一覧への即時反映が行われること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const newGenre = {
      id: 'science',
      displayName: '科学',
      description: '科学のクイズ',
      iconImageUrl: 'https://example.com/icon.png',
      isActive: true,
    };

    // fetch のモックを定義（初期ロード時のGETと、一時アップロードPOST、追加POST）
    const fetchMock = jest.fn().mockImplementation((url, options) => {
      if (url === '/api/genres/upload-icon' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, tempUrl: 'https://example.com/temp/icon.png' }),
        });
      }
      if (url === '/api/admin/genres' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, data: newGenre }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 'genre-1',
            displayName: '歴史',
            description: '歴史に関する問題',
            iconImageUrl: 'https://example.com/genre-1.png',
            isActive: true,
          },
        ],
      });
    });
    global.fetch = fetchMock;

    render(<AdminGenresPage />);

    // ロード完了を待つ
    await screen.findByText('歴史');

    // フォーム入力
    fireEvent.change(screen.getByLabelText(/ジャンルID/), { target: { value: 'science' } });
    fireEvent.change(screen.getByLabelText(/ジャンル名/), { target: { value: '科学' } });
    fireEvent.change(screen.getByLabelText(/説明/), { target: { value: '科学のクイズ' } });

    // ファイル選択
    const fileInput = screen.getByLabelText(/アイコン画像/) as HTMLInputElement;
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // アップロード完了とプレビューのファイル名表示を待つ
    await screen.findByText('test.png');

    // フォーム送信
    const submitButton = screen.getByRole('button', { name: /ジャンルを追加/ });
    fireEvent.click(submitButton);

    // POST処理が呼ばれることを検証
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/genres',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            id: 'science',
            displayName: '科学',
            description: '科学のクイズ',
            iconImageUrl: 'https://example.com/temp/icon.png',
          }),
        })
      );
    });

    // 成功メッセージの表示と、一覧テーブルへの追加を検証
    expect(screen.getByText(/ジャンル「科学」を新しく追加しました。/)).toBeInTheDocument();
    expect(screen.getByText('科学')).toBeInTheDocument();
    expect(screen.getByText('science')).toBeInTheDocument();
  });

  test('管理者のアクセス時に初期ジャンル一括投入セクションとボタンが表示されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken, uid: 'admin-1' } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminGenresPage />);

    await waitFor(() => {
      expect(screen.getByText('歴史')).toBeInTheDocument();
    });

    expect(document.getElementById('seed-genres-btn')).toBeInTheDocument();
    expect(document.getElementById('seed-genres-heading')).toBeInTheDocument();
  });

  test('投入中はボタンが無効化され、完了後に成功メッセージが表示されジャンル一覧が再取得されること', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as any,
      authUser: { getIdToken: mockGetIdToken, uid: 'admin-1' } as any,
      loading: false,
      refreshUser: jest.fn(),
    });

    const fetchMock = jest.fn().mockImplementation((url) => {
      if (url === '/api/admin/seed-genres') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, added: 4, updated: 6 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            id: 'genre-1',
            displayName: '歴史',
            description: '歴史に関する問題',
            iconImageUrl: 'https://example.com/genre-1.png',
            isActive: true,
          },
        ],
      });
    });
    global.fetch = fetchMock;

    render(<AdminGenresPage />);

    await screen.findByText('歴史');

    const seedButton = document.getElementById('seed-genres-btn') as HTMLButtonElement;
    fireEvent.click(seedButton);

    expect(seedButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText(/新規: 4件、更新: 6件/)).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/seed-genres',
      expect.objectContaining({ method: 'POST' })
    );
    // 一覧の再取得 (GET /api/admin/genres) が投入後に呼ばれていること
    expect(
      fetchMock.mock.calls.filter(([url]) => url === '/api/admin/genres').length
    ).toBeGreaterThanOrEqual(2);
  });

  test('非管理者には一括投入UIセクションが表示されないこと', async () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'user-1',
        moderationTier: 'newcomer',
      } as any,
      authUser: null,
      loading: false,
      refreshUser: jest.fn(),
    });

    render(<AdminGenresPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/not-found');
    });

    expect(document.getElementById('seed-genres-btn')).not.toBeInTheDocument();
  });

  describe('ジャンル削除フロー', () => {
    const adminAuth: ReturnType<typeof useAuth> = {
      user: {
        id: 'admin-1',
        moderationTier: 'admin',
      } as unknown as ReturnType<typeof useAuth>['user'],
      authUser: { getIdToken: mockGetIdToken, uid: 'admin-1' } as unknown as ReturnType<
        typeof useAuth
      >['authUser'],
      loading: false,
      refreshUser: jest.fn(),
    };

    const genresList = [
      {
        id: 'genre-1',
        displayName: '歴史',
        description: '歴史に関する問題',
        iconImageUrl: 'https://example.com/genre-1.png',
        isActive: true,
      },
      {
        id: 'genre-2',
        displayName: '科学',
        description: '科学に関する問題',
        iconImageUrl: null,
        isActive: true,
      },
    ];

    test('削除操作の開始で影響クイズ件数取得APIが呼ばれ、件数がダイアログに表示されること', async () => {
      mockUseAuth.mockReturnValue(adminAuth);

      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === '/api/admin/genres/genre-1/usage') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ quizCount: 3 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => genresList,
        });
      });
      global.fetch = fetchMock;

      render(<AdminGenresPage />);
      await screen.findByText('歴史');

      fireEvent.click(screen.getByTestId('delete-genre-btn-genre-1'));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/admin/genres/genre-1/usage',
          expect.objectContaining({ method: 'GET' })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('delete-genre-usage-count')).toHaveTextContent('3件');
      });

      // 削除対象自身は再割当て先の選択肢から除外される
      fireEvent.click(screen.getByTestId('delete-genre-reassign-select'));

      expect(
        screen.queryByTestId('delete-genre-reassign-option-genre-1')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('delete-genre-reassign-option-genre-2')).toBeInTheDocument();
    });

    test('削除確定後、削除APIが呼ばれ成功時に一覧が再取得され成功メッセージが表示されること', async () => {
      mockUseAuth.mockReturnValue(adminAuth);

      const fetchMock = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/genres/genre-2/usage') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ quizCount: 0 }),
          });
        }
        if (url === '/api/admin/genres/genre-2' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, reassignedCount: 0 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => genresList,
        });
      });
      global.fetch = fetchMock;

      render(<AdminGenresPage />);
      await screen.findByText('歴史');

      fireEvent.click(screen.getByTestId('delete-genre-btn-genre-2'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-genre-usage-count')).toHaveTextContent('0件');
      });

      const confirmBtn = screen.getByTestId('delete-genre-confirm-btn');
      expect(confirmBtn).not.toBeDisabled();
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/admin/genres/genre-2',
          expect.objectContaining({ method: 'DELETE' })
        );
      });

      await waitFor(() => {
        expect(screen.queryByTestId('delete-genre-confirm-btn')).not.toBeInTheDocument();
      });

      expect(screen.getByText(/「科学」を削除しました/)).toBeInTheDocument();

      // 一覧の再取得 (GET /api/admin/genres) が削除後に呼ばれていること
      expect(
        fetchMock.mock.calls.filter(([url]) => url === '/api/admin/genres').length
      ).toBeGreaterThanOrEqual(2);
    });

    test('削除失敗時はダイアログ内にエラーメッセージが表示され、対象ジャンルが一覧に残ること', async () => {
      mockUseAuth.mockReturnValue(adminAuth);

      const fetchMock = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url === '/api/admin/genres/genre-1/usage') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ quizCount: 0 }),
          });
        }
        if (url === '/api/admin/genres/genre-1' && options?.method === 'DELETE') {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: 'internal-error', message: '削除に失敗しました。' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => genresList,
        });
      });
      global.fetch = fetchMock;

      render(<AdminGenresPage />);
      await screen.findByText('歴史');

      fireEvent.click(screen.getByTestId('delete-genre-btn-genre-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-genre-usage-count')).toHaveTextContent('0件');
      });

      fireEvent.click(screen.getByTestId('delete-genre-confirm-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-genre-error')).toHaveTextContent('削除に失敗しました。');
      });

      // ダイアログは閉じず、確定ボタンが依然として表示されていること
      expect(screen.getByTestId('delete-genre-confirm-btn')).toBeInTheDocument();

      // 対象ジャンルは一覧に残っていること
      expect(screen.getByText('歴史')).toBeInTheDocument();
    });

    test('削除操作のキャンセル時は削除APIが呼ばれずダイアログが閉じること', async () => {
      mockUseAuth.mockReturnValue(adminAuth);

      const fetchMock = jest.fn().mockImplementation((url: string) => {
        if (url === '/api/admin/genres/genre-1/usage') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ quizCount: 0 }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => genresList,
        });
      });
      global.fetch = fetchMock;

      render(<AdminGenresPage />);
      await screen.findByText('歴史');

      fireEvent.click(screen.getByTestId('delete-genre-btn-genre-1'));

      await waitFor(() => {
        expect(screen.getByTestId('delete-genre-usage-count')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-genre-cancel-btn'));

      await waitFor(() => {
        expect(screen.queryByTestId('delete-genre-confirm-btn')).not.toBeInTheDocument();
      });

      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === '/api/admin/genres/genre-1' && options?.method === 'DELETE'
        )
      ).toBe(false);
    });
  });
});
