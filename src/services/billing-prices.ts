import type Stripe from 'stripe';
import {
  computeYearlySavingsLabel,
  formatJpyPriceLabel,
} from '@/lib/pricing-format';
import { getStripeClient } from '@/lib/stripe/server';
import { getPaidTierDefinitions } from '@/lib/subscription-plans';

export interface PriceQuote {
  amount: number;
  currency: 'jpy';
  label: string;
}

export interface PlanPrices {
  monthly: PriceQuote;
  yearly: PriceQuote;
  savingsLabel?: string;
}

export interface PlanPricesResult {
  player: PlanPrices;
  creator: PlanPrices;
}

export type ProPriceQuote = PriceQuote;
export type ProPricesResult = PlanPrices;

export class BillingPricesFetchError extends Error {
  override name = 'BillingPricesFetchError';
}

function parseJpyUnitAmount(price: Stripe.Price): number {
  if (price.currency !== 'jpy' || price.unit_amount == null) {
    throw new BillingPricesFetchError('Invalid Stripe price configuration');
  }
  return price.unit_amount;
}

export async function fetchPlanPricesFromStripe(): Promise<PlanPricesResult> {
  const playerDef = getPaidTierDefinitions().find((def) => def.tier === 'player');
  const creatorDef = getPaidTierDefinitions().find((def) => def.tier === 'creator');
  if (!playerDef || !creatorDef) {
    throw new BillingPricesFetchError('Player or Creator tier is not configured');
  }

  const stripe = getStripeClient();

  let playerMonthly: Stripe.Price;
  let playerYearly: Stripe.Price;
  let creatorMonthly: Stripe.Price;
  let creatorYearly: Stripe.Price;

  try {
    [playerMonthly, playerYearly, creatorMonthly, creatorYearly] = await Promise.all([
      stripe.prices.retrieve(playerDef.priceIds.monthly),
      stripe.prices.retrieve(playerDef.priceIds.yearly),
      stripe.prices.retrieve(creatorDef.priceIds.monthly),
      stripe.prices.retrieve(creatorDef.priceIds.yearly),
    ]);
  } catch (error) {
    console.error('[billing-prices] stripe retrieve failed:', error);
    throw new BillingPricesFetchError('Failed to retrieve Stripe prices');
  }

  const playerMonthlyAmount = parseJpyUnitAmount(playerMonthly);
  const playerYearlyAmount = parseJpyUnitAmount(playerYearly);
  const creatorMonthlyAmount = parseJpyUnitAmount(creatorMonthly);
  const creatorYearlyAmount = parseJpyUnitAmount(creatorYearly);

  const playerMonthlyQuote: PriceQuote = {
    amount: playerMonthlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(playerMonthlyAmount, 'monthly'),
  };
  const playerYearlyQuote: PriceQuote = {
    amount: playerYearlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(playerYearlyAmount, 'yearly'),
  };

  const creatorMonthlyQuote: PriceQuote = {
    amount: creatorMonthlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(creatorMonthlyAmount, 'monthly'),
  };
  const creatorYearlyQuote: PriceQuote = {
    amount: creatorYearlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(creatorYearlyAmount, 'yearly'),
  };

  const playerSavingsLabel = computeYearlySavingsLabel(playerMonthlyAmount, playerYearlyAmount);
  const creatorSavingsLabel = computeYearlySavingsLabel(creatorMonthlyAmount, creatorYearlyAmount);

  const player: PlanPrices = playerSavingsLabel
    ? { monthly: playerMonthlyQuote, yearly: playerYearlyQuote, savingsLabel: playerSavingsLabel }
    : { monthly: playerMonthlyQuote, yearly: playerYearlyQuote };

  const creator: PlanPrices = creatorSavingsLabel
    ? { monthly: creatorMonthlyQuote, yearly: creatorYearlyQuote, savingsLabel: creatorSavingsLabel }
    : { monthly: creatorMonthlyQuote, yearly: creatorYearlyQuote };

  return { player, creator };
}
