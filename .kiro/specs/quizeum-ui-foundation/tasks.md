# Implementation Plan

## 1. Foundation: ビルドパイプラインとスタイル基盤のセットアップ
- [x] 1.1 Tailwind CSS と PostCSS の依存関係・設定を追加する
  - `tailwindcss`, `@tailwindcss/postcss`, `postcss` を devDependencies に追加する
  - プロジェクトルートに `postcss.config.mjs` を作成し `@tailwindcss/postcss` プラグインを登録する
  - `npm run build` が PostCSS エラーなく完了することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: BuildPipeline_

- [x] 1.2 shadcn/ui を CLI デフォルト設定で初期化する
  - `npx shadcn@latest init` を Next.js 16 + TypeScript + App Router 向けに実行する
  - `components.json` を生成し、`style: new-york`（または default）、`baseColor: neutral`（または zinc）、`cssVariables: true` を設定する
  - `src/lib/utils.ts` に `cn()` ユーティリティが生成されることを確認する
  - _Requirements: 1.1, 4.2, 4.4_
  - _Boundary: BuildPipeline, CnUtility_
  - _Depends: 1.1_

- [x] 1.3 globals.css を shadcn テンプレートに置換し移行期 legacy を共存させる
  - `src/app/globals.css` を shadcn テンプレート（`@import "tailwindcss"`、CSS 変数、base layer）に置換する
  - 末尾に `@import "../styles/variables.css"` を残し未移行 CSS Modules の旧トークン参照を維持する
  - body gradient、glass-card ユーティリティ、Outfit Google Fonts import を削除する
  - `npm run build` 成功時に新 CSS 変数（`--background` 等）がバンドルに含まれることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 5.1, 5.2_
  - _Boundary: GlobalsStyles_
  - _Depends: 1.2_

---

## 2. Core: テーマブリッジとフォント統合
- [x] 2.1 テーマ DOM 適用を dark クラス + data-theme dual bridge に移行する
  - `src/lib/theme.ts` に `applyThemeToDocument(theme)` を追加し、`dark` クラスと `data-theme` 属性を同時設定する
  - `getThemeInitScript()` を dual bridge ロジックに更新する
  - `src/context/theme-context.tsx` の `applyThemeToDom` を共有ヘルパー経由に変更する
  - `localStorage` キー `quizetika-theme` と `DEFAULT_THEME = 'dark'` を維持する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - _Boundary: ThemeBridge_
  - _Depends: 1.3_

- [x] 2.2 Geist フォントを layout に統合する
  - `next/font` で Geist Sans / Geist Mono を `src/app/layout.tsx` に追加する
  - `globals.css` のフォント変数を Geist に合わせ、Outfit 依存を撤廃する
  - ブラウザでページ読み込み時に Geist フォントが適用されていることを確認する
  - _Requirements: 2.5_
  - _Boundary: GlobalsStyles_
  - _Depends: 1.3_

- [x] 2.3 テーマブリッジと cn() の単体テストを追加する
  - `tests/lib/theme.test.ts` に `applyThemeToDocument` の dark/light DOM 適用テストを追加する
  - `tests/lib/utils.test.ts` に `cn()` の結合・競合解決テストを新設する
  - `npm run test` が全パスすることを確認する
  - _Requirements: 3.3, 3.5, 3.6, 4.2, 6.2_
  - _Boundary: ThemeBridge, CnUtility_
  - _Depends: 2.1, 1.2_

---

## 3. Core: shadcn プリミティブの追加

