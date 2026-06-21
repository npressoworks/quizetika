import { getSnsLogoUrl } from '../../src/services/storage';
import { getDownloadURL, ref } from 'firebase/storage';

// firebase/storage のモック
jest.mock('firebase/storage', () => {
  const actual = jest.requireActual('firebase/storage');
  return {
    ...actual,
    ref: jest.fn(),
    getDownloadURL: jest.fn(),
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
    const mockRef = { path: 'assets/logos/youtube.png' };
    
    ref.mockReturnValue(mockRef);
    getDownloadURL.mockResolvedValue(mockUrl);

    // 1回目
    const url1 = await getSnsLogoUrl('youtube');
    expect(url1).toBe(mockUrl);
    expect(ref).toHaveBeenCalledWith(expect.any(Object), 'assets/logos/youtube.png');
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
