# Implementation Plan

## 1. Foundation: 個人ハブ用プリミティブの確認
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に Form, Label, Textarea, Select, Switch, Alert, Table, ToggleGroup が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 1.4, 3.4, 4.5, 7.3, 7.5, 8.4_
  - _Boundary: PersonalPrimitives_

---

## 2. Core: 設定画面とテーマ切替
- [x] 2.1 ThemeToggle を shadcn ToggleGroup で再実装する
  - `theme-toggle.module.css` の import を削除し、ToggleGroup で「ダーク」「ライト」2 択 UI を実装する
  - `useTheme().setTheme` のみ使用し、`data-testid="settings-theme-toggle"` とボタンラベルを維持する
  - ライト選択時に `html[data-theme="light"]` と `localStorage quizetika-theme` が更新されることをブラウザで確認する
  - _Requirements: 2.2, 2.3, 2.4_
  - _Boundary: ThemeToggle_
  - _Depends: 1.1_

- [x] 2.2 SettingsClient を shadcn Card レイアウトで再実装する
  - `settings.module.css` の import を削除し、Card セクションでテーマとアカウント領域を構成する
  - `data-testid="settings-page-container"`、`settings-profile-edit-link` を維持する
  - 未ログイン時にアカウントセクションが非表示になることを確認する
  - _Requirements: 2.1, 2.5, 2.6, 1.1, 1.2_
  - _Boundary: SettingsClient_
  - _Depends: 2.1_

---

## 3. Core: ログイン画面
- [x] 3.1 (P) Login ページを shadcn Card + Alert + Button で再実装する
  - `login.module.css` の import を削除し、`glass-card` / `btn btn-*` を shadcn コンポーネントに置換する
  - Google/X/Azure AD ボタン、`#e2e-test-login-btn`、リダイレクト契約、日本語エラーメッセージを維持する
  - `/login` が shadcn 標準スタイルで表示され、旧 neon/glass が不使用であることを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 1.1_
  - _Boundary: LoginPage_
  - _Depends: 1.1_

---

## 4. Core: プロフィール画面群
- [x] 4.1 ProfileClient とプロフィールスケルトンを shadcn 化する
  - `profile.module.css` および `profile-skeleton.module.css` を削除し、Tailwind + Card/Tabs/Badge で再実装する
  - `data-testid="profile-page-container"`, `profile-skeleton`, `profile-tab-history` を維持する
  - フォロー/アンフォロー、バッジ、tier 表示の既存インタラクションが動作することを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 1.1_
  - _Boundary: ProfileClient_
  - _Depends: 1.1_

- [x] 4.2 (P) ProfileEditClient を shadcn Form で再実装する
  - `edit.module.css` を削除し、Form + Label + Input + Textarea + Button で編集 UI を構成する
  - 保存ボタンの visible text「保存」を維持し、表示名・自己紹介の保存が動作することを確認する
  - _Requirements: 4.5, 1.1_
  - _Boundary: ProfileEditClient_
  - _Depends: 1.1_

- [x] 4.3 (P) Likes・Connections ページとサブコンポーネントを shadcn 化する
  - `likes.module.css`, `connections.module.css`, `connections-skeleton.module.css` を削除する
  - `profile-list-card`, `profile-play-history-panel`, `profile-lists-panel`, `likes-skeleton` を Tailwind + Card に移行する
  - `data-testid="likes-page-container"`, `connections-page-container`, `connections-skeleton` を維持する
  - _Requirements: 4.6, 4.7, 1.1_
  - _Boundary: ProfileSubpages_
  - _Depends: 1.1_

---

## 5. Core: ブックマーク画面
- [x] 5.0 (P) bookmarks-skeleton と notifications-skeleton を Tailwind 化する
  - `src/components/ui/bookmarks-skeleton.tsx`, `notifications-skeleton.tsx` から `.module.css` import を削除し shadcn Skeleton で再実装する
  - `data-testid="bookmarks-skeleton"` と通知読み込み中のスケルトン表示を維持する
  - `bookmarks-skeleton.module.css`, `notifications-skeleton.module.css` を削除する
  - _Requirements: 5.6, 6.5, 9.1_
  - _Boundary: PersonalSkeletons_
  - _Depends: 1.1_

- [x] 5.1 (P) ブックマーク画面とコンポーネントを shadcn Tabs + Card grid で再実装する
  - `bookmarks.module.css`, `bookmark.module.css` を削除する
  - BookmarksTabs を shadcn Tabs に移行し、全 testid（`bookmarks-tabs`, `bookmarks-tab-quiz` 等）を維持する
  - BookmarkQuizGrid / ListGrid / QuestionList / BookmarksClient の未ログインリダイレクトと空状態 testid を維持する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 1.4_
  - _Boundary: Bookmarks_
  - _Depends: 1.1_

---

## 6. Core: 通知画面
- [x] 6.1 (P) NotificationsClient を shadcn Card リストで再実装する
  - `notifications.module.css` を削除し、通知行を Card または border 付き list item で構成する
  - 未ログインリダイレクト、既読更新、タイプ別遷移、読み込みスケルトンを維持する
  - `/notifications` が shadcn 標準スタイルで表示されることを確認する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 1.1_
  - _Boundary: NotificationsClient_
  - _Depends: 1.1, 5.0_

---

## 7. Core: カスタムクイズ画面
- [x] 7.1 MyQuizSourcePanel と MyQuizSearchSection を shadcn 化する
  - 取得元 4 トグルを ToggleGroup に移行し、全 source testid（`my-quiz-source-own` 等）を維持する
  - 検索・絞り込み UI を Input/Select/Tabs 等で再構成し、`my-quiz-filters` 関連 testid を維持する
  - _Requirements: 7.3, 7.4, 7.7, 7.8, 1.3_
  - _Boundary: MyQuizFilters_
  - _Depends: 1.1_

