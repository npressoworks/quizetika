import type { PriceInterval, SubscriptionTier } from '@/types/subscription';

export type PaidFeatureKey = 'unlimited_ai_questions';

export interface PaidTierDefinition {
  tier: 'pro' | 'premium';
  displayName: string;
  priceIds: { monthly: string; yearly: string };
  featureKeys: readonly PaidFeatureKey[];
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let paidTierDefinitionsCache: readonly PaidTierDefinition[] | null = null;
let priceIdToTierCache: Map<string, SubscriptionTier> | null = null;

function buildPaidTierDefinitions(): readonly PaidTierDefinition[] {
  return [
    {
      tier: 'pro',
      displayName: 'Pro',
      priceIds: {
        monthly: requireEnv('STRIPE_PRICE_PRO_MONTHLY'),
        yearly: requireEnv('STRIPE_PRICE_PRO_YEARLY'),
      },
      featureKeys: ['unlimited_ai_questions'],
    },
  ] as const;
}

/**
 * 有料 tier 定義の単一正本。Premium 追加時は配列に1エントリ追加する。
 */
export function getPaidTierDefinitions(): readonly PaidTierDefinition[] {
  if (!paidTierDefinitionsCache) {
    paidTierDefinitionsCache = buildPaidTierDefinitions();
  }
  return paidTierDefinitionsCache;
}

/** @deprecated テスト互換のためのエイリアス — `getPaidTierDefinitions()` を優先 */
export const PAID_TIER_DEFINITIONS = new Proxy([] as readonly PaidTierDefinition[], {
  get(_target, prop) {
    const defs = getPaidTierDefinitions();
    const value = Reflect.get(defs as unknown as object, prop);
    return typeof value === 'function' ? value.bind(defs) : value;
  },
});

function ensurePriceIdMap(): Map<string, SubscriptionTier> {
  if (!priceIdToTierCache) {
    priceIdToTierCache = new Map(
      getPaidTierDefinitions().flatMap((def) => [
        [def.priceIds.monthly, def.tier],
        [def.priceIds.yearly, def.tier],
      ])
    );
  }
  return priceIdToTierCache;
}

export function priceIdToTier(priceId: string): SubscriptionTier | null {
  return ensurePriceIdMap().get(priceId) ?? null;
}

export function getPriceIdForInterval(interval: PriceInterval): string {
  const pro = getPaidTierDefinitions().find((d) => d.tier === 'pro');
  if (!pro) {
    throw new Error('Pro tier is not configured');
  }
  return interval === 'monthly' ? pro.priceIds.monthly : pro.priceIds.yearly;
}

export function hasFeature(tier: SubscriptionTier, feature: PaidFeatureKey): boolean {
  if (tier === 'free') return false;
  const def = getPaidTierDefinitions().find((d) => d.tier === tier);
  return def?.featureKeys.includes(feature) ?? false;
}

export function resolveSubscriptionTier(
  raw: SubscriptionTier | undefined | null
): SubscriptionTier {
  return raw ?? 'free';
}
