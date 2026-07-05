# Implementation Plan - e2e-suite-stabilization

- [ ] 1. 調査基盤（Failure Ledger・差分検証ツール）の構築

- [x] 1.1 Playwright JSON reporterを追加しLedger生成・差分比較スクリプトを実装する
  - `playwright.config.ts` の `reporter` 配列に `['json', { outputFile: 'playwright-report/results.json' }]` を追加する（既存の `list`/`html` 設定は変更しない）
  - `scripts/e2e-report-to-ledger.mjs` を実装する。`playwright-report/results.json` を読み取り、失敗（`status !== 'passed'`）したテストごとに `id`（`specFile::testTitle`）・`specFile`・`testTitle`・`domain`（specファイル名から導出）を抽出し、`.kiro/specs/e2e-suite-stabilization/failure-ledger.md` に `status: open` の初期レコードを生成する。既にLedgerに存在するテストIDの調査済みフィールド（`category`/`rootCauseSummary`等）は上書きしない
  - `scripts/e2e-baseline-diff.mjs` を実装する。2時点の `results.json` を `specFile` + `testTitle` で突き合わせ、「新規修正（ベースライン失敗→今回成功）」「未修正（両方失敗）」「新規デグレード（ベースラインになかった失敗）」の3区分を判定する
  - `package.json` の `scripts` に `e2e:ledger`（`node scripts/e2e-report-to-ledger.mjs`）と `e2e:diff`（`node scripts/e2e-baseline-diff.mjs`）を追加する
  - サンプルの `results.json` フィクスチャに対して2つのスクリプトを実行し、レコード抽出・3区分判定が期待通りであることをユニットテストで確認する
  - 観測可能な完了条件: フィクスチャデータに対し `node scripts/e2e-report-to-ledger.mjs` と `node scripts/e2e-baseline-diff.mjs` を実行すると期待通りの出力が得られ、対応するユニットテストが成功する
  - _Requirements: 1.1, 1.2, 1.4_
  - _Boundary: BaselineCapture (playwright.config.ts, scripts/e2e-report-to-ledger.mjs, scripts/e2e-baseline-diff.mjs, package.json)_

- [x] 1.2 BaselineCaptureを実行し実測結果をFailure Ledgerへ記録する
  - ローカルSupabaseを `supabase db reset` した状態で `npm run test:e2e` を実行し `playwright-report/results.json` を生成する（`research.md` に記録済みの実測（156件中50 failed / 4 skipped / 102 passed）を正式なベースラインとして再現する）
  - `npm run e2e:ledger` を実行し、`.kiro/specs/e2e-suite-stabilization/failure-ledger.md` に失敗50件分のレコード（`id`/`specFile`/`testTitle`/`domain`/`status: open`）を生成する
  - Firebase関連コード（`supabase-cleanup` のスコープ）には一切変更を加えない
  - 観測可能な完了条件: `failure-ledger.md` に50件のレコードが存在し、件数が `npm run test:e2e` のサマリー行（`50 failed`）と一致する
  - _Requirements: 1.1, 1.2, 1.4_
  - _Depends: 1.1_

- [x] 1.3 FlakinessProbeを実行し非決定的な失敗を識別する
  - Failure Ledger上の `status: open` レコードのみを対象に、Playwrightの `--grep` でテストを絞り込み2〜3回再実行する
  - 実行ごとに成否が入れ替わったテストIDについて、Ledgerの `flaky` フィールドを `true` に設定する。決定的に失敗し続けるテストは `flaky: false` のままとする
  - 観測可能な完了条件: Ledger上の全50レコードについて `flaky` フィールド（true/false）が確定している
  - _Requirements: 1.3_
  - _Depends: 1.2_

- [x] 2. Core: 認証・アクセス制御系ドメインの根本原因調査と修正

- [x] 2.1 (P) 管理者ポータル・管理者ユーザー管理のアクセス制限を調査・修正する
  - `e2e/admin-portal.spec.ts:5`（非管理者ユーザーでのアクセス制限確認）と `e2e/admin-users.spec.ts:5`（非管理者ユーザーでのアクセス制限確認）は同一パターン（`/admin` への未認証アクセス後のリダイレクト確認）で失敗しており、共有の根本原因として1レコードにグルーピングして調査する（Ledgerの `rootCauseGroup` を同一値に設定）
  - 原因を `product-bug`（認証・リダイレクトロジックの不具合）/ `test-defect`（アサーションやセレクタの不備）/ `env-config` のいずれかに分類し、Ledgerに記録する
  - 分類結果に応じて、プロダクトコード（認証・リダイレクト判定ロジック）またはテストコード（該当spec）のいずれか一方のみを修正する
  - `product-bug` の場合は、当該不具合を再現するJestまたはPlaywrightのリグレッションテストを追加する
  - `npm run test` を実行し既存テストに悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/admin-portal.spec.ts e2e/admin-users.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/admin-portal.spec.ts, e2e/admin-users.spec.ts, 認証・権限判定ロジック)_

