/**
 * @jest-environment jsdom
 */
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
});
