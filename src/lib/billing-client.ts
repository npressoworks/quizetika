import { getSupabaseAccessToken } from '@/lib/supabase/auth';
import type { ProPricesResult } from '@/services/billing-prices';
import type { PriceInterval } from '@/types/subscription';

export type { ProPriceQuote, ProPricesResult } from '@/services/billing-prices';

export type BillingApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'already-subscribed'
  | 'no-subscription'
  | 'network'
  | 'unknown';

export interface BillingApiError {
  code: BillingApiErrorCode;
  message: string;
  httpStatus?: number;
}

export class BillingClientError extends Error {
  constructor(public readonly apiError: BillingApiError) {
    super(apiError.message);
    this.name = 'BillingClientError';
  }
}

function mapErrorResponse(
  status: number,
  body: { error?: string; message?: string }
): BillingApiError {
  const fallbackMessage =
    'エラーが発生しました。しばらくしてから再度お試しください。';
  const message = body.message ?? fallbackMessage;

  switch (status) {
    case 401:
      return { code: 'unauthorized', message: 'ログインが必要です', httpStatus: status };
    case 403:
      return { code: 'forbidden', message, httpStatus: status };
    case 409:
      return {
        code: 'already-subscribed',
        message: message || 'すでに Pro プランに契約中です',
        httpStatus: status,
      };
    case 404:
      return {
        code: body.error === 'no-subscription' ? 'no-subscription' : 'unknown',
        message,
        httpStatus: status,
      };
    default:
      return { code: 'unknown', message, httpStatus: status };
  }
}

async function postBillingApi(
  path: string,
  body?: Record<string, unknown>
): Promise<{ sessionUrl: string }> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new BillingClientError({
      code: 'unauthorized',
      message: 'ログインが必要です',
    });
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.error('[billing-client] network error:', error);
    throw new BillingClientError({
      code: 'network',
      message: '通信に失敗しました。ネットワーク接続を確認して再度お試しください。',
    });
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    sessionUrl?: string;
  };

  if (!response.ok) {
    const apiError = mapErrorResponse(response.status, data);
    console.error('[billing-client] API error:', apiError);
    throw new BillingClientError(apiError);
  }

  const sessionUrl = data.sessionUrl;
  if (!sessionUrl || typeof sessionUrl !== 'string') {
    throw new BillingClientError({
      code: 'unknown',
      message: 'エラーが発生しました。しばらくしてから再度お試しください。',
      httpStatus: response.status,
    });
  }

  return { sessionUrl };
}

function isValidProPriceQuote(value: unknown): value is ProPricesResult['monthly'] {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Record<string, unknown>;
  return (
    typeof quote.amount === 'number' &&
    quote.currency === 'jpy' &&
    typeof quote.label === 'string'
  );
}

function isValidProPricesResult(value: unknown): value is ProPricesResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return isValidProPriceQuote(result.monthly) && isValidProPriceQuote(result.yearly);
}

export async function fetchProPrices(): Promise<ProPricesResult> {
  let response: Response;
  try {
    response = await fetch('/api/billing/prices');
  } catch (error) {
    console.error('[billing-client] network error:', error);
    throw new BillingClientError({
      code: 'network',
      message: '通信に失敗しました。ネットワーク接続を確認して再度お試しください。',
    });
  }

  const rawData = (await response.json().catch(() => ({}))) as any;

  if (!response.ok) {
    throw new BillingClientError({
      code: 'unknown',
      message:
        rawData.message ?? 'エラーが発生しました。しばらくしてから再度お試しください。',
      httpStatus: response.status,
    });
  }

  // Creator プランの価格を後方互換性のために返す
  const data = rawData.creator;

  if (!isValidProPricesResult(data)) {
    throw new BillingClientError({
      code: 'unknown',
      message: 'エラーが発生しました。しばらくしてから再度お試しください。',
      httpStatus: response.status,
    });
  }

  return data;
}

export async function startCheckoutSession(
  priceInterval: PriceInterval,
  plan: 'player' | 'creator' = 'creator'
): Promise<{ sessionUrl: string }> {
  return postBillingApi('/api/billing/checkout-session', { priceInterval, plan });
}

export async function changePlan(
  targetPlan: 'player' | 'creator'
): Promise<{ subscriptionTier: string }> {
  const token = await getSupabaseAccessToken();
  if (!token) {
    throw new BillingClientError({
      code: 'unauthorized',
      message: 'ログインが必要です',
    });
  }

  let response: Response;
  try {
    response = await fetch('/api/billing/change-plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetPlan }),
    });
  } catch (error) {
    console.error('[billing-client] network error:', error);
    throw new BillingClientError({
      code: 'network',
      message: '通信に失敗しました。ネットワーク接続を確認して再度お試しください。',
    });
  }

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    subscriptionTier?: string;
  };

  if (!response.ok) {
    const apiError = mapErrorResponse(response.status, data);
    console.error('[billing-client] API error:', apiError);
    throw new BillingClientError(apiError);
  }

  const subscriptionTier = data.subscriptionTier;
  if (!subscriptionTier || typeof subscriptionTier !== 'string') {
    throw new BillingClientError({
      code: 'unknown',
      message: 'エラーが発生しました。しばらくしてから再度お試しください。',
      httpStatus: response.status,
    });
  }

  return { subscriptionTier };
}

export async function startPortalSession(): Promise<{ sessionUrl: string }> {
  return postBillingApi('/api/billing/portal-session');
}

export function redirectToExternalUrl(sessionUrl: string): void {
  if (!sessionUrl.startsWith('https://')) {
    console.error('[billing-client] Invalid sessionUrl');
    throw new BillingClientError({
      code: 'unknown',
      message: 'エラーが発生しました。しばらくしてから再度お試しください。',
    });
  }
  window.location.assign(sessionUrl);
}
