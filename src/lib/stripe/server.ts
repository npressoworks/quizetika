import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('Missing required environment variable: STRIPE_SECRET_KEY');
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('Missing required environment variable: STRIPE_WEBHOOK_SECRET');
  }
  return secret;
}

export function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_APP_URL');
  }
  return url.replace(/\/$/, '');
}
