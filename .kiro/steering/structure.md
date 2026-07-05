# プロジェクト構成と設計パターン (Project Structure)

## 構成の基本方針 (Organization Philosophy)

ドメインおよび機能ごとの「機能別垂直分割（Vertical Feature Slicing）」アプローチを採用しています。
共通のインフラやロジック（Supabaseクライアントや共通型）は `src/services` や `src/types` に集約し、各画面やUIモジュールは `src/app` および `src/components` に配置します。

## ディレクトリパターン (Directory Patterns)

### App Router 画面とAPI (App Router & APIs)
**Location**: `/src/app/`  
**Purpose**: 画面のルーティング定義およびAPIエンドポイント。  
**Example**: `/src/app/admin/users/page.tsx` (管理者向けユーザー管理画面), `/src/app/api/verify-truth/route.ts` (ウミガメの合格判定API)。

### 共通レイアウト (Shared Layout)
**Location**: `/src/components/layout/`  
**Purpose**: 全画面共通のレスポンシブナビゲーション。`LayoutWrapper` が `/play` パスを除き Sidebar（PC/タブレット）・Header（モバイルミニ）・BottomNav（モバイル）を組み立て、`layout.tsx` から `AuthProvider` 配下で利用する。  
**Example**: `/src/components/layout/layout-wrapper.tsx`, `/src/components/layout/sidebar.tsx`, `/src/components/layout/bottom-nav.tsx`。

### UIコンポーネント (UI Components)
**Location**: `/src/components/`  
**Purpose**: アプリケーション全体で再利用されるUIコンポーネント。再利用可能なUI部品（`/src/components/ui/`）と機能ドメイン別（`quiz/`, `bookmark/`, `profile/`, `explore/`, `charts/`, `sorting/`, `pricing/`, `quiz-list/`, `markdown/`, `ads/` 等）に分かれます。  
**Example**: `/src/components/ui/skeleton-card.tsx`, `/src/components/ui/infinite-scroll-loader.tsx`（共通無限スクロールローダー）、`/src/components/quiz/quiz-dual-leaderboard.tsx`、`/src/components/ads/adsense-inline-ad.tsx`（インライン広告枠）、`/src/components/explore/genre-nav.tsx`（ジャンルナビ）、`/src/components/charts/analytics-chart.tsx`（クリエイター統計）。

### サービス・ビジネスロジック (Services)
**Location**: `/src/services/`  
**Purpose**: Supabase とのやり取りや、共通のビジネスロジック。  
**Example**: `/src/services/user.ts`, `quiz.ts`, `/src/services/reputation.ts`（信頼スコアリセットやモデレータティアー処理）。

### 型定義 (Types)
**Location**: `/src/types/`  
**Purpose**: アプリケーション全体で共有される共通のデータ型・インターフェースの定義。  
**Example**: `/src/types/quiz.ts` (クイズ、リーダーボードの型)。

### 純関数ライブラリ (Pure Logic Libraries)
**Location**: `/src/lib/`  
**Purpose**: UIに依存しない表示ヘルパー、セッション状態、検証・フィルタ等の純関数。サービス層のビジネスロジックとは分離し、コンポーネントやフックから呼び出す。バックエンド初期化は `/src/lib/supabase/`（クライアント `client.ts`、サーバー `server.ts`、ミドルウェア `middleware.ts`、認証 `auth.ts` / `auth-verify.ts`、生成型 `database.types.ts`）に集約する。XSS サニタイズは `/src/lib/security/`。Stripe サーバークライアントは `/src/lib/stripe/server.ts` に集約（クライアントバンドルへの秘密鍵漏洩を防止）。  
**Example**: `/src/lib/profile-list-display.ts`（リスト種別ラベル）、`/src/lib/question-list-session.ts`（問題リストプレイ進行）、`/src/lib/metadata-resolution.ts`（Supabase 移行済みのジャンル/タグ正規化）、`/src/lib/billing-client.ts`（Stripe Checkout クライアント）。

### React コンテキスト (Context)
**Location**: `/src/context/`  
**Purpose**: 認証状態・ユーザープロファイル・BAN 検知などアプリ横断のクライアント状態。ミドルウェア Cookie 同期（`syncMiddlewareAuthCookies`）と組み合わせて二重防御を構成。  
**Example**: `/src/context/auth-context.tsx`。

