/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ProfileEditClient } from '@/app/profile/edit/profile-edit-client';
import { getUser, updateProfile } from '@/services/user';
import { useActiveGenres } from '@/hooks/useActiveGenres';

// ImageCropper は Canvas/Image のブラウザ実測処理（jsdom未実装）に依存するため、
// ProfileEditClient 側のクロップフロー統合（モーダル表示→確定/キャンセル）検証に
// 必要な最小限のスタブに差し替える。クロップ処理そのものの単体検証は
// tests/components/image-cropper.test.tsx が担う。
const mockCroppedBlob = new Blob(['cropped-avatar-data'], { type: 'image/jpeg' });

jest.mock('@/components/ui/image-cropper', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    ImageCropper: (props: any) => {
      if (!props.isOpen) return null;
      return ReactActual.createElement(
        'div',
        { 'data-testid': 'mock-image-cropper' },
        ReactActual.createElement(
          'button',
          {
            type: 'button',
            'data-testid': props.confirmTestId || 'image-cropper-confirm',
            onClick: () => props.onCropComplete(mockCroppedBlob),
          },
          'confirm'
        ),
        ReactActual.createElement(
          'button',
          {
            type: 'button',
            'data-testid': props.cancelTestId || 'image-cropper-cancel',
            onClick: () => props.onClose(),
          },
          'cancel'
        ),
        ReactActual.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'mock-image-cropper-trigger-error',
            onClick: () => props.onError && props.onError('画像のトリミングに失敗しました。ファイル破損などの可能性があります。'),
          },
          'trigger-error'
        )
      );
    },
  };
});

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

const mockCurrentUser = { id: 'user-1', displayName: '本人' };
const mockRefreshUser = jest.fn().mockResolvedValue(undefined);
jest.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: false, refreshUser: mockRefreshUser }),
}));

jest.mock('@/services/user', () => ({
  getUser: jest.fn().mockResolvedValue({
    id: 'user-1',
    displayName: 'テストユーザー',
    bio: 'プロフィール自己紹介',
    deleteStatus: 'active',
    followedGenres: ['genre-1'],
    avatarUrl: 'https://example.com/existing-avatar.png',
    snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
  }),
  updateProfile: jest.fn(),
  validateProfileData: jest.fn().mockReturnValue([]),
}));

jest.mock('@/services/storage', () => ({
  uploadUserAvatar: jest.fn(),
}));

jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: jest.fn().mockReturnValue({
    genres: [
      { id: 'genre-1', displayName: 'プログラミング', iconImageUrl: '/icons/prog.png' },
      { id: 'genre-2', displayName: '歴史', iconImageUrl: '' },
      { id: 'genre-3', displayName: '科学', iconImageUrl: '' },
      { id: 'genre-4', displayName: '芸術', iconImageUrl: '' },
    ],
    loading: false,
    error: null,
    genreLabelById: new Map([
      ['genre-1', 'プログラミング'],
      ['genre-2', '歴史'],
      ['genre-3', '科学'],
      ['genre-4', '芸術'],
    ]),
    refetch: jest.fn(),
  }),
}));

