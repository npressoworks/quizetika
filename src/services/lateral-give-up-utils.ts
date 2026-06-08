import { Question } from '@/types';

/**
 * 諦め時にプレイヤーへ表示するテキストを返す。
 * 作成者向け解説（explanation）を優先し、未設定時は裏設定（aiContextDetails）にフォールバックする。
 */
export function getLateralRevealText(question: Question): string {
  const explanation = question.explanation?.trim();
  if (explanation) return explanation;

  const truth = question.aiContextDetails?.trim();
  if (truth) return truth;

  return '作成者が解説を設定していません。';
}
