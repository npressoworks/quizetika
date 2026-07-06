# Gap Analysis - supabase-cleanup

## Summary
- **Feature**: `supabase-cleanup`
- **Discovery Scope**: Complex Integration（削除作業自体は単純だが、前提となる「全ドメイン移行完了」という事実認識にコードベースとの重大な乖離がある）
- **Key Findings**:
  - `supabase-auth-migration` と `supabase-governance` は `tasks.md` の全タスクが `[x]` 完了済みだが、`spec.json.phase` が `implementation-complete` ではなく `implementation` のままになっているドリフトがある（`supabase-foundation`/`supabase-gameplay`/`supabase-storage-migration` で過去に発生し修正済みのパターンと同種）。
  - **より重大な問題**: `spec.json.phase` が `implementation-complete` の4ドメイン（core-data, gameplay, storage-migration, および仮に governance も含め）であっても、実際のソースコードには `firebase` / `firebase-admin` パッケージへの **生きた直接依存が最低14ファイル** 残存している。「サービス層は移行済み、UIやAPI Routeが直接Firestoreを叩いている」というサービス層とUI層の乖離が主因。
  - Requirement 1（前提条件検証）が `spec.json.phase` の参照のみに依存する設計だと、上記の理由で **誤って「移行完了」と判定してしまう**。実コードのFirebase参照が真の完了シグナルであり、`phase` フィールドは信頼できる代理指標になっていない。
  - `package.json` には要件・briefで言及されていない **`firebase-tools`（devDependencies）および `firebase emulators:start` / `firebase deploy` を呼ぶ npmスクリプト（`emulators`, `deploy:rules`）** が存在し、削除対象に追加検討が必要。
  - `scripts/reset-firestore.mjs`, `scripts/seed-test-data.mjs`、および `e2e/global-setup.ts` は `firebase-admin/{app,firestore,auth,storage}` を直接使用しており、E2E・シードインフラ全体が現状 Firestore Emulator 前提で構築されている。これは Requirement 5 の対象だが、要件文面よりも実際の改修範囲はかなり広い。
  - `src/app/community/merge/page.tsx` と `src/app/community/genres/page.tsx`（ガバナンスUI）は Firestore の `onSnapshot`（リアルタイムリスナー）を直接使用しており、Supabase Realtime への置換が必要になる可能性が高い（単純な読み取りAPI化では即時反映要件を満たせない）。
  - `src/services/ai-authoring-route-helpers.ts`（AI作問の利用回数制限）が `firebase-admin/firestore` に直接依存しているが、この責務は既存のどの `supabase-*` スペック（auth-migration/core-data/gameplay/storage-migration/governance）の Scope にも明記されていない **オーファンドメイン**。
  - `firebaseUser`（`auth-context.tsx` の互換プロパティ名）や `firebaseUid`（Stripe metadata・DBカラムの命名）は実際には Supabase 移行後の値を保持する命名レガシーであり、Firebase SDK への依存ではない。Requirement 7 の網羅的 grep はこれらを誤検知しないよう、パッケージ import の有無で判定する必要がある。

## Requirement-to-Asset Map

