# プロジェクト構成と設計パターン (Project Structure)

## 構成の基本方針 (Organization Philosophy)

ドメインおよび機能ごとの「機能別垂直分割（Vertical Feature Slicing）」アプローチを採用しています。
共通のインフラやロジック（Firebaseや共通型）は `src/services` や `src/types` に集約し、各画面やUIモジュールは `src/app` および `src/components` に配置します。

## ディレクトリパターン (Directory Patterns)

### App Router 画面とAPI (App Router & APIs)
**Location**: `/src/app/`  
**Purpose**: 画面のルーティング定義およびAPIエンドポイント。  
**Example**: `/src/app/admin/users/page.tsx` (管理者向けユーザー管理画面), `/src/app/api/verify-truth/route.ts` (ウミガメの合格判定API)。

### UIコンポーネント (UI Components)
**Location**: `/src/components/`  
**Purpose**: アプリケーション全体で再利用されるUIコンポーネント。再利用可能なUI部品（`/src/components/ui/`）と機能特有のコンポーネントに分かれます。  
**Example**: `/src/components/ui/Button.tsx`, `/src/components/quiz/LeaderboardTable.tsx`。

### サービス・ビジネスロジック (Services)
**Location**: `/src/services/`  
**Purpose**: Firebase（Firestore、Storage、Auth）とのやり取りや、共通のビジネスロジック。  
**Example**: `/src/services/reputation.ts` (信頼スコアリセットやモデレータティアー処理)。

### 型定義 (Types)
**Location**: `/src/types/`  
**Purpose**: アプリケーション全体で共有される共通のデータ型・インターフェースの定義。  
**Example**: `/src/types/quiz.ts` (クイズ、リーダーボードの型)。

### 純関数ライブラリ (Pure Logic Libraries)
**Location**: `/src/lib/`  
**Purpose**: UIに依存しない表示ヘルパー、セッション状態、検証・フィルタ等の純関数。サービス層のビジネスロジックとは分離し、コンポーネントやフックから呼び出す。  
**Example**: `/src/lib/profile-list-display.ts`（リスト種別ラベル）、`/src/lib/question-list-session.ts`（設問リストプレイ進行）。

### カスタムフック (Custom Hooks)
**Location**: `/src/hooks/`  
**Purpose**: データ取得・検索・プレイ状態など、コンポーネント横断の React ステートと副作用。  
**Example**: `/src/hooks/useBookmarkFeed.ts`, `/src/hooks/useQuestionAttachSearch.ts`。

### スタイル定義 (Styles)
**Location**: `/src/app/globals.css`（グローバル）、`/src/styles/`（共有トークン）  
**Purpose**: グローバルスタイルとテーマの CSS 変数。コンポーネント固有スタイルは CSS Modules を各コンポーネント隣に配置。  
**Example**: `/src/app/globals.css`, `/src/styles/variables.css`。

### 仕様と記憶 (Kiro Metadata)
**Location**: `/.kiro/`  
**Purpose**: 設計仕様（`specs/`）やプロジェクトメモリであるステアリング（`steering/`）を管理するディレクトリ。

## 命名規則 (Naming Conventions)

- **React コンポーネントファイル**: PascalCase（例: `QuizCard.tsx`）
- **ロジック・ヘルパー・サービスファイル**: kebab-case（例: `quiz-validation.ts`）
- **コンポーネント関数**: PascalCase（例: `export function QuizCard() {}`）
- **変数・通常の関数**: camelCase（例: `resetUserReputation`）
- **CSS Modules ファイル**: `[ComponentName].module.css` (PascalCaseでコンポーネント名と一致させる)

## インポート構成 (Import Organization)

エイリアス `@/*` を用いた絶対パスインポートを最優先とします。

```typescript
// 外部・システムモジュール
import { useEffect } from 'react';
import { db } from '@/lib/firebase';

// サービス・ビジネスロジック (絶対パス)
import { resetUserReputation } from '@/services/reputation';

// コンポーネント (絶対パス)
import { Button } from '@/components/ui/button';

// 相対パスは同一ディレクトリ内または非常に近い階層でのみ使用
import { LocalComponent } from './LocalComponent';
```

**パスエイリアス**:
- `@/*`: `/src/*` にマッピングされています。

## コード設計原則 (Code Organization Principles)

- **単一責任の原則**: サービス（例: `reputation.ts`）はデータ操作と検証ロジックに集中し、UIのステートやプレゼンテーションに関与しないようにします。
- **UIとの境界分離**: コンポーネント側はUI表現とユーザーインタラクションに徹し、ビジネスロジックやデータフェッチの詳細は `services` 側のAPIやフックを呼び出す形に疎結合化します。

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
