# Research & Design Decisions: quizetika-admin-users-ui

## Summary
- **Feature**: quizetika-admin-users-ui
- **Discovery Scope**: Extension & Complex Integration
- **Key Findings**:
  - 管理者専用の `/admin/users` 画面から、特定のUIDを指定してユーザーの信頼スコアとティアーを手動でリセット、およびアカウントの停止（BAN/UNBAN）を行う仕組み。
  - 監査ログとして `adminLogs` コレクションを新設し、実行者・対象者・アクションタイプ（`reset`, `ban`, `unban`）・理由・日時を記録。
  - BANされたユーザーのアクセスを即時かつ多重防衛で遮断するため、Firestore Security Rules、フロントエンド `AuthContext` での監視による強制ログアウト、Next.js ミドルウェアによる `/banned` 画面への強制リダイレクトを組み合わせる。
  - BANされたユーザーが過去に作成したクイズやデータは物理削除や非公開化せず、そのまま残す仕様とする。

## Research Log

### 1. 管理者アクションの監査ログ (adminLogs) の永続化設計
- **Context**: 管理者の緊急手動リセットやBAN/UNBANが実行されたことを後から追跡可能にする必要性。
- **Sources Consulted**: Firebase Firestore Documentation (Transactions, Subcollections)
- **Findings**:
  - `adminLogs` をトップレベルコレクションとして新設し、各アクションログをフラットに格納するのが集計・監査上最も適している。
  - Security Rules により、クライアントからの書き込み（`create/update/delete`）を完全に `false` に制限し、サーバーサイド（Firebase Admin SDK）からの特権書き込みのみを受け入れる設計にする。
- **Implications**: 
  - `AdminLog` のデータモデル型を `types/index.ts` に追加。
  - `firestore.rules` で `adminLogs` へのクライアント直接書き込みを遮断。

### 2. サーバーサイド認可ガードと多重防衛
- **Context**: クライアントサイドでのモックトークン改ざんや管理者ロールの偽装による特権昇格の防止。
- **Sources Consulted**: Next.js API Routes Middleware, Firebase Admin Authentication
- **Findings**:
  - クライアント側で `moderationTier` や `role` をチェックするだけでなく、Next.js API Route Handler（`/api/admin/users/reset` / `/api/admin/users/ban` など）で Firebase Auth ID Token の JWT を検証し、その UID を用いて Firestore（`users/{uid}`）から最新の権限を再度取得し判定（多重防衛）する必要がある。
- **Implications**: 各管理者用APIエンドポイント内での JWT トークン検証と、実行者である管理者の最新情報の引き直しを必須要件とする。

### 3. BANユーザーの即時アクセス遮断とセキュリティルールの設計
- **Context**: BANされたユーザーが有効なJWTトークンを持っている期間（最大1時間）に、APIやFirestoreに対して不正な書き込みを行うことを完全に防止する。
- **Sources Consulted**: Firebase Security Rules Client Checking, Next.js Middleware Cookie Synchronization
- **Findings**:
  - **Firestoreセキュリティルールによるデータ保護**: ほぼすべての書き込みルールに `get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isBanned != true` のチェックを導入することで、トークンが有効であってもFirestoreへの新規書き込み・更新を即座にブロックできる。
  - **フロントエンドとミドルウェアの連携**: `AuthContext` における `onAuthStateChanged` や `refreshUser` で取得したユーザー情報で `isBanned === true` を検知した際、直ちに `auth.signOut()` を実行し、クッキーの `quizetika_banned` を `true` に同期する。`middleware.ts` では `quizetika_banned === 'true'` の場合にアクセスを `/banned` に強制リダイレクトする。
- **Implications**:
  - `firestore.rules` の共通ヘルパー関数 `isNotBanned()` を追加し、各リソースルールに適用。
  - `auth-context.tsx` および `middleware-auth-cookies.ts` のCookie同期ロジックに `isBanned` 対応を追加。

## Architecture Pattern Evaluation

