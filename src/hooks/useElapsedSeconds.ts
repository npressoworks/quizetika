'use client';

import { useEffect, useState } from 'react';

/** プレイ中の経過秒数を1秒刻みでカウントする */
export function useElapsedSeconds(enabled: boolean): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled]);

  return elapsedSeconds;
}
