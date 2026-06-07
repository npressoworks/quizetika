import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { getAppBaseUrl, getStripeClient } from '@/lib/stripe/server';
import { getPriceIdForInterval } from '@/lib/subscription-plans';
import { resolveUserEntitlements } from '@/services/entitlement';
import type { PriceInterval } from '@/types/subscription';

export class AlreadySubscribedError extends Error {
  constructor() {
    super('既に有料プランに加入しています');
    this.name = 'AlreadySubscribedError';
  }
}

export class NoActiveSubscriptionError extends Error {
  constructor() {
    super('有効な有料契約が見つかりません');
    this.name = 'NoActiveSubscriptionError';
  }
}

export class UserNotFoundError extends Error {
  constructor() {
    super('ユーザーが見つかりません');
    this.name = 'UserNotFoundError';
  }
}

export interface CreateCheckoutSessionInput {
  uid: string;
  email: string;
  priceInterval: PriceInterval;
}

export interface CreateCheckoutSessionResult {
  sessionUrl: string;
}

export interface CreatePortalSessionInput {
  uid: string;
}

/**
 * Firebase UID とメールから Stripe Customer を取得または新規作成する
 */
export async function getOrCreateStripeCustomer(uid: string, email: string): Promise<string> {
  const db = getAdminFirestore();
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();

  if (!userSnap.exists) {
    throw new UserNotFoundError();
  }

  const userData = userSnap.data() as { stripeCustomerId?: string };
  if (userData.stripeCustomerId) {
    return userData.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUid: uid },
  });

  await userRef.set(
    {
      stripeCustomerId: customer.id,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return customer.id;
}

/**
 * 認証済み無料ユーザー向け Checkout Session を発行する
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  const entitlements = await resolveUserEntitlements(input.uid);
  if (entitlements.hasPaidEntitlements) {
    throw new AlreadySubscribedError();
  }

  const customerId = await getOrCreateStripeCustomer(input.uid, input.email);
  const priceId = getPriceIdForInterval(input.priceInterval);
  const appUrl = getAppBaseUrl();
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: input.uid,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/pricing?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=canceled`,
  });

  if (!session.url) {
    throw new Error('Stripe Checkout Session URL が取得できませんでした');
  }

  return { sessionUrl: session.url };
}

/**
 * 有効な有料契約者向け Customer Portal Session を発行する
 */
export async function createPortalSession(
  input: CreatePortalSessionInput
): Promise<{ sessionUrl: string }> {
  const entitlements = await resolveUserEntitlements(input.uid);
  if (!entitlements.hasPaidEntitlements) {
    throw new NoActiveSubscriptionError();
  }

  const db = getAdminFirestore();
  const userSnap = await db.collection('users').doc(input.uid).get();
  if (!userSnap.exists) {
    throw new UserNotFoundError();
  }

  const stripeCustomerId = userSnap.data()?.stripeCustomerId as string | undefined;
  if (!stripeCustomerId) {
    throw new NoActiveSubscriptionError();
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${getAppBaseUrl()}/pricing`,
  });

  return { sessionUrl: session.url };
}