describe('ProfileEditClient - Genre Selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ジャンル選択UIが表示され、初期データがチップとして表示されていること', async () => {
    render(<ProfileEditClient />);

    // ロード完了を待つ
    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    // ジャンル選択UIコンテナが存在すること
    const genreSelectContainer = screen.getByTestId('profile-genre-select');
    expect(genreSelectContainer).toBeInTheDocument();

    // 初期値の「プログラミング」チップが表示されていること
    expect(screen.getByTestId('profile-genre-chip-genre-1')).toBeInTheDocument();
    expect(screen.getByText('プログラミング')).toBeInTheDocument();

    // 「歴史」チップはまだ表示されていないこと
    expect(screen.queryByTestId('profile-genre-chip-genre-2')).not.toBeInTheDocument();
  });

  it('検索バーに入力してサジェストから選択し、チップを削除して保存できること', async () => {
    (updateProfile as jest.Mock).mockResolvedValue(true);
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    // 1. 初期選択の「プログラミング」チップを削除
    const removeBtn = screen.getByTestId('profile-genre-remove-genre-1');
    await act(async () => {
      fireEvent.click(removeBtn);
    });
    expect(screen.queryByTestId('profile-genre-chip-genre-1')).not.toBeInTheDocument();

    // 2. 検索バーに「歴史」と入力
    const searchInput = screen.getByTestId('profile-genre-search-input');
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '歴史' } });
    });

    // サジェストが表示されるのを待つ
    const suggestItem = await screen.findByTestId('profile-genre-suggest-genre-2');
    expect(suggestItem).toBeInTheDocument();

    // 3. サジェストを選択
    await act(async () => {
      fireEvent.mouseDown(suggestItem);
    });

    // 「歴史」チップが追加されたことを確認
    expect(screen.getByTestId('profile-genre-chip-genre-2')).toBeInTheDocument();

    // 保存ボタンをクリック
    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalledWith('user-1', {
        displayName: 'テストユーザー',
        bio: 'プロフィール自己紹介',
        followedGenres: ['genre-2'],
        snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
      });
      expect(mockPush).toHaveBeenCalledWith('/profile/user-1');
    });
  });

  it('最大3つのジャンル制限が機能すること', async () => {
    // 初期選択を空にするモック
    (getUser as jest.Mock).mockResolvedValueOnce({
      id: 'user-1',
      displayName: 'テストユーザー',
      bio: 'プロフィール自己紹介',
      deleteStatus: 'active',
      followedGenres: [],
      snsLinks: { youtube: '', x: '', instagram: '', tiktok: '' },
    });

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('profile-genre-search-input');

    // ジャンル1（プログラミング）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: 'プログラミング' } });
    });
    const suggest1 = await screen.findByTestId('profile-genre-suggest-genre-1');
    await act(async () => {
      fireEvent.mouseDown(suggest1);
    });

    // ジャンル2（歴史）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '歴史' } });
    });
    const suggest2 = await screen.findByTestId('profile-genre-suggest-genre-2');
    await act(async () => {
      fireEvent.mouseDown(suggest2);
    });

    // ジャンル3（科学）を追加
    await act(async () => {
      fireEvent.focus(searchInput);
      fireEvent.change(searchInput, { target: { value: '科学' } });
    });
    const suggest3 = await screen.findByTestId('profile-genre-suggest-genre-3');
    await act(async () => {
      fireEvent.mouseDown(suggest3);
    });

    // 3つ追加されたことの確認
    expect(screen.getByTestId('profile-genre-chip-genre-1')).toBeInTheDocument();
    expect(screen.getByTestId('profile-genre-chip-genre-2')).toBeInTheDocument();
    expect(screen.getByTestId('profile-genre-chip-genre-3')).toBeInTheDocument();

    // 検索インプットが disabled になり、プレースホルダーが変化することを確認
    expect(searchInput).toBeDisabled();
    expect(searchInput).toHaveAttribute('placeholder', 'ジャンルは最大3つまで登録できます');
  });
});