| Option                   | Description                                                                                | Strengths                                                                      | Risks / Limitations                     | Notes                                     |
| ------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------- |
| API Route + Core Service | UIがNext.js API Routeを呼び出し、内部で `ReputationService` のトランザクションをキックする | セキュリティがサーバー境界で完全に保護され、フロントエンドとの疎結合が保たれる | API Routeのボイラープレートコードが必要 | プロジェクトの既存のAPI/Service構成と一致 |

## Design Decisions

### Decision: adminLogs コレクションのクライアント書込遮断
- **Context**: 監査ログの改ざんを防ぐ。
- **Selected Approach**: `firestore.rules` 上で `adminLogs` に対する `create/update/delete` を完全に `if false` とし、サーバーサイド API から特権 Admin SDK を用いて書き込みを行う。
- **Rationale**: 監査ログはセキュリティ上、フロントエンドクライアントから一切書き換えられてはならないため。
- **Trade-offs**: テスト時もクライアントSDKから直接ダミーログを作れないが、モックサービスまたはAdmin SDKテストコードで検証可能。

### Decision: BAN検知時の即時ログアウトと /banned 画面へのリダイレクト
- **Context**: BANされたユーザーにアカウント停止状態であることを明確に伝え、それ以上の操作を不可能にする。
- **Selected Approach**: `AuthContext` 内で `dbUser.isBanned === true` を検知した際、直ちに `signOut` を行い、セッションCookie `quizetika_banned: "true"` をセットした上で `/banned` 画面へルーティングする。
- **Rationale**: クライアント側で安全にログアウトさせ、ミドルウェアが検知して保護することで、他のいかなる画面への遷移も遮断するため。
- **Trade-offs**: `/banned` 画面自体は未認証状態でも閲覧可能にする必要があるため、ミドルウェアの matcher から `/banned` を除外し、非BANユーザーが直接アクセスした場合は `/` へリダイレクトするガードを `/banned/page.tsx` 内に実装する。

## Risks & Mitigations
- 管理者権限の偽装による不正アクション — Next.js API Route Handlerで管理者トークンを再検証し、Firestoreから最新の権限を引き直すことで偽装を遮断。
- 存在しないUIDの処理試行 — `users/{targetUid}` の存在チェックをトランザクション内で行い、見つからない場合はエラーをスローしてロールバックする。
- トークン有効期間中のBANユーザーの書き込み試行 — `firestore.rules` のセキュリティルールに `isNotBanned()` チェックを適用し、APIおよびFirestoreのデータストアレベルで書き込み・変更を完全遮断。

