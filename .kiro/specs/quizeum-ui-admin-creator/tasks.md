# Implementation Plan

## 1. Foundation: 管理/クリエイター用プリミティブの確認
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に Table, Select, Textarea, Label, AlertDialog, Chart が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - `recharts` 依存が package.json に存在することを確認する
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 1.2, 1.3, 4.2, 5.2, 6.1, 6.3, 8.1, 8.2, 8.3, 8.4_
  - _Boundary: AdminPrimitives_

- [x] 1.2 破壊的操作確認用 ConfirmActionDialog を実装する
  - `src/components/admin/confirm-action-dialog.tsx` に AlertDialog ラッパーを作成する
  - 確認ボタンに `data-testid="confirm-action-btn"`、キャンセルに `data-testid="cancel-action-btn"` を付与する
  - キャンセル時に `onConfirm` が呼ばれないことを単体テストで検証する
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Boundary: ConfirmActionDialog_
  - _Depends: 1.1_

---

## 2. Core: チャート・スケルトンコンポーネントの移行
- [x] 2.1 AnalyticsChart を shadcn Chart で再実装する
  - `analytics-chart.tsx` のインラインスタイルを削除し、ChartContainer + BarChart（recharts）で 7 日間棒グラフを描画する
  - 既存 props（`data`, `title`, `unit`, `color`）とライト/ダーク両テーマの配色を維持する
  - クリエイターダッシュボードでトレンド 2 件がエラーなく表示されることを確認する
  - _Requirements: 6.1, 6.3_
  - _Boundary: AnalyticsChart_
  - _Depends: 1.1_

- [x] 2.2 SelectionPie を shadcn 標準スタイルで再実装する
  - `selection-pie.tsx` を PieChart + ChartLegend または Tailwind 円グラフで再実装し、旧インライン neon 色を削除する
  - 既存 props（`data: {label, count}[]`）とデータ欠損時のフォールバック表示を維持する
  - クイズ一覧の質問別円グラフが凡例付きで表示されることを確認する
  - _Requirements: 6.2, 6.4_
  - _Boundary: SelectionPie_
  - _Depends: 1.1_

- [x] 2.3 チャート・ダッシュボード用スケルトンを shadcn Skeleton で移行する
  - `stats-skeleton.tsx`, `charts-skeleton.tsx`, `quiz-list-skeleton.tsx`, `feedback-skeleton.tsx` から `.module.css` import を削除し Tailwind + Skeleton で再実装する
  - 既存 `data-testid`（`stats-skeleton`, `charts-skeleton`, `quiz-list-skeleton`, `feedback-list-skeleton`）を維持する
  - `tests/components/creator-skeleton-components.test.tsx` がパスすることを確認する
  - _Requirements: 3.2, 6.5_
  - _Boundary: ChartSkeletons_
  - _Depends: 1.1_

---

## 3. Core: 管理画面（ユーザー管理）の移行
- [x] 3.1 Admin Users ページを shadcn Table + フォームで再実装する
  - `src/app/admin/users/page.tsx` から `users.module.css` import を削除し、Table/Input/Textarea/Badge/Button で UI を再構築する
  - UID 検索、ユーザー情報表示、BAN/UNBAN/リセット、モデレーション導線を既存と同等に維持する
  - 理由 10 文字未満のバリデーションと `execute-reset-btn`, `execute-ban-btn`, `execute-unban-btn` id を維持する
  - 旧 glass/neon スタイルを使用しない shadcn 標準サーフェスで表示されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2, 7.4, 7.5_
  - _Boundary: AdminUsersPage_
  - _Depends: 1.3_

- [x] 3.2 Admin Users の破壊的操作に ConfirmActionDialog を統合する
  - BAN・レピュテーションリセット・UNBAN の実行前に ConfirmActionDialog を表示し、承認時のみ API を呼び出す
  - キャンセル時に画面状態と入力値が変更前に維持されることを確認する
  - `e2e/admin-users.spec.ts` に確認ダイアログのクリックステップを追加し E2E がグリーンであることを確認する
  - _Requirements: 8.3, 8.4, 8.5, 9.1_
  - _Boundary: AdminUsersPage, ConfirmActionDialog_
  - _Depends: 3.1_

---

## 4. Core: 管理画面（モデレーション）の移行
- [x] 4.1 Admin Moderation ページを shadcn 標準 UI で再実装する
  - `src/app/admin/moderation/page.tsx` から `moderation.module.css` import を削除し、Card/Table/Badge/Button で審査キューを再構築する
  - 通報理由表示、restore/delete アクション、admin_review 遷移、users 導線、seed UI（admin 限定）を既存と同等に維持する
  - `restore-btn-{id}`, `delete-btn-{id}`, `seed-genres-btn` id を維持する
  - クライアントサイド権限ガード（`moderationTier`, `isAdminUser`）と redirect 契約を維持する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1, 7.2, 7.5_
  - _Boundary: AdminModerationPage_
  - _Depends: 1.3_

