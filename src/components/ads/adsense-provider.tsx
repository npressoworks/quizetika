'use client';

import React, { useEffect } from 'react';
import { useAds } from '@/hooks/useAds';

interface AdsenseProviderProps {
  children: React.ReactNode;
}

export function AdsenseProvider({ children }: AdsenseProviderProps): React.JSX.Element {
  const { showAds } = useAds();
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  useEffect(() => {
    if (!showAds || !clientId) return;

    // 重複読み込み防止
    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );
    if (existingScript) return;

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`;
    script.crossOrigin = 'anonymous';
    script.async = true;
    document.head.appendChild(script);
  }, [showAds, clientId]);

  return <>{children}</>;
}