| Req | 対応する既存アセット | ギャップ種別 | 詳細 |
|-----|----------------------|--------------|------|
| 1. 前提条件検証 | 各 `.kiro/specs/supabase-*/spec.json` の `phase` | **Constraint** | `auth-migration`・`governance` は tasks 完了済みだが `phase` が `implementation`（ドリフト）。**Missing**: `phase` だけでは不十分で、実コードの Firebase 参照ゼロ件を確認する仕組みが要る。 |
| 2. パッケージ削除 | `package.json` dependencies (`firebase`, `firebase-admin`) | Known | 想定通り存在。**Missing**: `firebase-tools`（devDependencies）と `emulators`/`deploy:rules` npm scripts が要件未記載。 |
| 3. 初期化コード・設定ファイル削除 | `src/lib/firebase/{admin,config,firestore}.ts`、`.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules` | **Missing（ブロッカー）** | 14ファイルがこれらに直接依存中（下表）。削除すると即座にビルド破壊。 |
| 4. 環境変数クリーンアップ | `.env.local.example` | Known | 想定通り。リスク低。 |
| 5. テストインフラ統一 | `tests/__mocks__/firebase/*`（5ファイル）、`playwright.config.ts` | **Missing** | `tests/__mocks__/firebase-config.ts`, `tests/__mocks__/firebase-firestore.ts`（`firebase/` ディレクトリ外の追加モック）、`e2e/global-setup.ts`（firebase-admin直接使用）、`scripts/reset-firestore.mjs`・`scripts/seed-test-data.mjs` が要件未記載。37件のテストファイルが何らかの形で firebase に言及。 |
| 6. Steering ドキュメント更新 | `tech.md`, `structure.md`, `security.md` | Known | 対象セクション特定済み（tech.md 冒頭・併存記述、structure.md の `src/lib/firebase/` 記述、security.md §7・§9）。 |
| 7. 残存参照の全数検出 | プロジェクト全体 grep | **Constraint** | 単純な文字列 `firebase` grep は `firebaseUser`/`firebaseUid` 命名レガシー（無害）を大量に誤検知する。パッケージ import 文（`from 'firebase`, `from 'firebase-admin`, `from '@/lib/firebase`）に限定した検出ロジックが必要。 |
| 8. 最終検証ゲート | `npm run build` / `npm run test` / `npm run test:e2e` | Known | Requirement 1-7 が真に完了して初めて成立。現状では即失敗する。 |
| （未マッピング） | `src/services/ai-authoring-route-helpers.ts` | **Missing（オーファン）** | AI作問利用制限機能が既存 governance/core-data スペックの Scope に含まれていない。 |

## 実コードにおける Firebase SDK 生存確認（Requirement 7 の先取り調査）

`from 'firebase` / `from 'firebase-admin` / `from '@/lib/firebase` を直接 import している `src/` 配下ファイル（`src/lib/firebase/` 自体を除く）:

| ファイル | 想定オーナードメイン | 内容 |
|---|---|---|
| `src/services/attempt.ts` | supabase-gameplay（complete） | Firestore 直接クエリ |
| `src/services/review.ts` | supabase-gameplay（complete） | Firestore 直接クエリ |
| `src/services/ai-authoring-route-helpers.ts` | 未所属（オーファン） | `firebase-admin/firestore` で利用回数管理 |
| `src/lib/seed-genres-access.ts` | supabase-governance（complete） | `getDoc` で admin 権限チェック |
| `src/app/api/user/delete-account/route.ts` | supabase-core-data（complete） | Firestore 書き込み + 「Firebase Auth削除は未実装」とコメント明記 |
| `src/app/quiz/[id]/result/quiz-result-client.tsx` | supabase-gameplay（complete） | `attempts` への `updateDoc` |
| `src/app/notifications/notifications-client.tsx` | supabase-core-data（complete） | `QueryDocumentSnapshot` 型 import（カーソル型） |
| `src/app/notifications/announcements-tab.tsx` | supabase-core-data（complete） | 同上 |
| `src/app/creator/dashboard/player-dashboard-client.tsx` | supabase-gameplay（complete） | Firestore 直接クエリ（プレイ履歴集計） |
| `src/app/leaderboard/leaderboard-client.tsx` | supabase-gameplay（complete） | Firestore 直接クエリ（ユーザーランキング） |
| `src/app/leaderboard/page.tsx` | supabase-gameplay（complete） | 同上（サーバー側） |
| `src/app/community/genres/page.tsx` | supabase-governance（complete） | `onSnapshot` リアルタイムリスナー |
| `src/app/community/merge/page.tsx` | supabase-governance（complete） | `onSnapshot` リアルタイムリスナー |
| `src/app/admin/moderation/page.tsx` | supabase-governance（complete） | Firestore 直接クエリ + `firebaseUser.getIdToken()` |

上記14ファイルはすべて「`spec.json.phase: implementation-complete`」と記録されているドメインに属する。**このスペックの Boundary Context にある「サービス層のビジネスロジック変更は Out of scope（前段スペックが完了済みの前提）」は、この調査結果と矛盾する。**

### 【2026-07-04 更新】MigrationCompletionGate 実装後の正確な再分類と差し戻し完了

Task 1（MigrationCompletionGate）の実装・実行により、import/require 文の静的検出で上記14ファイルより広い **25件の本番コードファイル**（`src/lib/firebase/*` 自体と `tests/`・`e2e/` 配下の8ファイルを除く）が検出された。全件を精査し、以下のとおり正確なオーナードメインへ再分類し、各スペックの `requirements.md`（新規要件）と `tasks.md`（新規フォローアップタスク）へ差し戻し済み。

