# Gap Analysis: quizeum-governance-freeze

分析日: 2026-07-17 / 対象: requirements.md (Requirement 1〜6)

## 1. 現状調査（Current State Investigation)

### 1.1 コミュニティガバナンスの実装構造

| レイヤー | 資産 | 現状 |
|---|---|---|
| ルートガード | `src/middleware.ts` | `/community/merge` は Cookie `quizetika_tier` で moderator 以上、`/community/genres` は認証のみ。`quizetika_role === 'admin'` 判定は `/admin` 系で既に使用中（L91-97) |
| UI | `src/app/community/merge/page.tsx` | ページ内ガード（`TIER_RANK` で moderator 以上）、提案フォーム + 加重投票UI。15秒ポーリングで `merge_requests` を直接 select |
| UI | `src/app/community/genres/page.tsx` | 認証ユーザーが申請、moderator 以上が投票 |
| サービス | `src/services/tagMerge.ts` | 4つの RPC 呼び出しの薄いラッパー（起案/投票 × merge/genre） |
| DB | `supabase/migrations/20260705000000_governance_normalization.sql` | `handle_create_merge_request` / `handle_vote_merge_request` / `handle_submit_genre_request` / `handle_vote_genre_request`（全て SECURITY DEFINER）。可決判定は加重賛成 >=5 かつ賛成率 >=70%、可決時にタグ/ジャンルの canonical 書き換え・`quiz_tags` 付け替え・`quizzes.genre` 一括更新まで同期実行（L307-324） |
| DB ヘルパー | 同上 L109-126 | `is_admin()`（`role='admin' OR moderation_tier='admin'`）と `is_moderator_or_admin()` が既存。BAN系 RPC は `IF NOT is_admin() THEN RAISE EXCEPTION 'forbidden'` パターンを既に採用 |

### 1.2 バッジ・スコア表示

| 箇所 | 資産 | 現状 |
|---|---|---|
| プロフィール | `src/app/profile/[uid]/profile-client.tsx` | L276-279 でティアバッジ（`resolveModerationTierDisplay`）、L292 でレピュテーションスコア、L428+ で「獲得した称号バッジ」（別セクション、対象外） |
| 表示ヘルパー | `src/lib/moderation-tier-display.ts` | ティア→ラベル解決（admin→「システム管理者」等） |
| 管理画面 | `src/app/admin/users/*` | ティア表示あり（admin 専用画面のため凍結対象外） |
| **リーダーボード** | `src/app/leaderboard/leaderboard-client.tsx` L34-51 | **「スコア」タブが reputationScore によるランキングと数値を全ユーザーに公開表示**（下記 3.3 参照） |

### 1.3 管理者向け既存資産（再利用候補）

- `POST /api/admin/genres`（`src/app/api/admin/genres/route.ts`): Bearer トークン + `isAdminUser()` 判定でジャンルを直接登録（アイコン移動 `moveTemporaryGenreIcon` 込み）。**Requirement 4.1（即時ジャンル登録）はこの API の再利用でほぼ充足可能**
- `authorizeAdmin()` ヘルパー: admin API Route の認可パターンとして確立済み
- Cookie `quizetika_role`: middleware で参照可能な admin 判定軸が確立済み

### 1.4 設定フラグの既存パターン

- 専用の feature-flag 基盤は存在しない
- 環境変数パターン: `NEXT_PUBLIC_ENV`（`src/lib/posthog-enabled.ts` が判定関数を named module で提供する形）が最も近い先例
- middleware（Edge）・クライアント・サーバーの全レイヤーで参照するには `NEXT_PUBLIC_*` 環境変数 or コード内定数のどちらでも成立

## 2. Requirement-to-Asset Map

