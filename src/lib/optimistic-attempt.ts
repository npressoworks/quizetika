import { PendingSyncAttempt } from '@/services/attempt-session';

const KEY_PREFIX = 'quizetika_optimistic_attempt_';

function getSessionStorage(): Storage | null {
  if (typeof globalThis === 'undefined') return null;
  return globalThis.sessionStorage ?? null;
}

export function setOptimisticAttempt(localId: string, data: PendingSyncAttempt): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.setItem(`${KEY_PREFIX}${localId}`, JSON.stringify(data));
}

export function getOptimisticAttempt(localId: string): PendingSyncAttempt | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  const raw = storage.getItem(`${KEY_PREFIX}${localId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingSyncAttempt;
  } catch {
    return null;
  }
}

export function clearOptimisticAttempt(localId: string): void {
  const storage = getSessionStorage();
  if (!storage) return;
  storage.removeItem(`${KEY_PREFIX}${localId}`);
}