| オーナースペック | ファイル数 | 内訳 | 差し戻し先 |
|---|---|---|---|
| `supabase-auth-migration` | 5 | `billing-client.ts`, `useAiChatAssistant.ts`, `useAiPlayState.ts`, `useAiQuizAuthoring.ts`, `quiz-play-client.tsx`（いずれも `auth.currentUser.getIdToken()` によるトークン取得のみが残存。Firestoreデータアクセスではなく Firebase Auth SDK 依存） | Requirement 5, Task 6 |
| `supabase-core-data` | 4 | `delete-account/route.ts`, `notifications-client.tsx`, `announcements-tab.tsx`, `search/weekly-top/route.ts` | Requirement 5, Task 5 |
| `supabase-gameplay` | 7 | `attempt.ts`, `review.ts`, `leaderboard-client.tsx`, `leaderboard/page.tsx`, `quiz-result-client.tsx`, `player-dashboard-client.tsx`, `genres/weekly-top/route.ts`（`attempts` 集計） | Requirement 5, Task 4 |
| `supabase-governance` | 9 | `admin/moderation/page.tsx`, `community/genres/page.tsx`, `community/merge/page.tsx`, `seed-genres-access.ts`, `genres/generate-icon/route.ts`、および元オーファンだった AI作問利用制限4ファイル（`ai-authoring-route-helpers.ts`, `ai-chat-authoring/route.ts`, `ai-generate-questions/route.ts`, `ai-generate-thumbnail/route.ts`） | Requirement 8, Task 4 |

**訂正点**:
- 当初 `supabase-gameplay`／`supabase-governance` に分類していた `quiz-play-client.tsx` 等5ファイルは、実際には Firebase Auth のトークン取得のみが残存要因であり、正しくは `supabase-auth-migration` の責務。
- `src/services/ai-authoring-route-helpers.ts` のオーファン問題は、`resolveUserEntitlements`（`entitlement.ts`）と密接に関連するため `supabase-governance` の拡張として引き受ける決定を requirements.md に記録した（Requirement 8.3）。
- `tests/`・`e2e/` 配下で検出された8ファイルの残存参照は、個別ドメインへ差し戻さず `supabase-cleanup` 自身の Task 3（テストインフラ再編）で対応する。
- `supabase-core-data` と `supabase-gameplay` は `spec.json.phase` を `implementation-complete` から `implementation` に差し戻した（新規タスクが未完了のため）。`supabase-auth-migration`／`supabase-governance` は元々 `implementation` のままだったため変更なし。

## Implementation Approach Options

### Option A: 記録どおり信頼して削除を先行実行
`spec.json.phase` の記載を正として前提条件チェックを通過させ、Requirement 3 のファイル削除を実行する。
- ✅ 最速でクリーンアップを完了できる（brief の想定通り）
- ❌ 上記14ファイルが即座にビルドエラーになる。**採用不可**（要件 Requirement 3 AC4「TypeScript の型チェックを通過する」に反する）

### Option B: 残存箇所を supabase-cleanup 自身で移行してから削除（スコープ拡張）
Boundary Context の Out of scope を見直し、発見された14ファイル + `ai-authoring-route-helpers.ts` + E2E/scriptsインフラの Firestore 依存を本スペックの Scope に取り込み、削除の前段として実施する。
- ✅ 単一スペックで完結し、他スペックの手戻り待ちが不要
- ✅ `onSnapshot`→Supabase Realtime のような横断的な置換パターンを一箇所で確立できる
- ❌ 本来「クリーンアップ（削除・整理）」であるはずのスペックにビジネスロジック移行が混入し、責務が肥大化する
- ❌ `community/merge`・`community/genres` の Realtime 移行は governance ドメインの設計判断（RPC・RLS）に依存し、cleanup スペックの権限外の意思決定が必要になる