- [x] 7.2 (P) MyQuizFilteredTable・PlaySettings・PreviewBar を shadcn 化する
  - FilteredTable を shadcn Table に移行し、pagination 含む全 table testid を維持する
  - PlaySettings の出題数 ToggleGroup、Shuffle Switch、`my-quiz-play-settings` 等 testid を維持する
  - PreviewBar の `data-testid="my-quiz-start-play"` とプレイ開始動作を維持する
  - _Requirements: 7.4, 7.5, 7.6, 7.9, 1.3_
  - _Boundary: MyQuizPlay_
  - _Depends: 1.1_

- [x] 7.3 MyQuiz ページシェルと client を統合する
  - `my-quiz.module.css`（app + components）を削除し、MyQuizClient / page.tsx を Tailwind 化する
  - 未ログインリダイレクト、`my-quiz-page`, `my-quiz-content`, `my-quiz-pool-error` testid を維持する
  - ログイン後にカスタムクイズ全セクションが縦積み表示されることを確認する
  - _Requirements: 7.1, 7.2, 7.9, 1.1_
  - _Boundary: MyQuizClient_
  - _Depends: 7.1, 7.2_

---

## 8. Core: 料金画面
- [x] 8.1 (P) Pricing ページと plan コンポーネントを shadcn Card + Alert + Badge で再実装する
  - `pricing.module.css` および `src/components/pricing/*.module.css` を削除する
  - `pricing-skeleton`、checkout フィードバック、Pro badge、Free/Pro カードの CTA 契約を維持する
  - Sparkles の neon inline color を `text-primary` 等 shadcn トークンに置換する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 1.1_
  - _Boundary: Pricing_
  - _Depends: 1.1_

---

## 9. Integration: レガシー CSS Modules 削除
- [x] 9.1 個人ハブ境界内の CSS Modules を削除し import 残存がないことを確認する
  - design.md File Structure Plan に列挙された `[DELETE]` の `.module.css` をすべて削除する
  - `grep` で個人ハブコンポーネントに `.module.css` import が残っていないことを確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - _Depends: 2.2, 3.1, 4.1, 4.2, 4.3, 5.1, 6.1, 7.3, 8.1_

---

## 10. Validation: ビルド・E2E 回帰確認
- [x] 10.1 ビルド・lint・Jest の回帰を確認する
  - `npm run build`、`npm run lint`、`npm run test` を順に実行し全て成功することを確認する
  - 本スペック変更に起因する新規 lint エラーがないことを確認する
  - _Requirements: 10.4, 10.5_
  - _Depends: 9.1_

- [x] 10.2 個人ハブ関連 Playwright E2E の回帰を確認する
  - `npm run test:e2e -- e2e/user-settings.spec.ts e2e/my-quiz.spec.ts e2e/auth-profile.spec.ts` を実行しグリーンであることを確認する
  - テーマ切替 E2E が dual bridge 下で `data-theme` と localStorage を検証通過することを確認する
  - _Requirements: 10.1, 10.2, 10.3, 2.2, 2.3, 2.4_
  - _Depends: 10.1_

- [x]* 10.3 ThemeToggle と BookmarksTabs のスモークレンダリングテストを追加する
  - `@testing-library/react` で ThemeToggle（mock useTheme）と BookmarksTabs を mount し、testid が存在することを確認する
  - `npm run test` がパスすることを確認する
  - _Requirements: 2.1, 5.3_
  - _Depends: 10.1_

---

## Implementation Notes
- 本プロジェクトの `Button` / `Badge` は `asChild` 非対応（base-ui）。Link ボタンは `buttonVariants()` + `Link` で構成する。
- カスタムクイズ取得元は複数選択のため `ToggleGroup` ではなく個別 `Toggle`（`pressed` / `onPressedChange`）を使用。
- `npm run build` は compile + TypeScript チェックは通過するが、並行ビルドによる `.next` 破損で page data 収集が ENOENT で失敗する場合あり。単独実行で再試行推奨。

## 11. Phase 3: Player/Creator 表記への更新（2026-07-13、Upstream: quizetika-billing-subscription-ui Phase 3 先行必須）

- [x] 11.1 料金画面グリッドレイアウトの3カラム対応
  - `PricingPageContent` のカードグリッドを `grid gap-6 md:grid-cols-2` から `md:grid-cols-3` へ更新する（モバイルは既存の縦積みレイアウトを維持）
  - **完了状態**: デスクトップ幅で Free・Player・Creator の3カードが横並びで表示され、モバイル幅では縦積みのまま崩れないこと
  - _Requirements: 8.1_
  - _Depends: quizetika-billing-subscription-ui 11.6_
  - _Boundary: PricingPageContent_

- [x] 11.2 Phase 3 統合検証
  - `/pricing` 画面のレンダリングテストおよび既存 E2E（`user-settings`/`my-quiz`/`auth-profile`）に回帰がないことを確認する
  - **完了状態**: 関連する Jest テストがグリーンでパスし、レイアウト崩れがないこと
  - _Depends: 11.1_
  - _Requirements: 8.1_

### Implementation Notes (Phase 3)
- **Upstream 前提**: `quizetika-billing-subscription-ui` タスク 11.6（`/pricing` の Free/Player/Creator 3枚描画統合）が完了していること。
- 本スペックはグリッドレイアウトの調整のみを担当し、カード内部（価格・特典・CTA）のロジックには関与しない（Boundary は変更なし）。
