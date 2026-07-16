import { NextRequest, NextResponse } from 'next/server';
import { reconcileSubscriptions } from '@/services/subscription-reconciliation';

export const runtime = 'nodejs';

/**
 * GET /api/cron/sync-subscriptions
 * Vercel Cron からの日次起動を受け付け、`CRON_SECRET` による認可検証後に
 * Stripe 実契約状態とローカル DB の整合性チェック（是正）を実行する。
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await reconcileSubscriptions();
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error('[API/cron/sync-subscriptions] 整合性チェックに失敗:', error);
    return NextResponse.json({ error: 'internal-error' }, { status: 500 });
  }
}
