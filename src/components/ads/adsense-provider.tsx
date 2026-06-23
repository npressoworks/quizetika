'use client';

import React from 'react';
import Script from 'next/script';
import { useAds } from '@/hooks/useAds';

interface AdsenseProviderProps {
  children: React.ReactNode;
}

export function AdsenseProvider({ children }: AdsenseProviderProps): React.JSX.Element {
  const { showAds } = useAds();
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <>
      {showAds && clientId && (
        <Script
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
      )}
      {children}
    </>
  );
}