| 要件 | 既存資産 | ギャップ | 分類 |
|---|---|---|---|
| R1 凍結フラグ・可逆性 | なし（posthog-enabled.ts の判定モジュールパターンのみ） | 凍結フラグモジュール新規作成。DB 側凍結との整合方式が未決 | Missing |
| R2 画面アクセス制御 | middleware.ts の role/tier ガード、ページ内ガード | ガード条件を凍結時 admin 限定へ切替（middleware + 2ページ）。凍結中バナー表示（R2.4）新規。エディタ導線 `quiz-metadata-section.tsx` L301 の出し分け | Missing（小） |
| R3 即時マージ実行 | `handle_vote_merge_request` 内にマージ実行ロジック（L307-324)、`is_admin()` ヘルパー | **管理者単独で即時実行する経路が存在しない**。実行ロジックは投票 RPC 内にインライン実装されており抽出 or 複製が必要。pending 提案の承認/却下 UI も新規 | Missing |
| R4 即時ジャンル登録 | `POST /api/admin/genres`（直接登録・アイコン移動込み） | 新規登録は再利用可。**pending 申請の承認（登録+status更新）/却下の管理者経路が新規** | Missing（一部） |
| R5 サーバーサイド強制 | RPC は SECURITY DEFINER、`is_admin()` あり | **重大: 現行 RPC 4種の認可は `is_not_banned()` のみ。moderator 制限すら UI/middleware 層だけで、認証済みユーザーなら誰でも RPC 直叩きで起案・投票できる（既存の脆弱性）**。凍結チェック追加のマイグレーションが必要 | Missing + Constraint |
| R6 バッジ非表示 | profile-client.tsx の表示箇所は特定済み | フラグによる条件レンダリング追加のみ。**リーダーボードのスコアタブが要件の射程外（3.3）** | Missing（小）+ Unknown |

## 3. 制約・リスク・要調査事項

### 3.1 凍結フラグと DB 側強制の整合（Research Needed → 設計で確定）
アプリ側フラグ（環境変数/定数）は PostgreSQL RPC からは参照できない。選択肢:
- **(a) マイグレーションで凍結を焼き込む**: RPC 4種に `IF NOT is_admin() THEN RAISE EXCEPTION 'governance-frozen'` を追加。解除時は逆マイグレーション。シンプルだが解除に SQL 適用が必要（要件1.3 の「単一の設定」の解釈に注意 — アプリ側フラグ + 解除マイグレーションの2操作になる）
- **(b) DB 設定テーブル**: `app_settings` 的なテーブルの1行を RPC が参照。解除はデータ更新のみで完結し可逆性が最も高いが、新テーブル + RLS + シードが増える
- いずれの場合もアプリ側フラグと DB 側状態の二重管理になるため、設計で「真実の所在」を1つに定める（例: DB を真実とし、アプリ側は表示制御のみフラグ参照）

### 3.2 既存 RPC の認可欠落（Constraint / 凍結解除時の論点）
現行 RPC には moderator チェック自体が存在しない（`is_moderator_or_admin()` は定義済みだが未使用）。凍結マイグレーションで admin 限定にすると解除時に「元の挙動」へ戻す先が「認可なし」になってしまう。**解除時の復元先は `is_moderator_or_admin()` チェック付きとするのが妥当**（本来あるべき姿への修正を兼ねる）。設計で明文化すること。

### 3.3 リーダーボードの reputationScore 公開表示（解決済み・2026-07-17）
`/leaderboard` の「スコア」タブは reputationScore ランキングを全ユーザーに公開している。ユーザー確認の結果、**凍結対象に含める**ことで確定。requirements.md の Requirement 6.3 として追記済み（凍結中は「スコア」タブ非表示、プレイ数・作成数タブは維持）。対象ファイル: `src/app/leaderboard/leaderboard-client.tsx`（タブ定義 L20、`page.tsx` 側の初期データ取得も要確認）。

### 3.4 その他の制約
- 管理者の即時実行時、`resolve_vote_weight()` は admin ティアに重みを定義していない可能性があるため、投票経路の流用ではなく投票をバイパスする専用経路が安全
- `/community/genres` は現在「認証済みなら申請可」のため、凍結時は middleware の条件分岐が tier 比較から role 判定へ変わる（uid チェックのみのパスを admin 限定へ）
- E2E（Playwright）にガバナンス系テストが存在する場合、凍結フラグ ON/OFF 両状態のテスト戦略が必要（テスト環境でのフラグ制御方法を設計で決める）

## 4. 実装アプローチ選択肢

