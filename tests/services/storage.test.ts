import { assertGenreIconFileValid } from '../../src/lib/genre-icon-upload';

// Supabase クライアントのモックを作成
const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockRemove = jest.fn();

const mockStorageFrom = jest.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
}));

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: mockStorageFrom,
    },
  }),
}));

describe('uploadImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常系: 許可されたMIMEタイプの画像を対象バケットにアップロードし公開URLを返す', async () => {
    const { uploadImage } = require('../../src/services/storage');

    const mockFile = { type: 'image/png', size: 1024 } as any;
    mockUpload.mockResolvedValue({ data: { path: 'q1/icon_1.png' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/genres/q1/icon_1.png' },
    });

    const url = await uploadImage(mockFile, 'genres/q1/icon_1.png');

    expect(mockStorageFrom).toHaveBeenCalledWith('genres');
    expect(mockUpload).toHaveBeenCalledWith('q1/icon_1.png', mockFile, { contentType: 'image/png' });
    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/genres/q1/icon_1.png');
  });

  test('異常系: 許可されていないMIMEタイプの場合はエラーをスローすること', async () => {
    const { uploadImage } = require('../../src/services/storage');
    const mockFile = { type: 'image/svg+xml', size: 1024 } as any;

    await expect(uploadImage(mockFile, 'genres/q1/icon_1.svg')).rejects.toThrow(
      'PNG, JPEG, GIF ファイルのみアップロード可能です。'
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

describe('deleteImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Supabase 公開URLパターンの場合はバケットとパスを解決して削除すること', async () => {
    const { deleteImage } = require('../../src/services/storage');
    mockRemove.mockResolvedValue({ data: {}, error: null });

    await deleteImage('https://project.supabase.co/storage/v1/object/public/quizzes/q1/cover_1.png');

    expect(mockStorageFrom).toHaveBeenCalledWith('quizzes');
    expect(mockRemove).toHaveBeenCalledWith(['q1/cover_1.png']);
  });

  test('旧 Firebase Storage の URL は削除処理をスキップし正常終了すること', async () => {
    const { deleteImage } = require('../../src/services/storage');

    await expect(
      deleteImage('https://firebasestorage.googleapis.com/v0/b/quizetika.appspot.com/o/quizzes%2Fq1%2Fcover.png')
    ).resolves.toBeUndefined();

    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  test('空文字列の場合は何もしないこと', async () => {
    const { deleteImage } = require('../../src/services/storage');

    await expect(deleteImage('')).resolves.toBeUndefined();
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });
});

describe('getSnsLogoUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('初回呼び出し時に sns-logos バケットから公開URLを取得し、2回目以降はキャッシュから返す', async () => {
    const { getSnsLogoUrl } = require('../../src/services/storage');

    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/sns-logos/youtube.png' },
    });

    const url1 = await getSnsLogoUrl('youtube');
    expect(url1).toBe('https://project.supabase.co/storage/v1/object/public/sns-logos/youtube.png');
    expect(mockStorageFrom).toHaveBeenCalledWith('sns-logos');
    expect(mockGetPublicUrl).toHaveBeenCalledWith('youtube.png');
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);

    const url2 = await getSnsLogoUrl('youtube');
    expect(url2).toBe(url1);
    expect(mockGetPublicUrl).toHaveBeenCalledTimes(1);
  });
});

describe('uploadQuizCover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常系: 許可されたMIMEタイプかつサイズ制限内のBlobをアップロードできること', async () => {
    const { uploadQuizCover } = require('../../src/services/storage');

    const mockFile = new Blob(['dummy content'], { type: 'image/jpeg' });
    const quizId = 'quiz-123';

    mockUpload.mockResolvedValue({ data: { path: 'quiz-123/cover.jpeg' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/quizzes/quiz-123/cover.jpeg' },
    });

    const url = await uploadQuizCover(mockFile, quizId);

    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/quizzes/quiz-123/cover.jpeg');
    expect(mockStorageFrom).toHaveBeenCalledWith('quizzes');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^quiz-123\/cover_\d+\.jpeg$/),
      mockFile,
      { contentType: 'image/jpeg' }
    );
  });

  test('異常系: SVG形式のファイルはエラーをスローすること', async () => {
    const { uploadQuizCover } = require('../../src/services/storage');
    const mockFile = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const quizId = 'quiz-123';

    await expect(uploadQuizCover(mockFile, quizId)).rejects.toThrow('PNG, JPEG, GIF ファイルのみアップロード可能です。');
  });

  test('異常系: 10MBを超えるファイルはエラーをスローすること', async () => {
    const { uploadQuizCover } = require('../../src/services/storage');
    const largeSize = 10.1 * 1024 * 1024;
    const mockFile = {
      size: largeSize,
      type: 'image/png',
    } as any;
    const quizId = 'quiz-123';

    await expect(uploadQuizCover(mockFile, quizId)).rejects.toThrow('ファイルサイズは 10MB 以下にしてください。');
  });
});

describe('uploadUserAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常系: 許可されたMIMEタイプかつサイズ制限内のファイルをユーザーアバターパスへアップロードできること', async () => {
    const { uploadUserAvatar } = require('../../src/services/storage');

    const mockFile = { type: 'image/png', size: 1024 } as any;
    const uid = 'user-123';

    mockUpload.mockResolvedValue({ data: { path: 'user-123/avatar.png' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/users/user-123/avatar_1.png' },
    });

    const url = await uploadUserAvatar(mockFile, uid);

    expect(url).toBe('https://project.supabase.co/storage/v1/object/public/users/user-123/avatar_1.png');
    expect(mockStorageFrom).toHaveBeenCalledWith('users');
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^user-123\/avatar_\d+\.png$/),
      mockFile,
      { contentType: 'image/png' }
    );
  });

  test('異常系: SVG形式のファイルはエラーをスローすること', async () => {
    const { uploadUserAvatar } = require('../../src/services/storage');
    const mockFile = { type: 'image/svg+xml', size: 500 } as any;

    await expect(uploadUserAvatar(mockFile, 'user-123')).rejects.toThrow(
      'PNG, JPEG, GIF ファイルのみアップロード可能です。'
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  test('異常系: 5MBを超えるファイルはエラーをスローすること', async () => {
    const { uploadUserAvatar } = require('../../src/services/storage');
    const largeSize = 5.1 * 1024 * 1024;
    const mockFile = { type: 'image/png', size: largeSize } as any;

    await expect(uploadUserAvatar(mockFile, 'user-123')).rejects.toThrow(
      'ファイルサイズは 5MB 以下にしてください。'
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });
});

test('assertGenreIconFileValid はガード関数として存在する（既存維持の確認）', () => {
  expect(typeof assertGenreIconFileValid).toBe('function');
});
