import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripeClient, getStripeWebhookSecret } from '@/lib/stripe/server';
import {
  handleCheckoutSessionCompleted,
  handleInvoicePaymentFailed,
  handleStripeSubscriptionEvent,
  isStripeEventProcessed,
  markStripeEventProcessed,
} from '@/services/stripe-webhook';

export const runtime = 'nodejs';

/**
 * POST /api/webhooks/stripe
 * Stripe 契約イベントを冪等に Supabase へ同期する
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing-signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error('[API/webhooks/stripe] 署名検証失敗:', error);
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 });
  }

  if (await isStripeEventProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleStripeSubscriptionEvent(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }

    await markStripeEventProcessed(event.id, event.type);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[API/webhooks/stripe] イベント処理エラー:', error);
    return NextResponse.json({ error: 'processing-failed' }, { status: 500 });
  }
}
