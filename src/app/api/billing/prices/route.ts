import { NextResponse } from 'next/server';
import { fetchProPricesFromStripe } from '@/services/billing-prices';

export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  try {
    const prices = await fetchProPricesFromStripe();
    return NextResponse.json(prices);
  } catch (error) {
    console.error('[billing/prices] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: '価格情報の取得に失敗しました。' },
      { status: 500 }
    );
  }
}
