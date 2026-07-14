import { NextResponse } from 'next/server';
import { fetchPlanPricesFromStripe } from '@/services/billing-prices';

export const revalidate = 3600;

export async function GET(): Promise<NextResponse> {
  try {
    const prices = await fetchPlanPricesFromStripe();
    return NextResponse.json(prices);
  } catch (error) {
    console.error('[billing/prices] error:', error);
    return NextResponse.json(
      { error: 'internal-error', message: '価格情報の取得に失敗しました。' },
      { status: 500 }
    );
  }
}

