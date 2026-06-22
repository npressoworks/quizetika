process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'gs://quizeum-test-bucket';

import { getAdminStorage } from '../../src/lib/firebase/admin';

const mockFile = {
  save: jest.fn().mockResolvedValue(undefined),
  makePublic: jest.fn().mockResolvedValue(undefined),
};

const mockBucket = {
  name: 'quizeum-test-bucket',
  file: jest.fn(() => mockFile),
};

jest.mock('../../src/lib/firebase/admin', () => {
  const mockStorage = {
    bucket: jest.fn(() => mockBucket),
  };
  return {
    getAdminStorage: () => mockStorage,
  };
});

describe('uploadTemporaryGenreIconBuffer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('バッファデータを Firebase Storage の genres/temp パスに保存し、公開URLを返すこと', async () => {
    jest.resetModules();
    const { uploadTemporaryGenreIconBuffer } = require('../../src/services/storage-admin');

    const dummyBuffer = Buffer.from('dummy-image-data');
    const uid = 'user-123';
    
    const url = await uploadTemporaryGenreIconBuffer(dummyBuffer, uid);
    
    expect(mockBucket.file).toHaveBeenCalledWith(expect.stringMatching(/^genres\/temp\/user-123_\d+\.png$/));
    expect(mockFile.save).toHaveBeenCalledWith(dummyBuffer, {
      metadata: { contentType: 'image/png' },
      resumable: false,
    });
    expect(mockFile.makePublic).toHaveBeenCalledTimes(1);
    expect(url).toContain('https://storage.googleapis.com/quizeum-test-bucket/genres/temp/user-123_');
  });
});
