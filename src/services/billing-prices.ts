import type Stripe from 'stripe';
import {
  computeYearlySavingsLabel,
  formatJpyPriceLabel,
} from '@/lib/pricing-format';
import { getStripeClient } from '@/lib/stripe/server';
import { getPaidTierDefinitions } from '@/lib/subscription-plans';

export interface ProPriceQuote {
  amount: number;
  currency: 'jpy';
  label: string;
}

export interface ProPricesResult {
  monthly: ProPriceQuote;
  yearly: ProPriceQuote;
  savingsLabel?: string;
}

export class BillingPricesFetchError extends Error {
  override name = 'BillingPricesFetchError';
}

function parseJpyUnitAmount(price: Stripe.Price): number {
  if (price.currency !== 'jpy' || price.unit_amount == null) {
    throw new BillingPricesFetchError('Invalid Stripe price configuration');
  }
  return price.unit_amount;
}

export async function fetchProPricesFromStripe(): Promise<ProPricesResult> {
  const pro = getPaidTierDefinitions().find((def) => def.tier === 'pro');
  if (!pro) {
    throw new BillingPricesFetchError('Pro tier is not configured');
  }

  const stripe = getStripeClient();

  let monthlyPrice: Stripe.Price;
  let yearlyPrice: Stripe.Price;

  try {
    [monthlyPrice, yearlyPrice] = await Promise.all([
      stripe.prices.retrieve(pro.priceIds.monthly),
      stripe.prices.retrieve(pro.priceIds.yearly),
    ]);
  } catch (error) {
    console.error('[billing-prices] stripe retrieve failed:', error);
    throw new BillingPricesFetchError('Failed to retrieve Stripe prices');
  }

  const monthlyAmount = parseJpyUnitAmount(monthlyPrice);
  const yearlyAmount = parseJpyUnitAmount(yearlyPrice);

  const monthly: ProPriceQuote = {
    amount: monthlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(monthlyAmount, 'monthly'),
  };
  const yearly: ProPriceQuote = {
    amount: yearlyAmount,
    currency: 'jpy',
    label: formatJpyPriceLabel(yearlyAmount, 'yearly'),
  };

  const savingsLabel = computeYearlySavingsLabel(monthlyAmount, yearlyAmount);

  return savingsLabel ? { monthly, yearly, savingsLabel } : { monthly, yearly };
}