describe('ProfileEditClient - アバター画像変更（Phase 30）', () => {
  const mockPreviewUrl = 'blob:mock-preview-url';

  beforeAll(() => {
    global.URL.createObjectURL = jest.fn(() => mockPreviewUrl);
    global.URL.revokeObjectURL = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function makePngFile(name = 'avatar.png', size = 1024) {
    const file = new File(['x'.repeat(size)], name, { type: 'image/png' });
    return file;
  }

  // ファイル選択→クロップモーダル表示→確定操作までを一括で行うヘルパー
  async function selectFileAndConfirmCrop(file: File) {
    const input = screen.getByTestId('profile-avatar-upload-input') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    const confirmButton = await screen.findByTestId('profile-avatar-crop-confirm');
    await act(async () => {
      fireEvent.click(confirmButton);
    });
  }

  it('初期表示で既存のアバター画像がプレビュー領域に表示されること', async () => {
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const preview = screen.getByTestId('profile-avatar-preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveAttribute('src', 'https://example.com/existing-avatar.png');
  });

  it('有効な画像を選択するとクロップモーダルが表示され、確定するとプレビューが更新されること', async () => {
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const input = screen.getByTestId('profile-avatar-upload-input') as HTMLInputElement;
    const file = makePngFile();

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // 選択直後は即座にプレビューへ反映されず、クロップモーダルが表示されること
    const confirmButton = await screen.findByTestId('profile-avatar-crop-confirm');
    expect(confirmButton).toBeInTheDocument();
    expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute(
      'src',
      'https://example.com/existing-avatar.png'
    );

    // クロップ確定操作を行う
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute('src', mockPreviewUrl);
    });
    expect(screen.queryByTestId('profile-avatar-crop-confirm')).not.toBeInTheDocument();
  });

  it('アバターを選択して保存すると、アップロードされたURLでプロフィールが更新され、refreshUser呼び出し後に遷移すること', async () => {
    const { uploadUserAvatar } = require('@/services/storage');
    (uploadUserAvatar as jest.Mock).mockResolvedValue('https://example.com/new-avatar.png');
    (updateProfile as jest.Mock).mockResolvedValue(true);

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const file = makePngFile();
    await selectFileAndConfirmCrop(file);
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute('src', mockPreviewUrl);
    });

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(uploadUserAvatar).toHaveBeenCalledWith(mockCroppedBlob, 'user-1');
      expect(updateProfile).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ avatarUrl: 'https://example.com/new-avatar.png' })
      );
      expect(mockRefreshUser).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith('/profile/user-1');
    });
  });

  it('アバターを変更せずに保存した場合、uploadUserAvatarを呼ばずavatarUrlを更新対象に含めないこと', async () => {
    const { uploadUserAvatar } = require('@/services/storage');
    (updateProfile as jest.Mock).mockResolvedValue(true);

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
    expect(uploadUserAvatar).not.toHaveBeenCalled();
    const updateCallArg = (updateProfile as jest.Mock).mock.calls[0][1];
    expect(updateCallArg).not.toHaveProperty('avatarUrl');
  });

  it('アバターのアップロードに失敗した場合、変更前のアバター表示を維持したままエラーを表示し、遷移しないこと', async () => {
    const { uploadUserAvatar } = require('@/services/storage');
    (uploadUserAvatar as jest.Mock).mockRejectedValue(new Error('アップロードに失敗しました。'));

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const file = makePngFile();
    await selectFileAndConfirmCrop(file);

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(screen.getByText('アップロードに失敗しました。')).toBeInTheDocument();
    });
    expect(updateProfile).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith('/profile/user-1');
  });

  it('クロップ確定操作後、切り抜き結果（Blob）がアップロード対象になり保存時にuploadUserAvatarへ渡されること', async () => {
    const { uploadUserAvatar } = require('@/services/storage');
    (uploadUserAvatar as jest.Mock).mockResolvedValue('https://example.com/cropped-avatar.png');
    (updateProfile as jest.Mock).mockResolvedValue(true);

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const file = makePngFile();
    await selectFileAndConfirmCrop(file);

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      // 元の File ではなく、クロップ確定によって生成された Blob がアップロード対象になること
      expect(uploadUserAvatar).toHaveBeenCalledWith(mockCroppedBlob, 'user-1');
      expect(uploadUserAvatar).not.toHaveBeenCalledWith(file, 'user-1');
    });
  });

  it('クロップキャンセル操作後は変更前のアバターが維持され、保存時にuploadUserAvatarが呼ばれないこと', async () => {
    const { uploadUserAvatar } = require('@/services/storage');
    (updateProfile as jest.Mock).mockResolvedValue(true);

    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const input = screen.getByTestId('profile-avatar-upload-input') as HTMLInputElement;
    const file = makePngFile();
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    const cancelButton = await screen.findByTestId('profile-avatar-crop-cancel');
    await act(async () => {
      fireEvent.click(cancelButton);
    });

    // モーダルが閉じ、変更前のアバターが維持されていること
    expect(screen.queryByTestId('profile-avatar-crop-cancel')).not.toBeInTheDocument();
    expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute(
      'src',
      'https://example.com/existing-avatar.png'
    );

    const saveButton = screen.getByRole('button', { name: /保存/ });
    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      expect(updateProfile).toHaveBeenCalled();
    });
    expect(uploadUserAvatar).not.toHaveBeenCalled();
    const updateCallArg = (updateProfile as jest.Mock).mock.calls[0][1];
    expect(updateCallArg).not.toHaveProperty('avatarUrl');
  });

  it('許可されていない形式の画像を選択すると保存前にエラーが表示され、プレビューは変わらないこと', async () => {
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const input = screen.getByTestId('profile-avatar-upload-input') as HTMLInputElement;
    const svgFile = new File(['<svg></svg>'], 'avatar.svg', { type: 'image/svg+xml' });

    await act(async () => {
      fireEvent.change(input, { target: { files: [svgFile] } });
    });

    await waitFor(() => {
      expect(screen.getByText(/PNG, JPEG, GIF/)).toBeInTheDocument();
    });
    expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute(
      'src',
      'https://example.com/existing-avatar.png'
    );
  });

  it('クロップ処理中にImageCropperのonErrorが呼ばれた場合、エラーメッセージが表示されモーダルは開いたまま維持されること', async () => {
    render(<ProfileEditClient />);

    await waitFor(() => {
      expect(screen.getByText('プロフィールの編集')).toBeInTheDocument();
    });

    const input = screen.getByTestId('profile-avatar-upload-input') as HTMLInputElement;
    const file = makePngFile();
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // クロップモーダルが表示されていること
    expect(await screen.findByTestId('profile-avatar-crop-confirm')).toBeInTheDocument();

    // ImageCropper側のonErrorを発火（切り抜き失敗を模擬）
    const triggerErrorButton = screen.getByTestId('mock-image-cropper-trigger-error');
    await act(async () => {
      fireEvent.click(triggerErrorButton);
    });

    // エラーメッセージが表示されること
    await waitFor(() => {
      expect(
        screen.getByText('画像のトリミングに失敗しました。ファイル破損などの可能性があります。')
      ).toBeInTheDocument();
    });

    // モーダルは開いたまま維持されること（isCropModalOpenがfalseにならない）
    expect(screen.getByTestId('profile-avatar-crop-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('mock-image-cropper')).toBeInTheDocument();

    // 既存アバターのプレビューは変わらないこと
    expect(screen.getByTestId('profile-avatar-preview')).toHaveAttribute(
      'src',
      'https://example.com/existing-avatar.png'
    );
  });
});