### Option A: 既存コンポーネントの全面 in-place 拡張
middleware・2ページ・profile を凍結フラグで条件分岐し、既存投票 RPC に admin バイパス分岐を追加。
- ✅ 新規ファイル最小、変更箇所が既存導線に閉じる
- ❌ 投票 RPC に「凍結時は admin 単独可決」の分岐を混ぜると可決ロジックが複雑化し、解除時の復元も汚れる
- ❌ community ページに投票 UI と管理者即時実行 UI が同居し肥大化

### Option B: 管理者専用の新規画面・新規 RPC に分離
`/admin` 配下に新設のマージ/ジャンル管理画面を作り、community ページは凍結中全員 404。
- ✅ 責務分離が最もクリーン
- ❌ **ディスカバリーで「/community/* を管理者専用として存続」とユーザー決定済みのため不採用**（URL 変更は要件2.2 に反する）

### Option C: ハイブリッド（推奨）
- 凍結フラグ: 新規モジュール `src/lib/governance-freeze.ts`（posthog-enabled.ts パターン踏襲）
- ガード: middleware.ts と 2ページの既存ガードを in-place 拡張（凍結時 admin 限定）
- 即時実行: **新規 RPC**（例: `handle_admin_execute_merge` / `handle_admin_resolve_merge_request` / `handle_admin_resolve_genre_request`）を追加し、既存投票 RPC のマージ実行ロジックを共有関数へ抽出。既存 RPC は凍結チェック追加のみ
- 新規ジャンル直接登録: 既存 `POST /api/admin/genres` を再利用
- バッジ非表示: profile-client.tsx の条件レンダリング（in-place）
- ✅ ユーザー決定（管理者専用として存続・即時実行・可逆性）と要件を全て満たしつつ、可決ロジックの複雑化を回避
- ✅ 解除時は「フラグ OFF + RPC 復元（is_moderator_or_admin 付き）」で新規 RPC は残置可能（admin 専用機能として無害）
- ❌ マイグレーション + 新規 RPC 3種前後の追加コストが Option A より大きい

## 5. 工数・リスク評価

- **工数: M（3〜7日）** — 既存パターン（is_admin RPC ガード、admin API 認可、フラグモジュール）が全て揃っており未知の技術なし。ただし UI 2画面の改修 + マイグレーション + テスト（フラグ両状態）で範囲は広め
- **リスク: Medium** — マージ実行ロジックの抽出は既存可決フローに触れるためリグレッションリスクあり（既存テスト資産の確認が必要）。凍結フラグと DB 状態の二重管理（3.1）は設計を誤ると「UI は凍結解除済みだが RPC が拒否」等の不整合を生む

## 6. 設計フェーズへの推奨事項

- **推奨アプローチ**: Option C（ハイブリッド）
- **設計で確定すべき事項**:
  1. 凍結フラグの真実の所在（3.1 の (a) or (b)）と、アプリ側/DB 側の同期規約
  2. 凍結解除時の RPC 復元先を `is_moderator_or_admin()` チェック付きとする方針の明文化（3.2）
  3. 管理者即時実行 RPC のシグネチャと、既存投票 RPC からのマージ実行ロジック抽出方法
  4. pending 提案・申請の承認/却下 UI（既存 community ページ内タブ or セクション追加）
  5. E2E/単体テストにおけるフラグ制御方法
- **ユーザー確認推奨**: リーダーボード「スコア」タブ（reputationScore 公開ランキング）を凍結対象に含めるか（3.3）

---

# Design Discovery & Decisions（2026-07-17 設計フェーズ）

## 追加ディスカバリー（ライト版）

- `resolve_vote_weight()`: senior_moderator のみ重み2、他は1（admin ティアに特別な重みなし）→ 管理者の即時実行は投票経路の流用ではなく専用 RPC が正しいことを裏付け
- `handle_vote_genre_request` の可決分岐（L403-407）: `metadata_genres` への INSERT で完結。可決閾値はマージ（賛成率70%）と異なり80%
- `isAdminUser()`（`src/lib/middleware-auth-cookies.ts` L24-28): `moderationTier === 'admin' || role === 'admin'`。Cookie `quizetika_role=admin` はこの判定でログイン時に同期される
- `User` 型（`src/types/index.ts` L24-25): `moderationTier` に `admin` 値は含まれず `role?: string` が別軸で存在（DB 側 `is_admin()` は両軸を見る）
- マイグレーション命名: 日付ベース `YYYYMMDDHHMMSS_name.sql`、最新は `20260723...` → 新規は `20260724000000_governance_freeze.sql`
- 既存テスト資産: `tests/services/tagMerge.test.ts` / `tagMerge-thresholds.test.ts`（RPC ラッパー・閾値）、`tests/components/profile-client.test.tsx`、leaderboard 系複数 → 凍結による更新対象を design.md の Modified Files に反映済み

## 設計判断（Design Decisions）

### D1: 凍結状態の真実の所在 — アプリ側コード定数 + DB 焼き込みマイグレーション（ギャップ分析 3.1 の (a) を採用）
- **採用**: `src/lib/governance-freeze.ts` の `isGovernanceFrozen()`（コード定数を返す純粋関数）をアプリ層の唯一の参照点とし、DB 側はマイグレーションで凍結ゲートを焼き込む
- **理由**: (b) 設定テーブル案は新テーブル + RLS + シード + RPC 内参照の追加コストがかかる一方、凍結は週単位以上の運用を想定しており解除時の1マイグレーションは許容コスト。既存 BAN 系 RPC の `is_admin()` ガードパターンと完全に同型になり実装リスクが低い
- **却下**: (b) `app_settings` テーブル参照 — 解除がデータ更新のみで済む利点はあるが、Edge middleware から毎リクエスト DB を引けないためアプリ側フラグとの二重管理は結局解消せず、コスト増に見合わない
- **関数化の理由**: `jest.mock` によるフラグ両状態テストを可能にするため（bare constant の export では差し替え不能）

### D2: 凍結中は既存 RPC 4種を管理者含め無条件拒否
- 管理者が投票経路を使えると加重投票の集計で自動可決が発生しうる（5.2 違反）。管理者専用 RPC / admin API が代替経路を提供するため既存経路の管理者バイパスは不要

### D3: 凍結解除時の復元先は `is_moderator_or_admin()` ガード付き（ギャップ分析 3.2 の解決）
- 認可なし状態（現行の脆弱性）への復元は行わない。未使用のまま定義済みだった `is_moderator_or_admin()` を復元時に組み込む。復元マイグレーションの雛形定義は本スペックの実装タスクに含める

### D4: マージ/ジャンル登録実行ロジックの共有関数抽出（Generalization）
- 「投票可決による実行」と「管理者の即時実行」は同一処理の2つの起動経路 → `execute_merge()` / `register_genre()` に抽出し結果整合（3.2）を構造的に保証。凍結中は可決経路が到達不能のため、実質的な利用者は管理者 RPC のみだが、解除後の可決経路も同じ関数を使う

### D5: ジャンル新規即時登録は既存 `POST /api/admin/genres` を再利用（Build vs Adopt）
- アイコンの一時アップロード→本配置（`moveTemporaryGenreIcon`）まで実装済みの admin API が存在するため、新規 RPC は作らない。保留申請の承認/却下のみ新規 RPC（`handle_admin_resolve_genre_request`）とする

### D6: 簡素化（Simplification）
- 凍結告知ページ・専用 403 画面は作らない（非管理者は既存の `/not-found` 演出で統一）
- `/admin` 配下への画面新設はしない（ユーザー決定により `/community/*` を管理者専用として存続）
- 管理者専用 RPC は凍結解除後も残置（`is_admin()` ガード付きで無害、削除マイグレーションの往復コストを回避）

## リスクと緩和
- **実行ロジック移設のリグレッション**: `tagMerge-thresholds.test.ts` の検証観点を統合テストで踏襲。可決経路と管理者経路の結果一致を明示的に検証（design.md Integration Tests 2）
- **フラグと DB 状態の不整合**: どちらが先行しても安全側（UI 先行=画面が閉じる、DB 先行=投票が拒否される）であることを Migration Strategy に明記
