# Research & Design Decisions - e2e-suite-stabilization

## Summary
- **Feature**: `e2e-suite-stabilization`
- **Discovery Scope**: Extension（既存システムの調査・修正。新規アーキテクチャ導入なし）
- **Key Findings**:
  - ローカル Supabase を `supabase db reset` した直後に `npm run test:e2e`（156件、Playwright, `workers: 1` の逐次実行、実測所要時間 約17.4分）を実測実行した。結果は **50 failed / 4 skipped / 102 passed** であり、プロジェクト説明にある「156件中50件」と完全に一致することを確認した。全件一覧は本節末尾の「実測ベースライン（2026-07-05時点）」を参照。今後 Requirement 1 のタスク実行時にこの結果を `failure-ledger.md` として正式化する。
  - 失敗50件は24種類のspecファイル（全32ファイル中）に分散しており、単一ファイル・単一ドメインへの偏りはない。ファイルあたりの失敗数は `leaderboard.spec.ts`（6件）が最多で、次いで `additional-features.spec.ts` / `moderation-feedback.spec.ts` / `social-features.spec.ts`（各4件）、`layout.spec.ts` / `quiz-search.spec.ts` / `streaming-skeleton.spec.ts`（各3件）と続く。
  - `admin-portal.spec.ts:5` と `admin-users.spec.ts:5` は、いずれも「非管理者ユーザーでのアクセス制限確認」という同一パターンのテスト（`/admin` への未認証アクセス後にリダイレクト先を確認）であり、同一の根本原因（認証・リダイレクト系の共通ロジック）を共有している可能性が高い。Requirement 2.3 のグルーピング対象の具体例となる。
  - `genre-icons.spec.ts` の `test.describe` タイトルが「ジャンルアイコン **Firebase Storage 移行** E2Eテスト」のままであり、`supabase-cleanup` 完了後もFirebase時代の記述が残存している。これは本スペックの対象（現行Supabase実装に対する検証failure）である可能性と、テストコード自体の記述更新漏れ（`test-defect`）である可能性の両方があり、優先的に調査すべき候補である。
  - `e2e/*.spec.ts`（32ファイル）は機能ドメインごとに1ファイル1 `test.describe` で構成されており、ファイル単位がそのまま「ドメイン」の実用的な分類軸になる（新しいドメイン分類体系を別途定義する必要がない）。
  - 既存の E2E テストコード（例: `admin-portal.spec.ts`, `leaderboard.spec.ts`, `seo-sharing.spec.ts`）は `page.waitForTimeout(N)` による固定待機、`isVisible().catch(() => false)` によるフォールバック分岐、複数ロケータの `.or()` 連結など、タイミング依存・環境依存の書き方が随所にあり、失敗が「プロダクトコードの不具合」ではなく「テストコード自体の不安定さ」に起因するケースが一定数含まれると推測される。この推測を裏付ける／反証するために実測データでの分類（Requirement 2）が必要。
  - `playwright.config.ts` の reporter は `list` と `html` のみで、機械可読な JSON レポートが出力されていない。ベースラインと最終検証の差分を確実に比較するため、`json` reporter の追加が必要（Requirement 1, 5 を支える基盤）。
  - `supabase-cleanup` タスク5.3の記録により、`saveQuiz` の INSERT順序バグと `applyCursorFilter` のthenable自動実行バグの2件（コミット `d067070`）は本スペックの母集合から除外済みであることを確認した。

## Research Log

### Playwright E2E スイートの実行構成
- **Context**: ベースライン再現手順（Requirement 1.1）の実行可否と、既存のテストインフラ構成を確認する必要があった。
- **Sources Consulted**: `playwright.config.ts`, `e2e/global-setup.ts`, `package.json`
- **Findings**:
  - `webServer` はローカル実行時 `reuseExistingServer: true` で `npx next dev` を起動・再利用する。CI時のみ `next build && next start`。
  - `globalSetup`（`e2e/global-setup.ts`）が Supabase Auth に E2Eテストユーザーを作成し、`users` テーブルへ admin ロールで upsert、ジャンルマスタ投入、広告テスト用ダミークイズ25件のシードを行う。既存データは `title LIKE '[AD_TEST]%'` で事前削除してから再投入するため、`supabase db reset` を挟まなくても複数回実行できる冪等設計。
  - `fullyParallel: false` / `workers: 1` のため、156件は逐次実行される（実測で1件あたり1〜18秒程度）。
