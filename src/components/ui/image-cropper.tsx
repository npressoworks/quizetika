'use client';

import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AddOutlined, RemoveOutlined } from '@mui/icons-material';

// 解像度制限(FHD)および1.91:1(OGP)アスペクト比維持のための寸法計算関数
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxWidth: number = 1920,
  maxHeight: number = 1005 // 1920 / 1.91 = 1005.23... (四捨五入して 1005)
): { width: number; height: number } {
  let targetWidth = width;
  let targetHeight = height;

  const aspect = 1.91;

  if (targetWidth > maxWidth || targetHeight > maxHeight) {
    if (targetWidth / targetHeight >= aspect) {
      targetWidth = maxWidth;
      targetHeight = Math.round(maxWidth / aspect);
    } else {
      targetHeight = maxHeight;
      targetWidth = Math.round(maxHeight * aspect);
    }
  }
  return { width: targetWidth, height: targetHeight };
}

// Canvasを用いて切り抜き・縮小(FHD制限)・JPEG変換を行うヘルパー関数
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area
): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.setAttribute('crossOrigin', 'anonymous'); // CORS 回避用
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D コンテキストの取得に失敗しました。');
  }

  // クロップ対象のオリジナル幅・高さから目標のFHD以下サイズを計算
  const { width: targetWidth, height: targetHeight } = calculateTargetDimensions(
    pixelCrop.width,
    pixelCrop.height
  );

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // Canvasに切り抜いた画像を描画 (縮小リサイズを同時に適用)
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // JPEG 形式、画質 0.85 で Blob をエクスポート
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas からの Blob 生成に失敗しました。'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.85
    );
  });
}

export interface ImageCropperProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function ImageCropper({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
}: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixelsData: Area) => {
      setCroppedAreaPixels(croppedAreaPixelsData);
    },
    []
  );

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedBlob);
      onClose();
    } catch (error) {
      console.error('画像の切り抜き処理に失敗しました:', error);
      alert('画像のトリミングに失敗しました。ファイル破損などの可能性があります。');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>画像を 1.91:1 (OGP規格) に切り抜く</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* クロッパーエリア */}
          <div className="relative w-full h-[280px] bg-black rounded-lg overflow-hidden border border-border">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1.91}
              onCropChange={setCrop}
              onCropComplete={onCropCompleteCallback}
              onZoomChange={setZoom}
              objectFit="cover"
            />
          </div>

          {/* ズームコントロール */}
          <div className="flex items-center gap-3 px-1">
            <RemoveOutlined
              className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setZoom(Math.max(1, zoom - 0.2))}
            />
            <input
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <AddOutlined
              className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={() => setZoom(Math.min(3, zoom + 0.2))}
            />
            <span className="text-xs text-muted-foreground font-mono min-w-[32px] text-right">
              {zoom.toFixed(1)}x
            </span>
          </div>
        </div>

        <DialogFooter className="sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? '処理中…' : '確定'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