### Option C: 是正タスクを前段スペックへ差し戻し、cleanup はゲート＋最終整理のみに専念（Hybrid）
1. まず `supabase-auth-migration` と `supabase-governance` の `spec.json.phase` ドリフトを修正（tasks.md 完了済みのため機械的に直せる）。
2. 発見された14ファイルの Firestore 直接依存を、本来のオーナースペック（`supabase-gameplay`・`supabase-core-data`・`supabase-governance`）への **追加タスク（フォローアップ）** として差し戻す。`ai-authoring-route-helpers.ts` は新規の軽量スペックまたは `supabase-governance` 拡張のどちらに含めるか要意思決定。
3. `supabase-cleanup` は要件通り「全ドメインの実コード上のFirebase参照ゼロ」を確認した後にのみ削除・Steering更新・最終検証ゲートを実行する、純粋な最終工程に留める。
- ✅ 各スペックの責務境界（Boundary Strategy）を壊さない。ロードマップの Phase 35 設計思想（ドメイン別垂直移行）と整合
- ✅ `supabase-cleanup` の要件（Requirement 1-8）はそのまま使える。Requirement 1 の前提条件検証ロジックを「`phase` 確認 + 実コード grep 確認」の二段階に強化するだけでよい
- ❌ 前段4スペックへの後戻り作業が発生し、`supabase-cleanup` 単体の着手が当面ブロックされる
- ❌ 差し戻し範囲の合意形成（どのファイルをどのスペックが引き取るか）に追加の調整コストがかかる

## Effort & Risk

| 対象 | Effort | Risk | 根拠 |
|---|---|---|---|
| Requirement 1（前提条件検証ロジックの強化） | S | Low | 既存 grep + spec.json 読み取りの組み合わせで実現可能 |
| Requirement 2（パッケージ削除、`firebase-tools`含む） | S | Low | 依存が解消済みなら機械的な `npm uninstall` |
| Requirement 3（初期化コード・設定削除） | S（ただし全てのブロッカー解消後） | **High**（現状） | 14ファイルの生存依存が解消されるまで着手不可。解消後の削除自体は低リスク |
| Requirement 5（テストインフラ統一） | M〜L | Medium〜High | `e2e/global-setup.ts` と `playwright.config.ts` の Emulator 前提を Supabase ローカルに置き換える設計が必要。37件のテストファイルへの波及確認が必要 |
| Requirement 6（Steering更新） | S | Low | 対象箇所は特定済み。Phase 1-34履歴保持の注意のみ |
| フォローアップ: 14ファイルのFirestore直接依存解消（他スペック帰属） | L〜XL（cleanup外） | High | `onSnapshot`→Realtime 移行はアーキテクチャ判断を要する。gameplay/core-data/governance の設計変更を伴う |
| フォローアップ: `ai-authoring-route-helpers.ts` のオーファン解消 | S〜M（cleanup外） | Medium | 帰属スペック未定。範囲自体は小さい |

## Recommendations for Design Phase

- **推奨アプローチ**: Option C（Hybrid / 差し戻し）。`supabase-cleanup` の設計では、Requirement 1 の前提条件検証を「`spec.json.phase` 確認」だけでなく「対象ドメインの所有ファイルに `firebase`/`firebase-admin`/`@/lib/firebase` の直接 import が存在しないことを機械的に grep 確認する」二段階ゲートとして設計することを強く推奨する。
- **Key Decisions（設計フェーズで確定すべき事項）**:
  1. `supabase-auth-migration` / `supabase-governance` の `spec.json.phase` ドリフト修正を誰が・いつ実施するか（cleanup着手前の前提整備タスクとして本スペックの design.md に明記するか、各スペック側で個別対応するか）。
  2. 発見された14ファイルの是正を「`supabase-cleanup` の前提ブロッカー」としてどのスペックに差し戻すか（gameplay: attempt.ts/review.ts/leaderboard系/quiz-result-client.tsx/player-dashboard-client.tsx、core-data: notifications系/delete-account route、governance: community系ページ/seed-genres-access.ts/admin/moderation）。
  3. `ai-authoring-route-helpers.ts` の帰属スペックの決定（新規スペック起票 or 既存スペック拡張）。
  4. `community/genres`・`community/merge` の `onSnapshot` リアルタイム要件を Supabase でどう再現するか（Supabase Realtime channels、またはポーリング/手動リフレッシュへの要件緩和）。
