import { calculateTargetDimensions } from '@/components/ui/image-cropper';

describe('calculateTargetDimensions', () => {
  test('解像度が制限範囲内（FHD以下）の場合はサイズを変更しないこと', () => {
    const size = { width: 800, height: 419 }; // 1.91:1 (800 / 1.91 = 418.8...)
    const result = calculateTargetDimensions(size.width, size.height);
    expect(result.width).toBe(800);
    expect(result.height).toBe(419);
  });

  test('幅が1920を超える場合、1.91:1のアスペクト比を維持して幅1920に縮小されること', () => {
    const size = { width: 3000, height: 1571 }; // 3000 / 1.91 = 1570.6...
    const result = calculateTargetDimensions(size.width, size.height);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1005); // 1920 / 1.91 = 1005.2...
  });

  test('高さが1005を超える場合、1.91:1のアスペクト比を維持して高さ1005に縮小されること', () => {
    const size = { width: 2100, height: 1100 }; // 2100 / 1100 = 1.909...
    const result = calculateTargetDimensions(size.width, size.height);
    // 高さが1005に制限され、幅はアスペクト比を保って1920に変換される
    expect(result.height).toBe(1005);
    expect(result.width).toBe(1920); // 1005 * 1.91 = 1919.55 -> 1920
  });

  test('aspect引数に1（正方形）とmaxWidth/maxHeight=512を指定した場合、512px上限で正方形に縮小されること', () => {
    const size = { width: 1000, height: 1000 };
    const result = calculateTargetDimensions(size.width, size.height, 1, 512, 512);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
  });
});
