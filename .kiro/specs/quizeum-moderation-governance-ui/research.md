# Gap & Discovery Analysis: quizeum-moderation-governance-ui

## Analysis Summary

- **スコープ**:
  - Phase 6 (ジャンルアイコンSVG禁止): 実装完了。
  - **管理者ジャンル直接追加機能**: システム管理者がコミュニティ投票を介さずにジャンルを直接新設・管理できる専用のUI `/admin/genres` および API ルート `/api/admin/genres` を実装する。
  - **管理者メニューポータル画面 (2026-06-18 追加)**: 各管理者用画面（モデレーション審査、ユーザー評判管理、ジャンル直接管理）への相互導線を集約した共通ランディングページ `/admin` を実装する。
- **最大ギャップ**:
  - 現在、ジャンルの追加は `src/app/api/admin/seed-genres` による一括シード投入のみで、任意の個別ジャンルを管理画面から追加する機能およびAPIが存在しない（本スペックで解決済み）。
  - 管理者機能的ルートパス `/admin` にアクセスした際、ランディングページが存在しないため 404 となる。
- **推奨アプローチ**:
  - 新規画面 `/admin/genres` を構築し、Tailwind CSS + shadcn/ui を採用する。
  - 新規画面 `/admin/page.tsx` をサーバーコンポーネント（RSC）として構築し、静的フレームを描画し、3つの管理者用サブページへの遷移カードを提供する。
  - 新規 API エンドポイント `/api/admin/genres` を作成する（実装完了）。

---

## 1. Research Log (管理者ジャンル直接追加機能)

### [Topic] ジャンル直接追加の書き込み経路（クライアント直接 vs サーバーAPI）
- **Context**: Firestore Security Rules では `canWriteMetadataGenres()` が定義されており、管理者/モデレーターはクライアントサイドから直接 `metadata_genres` コレクションへ書き込み可能であるが、どちらを採用すべきか。
- **Sources Consulted**: `firestore.rules`, `src/app/api/admin/seed-genres/route.ts`
- **Findings**:
  - クライアント直接書き込みの場合、一意性（重複ID）の検証を Firestore トランザクションまたはルールで厳密に行う必要があるが、クライアント側だけでの制御は不具合時のデータ破壊リスクがある。
  - 既存の `seed-genres` API や `users` 管理 API はサーバーサイドの Next.js API Route と Firebase Admin SDK を利用している。
- **Implications**:
  - サーバーサイド API `/api/admin/genres` (GET / POST) を新設し、管理者認証チェックを施した上で Admin SDK で `metadata_genres` に書き込むアプローチを採用する。これにより、一意性チェックや監査性の高いデータバリデーションをサーバー側で一元化できる。

---

## 2. Design Decisions

### Decision: 新規画面 `/admin/genres` のUIスタックと構成
- **Context**: 新画面の UI 実装におけるスタイリングとコンポーネント選択。
- **Alternatives Considered**:
  1. Vanilla CSS / CSS Modules — 既存の古い画面で一部使用。
  2. Tailwind CSS + shadcn/ui — ロードマップ Phase 24 の UI 刷新以降の標準スタック。
- **Selected Approach**: Tailwind CSS + shadcn/ui を採用し、`src/components/ui/` の Card, Button, Input, Table, Label などを利用する。
- **Rationale**: 既存の管理者画面（`/admin/moderation`, `/admin/users`）はすでに shadcn/ui と Tailwind に完全に移行されており、一貫したルック＆フィール（プレミアムなデザイン）を保つために同一スタックを利用する。
- **Trade-offs**: CSS Modules よりも再利用性が高く、迅速に構築できる。

### Decision: ジャンルの一意性チェック
- **Context**: 既存のジャンル ID が重複した状態での登録を防ぐ。
- **Selected Approach**: API POST リクエスト処理内で、送信された `id` を持つドキュメントが `metadata_genres` コレクションに存在するかどうかを `get()` でチェックする。
- **Rationale**: 存在する場合は 409 Conflict レスポンスを返し、フロントエンドで「このジャンルIDはすでに登録されています」とエラー表示することで、重複登録を防ぐ。

### Decision: 管理者メニューポータル画面（/admin）のUI構成
- **Context**: 管理者パス（`/admin`）アクセス時に、統一されたナビゲーションメニューを提供する。
- **Selected Approach**: `src/app/admin/page.tsx` をサーバーコンポーネント（RSC）および一部クライアントサイドガードを併用した構造で新規作成し、3つの管理者用サブページ（モデレーション審査、ユーザー管理、ジャンル直接管理）へリンクするカード型ナビゲーションUIを採用する。
- **Rationale**: 各画面へのアクセス制限はすでにミドルウェアおよび各ページコンポーネントで二重防御されている。本ランディングページでは、それらの管理機能を美しくカードUI（Lucideアイコン付き）として整理し、管理者の操作体験を大きく向上させる。
- **Trade-offs**: 完全なクライアントサイドガードのためのラッパーを利用し、非管理者時には `/not-found` へリダイレクトする。


---

## 3. Risks & Mitigations
- **不正アクセス（権限リーク）**: 一般ユーザーが `/admin/genres` や `/api/admin/genres` に直接アクセスするリスク。
  - *対策*: UI側では `useAuth()` を使用し、`moderationTier !== 'admin'` かつ `role !== 'admin'` の場合は即時 `/not-found` へ遷移するルートガードを実装。API側では Firebase ID Token を検証し、対象ユーザーが管理者ロールを所有しているかデータベースから取得して検証（Defense in depth）。
- **SVG形式によるXSS脆弱性 (SEC-08)**:
  - *対策*: フロントエンドの画像選択時に `validateGenreIconFile` で拡張子およびMIMEタイプを検証し、SVGを完全に弾く。また、API 登録段階でファイル拡張子が不適切な場合はエラーとする。

---

## 4. References
- [firestore.rules](file:///d:/quizeum/firestore.rules#L297-L301) — metadata_genres へのパーミッション定義
- [src/lib/genre-icon-upload.ts](file:///d:/quizeum/src/lib/genre-icon-upload.ts) — ジャンルアイコン用共通バリデーションロジック
- [src/services/storage.ts](file:///d:/quizeum/src/services/storage.ts#L90-L96) — ジャンルアイコン保存先パス決定ロジック
