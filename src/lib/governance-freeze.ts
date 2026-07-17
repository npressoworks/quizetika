/**
 * コミュニティガバナンス凍結フラグ
 *
 * 凍結状態のアプリ側の唯一の参照点。Edge Runtime（middleware）・クライアント・
 * サーバーの全レイヤーから import 可能な純粋 TS モジュール（外部依存ゼロ・副作用なし）。
 *
 * 【凍結解除時はこの定数 1 行のみを `false` に変更する】
 * （あわせて設計書 Migration Strategy の復元マイグレーションを適用すること）
 */
export const COMMUNITY_GOVERNANCE_FROZEN: boolean = true;

/**
 * 凍結中なら true。UI・middleware・サービス層はこの関数のみを参照する。
 * 関数化しているのはテストで `jest.mock('@/lib/governance-freeze')` による
 * 差し替えを可能にするため。
 */
export function isGovernanceFrozen(): boolean {
  return COMMUNITY_GOVERNANCE_FROZEN;
}
