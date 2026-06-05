# 技術スタックと標準 (Technology Stack)

## アーキテクチャ (Architecture)

Next.js（App Router）によるフルスタックフロントエンドと、Firebase（Auth, Firestore, Storage）のBaaS構成を密に統合したサーバーレスアーキテクチャを採用しています。
一部の重い処理や機密処理は、Next.jsのAPI RoutesやServer Actionsを利用して安全に実行します。

## コア技術 (Core Technologies)

- **Language**: TypeScript (Strict Mode)
- **Framework**: Next.js 16.2.6 (App Router)
- **Runtime**: Node.js 20+
- **Database / Auth**: Firebase 12.13.0 (Firestore, Authentication, Cloud Storage)
- **AI**: Gemini API (`@google/generative-ai` 0.24.1)

## 主要ライブラリ (Key Libraries)

- **UI / Styling**: Vanilla CSS (CSS Modules 等)。TailwindCSSは使用しません。
- **Animations**: Framer Motion 12.40.0
- **Drag & Drop**: @dnd-kit (Core / Sortable)
- **Sanitizer**: Isomorphic DOMPurify (XSS防止のためのHTMLサニタイズ)
- **Icons**: Lucide React

## 開発標準 (Development Standards)

### 型安全性 (Type Safety)
- TypeScriptの `strict` モードを常時有効化します。
- `any` 型の使用は原則禁止とし、未知の入力には `unknown` もしくは厳密な Zod スキーマを使用します。

### コード品質 (Code Quality)
- ESLintによる静的解析をパスする必要があります。
- テストコードにおけるモックやテストプレイ用コードが本番ビルド（Production）に混入しないよう、静的フラグを用いたTree Shakingが機能するように実装します。

### テスト (Testing)
- **サービス・ロジック**: Jest を用いた単体テスト・結合テスト。
- **UI・インタラクション**: Playwright によるE2Eテスト。

## 開発環境 (Development Environment)

### 共通コマンド (Common Commands)
```bash
# ローカル開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# テスト実行
npm run test

# E2Eテスト実行
npm run test:e2e
```

## 主要な技術決定 (Key Technical Decisions)

- **リスト種別の後方互換**: `QuizList.listType`（`quiz` | `question`）は未設定ドキュメントを `quiz` と解釈する `resolveListType()` を型層に集約し、UI・サービスは `list.listType` の直参照を避ける。
- **Vanilla CSSの採用**: UIは独自のプレミアムなデザインシステムを構築するため、TailwindCSSなどの汎用ユーティリティフレームワークは使用せず、柔軟で保守性の高い Vanilla CSS / CSS Modules を使用します。
- **二重検証（Defense-in-Depth）**: フロントエンド（Cookie等）での権限チェックはUX向上のためだけに使用し、実際のデータ更新や操作はFirestoreセキュリティルール（`firestore.rules`）およびサーバーサイドでのトークン検証で厳格に認可します。
- **画像のSVGアップロード禁止**: XSS（スクリプト埋め込み）攻撃を防ぐため、Firebase Storageへの画像アップロード（アイコン含む）は `PNG`, `JPEG`, `GIF` に限定し、セキュリティルールで容量・MIMEタイプを厳格にチェックします。

---
_Document standards and patterns, not every dependency_
