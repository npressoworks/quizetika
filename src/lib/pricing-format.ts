export type PriceLabelInterval = 'monthly' | 'yearly';

export function formatJpyPriceLabel(amount: number, interval: PriceLabelInterval): string {
  const formatted = amount.toLocaleString('ja-JP');
  return interval === 'monthly' ? `¥${formatted}/月` : `¥${formatted}/年`;
}

export function computeYearlySavingsLabel(
  monthlyAmount: number,
  yearlyAmount: number
): string | undefined {
  if (monthlyAmount <= 0) {
    return undefined;
  }
  const monthsSaved = Math.floor((monthlyAmount * 12 - yearlyAmount) / monthlyAmount);
  if (monthsSaved < 1) {
    return undefined;
  }
  return `年額で約${monthsSaved}ヶ月分お得`;
}