- **Research Needed（設計フェーズへ持ち越し）**:
  - Supabase Realtime（Postgres Changes）を使った `onSnapshot` 代替パターンの技術検証。
  - `e2e/global-setup.ts` を Supabase CLI（`supabase start` + seed SQL）ベースに置き換える具体的な移行手順。
  - `firebase-tools`／`firebase emulators:start` に依存する `npm run emulators` / `deploy:rules` / `*:emulator` 系スクリプト群の廃止または Supabase 相当コマンドへの置換方針。
  - `scripts/reset-firestore.mjs` / `scripts/seed-test-data.mjs` / `scripts/migrate-*.mjs` の要否判定（Supabase版シードスクリプトへの置換 or 廃止）。

## Risks & Mitigations
- **リスク**: `spec.json.phase` を信頼して削除を実行し、本番ビルドが破壊される — **軽減策**: Requirement 1 に実コード grep ゲートを追加し、CI/レビューで二重確認する。
- **リスク**: 14ファイルの是正が複数スペックに分散し、責任の空白地帯が発生する — **軽減策**: design.md でファイル単位の帰属表を明記し、各オーナースペックの tasks.md にフォローアップタスクとして追記する。
- **リスク**: `onSnapshot` のリアルタイム性要件が Supabase 移行で失われ、UX 低下を招く — **軽減策**: design フェーズで Supabase Realtime の技術検証を先行し、要件で許容されるレイテンシを明確化する。

## Design Decisions（設計フェーズ）

### Decision: Requirement 1 / 7 を単一の「MigrationCompletionGate」ツールに統合
- **Context**: 前提条件検証（Req 1）と残存参照の全数検出（Req 7）は、どちらも「spec.json の宣言」と「実コードの実態」を突き合わせる同種の検証ロジックであり、別々に実装すると重複が生じる。
- **Alternatives Considered**:
  1. Req 1 は spec.json 読み取りのみの軽量チェック、Req 7 は別途 grep スクリプトとして独立実装 — ロジック重複・二重メンテナンスの懸念。
  2. CI パイプライン専用のワークフロー定義（GitHub Actions等）としてのみ実装 — ローカル実行や再検証（削除後の最終ゲート）に使えず、要件 7.2 の「修正または削除するまで完了と判定しない」という繰り返し確認の運用に不向き。
- **Selected Approach**: `scripts/verify-firebase-removed.mjs` という単一の Node スクリプトとして実装し、(A) `.kiro/specs/supabase-*/spec.json` の `phase` 確認と、(B) `src/`/`tests/`/`e2e/` に対する import 文ベースの Firebase 参照検出の両方を担う。削除作業の**前**（Req 1 の前提条件ゲートとして）と削除作業の**後**（Req 7 の残存確認・Req 8 の最終ゲートの一部として）の両方で同一スクリプトを再実行する。
- **Rationale**: 単一の真実源（Single Source of Truth）とすることで、判定ロジックの重複・乖離を防ぐ。既存の `scripts/*.mjs`（Node ESM、フラグ引数方式）の規約に合致する。
- **Trade-offs**: スクリプトの責務がやや広くなるが、対象が「Firebase残存検出」という単一目的に閉じているため許容範囲。
- **Follow-up**: 誤検知防止のため、文字列一致ではなく import/require 文の specifier（`firebase`, `firebase-admin`, `firebase-admin/*`, `firebase/*`, および `@/lib/firebase` 配下解決）のみを検出対象とし、`firebaseUser`/`firebaseUid` のような識別子名の一致は対象外とする（Summary 節の誤検知知見を反映）。

### Decision: Firestore専用の開発スクリプト（`scripts/seed-test-data.mjs` 等）は移植せず廃止する
- **Context**: `scripts/seed-test-data.mjs`・`scripts/reset-firestore.mjs`・`scripts/migrate-delete-quizlists.mjs`・`scripts/migrate-quiz-visibility-public.mjs` はいずれも `firebase-admin` に直接依存する Firestore 専用ツールで、対応する `package.json` スクリプト（`seed:test-data*`, `db:reset*`）も同様。
- **Alternatives Considered**:
  1. Supabase (PostgreSQL) 向けに同等のロジックを再実装する — Firestore は完全に廃止されるため恒久的な移植コストに見合わない。
  2. 現状維持（未使用コードとして放置） — brief の「クリーンな状態にする」目的に反し、Requirement 7 の残存参照検出で継続的にノイズとなる。