### Primitive Wave 1
- [x] 3.1 (P) Button と Input プリミティブを追加する
  - `npx shadcn@latest add button input` で `src/components/ui/button.tsx` と `input.tsx` を生成する
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` がプリミティブ追加後も成功することを確認する
  - _Requirements: 4.1, 4.3, 4.4_
  - _Boundary: ShadcnPrimitives_
  - _Depends: 1.2_

- [x] 3.2 (P) Dialog と Tabs プリミティブを追加する
  - `npx shadcn@latest add dialog tabs` で `src/components/ui/dialog.tsx` と `tabs.tsx` を生成する
  - 必要な `@radix-ui/react-dialog` と `@radix-ui/react-tabs` 依存が package.json に追加されることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 4.1, 4.3, 4.4_
  - _Boundary: ShadcnPrimitives_
  - _Depends: 1.2_

- [x] 3.3 (P) Skeleton、Badge、Card プリミティブを追加する
  - `npx shadcn@latest add skeleton badge card` で 3 コンポーネントを生成する
  - 既存 `skeleton-card.tsx` 等とのファイル名衝突がないことを確認する
  - Card コンポーネントが shadcn デフォルトの border + shadow スタイルを持つことを確認する
  - _Requirements: 2.4, 4.1, 4.3, 4.4_
  - _Boundary: ShadcnPrimitives_
  - _Depends: 1.2_

### Primitive Wave 2

- [x] 3.4 (P) Form・Label・Textarea プリミティブを追加する
  - `npx shadcn@latest add form label textarea` で `src/components/ui/` に 3 コンポーネントを生成する
  - `react-hook-form` と `@hookform/resolvers` 依存が package.json に追加されることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 4.2, 4.5, 4.6_
  - _Boundary: ShadcnPrimitivesWave2_
  - _Depends: 3.1, 3.2, 3.3_

- [x] 3.5 (P) Select・Switch・RadioGroup・ToggleGroup プリミティブを追加する
  - `npx shadcn@latest add select switch radio-group toggle-group` で 4 コンポーネントを生成する
  - 必要な Radix 依存が package.json に追加されることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 4.2, 4.5, 4.6_
  - _Boundary: ShadcnPrimitivesWave2_
  - _Depends: 3.4_

- [x] 3.6 (P) Table・Alert・Accordion・Progress・Popover プリミティブを追加する
  - `npx shadcn@latest add table alert accordion progress popover` で 5 コンポーネントを生成する
  - `npm run build` が成功することを確認する
  - _Requirements: 4.2, 4.5, 4.6_
  - _Boundary: ShadcnPrimitivesWave2_
  - _Depends: 3.4_

- [x] 3.7 (P) AlertDialog・Chart プリミティブを追加する
  - `npx shadcn@latest add alert-dialog chart` で `alert-dialog.tsx` と `chart.tsx` を生成する
  - `recharts` 依存が package.json に追加されることを確認する
  - `npm run build` が Chart 追加後も成功することを確認する
  - _Requirements: 4.2, 4.5, 4.6_
  - _Boundary: ShadcnPrimitivesWave2_
  - _Depends: 3.4_

- [x] 3.8 (P) Avatar・DropdownMenu・Separator プリミティブを追加する
  - `npx shadcn@latest add avatar dropdown-menu separator` で 3 コンポーネントを生成する
  - layout-shell が消費するシェル用プリミティブとして `src/components/ui/` に配置されることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 4.2, 4.5, 4.6_
  - _Boundary: ShadcnPrimitivesWave2_
  - _Depends: 3.4_

---

## 4. Integration: 方針更新と統合確認
- [x] 4.1 steering 文書のスタイリング方針を更新する
  - `.kiro/steering/tech.md` の「TailwindCSSは使用しません」条項を Tailwind CSS + shadcn/ui 採用に改定する
  - `.kiro/steering/structure.md` のスタイル配置記述（globals.css、components/ui）を新基盤に合わせて更新する
  - steering 更新後、後続スペックが Tailwind 禁止条項を撤廃可能な状態になっていることを確認する
  - _Requirements: 7.1, 7.2, 7.3_
  - _Boundary: SteeringDocs_
  - _Depends: 1.3_

- [x] 4.2 既存ページの DOM 構造と Provider ツリーを維持した統合確認を行う
  - `layout.tsx` の Provider 順序（PostHog → Auth → Theme → LayoutWrapper）が変更されていないことを確認する
  - 既存ルート（`/`, `/settings` 等）の `data-testid` 属性が変更されていないことを確認する
  - 未移行ページが CSS Modules 付きで引き続き描画されることをブラウザで確認する
  - _Requirements: 5.3, 6.3_
  - _Boundary: ThemeBridge, GlobalsStyles_
  - _Depends: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

---

## 5. Validation: ビルド・テスト回帰確認
- [x] 5.1 ビルド・lint・Jest の回帰を確認する
  - `npm run build`、`npm run lint`、`npm run test` を順に実行し全て成功することを確認する
  - 本スペック追加ファイルに起因する新規 lint エラーがないことを確認する
  - _Requirements: 1.1, 1.3, 6.2_
  - _Depends: 4.2_

- [x] 5.2 既存 Playwright E2E スイートの回帰を確認する
  - `npm run test:e2e` を実行し既存スイートがグリーンであることを確認する
  - テーマ切替 E2E（settings spec）が dual bridge 下で通過することを確認する
  - _Requirements: 6.1, 6.3_
  - _Depends: 4.2_

- [x]* 5.3 shadcn プリミティブのスモークレンダリングテストを追加する
  - Button / Input / Card を `@testing-library/react` で mount し、エラーなく描画されることを確認するテストを追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 4.1, 4.3_
  - _Depends: 3.1, 3.3_

## Implementation Notes

- shadcn CLI v4 は `style: base-nova`（neutral）を生成。`form` は registry 未提供のため `field.tsx` + 手動 `form.tsx`（react-hook-form）で提供。
- E2E（5.2）は Firestore Emulator（`npm run emulators`）+ `e2e/global-setup.ts` が必要。ローカル検証は `npx playwright test e2e/layout.spec.ts e2e/user-settings.spec.ts` を emulator 起動後に実行。