- [x] 2.2 (P) レイアウトの管理者メニュー表示を調査・修正する
  - `e2e/layout.spec.ts:94`（Admin menu is visible and active）・`:114`（Admin popup links are visible）・`:168`（PC sidebar collapse toggle, avatar popup, and profile nav link）の3件を調査する
  - タスク2.1の管理者アクセス制限の根本原因（認証・権限判定ロジック）と関連する可能性があるため、2.1の調査結果（`rootCauseGroup`）と重複しないか確認したうえで、独立した原因であれば別レコードとして分類・修正する
  - 分類結果に応じて、プロダクトコード（レイアウト/サイドバーの管理者判定ロジック）またはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/layout.spec.ts` が0 failedで完了し、Ledgerの該当3レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/layout.spec.ts, サイドバー/管理者メニュー表示ロジック)_

- [x] 2.3 (P) コミュニティモデレーション・ガバナンス機能を調査・修正する
  - `e2e/moderation-feedback.spec.ts` の4件（`:5` NGワードを含むタイトルのブロック、`:50` 指摘レポート送信、`:164` ジャンル新設申請のアクセス制限とUI非表示、`:247` 管理者モデレーション画面へのアクセス）を調査する。4件が同一原因か独立した原因かをLedgerで判別する
  - 各失敗を分類し、対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/moderation-feedback.spec.ts` が0 failedで完了し、Ledgerの該当4レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/moderation-feedback.spec.ts, モデレーション/ジャンル申請ロジック)_

- [x] 2.4 (P) ユーザー認証・プロフィール機能（好きなジャンル設定）を調査・修正する
  - `e2e/auth-profile.spec.ts:207`（好きなジャンルの設定と表示の検証、Phase 28）を調査し分類する
  - 対応するプロダクトコード（プロフィール編集・ジャンル設定ロジック）またはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/auth-profile.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/auth-profile.spec.ts, プロフィール編集/ジャンル設定ロジック)_

- [x] 3. Core: クリエイター・作問系ドメインの根本原因調査と修正

- [x] 3.1 (P) クイズ作成・管理フローを調査・修正する
  - `e2e/quiz-creation.spec.ts:5`（新規作成・問題エディタでの問題設定・下書き保存・公開申請）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/quiz-creation.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/quiz-creation.spec.ts, クイズ作成・下書き・公開申請ロジック)_

- [x] 3.2 (P) クイズカバー画像アップロードを調査・修正する
  - `e2e/quiz-cover-upload.spec.ts` の2件（`:4` 1.91:1トリミングでのカバー設定、`:91` 10MB超過時のバリデーションエラー表示）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/quiz-cover-upload.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/quiz-cover-upload.spec.ts, カバー画像トリミング/バリデーションロジック)_

- [x] 3.3 (P) クイズ編集画面の指摘フィードバック機能を調査・修正する
  - `e2e/quiz-editor-feedback.spec.ts:42`（指摘内容の表示、解決・却下・モーダル連携）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/quiz-editor-feedback.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/quiz-editor-feedback.spec.ts, 指摘レポート表示/解決ロジック)_

- [x] 3.4 (P) AIクイズ作問（Upsell・Pro機能）を調査・修正する
  - `e2e/ai-quiz-authoring.spec.ts` の2件（`:16` 無料ユーザーへのUpsell表示、`:23` Pro fixtureでのAPI mock問題+10）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/ai-quiz-authoring.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/ai-quiz-authoring.spec.ts, AI作問Upsell/Pro機能判定ロジック)_

- [x] 3.5 (P) クリエイターダッシュボードを調査・修正する
  - `e2e/creator-dashboard.spec.ts` の2件（`:5` F-901ダッシュボード表示、`:241` ダッシュボード→クイズ作成→統計確認の複合フロー）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/creator-dashboard.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/creator-dashboard.spec.ts, ダッシュボード集計/表示ロジック)_

- [x] 3.6 (P) クリエイター画面のStreaming/Suspenseスケルトンを調査・修正する
  - `e2e/creator-streaming-skeleton.spec.ts` の2件（`:5` ダッシュボードの各スケルトン解消、`:19` quiz-editor-skeleton解消）を調査し分類する
  - 対応するプロダクトコード（Suspense境界・データフェッチ完了タイミング）またはテストコードのみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/creator-streaming-skeleton.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/creator-streaming-skeleton.spec.ts, クリエイター画面Suspense境界)_