- **Implications**: ベースライン取得・最終検証のいずれも「`supabase db reset` → `npm run test:e2e`」の単純な手順で再現可能であり、新規のテストインフラ変更は不要。既存の `globalSetup` の冪等性により、個々の修正イテレーション毎に全体をリセットする必要はなく、`npm run test:e2e` の再実行のみで足りる。

### 失敗記録の機械可読化
- **Context**: Requirement 1（ベースライン確定）と Requirement 5（最終検証でのデグレード検出）は、2回の実行結果（ベースライン／最終）を突き合わせて一致・不一致を判定する必要がある。現状の `list`/`html` reporter は人間可読だが、テスト単位での機械比較には不向き。
- **Sources Consulted**: `playwright.config.ts` の `reporter` 設定、[Playwright公式: Reporters](https://playwright.dev/docs/test-reporters)（`json` reporter は組み込みでバージョン追加不要）
- **Findings**: Playwright 組み込みの `json` reporter を `reporter` 配列に追加するだけで、既存の `list`/`html` 出力と併存できる。追加の依存パッケージは不要（現行 Playwright 1.60系に内蔵）。
- **Implications**: `playwright.config.ts` に `['json', { outputFile: 'playwright-report/results.json' }]` を追加し、ベースライン取得時・最終検証時の双方でこのファイルを比較対象とする。

## 実測ベースライン（2026-07-05時点）

`supabase db reset` 直後に `npm run test:e2e` を実行した結果: **156件中 50 failed / 4 skipped / 102 passed**（所要時間 約17.4分）。Requirement 1 のタスク実行時に、この結果を正式に `failure-ledger.md` へ変換する（本表はその一次資料）。

| # | Domain（specファイル） | 行 | テストタイトル |
| --- | --- | --- | --- |
| 1 | additional-features | 105 | F-105: 称号バッジ自動付与機能が正常に動作すること |
| 2 | additional-features | 180 | プロフィール編集画面: フォローしているジャンルが管理できること |
| 3 | additional-features | 238 | 複合テスト: 検索 → フィルタ → 詳細 → プレイ の完全フロー |
| 4 | additional-features | 280 | 複合テスト: クイズ作成 → 統計確認 → 修正 のフロー |
| 5 | admin-portal | 5 | 非管理者ユーザーでのアクセス制限確認 |
| 6 | admin-users | 5 | 非管理者ユーザーでのアクセス制限確認 |
| 7 | ads | 27 | 無料ユーザー: 検索画面で10件ごとに1件のインライン広告（PRバッジ付き）が表示されること |
| 8 | ads | 74 | 無料ユーザー: クイズ完了時に動画広告モーダルが1/3確率で表示され5秒後にスキップできること |
| 9 | ai-quiz-authoring | 16 | 無料ユーザーは Upsell が表示される |
| 10 | ai-quiz-authoring | 23 | Pro fixture: パネル表示・API mock で問題+10 |
| 11 | auth-profile | 207 | 好きなジャンルの設定と表示の検証（Phase 28） |
| 12 | creator-dashboard | 5 | F-901: クリエイターダッシュボードが正常に表示されること |
| 13 | creator-dashboard | 241 | 複合テスト: ダッシュボード → クイズ作成 → 統計確認 の完全フロー |
| 14 | creator-streaming-skeleton | 5 | クリエイターダッシュボードで各スケルトンが消えコンテンツが表示されること |
| 15 | creator-streaming-skeleton | 19 | クイズ作成画面で quiz-editor-skeleton が消えエディタが表示されること |
| 16 | genre-icons | 5 | コミュニティジャンル申請での手動アップロード & 申請 & 投票可決フロー |
| 17 | home-sidebar | 59 | お問い合わせリンクをクリックして別タブでフォームが開くこと |
| 18 | infinite-scroll | 22 | 検索画面: 初期表示20件+もっと見るボタン、クリック後の追加取得と広告インライン挿入 |
| 19 | infinite-scroll | 52 | プロフィール画面: 初期表示20件+もっと見るボタン、クリック後の追加取得と広告インライン挿入 |
| 20 | layout | 94 | Phase 27: Admin menu is visible and active on /admin for Admin User |
| 21 | layout | 114 | Phase 27: Admin popup links are visible for Admin User |
| 22 | layout | 168 | Phase 28: PC sidebar collapse toggle, avatar popup, and profile nav link |
| 23 | leaderboard | 68 | F-802: クイズプレイ後にハイスコアが記録されること |
| 24 | leaderboard | 160 | クイズ詳細画面: 初回プレイランキングが表示されること |
| 25 | leaderboard | 182 | クイズ詳細画面: リプレイランキングが表示されること |
| 26 | leaderboard | 199 | F-803: 短答式問題が正常に機能すること |
| 27 | leaderboard | 229 | F-804: 画像アタッチ（問題画像）が正常に機能すること |
| 28 | leaderboard | 292 | 複合テスト: プレイ → ハイスコア記録 → ランキング確認 の完全フロー |
| 29 | learning-support | 196 | プロフィール画面で弱点克服セクションへのリンクが確認できること |
| 30 | moderation-feedback | 5 | NGワードを含むクイズタイトルの保存がブロックされること |
| 31 | moderation-feedback | 50 | クイズ結果画面から指摘レポートを送信できること |
| 32 | moderation-feedback | 164 | ジャンル新設申請機能のアクセス制限とUI非表示の確認 |
| 33 | moderation-feedback | 247 | 管理者モデレーション画面にアクセスできること |
| 34 | my-quiz | 12 | ログイン後にカスタムクイズページが表示される |
| 35 | quiz-cover-upload | 4 | ローカル画像を選択し1.91:1でトリミングしてカバー画像として設定できること |
| 36 | quiz-cover-upload | 91 | 容量10MB以上の画像選択時にバリデーションエラーが表示されること |
| 37 | quiz-creation | 5 | クイズの新規作成、問題設定、下書き保存、公開申請を行えること |
| 38 | quiz-editor-feedback | 42 | 編集画面に指摘内容が正しく表示され解決・却下・モーダル連携が行えること |
| 39 | quiz-play | 5 | 公開クイズを検索・プレイし結果画面で評価・投票・リアクションを行えること |
| 40 | quiz-search | 71 | クイックサーチチップでタグチップが追加されカードに★難易度が表示されること |
| 41 | quiz-search | 108 | フォローしたユーザーのタイムラインがログイン後に表示できること |
| 42 | quiz-search | 184 | スクロール末端で追加読み込みが発火しsticky検索バーが表示されること |
| 43 | seo-sharing | 230 | 複合テスト: クイズ作成 → OGPメタデータ検証 → SNS共有確認 の完全フロー |
| 44 | social-features | 115 | F-403-2: トップページ一覧からの直接ブックマークで星アイコンが即時反映されること |
| 45 | social-features | 166 | F-404: 通知機能が正常に動作すること |
| 46 | social-features | 187 | F-405: クリエイターリアクション（いいね・感謝）機能が正常に動作すること |
| 47 | social-features | 308 | 複合テスト: フォロー → プレイ → リアクション の完全フロー |
| 48 | streaming-skeleton | 68 | 弱点克服画面で review-skeleton が消えジャンル選択が表示されること |
| 49 | streaming-skeleton | 77 | ブックマーク画面で bookmarks-skeleton が消え3タブが表示されること |
| 50 | streaming-skeleton | 93 | 未認証時に /bookmarks および /notifications へのアクセスがログインへリダイレクトされること |

**ドメイン別失敗数（上位）**: leaderboard 6件、additional-features / moderation-feedback / social-features 各4件、layout / quiz-search / streaming-skeleton 各3件、admin-portal / admin-users / ads / ai-quiz-authoring / creator-dashboard / creator-streaming-skeleton / infinite-scroll / quiz-cover-upload 各2件、その他9ドメイン各1件（計24ドメイン / 32ドメイン中）。

### 追記: タスク1.2実行時の実測差分（正式ベースライン）

タスク1.2（BaselineCapture）を実行した結果、本節の実測（50 failed）と異なり **56 failed / 4 skipped / 96 passed** となった。以下の6件が本節の一覧には含まれていなかった新規の失敗であり、`ads.spec.ts` / `learning-support.spec.ts` / `streaming-skeleton.spec.ts` / `seo-sharing.spec.ts` は既存の一覧に対して追加の失敗行として扱う（`auth-streaming-skeleton` は新規ドメイン）。いずれも `page.waitForTimeout` 等のタイミング依存記述を含む可能性が高く、Requirement 1.3 の FlakinessProbe で非決定性を確認する対象に含めた。

| Domain | 行 | テストタイトル |
| --- | --- | --- |
| ads | 133 | 有料ユーザー（Proプラン）：クイズ完了時に動画広告モーダルが表示されず、直接結果画面へ遷移すること |
| auth-streaming-skeleton | 16 | つながり一覧で connections-skeleton が消えコンテンツが表示されること |
| learning-support | 19 | クイズ詳細画面でプレイモード選択UIが正しく表示されること（通常・模擬試験・フラッシュカード） |
| learning-support | 115 | フラッシュカードモードで「答えを見る」ボタンが機能すること |
| seo-sharing | 215 | 動的SEOメタデータ: クイズタイトルがページタイトルに反映されていること |
| streaming-skeleton | 44 | クイズ結果画面で結果スケルトンが消えエラーまたはサマリーが表示されること |

本スペックの以後の作業（Requirement 2以降の根本原因調査・修正）は、この実測56件を正式なベースライン母集合として扱う（`.kiro/specs/e2e-suite-stabilization/failure-ledger.md` を一次情報源とする）。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Gated Investigate-Fix-Verify Pipeline | `supabase-cleanup` の Gated Sequential Pipeline を踏襲し、ベースライン確定 → ドメイン別調査・分類 → 独立修正 → リグレッション防止 → 最終検証ゲートの順に進める | 既存スペックで実績のあるパターン。各段階が失敗した場合に後続へ進まない安全設計をそのまま流用できる | ドメインごとに並行して調査・修正が進むため、Ledger（後述）による一元的な状態管理がないと進捗が散逸する | 採用 |
| ドメインごとに独立した個別スペックへ分割 | バッジ・管理者ポータル・ソーシャル等、ドメインごとに `e2e-stabilization-badge` のような子スペックを作る | ドメインごとの責任分界が明確 | 8ドメイン以上に対して個別スペックを起票するオーバーヘッドが大きく、根本原因が複数ドメインにまたがる場合（例: 共通コンポーネントのバグ）に分割が機能しない | 不採用: 本要件のRequirement 2.3（原因の共有によるグルーピング）と相性が悪い |
| 全失敗を1つの一括修正コミットで対応 | 調査後、原因ごとの独立性を保たず一度に全修正を行う | 作業ステップが少ない | Requirement 3.1（無関係な変更を混在させない）に反する。レビュー・切り戻しが困難 | 不採用 |

## Design Decisions

### Decision: Failure Ledger をスペック内の一次情報源とする
- **Context**: 50件規模・8ドメイン以上にまたがる失敗の調査状況（分類・原因・修正・リグレッションテスト・状態）を、`tasks.md` だけで追跡すると情報が薄くなり、根本原因のグルーピング（Requirement 2.3）や最終検証時の差分判定（Requirement 5.2, 5.4）の裏付けが取りにくい。
- **Alternatives Considered**:
  1. `tasks.md` のチェックボックスのみで管理する — 原因分類やグルーピングの構造化データを保持できない
  2. Playwright の `html`/`json` レポートのみに依存する — 分類（プロダクトバグ／テスト不備／環境問題）や修正参照など、レポートに存在しない情報を保持できない
- **Selected Approach**: `.kiro/specs/e2e-suite-stabilization/failure-ledger.md` を新設し、ベースライン取得時に自動生成したスケルトン（テストID・ファイル・タイトル・ドメイン）に、調査中に人手で分類・原因・修正参照・状態を追記していく。
- **Rationale**: `supabase-cleanup` の `research.md`（ファイル別オーナー表）と同様に、複数タスクにまたがる調査結果を一箇所に集約する既存パターンを踏襲できる。
- **Trade-offs**: 追跡用ファイルのメンテナンスコストが発生するが、50件規模の並行調査では一覧性の価値がコストを上回る。
- **Follow-up**: `tasks.md` 生成時、Ledger の各行を個々のタスクにマッピングする。

### Decision: JSON reporter を追加してベースライン・最終検証の差分を機械的に比較する
- **Context**: Requirement 5.4（新規デグレード検出）を目視のみで行うと見落としが生じる。
- **Alternatives Considered**:
  1. `list` reporter の標準出力をテキスト差分（`diff`）する — テスト実行順や色コード（ANSIエスケープ）の混入により誤判定しやすい
  2. HTMLレポートを目視比較する — 156件規模では非効率かつ属人的
- **Selected Approach**: `playwright.config.ts` に `json` reporter を追加し、ベースライン実行時の `results.json` と最終検証実行時の `results.json` をテスト全体パス（`file` + `title`）で突き合わせる軽量スクリプト（`scripts/e2e-baseline-diff.mjs`）を新設する。
- **Rationale**: Playwright標準機能のみで実現でき、新規依存パッケージ・新規テストインフラ変更が不要。
- **Trade-offs**: 比較スクリプトの実装・保守コストが発生するが、`supabase-cleanup` の `verify-firebase-removed.js` と同等の軽量Node ESMスクリプトで賄える規模。
- **Follow-up**: スクリプトの単体テストで、「ベースラインで失敗→最終で成功」「ベースラインで失敗→最終でも失敗」「ベースラインに存在しない新規失敗（デグレード）」の3パターンを検証する。

## Risks & Mitigations
- リスク: E2Eテストの中に真にflakyなもの（環境要因で非決定的に成功/失敗する）が含まれ、根本原因調査が長期化する — 緩和策: Requirement 1.3 の通り、同一テストを複数回再実行して非決定性を確認した時点でflaky分類とし、機能不具合調査から除外する。
- リスク: 1つの根本原因が複数ドメイン（例: 共通コンポーネントや共通フック）にまたがり、ドメイン単位の独立修正という前提が崩れる — 緩和策: Requirement 2.3 に基づき、共有原因はグルーピングして単一の修正対象として扱う（Ledger上で1レコードに複数テストIDを紐付ける）。
- リスク: 個々の修正を逐次適用する過程で `npm run test` の再実行に時間がかかり、50件規模の修正サイクルが長期化する — 緩和策: Jest単体テストスイートは219スイート/1222テストで数十秒〜数分規模（既存実績）であり、E2E全体再実行は最終検証ゲートのみに限定し、個別修正時は関連ドメインのJest/該当specファイルのみを対象にした部分実行を許容する。

## References
- [Playwright Test Reporters](https://playwright.dev/docs/test-reporters) — 組み込み `json` reporter の設定方法確認に使用
- `.kiro/specs/supabase-cleanup/design.md` — Gated Sequential Pipeline パターンおよび `research.md` 活用方針の参照元
- `.kiro/specs/supabase-cleanup/tasks.md`（タスク5.3実行結果） — 本スペックの母集合（50件）の出処、および除外済み2件のバグの根拠