### ルートガード (Middleware)
**Location**: `/src/middleware.ts`  
**Purpose**: 管理者・モデレーター向けルートの一次フィルタ（Cookie ベース）。BAN ユーザーは `quizetika_banned` Cookie により `/banned` へリダイレクト。実際の認可は API Route / Supabase RLS で再検証する。

### カスタムフック (Custom Hooks)
**Location**: `/src/hooks/`  
**Purpose**: データ取得・検索・プレイ状態など、コンポーネント横断の React ステートと副作用。  
**Example**: `/src/hooks/useBookmarkFeed.ts`, `/src/hooks/useQuestionAttachSearch.ts`, `/src/hooks/useAds.ts`（広告制御）。

### スタイル定義 (Styles)
**Location**: `/src/app/globals.css`（Tailwind + shadcn テーマ）、`/src/styles/variables.css`（移行期 legacy トークン）、`/src/components/ui/`（shadcn プリミティブ）、各コンポーネント隣の CSS Modules（未移行ドメイン）  
**Purpose**: `globals.css` が Tailwind CSS v4 と shadcn CSS 変数の正。`variables.css` は未移行 CSS Modules 向け legacy トークン（全スライス完了後に削除予定）。新規 UI は shadcn プリミティブ + Tailwind。未移行コンポーネントは CSS Modules を継続利用。  
**Example**: `/src/app/globals.css`, `/src/lib/utils.ts`（`cn()`）, `/src/components/ui/button.tsx`, `/src/styles/variables.css`。

### テスト (Tests)
**Location**: `/tests/`（Jest）、`/e2e/`（Playwright）  
**Purpose**: `tests/` は `src/` の構造をミラー（`tests/services/`, `tests/components/` 等）。Supabase は `@/lib/supabase/client` を `jest.mock()` したチェーンモックで検証する。E2E は `e2e/*.spec.ts` に機能ドメイン別に配置。  
**Example**: `/tests/services/reputation.test.ts`, `/e2e/layout.spec.ts`。

### 静的テストデータ (Static Test Data)
**Location**: `/src/data/`  
**Purpose**: シードスクリプトから参照される要書データ（初期ジャンル・テストデータ）。本番ビルドには含まれず、スクリプトからのみ読み込まれる。  
**Example**: `/src/data/initial_genres.json`。

### 仕様と記憶 (Kiro Metadata)
**Location**: `/.kiro/`  
**Purpose**: 設計仕様（`specs/`）やプロジェクトメモリであるステアリング（`steering/`）を管理するディレクトリ。

## 命名規則 (Naming Conventions)

- **React コンポーネントファイル**: kebab-case（例: `quiz-card.tsx`, `layout-wrapper.tsx`）
- **ロジック・ヘルパー・サービスファイル**: kebab-case（例: `quiz-validation.ts`）
- **コンポーネント関数**: PascalCase（例: `export function QuizCard() {}`）
- **変数・通常の関数**: camelCase（例: `resetUserReputation`）
- **CSS Modules ファイル**: `[component-name].module.css`（対応コンポーネントと同じ kebab-case ベース名）

## インポート構成 (Import Organization)

エイリアス `@/*` を用いた絶対パスインポートを最優先とします。

```typescript
// 外部・システムモジュール
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// サービス・ビジネスロジック (絶対パス)
import { resetUserReputation } from '@/services/reputation';

// コンポーネント (絶対パス)
import { SkeletonCard } from '@/components/ui/skeleton-card';

// 相対パスは同一ディレクトリ内または非常に近い階層でのみ使用
import { LocalComponent } from './LocalComponent';
```

**パスエイリアス**:
- `@/*`: `/src/*` にマッピングされています。

## コード設計原則 (Code Organization Principles)

- **単一責任の原則**: サービス（例: `reputation.ts`）はデータ操作と検証ロジックに集中し、UIのステートやプレゼンテーションに関与しないようにします。
- **UIとの境界分離**: コンポーネント側はUI表現とユーザーインタラクションに徹し、ビジネスロジックやデータフェッチの詳細は `services` 側のAPIやフックを呼び出す形に疎結合化します。

---
_updated_at: 2026-07-05 — supabase-cleanup 完了に伴い /src/lib/firebase/ 併存記述を除去し Supabase 単独構成に更新_

_Document patterns, not file trees. New files following patterns shouldn't require updates_