- [x] 3.7 (P) ジャンルアイコン申請フローを調査・修正する
  - `e2e/genre-icons.spec.ts:5`（コミュニティジャンル申請での手動アップロード＆申請＆投票可決フロー）を調査する。`test.describe` タイトルに「Firebase Storage 移行」という`supabase-cleanup`完了後も残存するFirebase時代の記述があるため、まずテストコード自体の記述更新漏れ（`test-defect`）である可能性を優先的に確認する
  - 調査の結果、原因がFirebase関連コード（`supabase-cleanup` のスコープ）に起因すると判明した場合は、Ledgerの `status` を `deferred_out_of_scope` とし本タスクの修正対象から除外する
  - 現行のSupabase実装における不具合と判明した場合は、対応するプロダクトコードまたはテストコードのみを修正し、`product-bug` の場合はリグレッションテストを追加して `npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/genre-icons.spec.ts` が0 failedで完了するか、Ledgerの該当レコードが `deferred_out_of_scope` として明確に記録されている
  - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/genre-icons.spec.ts, ジャンルアイコン申請ロジック)_

- [x] 4. Core: プレイ・学習系ドメインの根本原因調査と修正

- [x] 4.1 (P) クイズプレイ・結果評価フローを調査・修正する
  - `e2e/quiz-play.spec.ts:5`（検索→プレイ→全問正解→結果画面での良問評価・難易度投票・感謝リアクション）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/quiz-play.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/quiz-play.spec.ts, プレイ結果評価ロジック)_

- [x] 4.2 (P) リーダーボード・ランキング機能を調査・修正する
  - `e2e/leaderboard.spec.ts` の6件（`:68` F-802ハイスコア記録、`:160` 初回プレイランキング、`:182` リプレイランキング、`:199` F-803短答式問題、`:229` F-804画像アタッチ問題、`:292` プレイ→ハイスコア記録→ランキング確認の複合フロー）を調査する。同一ファイル内の失敗のため、まず全6件を横断的に確認し、ランキング記録・表示系（`:68`,`:160`,`:182`,`:292`）と個別問題形式系（`:199`,`:229`）で根本原因が分かれるかをLedgerの `rootCauseGroup` で判別する
  - 判明した各原因について、対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/leaderboard.spec.ts` が0 failedで完了し、Ledgerの該当6レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/leaderboard.spec.ts, ハイスコア記録/ランキング表示/問題形式別採点ロジック)_

- [x] 4.3 (P) 学習・資格対策支援機能を調査・修正する
  - `e2e/learning-support.spec.ts:196`（プロフィール画面の弱点克服セクションへのリンク確認）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/learning-support.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/learning-support.spec.ts, 弱点克服セクション導線)_

- [x] 4.4 (P) Streaming/Suspenseスケルトン（一般画面）を調査・修正する
  - `e2e/streaming-skeleton.spec.ts` の3件（`:68` review-skeleton解消、`:77` bookmarks-skeleton解消、`:93` 未認証時の`/bookmarks`・`/notifications`ログインリダイレクト）を調査し分類する
  - 対応するプロダクトコード（Suspense境界・未認証リダイレクト処理）またはテストコードのみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/streaming-skeleton.spec.ts` が0 failedで完了し、Ledgerの該当3レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/streaming-skeleton.spec.ts, Suspense境界/未認証リダイレクト)_

- [x] 5. Core: 発見・ソーシャル系ドメインの根本原因調査と修正

- [x] 5.1 (P) 検索画面の探索機能を調査・修正する
  - `e2e/quiz-search.spec.ts` の3件（`:71` クイックサーチチップと★難易度表示、`:108` フォローユーザーのタイムライン表示、`:184` 無限スクロールでのsticky検索バー表示）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/quiz-search.spec.ts` が0 failedで完了し、Ledgerの該当3レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/quiz-search.spec.ts, 検索/タイムライン/無限スクロールロジック)_

- [x] 5.2 (P) ハイブリッド無限スクロール・広告インライン挿入を調査・修正する
  - `e2e/infinite-scroll.spec.ts` の2件（`:22` 検索画面、`:52` プロフィール画面の初期表示20件＋もっと見る＋10件ごとの広告挿入）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/infinite-scroll.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/infinite-scroll.spec.ts, 無限スクロール/広告インライン挿入ロジック)_

- [x] 5.3 (P) ソーシャル機能（ブックマーク・通知・リアクション）を調査・修正する
  - `e2e/social-features.spec.ts` の4件（`:115` F-403-2直接ブックマーク即時反映、`:166` F-404通知機能、`:187` F-405作家リアクション、`:308` フォロー→プレイ→リアクションの複合フロー）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/social-features.spec.ts` が0 failedで完了し、Ledgerの該当4レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/social-features.spec.ts, ブックマーク/通知/リアクションロジック)_

