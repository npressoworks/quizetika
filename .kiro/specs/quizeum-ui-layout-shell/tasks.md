# Implementation Plan

## 1. Foundation: シェル用プリミティブとナビヘルパーの準備
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に Avatar, DropdownMenu, Separator が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 2.4, 3.2, 5.5_
  - _Boundary: ShellPrimitives_

- [x] 1.2 ナビアクティブ判定ヘルパーを抽出し単体テストを追加する
  - `src/components/layout/nav-active.ts` に `isNavItemActive`, `isHomeActive`, `isSearchActive` を Sidebar/BottomNav から移設する
  - `tests/components/nav-active.test.ts` で `/`, `/search`, `/lists`, `/list/`, `/my-quiz` の判定ケースを検証する
  - `npm run test` で新規テストがパスすることを確認する
  - _Requirements: 2.5, 2.6, 2.7, 3.7, 6.4_
  - _Boundary: NavActiveHelpers_
  - _Depends: 1.1_

---

## 2. Core: LayoutWrapper の Tailwind 移行
- [x] 2.1 LayoutWrapper を Tailwind 化しレスポンシブ余白を維持する
  - `layout-wrapper.module.css` の import を削除し、Tailwind クラスで `appContainer` / `mainWrapper` / `content` / `playContainer` を再現する
  - 非プレイ画面で `lg:pl-[275px]`、`md:pl-[70px]`（768–1023px）、`max-md:pb-[60px]` の余白契約を維持する
  - `/play` パスでは Sidebar・Header・BottomNav を含まない `playContainer` のみをレンダーする
  - メインコンテンツの `max-w-[1200px] mx-auto` 中央寄せを維持する
  - _Requirements: 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 4.5, 6.2, 6.3_
  - _Boundary: LayoutWrapper_
  - _Depends: 1.2_

---

## 3. Core: Sidebar の shadcn + Tailwind 移行
- [x] 3.1 Sidebar を shadcn 標準スタイルで再実装する
  - `sidebar.module.css` の import を削除し、Tailwind で固定 Sidebar（PC 275px / タブレット 70px アイコンのみ）を再現する
  - `glass-card`, `text-neon-primary`, `text-neon-accent`, `btn btn-accent` を削除し、`bg-background`, `border-border`, shadcn Button を使用する
  - 既存メニュー IA・ログイン状態分岐・アクティブ判定（`nav-active.ts`）・`data-testid` を維持する
  - アカウントポップアップを shadcn DropdownMenu + Separator で再実装し、`sidebar-profile-btn` / `sidebar-settings-link` を維持する
  - アクティブリンクの `class` に `active` 部分文字列を含める
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 5.1, 5.2, 5.3, 5.4, 5.5, 6.4, 6.5_
  - _Boundary: Sidebar_
  - _Depends: 2.1_

---

## 4. Core: Header と BottomNav の並列移行
- [x] 4.1 (P) Header を shadcn 標準スタイルで再実装する
  - `header.module.css` の import を削除し、767px 以下のみ表示する Tailwind Header を実装する
  - プロフィールポップアップを DropdownMenu で再実装し、既存 `data-testid`（`header-profile-btn`, `header-profile-popup`, `header-nav-lists`, `header-nav-my-quiz`, `header-settings-link`, `mobile-header-create-btn`）を維持する
  - 768px 以上および `/play` パスでは Header を非表示にする
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.5, 6.5_
  - _Boundary: Header_
  - _Depends: 3.1_

- [x] 4.2 (P) BottomNav を shadcn 標準スタイルで再実装する
  - `bottom-nav.module.css` の import を削除し、下部固定 60px の Tailwind BottomNav を実装する
  - ログイン/未ログインの表示分岐と全 `data-testid` を維持する
  - `nav-active.ts` によるホーム/検索アクティブ表示と `active` クラス E2E 互換を維持する
  - `/play` パスでは BottomNav を非表示にする
  - _Requirements: 1.3, 3.5, 3.6, 3.7, 3.8, 5.1, 5.2, 5.3, 5.4, 5.5, 6.4_
  - _Boundary: BottomNav_
  - _Depends: 3.1_

---

## 5. Integration: レガシー削除と単体テスト更新
- [x] 5.1 シェル関連 CSS Modules を削除する
  - `layout-wrapper.module.css`, `sidebar.module.css`, `header.module.css`, `bottom-nav.module.css` を削除する
  - `src/components/layout/` 配下に `.module.css` が残っていないことを確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 6.1_
  - _Depends: 4.1, 4.2_

- [x] 5.2 layout-wrapper 単体テストを更新する
  - `tests/components/layout-wrapper.test.tsx` が Tailwind 移行後も `/play` 分岐と子コンポーネント描画を検証することを確認する
  - 必要に応じてモックやアサーションを更新し `npm run test` がパスすることを確認する
  - _Requirements: 7.2_
  - _Depends: 5.1_

---

## 6. Validation: ビルド・E2E 回帰とテーマ視認性確認
- [x] 6.1 ビルド・lint・Jest の回帰を確認する
  - `npm run build`、`npm run lint`、`npm run test` を順に実行し全て成功することを確認する
  - 本スペック変更に起因する新規 lint エラーがないことを確認する
  - _Requirements: 7.2, 7.3_
  - _Depends: 5.2_

- [x] 6.2 Playwright layout E2E とテーマ視認性を確認する
  - `npm run test:e2e -- e2e/layout.spec.ts` を実行し全 7 ケースがグリーンであることを確認する
  - ライト/ダーク両テーマで Sidebar・Header・BottomNav のコントラストとアクティブ状態の視認性をブラウザで確認する
  - _Requirements: 1.1, 1.2, 1.3, 5.2, 5.3, 5.4, 7.1, 7.4_
  - _Depends: 6.1_

- [x]* 6.3 シェルコンポーネントのスモークレンダリングテストを追加する
  - Sidebar / Header / BottomNav を `useAuth` モック付きで mount し、ログイン・未ログイン双方でエラーなく描画されるテストを追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 2.2, 3.5_
  - _Depends: 6.1_