## References
- [Firestore Security Rules](https://firebase.google.com/docs/rules) — 監査ログおよびBANユーザーのデータ書き込み保護方針
- [Firebase Admin JWT Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens) — IDトークンの認証

---

> **注記**: 上記セクションは Firebase 時代（移行前）の初期設計調査であり、現在はプロジェクト全体が `supabase-cleanup` の完了をもって Supabase（PostgreSQL + RLS + RPC）に一本化されている（`.kiro/steering/tech.md` 参照）。Firestore Security Rules / Admin SDK に関する記述は歴史的経緯として残すが、以降の実装は下記の Supabase ベースの Gap Analysis を参照すること。

## Gap Analysis: quizeum-admin-users-ui（BAN機能見直し・Supabase基盤）

### 1. 現状調査 (Current State)

#### 既存アセット

- **画面**: `src/app/admin/users/page.tsx` — UID単発検索型のクライアントコンポーネント。検索→表示→アクション（リセット/BAN/UNBAN）の単一フォームパターン。
- **サービス層**: `src/services/reputation.ts` — `resetUserReputation` / `banUser` / `unbanUser`。いずれも Supabase RPC（`handle_reset_user_reputation` / `handle_ban_user` / `handle_unban_user`、`SECURITY DEFINER`）を呼ぶ薄いラッパー。
- **モデレーション**: `src/services/moderation.ts` — `flagContent`（クイズ通報、RPC `handle_flag_content`）/ `resolveFlag`（RPC `handle_resolve_flag`）。クイズ単位の通報のみ。
- **API Routes**: `src/app/api/admin/users/{ban,unban,reset}/route.ts` — Bearerトークン検証 → サービス呼び出しの薄いハンドラ。新規アクション（通報送信・ティア引き下げ）も同パターンで追加可能。
- **DBスキーマ（`database.types.ts`より）**:
  - `users` テーブルに `is_banned`, `banned_reason`, `banned_at`, `moderation_tier`, `reputation_score` が**既に存在**（Requirement 11のBAN日時フィルタは新規カラム不要）。
  - `quizzes` テーブルに `flags_count`（クイズ単位の通報累計数、`status` が `suspended` になる閾値5と連動）が存在。
  - `admin_logs` テーブル: `action`（enum: `admin_log_action_enum` = `'reputation_reset' | 'ban' | 'unban'` の3値のみ）, `executor_id`, `target_uid`, `reason`, `created_at`。
  - `moderation_tier_enum` は既存（`newcomer/contributor/moderator/senior_moderator`、`admin` は `role` 列側で判定）。
  - **ユーザー本人への直接通報を保存するテーブルは存在しない**（`user_reports` 相当のテーブルなし）。
- **一覧・フィルタUIの参考実装**: `src/app/creator/quizzes/creator-quiz-management-client.tsx` / `creator-quiz-management-sections.tsx` に、`keyword` + `status` + `sortBy/sortOrder` を持つ `filters` ステートパターンと、クイズごとの通報件数を `Record<quizId, number>` で表示するUIが既に存在。Requirement 9/11 のフィルタ・ランキングUIの直接参考になる。
- **認可パターン**: `is_admin()` / `is_moderator_or_admin()` PL/pgSQL関数がRLS/RPC双方で再利用されている（`governance_normalization.sql`）。新規RPCもこのパターンに乗せられる。
- **RPCパターン**: 全ての特権操作は `SECURITY DEFINER` のPL/pgSQL関数（`handle_xxx`）に集約され、クライアントからの直接テーブル書き込みは拒否される設計。新規アクション（通報送信・ティア引き下げ）もこの規約に従う必要がある。

#### 命名・アーキテクチャ規約

- サービス層は `src/services/*.ts`（kebab-case、単一責任）、API Routeは `src/app/api/admin/users/{action}/route.ts` の1アクション1ルート方式。
- 二重防御（フロントは UX 用、実際の認可は RLS + RPC 側）を徹底する方針（`tech.md`）。

### 2. 要件の実現可能性分析 (Requirements Feasibility)

| Requirement | 必要な技術要素 | ギャップ状態 |
| --- | --- | --- |
| 8. ユーザー直接通報 | 新規テーブル（通報者・対象・理由・重複防止用ユニーク制約）、新規RPC（`handle_report_user`）、新規APIルート、新規UIエントリポイント（プロフィール画面への通報ボタン） | **Missing**: テーブル・RPC・UI導線すべて新規 |
| 9. 通報数上位ユーザー一覧 | クイズ`flags_count`の著者別合計 + Requirement 8の直接通報数、を合算する集計クエリ（RPCまたはビュー）、ページネーション | **Missing**: 集計クエリ・一覧UI・ページネーションは新規。**Unknown**: 合算をDBビュー/RPCで行うかクライアント側で2クエリ合成するかは設計判断が必要 |
| 10. ティア段階的引き下げ | 新規RPC（`handle_downgrade_tier`、下位ティアのみ許可するバリデーション）、`admin_log_action_enum` へ新規値追加（例: `'tier_downgrade'`）、UI側のティア選択ドロップダウン | **Missing**: RPC・enum拡張・UI。**Constraint**: enum値追加はマイグレーションが必要（`ALTER TYPE ... ADD VALUE` は同一トランザクション内で直後に使えない制約があるため、追加とデータ投入は別マイグレーションに分離するか、`admin_logs.action` をtext運用に緩和するか設計判断が必要） |
| 11. BAN済み一覧・日時フィルタ・検索・解除 | `users.is_banned/banned_at` を条件にした一覧取得クエリ（期間・キーワード）、既存`unbanUser`の再利用 | **Constraint（軽微）**: カラムは既存、新規テーブル不要。一覧取得用のサービス関数（例: `getBannedUsers(filters)`）と対応するRLS SELECTポリシー（管理者のみ全ユーザーのBAN情報を横断参照できるか）の確認が必要 |

#### 共通の未知事項（Research Needed）

- **RLS横断SELECTポリシー**: 現行の `/admin/users` はUID指定の単発 `getUserProfile` のみで、全ユーザーを横断的にSELECTするクエリ（ランキングやBAN一覧）に対応するRLSポリシーが `users` テーブルに存在するか未確認。管理者ロールによる全件SELECTを許可するポリシーの追加が必要な可能性が高い。
- **通報数集計の実装場所**: DBビュー/マテリアライズドビューで事前集計するか、RPCでオンデマンド集計するか、クライアント側で2クエリ合成するかは設計フェーズで比較検討が必要。ユーザー数・クイズ数の規模次第でパフォーマンス特性が異なる。
- **`admin_log_action_enum` 拡張方法**: Postgres の enum 追加制約（トランザクション分離）を踏まえた安全なマイグレーション手順の確定が必要。

### 3. 実装アプローチの選択肢

#### Option A: 既存コンポーネントの拡張

`page.tsx` を単一検索フォームから、タブ切り替え（UID検索／通報ランキング／BAN一覧）を持つ複合画面に拡張し、`reputation.ts` / `moderation.ts` に関数を追加していく。

- ✅ 既存の認可ガード・レイアウト・ConfirmActionDialogパターンをそのまま再利用できる
- ✅ 画面遷移が発生せず、既存のE2Eテスト（`/admin/users`系）の骨格を維持しやすい
- ❌ `page.tsx` が単一ファイルで肥大化しやすい（現状543行、タブ追加で相応に増加）
- ❌ 通報ランキング・BAN一覧・詳細操作が同一画面内に混在し、状態管理が複雑化する

#### Option B: 新規コンポーネント分割

`page.tsx` はタブの器のみとし、`AdminUserSearchPanel` / `AdminReportedUsersPanel` / `AdminBannedUsersPanel` のようにセクション単位でコンポーネントを分割する（`creator-quiz-management-sections.tsx` に近い構成）。

- ✅ 各パネルが単一責任を持ち、テスト・保守が容易
- ✅ `creator-quiz-management-*` と同型の filters ステートパターンを踏襲でき、実装コストが読みやすい
- ❌ ファイル数が増え、パネル間で選択ユーザーの状態（例: ランキングから検索結果へジャンプ）をどう受け渡すか設計が必要

#### Option C: ハイブリッド

検索パネルは既存 `page.tsx` のロジックをそのまま流用しつつ、通報ランキング・BAN一覧は新規セクションコンポーネントとして切り出す。Requirement 9.7（ランキングから詳細操作を展開）は、新規パネルから既存の検索結果表示エリアの状態（`searchedUser`）を呼び出す形で連携する。

- ✅ Option A/Bの折衷で、既存コードの再利用と新規機能の分離のバランスが取れる
- ✅ 段階的な実装が可能（まずBAN一覧、次に通報ランキング、のように分割リリースしやすい）
- ❌ パネル間の状態受け渡し設計（Reactの状態リフトアップ or カスタムフック化）が必要になる

**Gap Analysisとしての情報提供に留め、最終選択は設計フェーズで判断する。**

### 4. 複雑度とリスク

| 領域 | Effort | Risk | 根拠 |
| --- | --- | --- | --- |
| Requirement 8（直接通報） | M（3–7日） | Medium | 新規テーブル・RPC・UI導線が必要だが、`flagContent`と同型のパターンを踏襲できるため未知技術はない |
| Requirement 9（通報ランキング） | M（3–7日） | Medium | 集計クエリの設計（ビュー/RPC/クライアント合成）が未確定で、パフォーマンス検証が必要 |
| Requirement 10（ティア引き下げ） | S–M（2–5日） | Low–Medium | 既存`handle_reset_user_reputation`とほぼ同型のRPCで実装可能。enum拡張の手順のみ要注意 |
| Requirement 11（BAN一覧・フィルタ） | S（2–4日） | Low | 必要なカラムはすべて既存。RLSポリシーの確認・一覧取得関数の追加のみ |

### 5. 設計フェーズへの推奨事項

- **推奨アプローチ**: Option C（ハイブリッド）。既存の検索・アクションロジックを壊さずに、新規一覧系機能をパネル単位で追加する。
- **設計フェーズで確定すべき事項**:
  1. 通報数集計（クイズ通報合算＋直接通報）をDBビュー/RPC/クライアント合成のどれで行うか
  2. `users` テーブルへの管理者向け横断SELECTを許可するRLSポリシーの要否と設計
  3. `admin_log_action_enum` への `tier_downgrade`（および必要であれば `user_report`）追加の安全なマイグレーション手順
  4. 直接通報テーブルのスキーマ（重複防止のユニーク制約キー: `reporter_id + target_uid + status='open'` 想定）
  5. ランキング一覧からの行選択→詳細操作展開（Requirement 9.7）の状態設計（パネル間の状態リフトアップ or Context）

---

## Design Discovery（Light）追加調査 — 2026-07-12

### 6. RLSポリシーの実地確認（重要な発見）

`supabase/migrations/20260702000000_init.sql` を確認した結果、以下が判明した。

- **`users_read` ポリシーは `USING (TRUE)`** — 既に全ユーザーが `users` テーブルの全行を横断SELECT可能。Requirement 11（BAN一覧・検索・日時フィルタ）は新規RLSポリィシー不要で、クライアントから直接 `is_banned = true` 条件のクエリを投げられる。
- **`quizzes_read` ポリシーは `status = 'published' AND visibility = 'public' OR author_id = auth.uid() OR followers`** に限定されており、`suspended` ステータスや非公開クイズは第三者（管理者含む）から通常のクライアントSELECTでは見えない。
  - 実際、既存の `/admin/moderation` 画面 (`src/app/admin/moderation/page.tsx`) は `.from('quizzes').eq('status','suspended')` を**クライアントから直接**クエリしているが、`quizzes_read` ポリシーに `is_admin()` 例外がないため、このクエリは RLS 上は非公開/停止中クイズを返さない可能性が高い（既存機能の潜在バグ。本specのスコープ外だが、Requirement 9 の設計に直接影響するため記録する）。
  - 結論: Requirement 9（通報数ランキング）で `quizzes.flags_count` を著者別に合算するには、RLSをすり抜けられる `SECURITY DEFINER` の集計RPCが必須（既存の `handle_ban_user` 等と同じパターン）。クライアント直接クエリでは対応できない。

### 7. 設計判断（Design Decisions）

- **Decision: 通報数集計は `SECURITY DEFINER` RPC (`get_reported_users_ranking`) で行う**
  - Context: `quizzes_read` RLSが `suspended`/非公開クイズを一般クエリから隠すため、クライアント側の2クエリ合成では通報数を正しく合算できない。
  - Rationale: 既存の全ての特権操作（BAN/UNBAN/リセット/通報解決）が `SECURITY DEFINER` RPCに集約されている規約と一致させ、RLSを個別に緩めるより安全。
  - Trade-offs: RPC内でページネーション・ソートを実装する必要があり、クライアント側の単純なSupabaseクエリビルダーは使えない。
- **Decision（タスク生成時に訂正）: BAN一覧も`SECURITY DEFINER` RPC (`get_banned_users`) で実装する**
  - 当初は `users_read` が `USING (TRUE)` であることから「クライアント直接クエリで十分」と判断していたが、`admin_logs` テーブルが `admin_logs_policy ON admin_logs FOR ALL USING (FALSE)` によりSELECTも含め完全に遮断されていることをタスク生成時のコード確認で発見した。Requirement 11.3（実行した管理者の表示）を満たすには `users` と `admin_logs` のJOINが必須であり、`admin_logs` 側がクライアントから一切参照できない以上、クライアント直接クエリでは実現不可能。
  - Rationale: `get_reported_users_ranking` と同じ `SECURITY DEFINER` RPCパターンに統一し、サーバーサイドで `users`/`admin_logs` をJOINして返す。
- **Decision: ユーザー直接通報（`user_reports`）はテーブルへの直接クライアントSELECT/INSERTを禁止し、`SECURITY DEFINER` RPC (`handle_report_user`) 経由のみで書き込む**
  - Rationale: `admin_logs`・既存の通報系テーブルと同じ「クライアント直接書込禁止、RPC経由のみ」の規約に合わせる（Generalization: 既存の特権操作RPCパターンを新規テーブルにもそのまま適用）。
- **Decision: `admin_log_action_enum` への `tier_downgrade` 追加は、値追加のみを行う専用マイグレーションファイルとして分離する**
  - Rationale: PostgreSQLは`ALTER TYPE ... ADD VALUE`を実行した同一トランザクション内でその値を直後に参照できない制約があるため、値追加とRPC定義を別マイグレーションファイルに分離する（安全なマイグレーション順序の確保）。
- **Build vs Adopt**: 新規の権限管理システムやORMは導入せず、既存の `is_admin()` / `SECURITY DEFINER` RPC / RLSパターンをそのまま踏襲する（Adopt）。
- **Simplification**: ページネーションは無限スクロールではなく、既存に前例のないシンプルな「前へ/次へ」ボタン方式（limit/offset）を採用する。管理者向けツールであり、Requirement文言にも無限スクロール要求はないため過剰実装を避ける。
- **Generalization**: 検索結果表示・アクション（リセット/BAN/UNBAN/ティア引き下げ）のUIブロックは、ランキング一覧・BAN一覧のどちらから選択されても同一コンポーネントを再利用する共通「選択中ユーザー」状態として設計する（`page.tsx` に状態をリフトアップ）。

---

## Design Review（`/kiro-validate-design`）— 2026-07-12

**判定**: GO（3件の軽微な手当てを条件に実施し、即時反映済み）

- **Issue 1（反映済み）**: `page.tsx` 分割時に `e2e/admin-users.spec.ts` が依存する既存 `id`（`execute-reset-btn` 等）を変更しない制約を `design.md` の Modified Files に明記。
- **Issue 2（反映済み）**: `BannedUserSummary.bannedByExecutorId` のN+1回避のため、`users` 1クエリ + `admin_logs` 1クエリ（`target_uid = ANY(uids)`）+ クライアント側で `target_uid` ごとに最新行を抽出、という具体的な結合方針を明記。
- **Issue 3（反映済み）**: `user_reports.category` にDB CHECK制約（4値）を追加し、`handle_report_user` のInvariantsにもRPC内検証を明記。

---

## タスク生成時の追加調査（コードギャップ発見）— 2026-07-12

`/kiro-spec-tasks` 実行前のコード確認で、既存の承認済み Requirement 7（非同期表示最適化）が実装されていないことが判明した。

- `src/app/admin/users/page.tsx` に `data-testid="admin-user-info-skeleton"` 等のスケルトン要素が存在せず、`loading` 中は画面全体を覆う `CircularProgress` のみが表示される（セクション単位のスケルトンではない）。
- さらに、Requirement 7.4/7.5（監査ログ履歴リストのスケルトン→実データ差し替え）が前提とする「監査ログ（`admin_logs`）の履歴リスト表示」自体が `page.tsx` に存在しない。テキストで「実行履歴は監査ログとして保存されます」と説明するのみで、実際の一覧UIは未実装。
- **結論**: Requirement 7 はUIのスケルトン化だけでなく、監査ログ履歴リストという表示機能自体を新規に実装する必要がある。`design.md` の Overview/Goals/Boundary Commitments を修正し、`UserSearchPanel` の責務に「対象ユーザーに関する監査ログ履歴リストの表示」を追加した。タスク生成でもこの前提でRequirement 7を新規実装タスクとして扱う。