- **Selected Approach**: 上記4スクリプトと対応する npm scripts（`seed:test-data`, `seed:test-data:emulator`, `db:reset`, `db:reset:emulator`, `db:reset-and-seed`, `db:reset-and-seed:emulator`, `emulators`, `deploy:rules`）を削除する。Supabase 側は既に `supabase/seed.sql` と `supabase db reset`（Supabase CLI 標準機能）が同等の役割を担っており、新規実装は不要（Build vs Adopt: 既存ソリューションを採用）。
- **Rationale**: Firestore が存在しなくなる以上、Firestore専用スクリプトは実行不能な死んだコードになる。Supabase CLI の標準機能で代替可能なため独自実装を持つ必要がない。
- **Trade-offs**: なし（純粋な削除）。README／オンボーディング手順があれば `supabase db reset` の案内に更新する必要がある（Requirement 6 のドキュメント更新に含める）。

### Decision: テストの Firebase モック除去は jest.config.js の `moduleNameMapper` 削除が起点
- **Context**: `jest.config.js` の `moduleNameMapper` が `firebase/*`・`@/lib/firebase/config`・`@/lib/firebase/firestore` へのあらゆる import をグローバルに自動モックしており、37件のテストファイルが「firebase」に言及する主因はこのグローバル置換の恩恵を受けているためであり、大半のテストファイル自体が直接 Firebase をモックしているわけではない。
- **Selected Approach**: `moduleNameMapper` から Firebase 関連の3エントリを削除し、`tests/__mocks__/firebase/`・`tests/__mocks__/firebase-config.ts`・`tests/__mocks__/firebase-firestore.ts` を削除する。Supabase 側は既存の `jest.mock('@/lib/supabase/client')` チェーンモックパターン（`tech.md` に記載済み、複数テストで採用済み）をそのまま踏襲し、新規共有モック基盤は作らない（Build vs Adopt）。
- **Rationale**: 既存パターンの流用により新規抽象化を避ける（Simplification）。
- **Constraint**: この削除は、`moduleNameMapper` に依存しているテスト対象コード（＝ Out of Boundary の14ファイル）が実際に Firebase import を持たなくなって初めて安全に実行できる。`MigrationCompletionGate` のスキャン範囲に `jest.config.js` 自体は含めないが、Stage B のスキャン結果がゼロになった時点でこの削除も安全になるという依存関係がある。

### Generalization
- Req 1（前提条件検証）と Req 7（残存検出）は「宣言された完了状態」と「コード上の実態」を突き合わせる、より一般的な「移行完了検証」という単一の能力の特殊ケースである。`MigrationCompletionGate` はこの一般化された能力として設計し、実装スコープは現行要件（このスペックの削除ゲート）に限定する。

## Phase 36 Discovery: 残存識別子命名の是正（Light Discovery）

### Summary
- **Feature Type**: Extension（実装完了済みスペックへの追加要件）
- **Discovery Scope**: 上記 Summary（14行目）で「無害な命名レガシー」として MigrationCompletionGate の誤検知除外対象にした `firebaseUser`/`firebaseUid` そのものを、今度は是正対象として棚卸しする。パッケージ依存ではなく識別子名のみの変更のため、コードベース調査（Grep）のみで十分であり、外部リサーチは不要。

### 対象ファイルの棚卸し（Grep確認済み）

**`firebaseUser`（AuthContext の互換プロパティ名）**:
| ファイル | 用途 |
|---|---|
| `src/context/auth-context.tsx` | `AuthContextType.firebaseUser` の定義・`useState`・Provider value |
| `src/app/admin/users/page.tsx` | `firebaseUser.getIdToken()` によるAPI認可トークン取得 |
| `src/app/admin/moderation/page.tsx` | 同上 |
| `src/app/admin/genres/admin-genres-client.tsx` | 同上 |
| `src/components/explore/quiz-carousel.tsx` | `firebaseUser?.uid` の参照のみ |
| `src/app/community/genres/page.tsx` | `firebaseUser.getIdToken()` / `firebaseUser.uid` |
| `src/app/search/search-client.tsx` | `firebaseUser?.uid` の参照のみ |