- [x] 5.4 (P) SEO/OGP・SNS共有機能を調査・修正する
  - `e2e/seo-sharing.spec.ts:230`（クイズ作成→OGPメタデータ検証→SNS共有確認の複合フロー）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/seo-sharing.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/seo-sharing.spec.ts, OGPメタデータ生成ロジック)_

- [x] 5.5 (P) 広告機能（インライン広告・動画広告モーダル）を調査・修正する
  - `e2e/ads.spec.ts` の2件（`:27` 検索画面10件ごとのインライン広告、`:74` クイズ完了時の動画広告モーダル1/3確率表示）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/ads.spec.ts` が0 failedで完了し、Ledgerの該当2レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/ads.spec.ts, 広告表示制御ロジック)_

- [x] 5.6 (P) トップページ右サイドバー（法的・サポートリンク）を調査・修正する
  - `e2e/home-sidebar.spec.ts:59`（お問い合わせリンクの別タブオープン）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/home-sidebar.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/home-sidebar.spec.ts, サイドバーリンク導線)_

- [x] 5.7 (P) カスタムクイズ（マイクイズ）画面を調査・修正する
  - `e2e/my-quiz.spec.ts:12`（ログイン後のカスタムクイズページ表示）を調査し分類する
  - 対応するプロダクトコードまたはテストコードのいずれか一方のみを修正する
  - `product-bug` の場合はリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/my-quiz.spec.ts` が0 failedで完了し、Ledgerの該当レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/my-quiz.spec.ts, カスタムクイズ画面表示ロジック)_

- [x] 5.8 (P) 追加機能・複合フロー（バッジ付与・フォロージャンル・複合シナリオ）を調査・修正する
  - `e2e/additional-features.spec.ts` の4件（`:105` F-105称号バッジ自動付与、`:180` フォローしているジャンルの管理、`:238` 検索→フィルタ→詳細→プレイの複合フロー、`:280` クイズ作成→統計確認→修正の複合フロー）を調査し分類する
  - 複合フロー（`:238`,`:280`）は検索・プレイ・作成・統計など他ドメインのタスク（5.1, 4.1, 3.1, 3.5等）と処理を共有する可能性があるため、原因調査の際にそれらのタスクで既に特定された `rootCauseGroup` と重複しないか確認する
  - 対応するプロダクトコードまたはテストコードのみを修正する
  - `product-bug` のものはリグレッションテストを追加し、`npm run test` で悪影響がないことを確認する
  - 観測可能な完了条件: `npx playwright test e2e/additional-features.spec.ts` が0 failedで完了し、Ledgerの該当4レコードが `status: fixed` になる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_
  - _Boundary: DomainFixWorkflow (e2e/additional-features.spec.ts, 称号バッジ付与/フォロージャンル管理ロジック)_

- [ ] 6. 最終検証: ベースラインとの差分比較によるゲート判定

- [ ] 6.1 FinalVerificationGateを実行しE2Eベースラインとの差分を確認する
  - Failure Ledger上の全50レコードが `fixed` または `deferred_out_of_scope` になっていることを確認する
  - ローカルSupabaseを `supabase db reset` した状態で `npm run test:e2e` を再実行し、新しい `playwright-report/results.json` を生成する
  - `npm run e2e:diff` を実行し、ベースライン時の `results.json` と比較して「新規修正」「未修正」「新規デグレード」を判定する
  - 「未修正」のうち `flaky: false` のレコードが1件でも残る場合、または「新規デグレード」が1件でも検出された場合は完了と判定せず、該当レコードを対応する Core タスク（2.x〜5.x）に差し戻す
  - 「未修正」が `flaky: true` のみである場合は、その旨を記録した上で完了判定を妨げないものとする
  - 観測可能な完了条件: `npm run e2e:diff` の出力が「新規デグレードなし」かつ「flaky以外の未修正なし」であることを示す
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [ ] 6.2 Jestスイート全体の最終確認を行う
  - `npm run test` を実行し、Jestテストスイート全体（既存219スイート/1222テスト規模＋本スペックで追加したリグレッションテスト）が成功することを確認する
  - 観測可能な完了条件: `npm run test` が終了コード `0` で完了する
  - _Requirements: 5.5_
  - _Depends: 6.1_