- [x] 4.2 Admin Moderation の restore/delete に ConfirmActionDialog を統合する
  - 公開復帰・コンテンツ削除の実行前に ConfirmActionDialog を表示し、承認時のみ `resolveFlag()` を呼び出す
  - キャンセル時にキュー状態が変更されないことを確認する
  - `tests/app/admin/moderation-seed.test.tsx` がパスすることを確認する
  - _Requirements: 8.1, 8.2, 8.5, 9.2_
  - _Boundary: AdminModerationPage, ConfirmActionDialog_
  - _Depends: 4.1_

---

## 5. Core: クリエイターダッシュボードの移行
- [x] 5.1 Creator Dashboard のセクションとアクションを shadcn 化する
  - `dashboard-sections.tsx` から `dashboard.module.css` import を削除し、Card/Badge/Button で統計グリッド・クイズ一覧・フィードバックを再構築する
  - `dashboard-actions.tsx` と `dashboard-client.tsx` を Tailwind 化し、インライン neon style を削除する
  - 既存 `data-testid`（`stats-section`, `analytics-section`, `creator-quiz-list`, `quiz-card`, `creator-quiz-review-score`）とエディタ・詳細導線を維持する
  - 未認証時の `/login` redirect を維持する
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 7.3, 7.5_
  - _Boundary: CreatorDashboard_
  - _Depends: 2.1, 2.2, 2.3_

- [x] 5.2 Creator Dashboard のスケルトン→コンテンツ遷移を確認する
  - データ読み込み中に 4 種スケルトンが表示され、完了後に実セクションへ置換されることをブラウザで確認する
  - `e2e/creator-dashboard.spec.ts` と `e2e/creator-streaming-skeleton.spec.ts` がグリーンであることを確認する
  - _Requirements: 3.2, 9.1_
  - _Boundary: CreatorDashboard, ChartSkeletons_
  - _Depends: 5.1_

---

## 6. Core: コミュニティツールの並列移行
- [x] 6.1 (P) Community Genres ページを shadcn Tabs + Table で再実装する
  - `src/app/community/genres/page.tsx` から `genres.module.css` import を削除し、Tabs（リクエスト・投票・履歴）+ Table + フォームで再構築する
  - アイコンアップロード、投票承認/却下、`genre-vote-approve-{id}` 等の id を維持する
  - 旧 glass/neon スタイルを使用しない shadcn 標準 UI で表示されることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 7.5_
  - _Boundary: CommunityGenresPage_
  - _Depends: 1.1_

- [x] 6.2 (P) Community Merge ページを shadcn Tabs + Table で再実装する
  - `src/app/community/merge/page.tsx` から `merge.module.css` import を削除し、Tabs（保留投票・提案）+ Table + フォームで再構築する
  - マージ提案フォーム、投票承認/却下、`vote-approve-{id}` 等の id を維持する
  - 旧 glass/neon スタイルを使用しない shadcn 標準 UI で表示されることを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.5_
  - _Boundary: CommunityMergePage_
  - _Depends: 1.1_

---

## 7. Integration: レガシー CSS Modules 削除
- [x] 7.1 当該ドメインの CSS Modules を削除する
  - `users.module.css`, `moderation.module.css`, `dashboard.module.css`, `genres.module.css`, `merge.module.css`, `stats-skeleton.module.css`, `charts-skeleton.module.css`, `quiz-list-skeleton.module.css`, `feedback-skeleton.module.css` を削除する
  - `src/app/admin/`, `src/app/creator/dashboard/`, `src/app/community/`, `src/components/charts/`, `src/components/quiz/` 配下に未参照 `.module.css` が残っていないことを確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 9.4_
  - _Depends: 3.2, 4.2, 5.2, 6.1, 6.2_

---

## 8. Validation: ビルド・テスト回帰とテーマ視認性
- [x] 8.1 ビルド・lint・Jest の回帰を確認する
  - `npm run build`、`npm run lint`、`npm run test` を順に実行し全て成功することを確認する
  - 本スペック変更に起因する新規 lint エラーがないことを確認する
  - _Requirements: 9.2, 9.5_
  - _Depends: 7.1_

- [x] 8.2 関連 Playwright E2E とテーマ視認性を確認する
  - `npm run test:e2e -- e2e/admin-users.spec.ts e2e/creator-dashboard.spec.ts e2e/creator-streaming-skeleton.spec.ts e2e/moderation-feedback.spec.ts` を実行し全てグリーンであることを確認する
  - ライト/ダーク両テーマで管理テーブル・フォーム・チャート・バッジのコントラストをブラウザで確認する
  - _Requirements: 9.1, 9.3_
  - _Depends: 8.1_

- [x]* 8.3 ConfirmActionDialog と AnalyticsChart のスモークテストを追加する
  - ConfirmActionDialog の確認/キャンセル挙動と AnalyticsChart の props レンダリングを `@testing-library/react` で検証するテストを追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 8.5, 6.1_
  - _Depends: 8.1_