**`firebaseUid`（エンタイトルメント/サブスクリプション/Stripe Webhookのフィールド・変数名、および Stripe Customer メタデータキー）**:
| ファイル | 用途 |
|---|---|
| `src/types/subscription.ts` | `StripeSubscriptionSnapshot.firebaseUid` フィールド |
| `src/services/entitlement.ts` | `applySubscriptionFromStripe`/`clearPaidEntitlements` の引数・`.eq('id', snapshot.firebaseUid)` |
| `src/services/subscription.ts` | `stripe.customers.create({ metadata: { firebaseUid: uid } })`（Stripe API へ書き込まれる実データのキー名） |
| `src/services/stripe-webhook.ts` | `resolveFirebaseUidFromSubscription`、`subscription.metadata?.firebaseUid`、`customer.metadata?.firebaseUid`、複数のローカル変数・引数名 |

### 除外確認
- `src/components/quiz/quiz-editor.tsx:82` の `CANONICAL_TAGS` 配列中 `'Firebase'` はユーザーがクイズに付与する技術タグの値であり、識別子ではないため対象外。
- `src/services/attempt-server.ts`、`src/services/notification.ts`、`src/middleware.ts`、`src/lib/middleware-auth-cookies.ts` 等のコメント中の「Firebase」への言及は、識別子リネームの対象ではなく、旧Storageデータの文脈（`storage.ts`/`storage-path.ts`）は隣接スペック `supabase-storage-legacy-migration` の責務のため対象外。

### Key Decision: Stripe Customer メタデータキーは新旧デュアルリードで移行する
- **Context**: `firebaseUid` はコード内部の変数名・型フィールド名であるだけでなく、`stripe.customers.create({ metadata: { firebaseUid: uid } })` として **Stripe 側に実データとして書き込まれているキー名**でもある。既に本番稼働中の Stripe Customer オブジェクトには過去に作成された `metadata.firebaseUid` が存在し、Stripe 側のデータを本スペックが一括更新することはできない（Stripe Update Customer API を全顧客に対して呼ぶ運用コストとリスクを要件が求めていない）。
- **Alternatives Considered**:
  1. 内部コードのみリネームし、Stripe に書き込むキー名は `firebaseUid` のまま維持する — 識別子命名の是正という目的を部分的にしか達成できず、Requirement 9 の趣旨（Firebase を含まない命名への是正）に反する。
  2. 新規 Stripe Customer 作成時のキーを新名称（`userId`）に切り替え、読み取り時は新キー優先・旧キー（`firebaseUid`）フォールバックのデュアルリードにする — 新規作成分は是正され、既存データとの互換性も保たれる。
  3. 既存 Stripe Customer 全件をバッチ処理で `metadata.userId` に書き換えた上でコードも新キーのみに統一する — Stripe API のレートリミットと対象件数次第でコスト増、本スペックの Boundary（Out of scope: 外部データの物理移行）と矛盾する。
- **Selected Approach**: Alternative 2（デュアルリード）。新規作成 Stripe Customer には `metadata: { userId: uid }` を書き込み、読み取り時（`resolveUidFromSubscription`/`resolveUidFromCustomer`）は `metadata.userId` を優先し、存在しない場合のみ `metadata.firebaseUid` にフォールバックする。
- **Rationale**: 挙動を変えずに（Requirement 9.3）既存データとの後方互換を保ちながら（Requirement 9.4）、コード側の命名は是正できる。将来的に全既存顧客のバックフィルが完了すればフォールバック分岐を除去できる（Revalidation Trigger として design.md に記録）。
- **Trade-offs**: 読み取りロジックに1分岐が増えるが、既存の `??` 演算子で表現可能な軽量な変更に留まる。

### Naming Decisions
- `AuthContext.firebaseUser` → `authUser`（`user` = DBプロフィール、`authUser` = 認証セッション由来の互換オブジェクト、という対比が明確になる）
- `StripeSubscriptionSnapshot.firebaseUid` および各サービス関数の同名パラメータ → `uid`（`subscription.ts` の `CreateCheckoutSessionInput.uid` 等、既存コードで既に確立されている命名規則と統一）
- `resolveFirebaseUidFromSubscription` → `resolveUidFromSubscription`
- Stripe Customer メタデータの書き込みキー → `userId`（読み取りは `userId` 優先 → `firebaseUid` フォールバック）
