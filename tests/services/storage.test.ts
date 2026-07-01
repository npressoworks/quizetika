import { getSnsLogoUrl, uploadQuizCover } from '../../src/services/storage';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

// firebase/storage のモック
jest.mock('firebase/storage', () => {
  const actual = jest.requireActual('firebase/storage');
  return {
    ...actual,
    ref: jest.fn(),
    getDownloadURL: jest.fn(),
    uploadBytes: jest.fn(),
  };
});

describe('getSnsLogoUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('初回呼び出し時に Storage から URL を取得し、2回目以降はキャッシュから返す', async () => {
    jest.resetModules();
    const { getSnsLogoUrl } = require('../../src/services/storage');
    const { getDownloadURL, ref } = require('firebase/storage');

    const mockUrl = 'https://firebasestorage.googleapis.com/v0/b/.../youtube.png';
    const mockRef = { path: '/sns-logos/youtube.png' };
    
    ref.mockReturnValue(mockRef);
    getDownloadURL.mockResolvedValue(mockUrl);

    // 1回目
    const url1 = await getSnsLogoUrl('youtube');
    expect(url1).toBe(mockUrl);
    expect(ref).toHaveBeenCalledWith(expect.any(Object), '/sns-logos/youtube.png');
    expect(getDownloadURL).toHaveBeenCalledWith(mockRef);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);

    // 2回目
    const url2 = await getSnsLogoUrl('youtube');
    expect(url2).toBe(mockUrl);
    expect(getDownloadURL).toHaveBeenCalledTimes(1);
  });

  test('異なるSNS名の場合は個別に URL を取得する', async () => {
    jest.resetModules();
    const { getSnsLogoUrl } = require('../../src/services/storage');
    const { getDownloadURL, ref } = require('firebase/storage');

    ref.mockImplementation((_storage: any, path: string) => ({ path }));
    getDownloadURL
      .mockResolvedValueOnce('https://storage/youtube.png')
      .mockResolvedValueOnce('https://storage/x.png');

    const urlYoutube = await getSnsLogoUrl('youtube');
    const urlX = await getSnsLogoUrl('x');

    expect(urlYoutube).toBe('https://storage/youtube.png');
    expect(urlX).toBe('https://storage/x.png');
    expect(getDownloadURL).toHaveBeenCalledTimes(2);
  });
});

describe('uploadQuizCover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('正常系: 許可されたMIMEタイプかつサイズ制限内のBlobをアップロードできること', async () => {
    jest.resetModules();
    const { uploadQuizCover } = require('../../src/services/storage');
    const { getDownloadURL, ref, uploadBytes } = require('firebase/storage');
    
    const mockFile = new Blob(['dummy content'], { type: 'image/jpeg' });
    const quizId = 'quiz-123';
    const mockUrl = 'https://storage/quizzes/quiz-123/cover.jpeg';
    const mockRef = { path: 'quizzes/quiz-123/cover.jpeg' };

    ref.mockReturnValue(mockRef);
    uploadBytes.mockResolvedValue({ ref: mockRef });
    getDownloadURL.mockResolvedValue(mockUrl);

    const url = await uploadQuizCover(mockFile, quizId);

    expect(url).toBe(mockUrl);
    expect(ref).toHaveBeenCalledWith(expect.any(Object), expect.stringMatching(/^quizzes\/quiz-123\/cover_\d+\.jpeg$/));
    expect(uploadBytes).toHaveBeenCalledWith(mockRef, mockFile, { contentType: 'image/jpeg' });
    expect(getDownloadURL).toHaveBeenCalledWith(mockRef);
  });

  test('異常系: SVG形式のファイルはエラーをスローすること', async () => {
    const mockFile = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
    const quizId = 'quiz-123';

    await expect(uploadQuizCover(mockFile, quizId)).rejects.toThrow('PNG, JPEG, GIF ファイルのみアップロード可能です。');
  });

  test('異常系: 10MBを超えるファイルはエラーをスローすること', async () => {
    const largeSize = 10.1 * 1024 * 1024;
    const mockFile = {
      size: largeSize,
      type: 'image/png',
    } as any;
    const quizId = 'quiz-123';

    await expect(uploadQuizCover(mockFile, quizId)).rejects.toThrow('ファイルサイズは 10MB 以下にしてください。');
  });
});
