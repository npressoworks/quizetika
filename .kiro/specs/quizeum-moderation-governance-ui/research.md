# Gap & Discovery Analysis: quizetika-moderation-governance-ui

## Analysis Summary

- **スコープ**:
  - Phase 6 (ジャンルアイコンSVG禁止): 実装完了。
  - **管理者ジャンル直接追加機能**: システム管理者がコミュニティ投票を介さずにジャンルを直接新設・管理できる専用のUI `/admin/genres` および API ルート `/api/admin/genres` を実装する。
  - **管理者メニューポータル画面**: 各管理者用画面（モデレーション審査、ユーザー評判管理、ジャンル直接管理）への相互導線を集約した共通ランディングページ `/admin` を実装する。
  - **ジャンル画像のローカル保存化 (2026-06-18 追加)**: ジャンルアイコン画像および一時画像の保存先を Firebase Storage からローカルファイルシステム（`assets/genre/`）へ変更し、エミュレータバケットエラーを解消してファイル管理を簡素化する。
- **最大ギャップ**:
  - 現在、ジャンルの追加は `src/app/api/admin/seed-genres` による一括シード投入のみで、任意の個別ジャンルを管理画面から追加する機能およびAPIが存在しない（本スペックで解決済み）。
  - 管理者機能的ルートパス `/admin` にアクセスした際、ランディングページが存在しないため 404 となる。
  - すべてのジャンルアイコンアップロードおよびAI生成画像が Firebase Storage に直接アップロードされるようになっており、ローカル環境でのバケット未存在エラーが発生する。
- **推奨アプローチ**:
  - 新規画面 `/admin/genres` を構築し、Tailwind CSS + shadcn/ui を採用する。
  - 新規画面 `/admin/page.tsx` をサーバーコンポーネント（RSC）として構築し、静的フレームを描画し、3つの管理者用サブページへの遷移カードを提供する。
  - 新規 API エンドポイント `/api/admin/genres` を作成する（実装完了）。
  - ローカルアセット配信 API `/api/assets/genre/[...path]` を新設し、`assets/genre/` からアセットを読み出して配信する。
  - クライアント用ローカルアップロード API `/api/genres/upload-icon` を新設し、AI生成と手動アップロードの両方をローカル一時領域 `assets/genre/temp/` に一度保存した上で、共通の移行ロジックを用いて正式ディレクトリに移行する構造へ統一する。

---

## 1. Research Log (管理者ジャンル直接追加機能 & ローカル保存化)

### [Topic] ジャンル直接追加の書き込み経路（クライアント直接 vs サーバーAPI）
- **Context**: Firestore Security Rules では `canWriteMetadataGenres()` が定義されており、管理者/モデレーターはクライアントサイドから直接 `metadata_genres` コレクションへ書き込み可能であるが、どちらを採用すべきか。
- **Sources Consulted**: `firestore.rules`, `src/app/api/admin/seed-genres/route.ts`
- **Findings**:
  - クライアント直接書き込みの場合、一意性（重複ID）の検証を Firestore トランザクションまたはルールで厳密に行う必要があるが、クライアント側だけでの制御は不具合時のデータ破壊リスクがある。
  - 既存の `seed-genres` API や `users` 管理 API はサーバーサイドの Next.js API Route と Firebase Admin SDK を利用している。
- **Implications**:
  - サーバーサイド API `/api/admin/genres` (GET / POST) を新設し、管理者認可チェックを施した上で Admin SDK で `metadata_genres` に書き込むアプローチを採用する。これにより、一意性チェックや監査性の高いデータバリデーションをサーバー側で一元化できる。

### [Topic] AIジャンルアイコン生成 API の設計と生成制限
- **Context**: ジャンルアイコン画像を Gemini (Imagen) API を使って生成する際の API 設計、保存先、および生成制限の適用。
- **Sources Consulted**: `src/app/api/quiz/ai-generate-thumbnail/route.ts`, `src/services/ai-authoring-utils.ts`
- **Findings**:
  - 既存の作問用画像生成APIは `gemini-2.5-flash-image` を使用しており、ユーザーが送信したタイトルと説明からプロンプトを構築して画像（PNG）を生成。
  - 生成した画像は Admin SDK の `uploadQuizCoverBuffer` で Storage に保存されている。
  - 一般ユーザーに対する画像生成の回数制限は Firestore のトランザクションを用いて1日あたりの回数をカウント・検証している。
- **Implications**:
  - ジャンル用にも同様に、Gemini を呼び出す新規 API `/api/genres/generate-icon` を追加。
  - 入力パラメータは `displayName` (表示名) と `description` (説明文)。
  - 生成制限：一般ユーザー（申請画面）には1日5回のデイリー制限を適用。管理者には制限をかけない。制限数は `users/{uid}/authoring_limits/genre-icon` でトラッキングする。

### [Topic] ローカルアセットの保存と配信経路の設計
- **Context**: Firebase Storage を使わず、ローカルの `assets/genre/` に画像を保存する場合、Webアプリから画像をどのように配信・参照するか。
- **Sources Consulted**: Next.js App Router 配信ドキュメント
- **Findings**:
  - Next.js でプロジェクトルートにある `assets/` は自動配信されないため、配信用の API Route を構築する必要がある。
  - GET `/api/assets/genre/[...path]` を作成し、ファイル名をパラメータとして受け取って `fs.readFileSync` で読み込み、`Content-Type` を設定してレスポンスを返すことで、通常の画像 URL（`/api/assets/genre/math-science/icon_123.png`）として配信可能。
- **Implications**:
  - 配信 API Route `/api/assets/genre/[...path]` を実装する。また、一時的な画像は `/api/assets/genre/temp/{uid}_{timestamp}.png` として配信する。これによりフロントエンドのプレビュー表示などがスムーズに行える。

### [Topic] クライアント画像アップロードのローカル保存対応
- **Context**: フロントエンドUIで手動選択されたファイルをローカルに保存するためのアップロード経路。
- **Sources Consulted**: Next.js API Routes (Request FormData)
- **Findings**:
  - Next.js 13+ では `request.formData()` を使ってマルチパートフォームのファイルデータを容易にパースできる。
  - 新設する POST `/api/genres/upload-icon` でファイルを受け取り、サイズや MIME バリデーション後に `assets/genre/temp/` 配下に保存する。
- **Implications**:
  - 手動アップロードもAI生成と同様に「一時フォルダに保存し、一時URLを返す」という仕様に統一することで、フロント側のプレビュー処理や、保存・申請確定時の移行処理（正式フォルダへのコピー＆一時ファイル削除）を完全に同一ロジックに集約できる。

---

## 2. Design Decisions

### Decision: 新規画面 `/admin/genres` のUIスタックと構成
- **Context**: 新画面の UI 実装におけるスタイリングとコンポーネント選択。
- **Selected Approach**: Tailwind CSS + shadcn/ui を採用し、`src/components/ui/` の Card, Button, Input, Table, Label などを利用する。
- **Rationale**: 既存の管理者画面はすでに shadcn/ui と Tailwind に完全に移行されており、一貫したルック＆フィール（プレミアムなデザイン）を保つために同一スタックを利用する。

### Decision: ジャンルの一意性チェック
- **Context**: 既存のジャンル ID が重複した状態での登録を防ぐ。
- **Selected Approach**: API POST リクエスト処理内で、送信された `id` を持つドキュメントが `metadata_genres` コレクションに存在するかどうかを `get()` でチェックする。
- **Rationale**: 存在する場合は 409 Conflict レスポンスを返し、フロントエンドで「このジャンルIDはすでに登録されています」とエラー表示することで、重複登録を防ぐ。

### Decision: 管理者メニューポータル画面（/admin）のUI構成
- **Context**: 管理者パス（`/admin`）アクセス時に、統一されたナビゲーションメニューを提供する。
- **Selected Approach**: `src/app/admin/page.tsx` をサーバーコンポーネント（RSC）および一部クライアントサイドガードを併用した構造で新規作成し、3つの管理者用サブページ（モデレーション審査、ユーザー管理、ジャンル直接管理）へリンクするカード型ナビゲーションUIを採用する。

### Decision: AIアイコン生成 API の分離と制限の実装
- **Context**: AI画像生成の処理フローと制限管理。
- **Selected Approach**: 新規 API `/api/genres/generate-icon` を追加し、一般ユーザー向けに1日5回のデイリー制限を適用し、管理者ユーザーは制限フリーとする。
- **Rationale**: ジャンルアイコンに適した専用のプロンプトの構築や、クイズ画像生成枠とは独立した生成制限ポリシーを適用するため。

### Decision: ローカルアセット配信 API (/api/assets/genre/[...path]) の導入
- **Context**: Firebase Storage 廃止に伴うローカル画像配信。
- **Selected Approach**: GET `/api/assets/genre/[...path]` API Route を構築し、`assets/genre/` ディレクトリから静的ファイルを動的読み込みしてバイナリ配信する。
- **Rationale**: シンボリックリンクの構築や外部アセットサーバーの準備なしに、Next.js単体でローカルに書き込まれたアセットを誰でも安全かつ即座に参照可能にするため。

### Decision: アップロードフローの統一 (upload-icon API の新設)
- **Context**: クライアントからの手動アップロード画像とAI生成画像のライフサイクル管理。
- **Selected Approach**: POST `/api/genres/upload-icon` を新設し、手動画像ファイルをローカル一時領域 `assets/genre/temp/` に保存する。
- **Rationale**: これにより手動アップロード画像も、AI生成画像（`generate-icon`）と同様に一時URLがフロントエンドに返却されるようになり、最終登録処理（直接追加 or 申請確定）の時点で正式フォルダ（`assets/genre/{genreId}/icon_{timestamp}.png`）へとコピー・リネーム移行される共通のサーバーサイド処理に一元化できる。

---

## 3. Risks & Mitigations

- **不正アクセス（権限リーク）**: 一般ユーザーが管理者用 API に直接アクセスするリスク。
  - *対策*: UI側ガードに加え、API側で Firebase ID Token を検証し、対象ユーザーが管理者ロールを所有しているかデータベースから取得して検証（二重検証）。
- **SVG形式によるXSS脆弱性 (SEC-08)**:
  - *対策*: フロントエンドの画像選択時に `validateGenreIconFile` で MIME タイプを検証し、SVGを弾く。また、API 登録段階（`upload-icon`）でファイル拡張子が不適切な場合はエラーとする。
- **Gemini API 呼び出しの乱用によるコスト急増リスク**:
  - *対策*: サーバー側で UID に基づくデイリー生成制限（1日5回）を厳密にチェックする（管理者は制限フリー）。
- **ローカルファイル書き込み・読み込み時のディレクトリトラバーサル脆弱性**:
  - *リスク*: リクエストに含まれるファイルパスやジャンルIDに `..` などの相対パス文字列が含まれていた場合、サーバー上の任意のシステムファイルを上書き・漏洩されるリスク。
  - *対策*: ジャンルIDおよびファイルパスに対して、英数字・ハイフン・ドット・アンダースコアのみを許容する正規表現（`^[a-z0-9-]+$` 等）を用いてサーバーサイドで厳密なサニタイズ・検証を実行する。
- **サーバー再起動時のローカルアセット永続化リスク**:
  - *リスク*: コンテナ環境などにおいて、サーバー再起動や再デプロイ時に `assets/genre/` ディレクトリ配下の画像が消失する可能性。
  - *対策*: 要件ドキュメント内の Adjacent expectations に「ローカル保存された画像ファイルの永続化やパス解決はホスト・インフラ環境に依存する」ことを明記し、開発環境ではローカルファイル、本番環境では永続ボリューム（PV）のマウント等を前提とする。

---

## 4. References
- [src/lib/genre-icon-upload.ts](file:///d:/quizetika/src/lib/genre-icon-upload.ts) — ジャンルアイコン用共通バリデーションロジック
- [src/services/storage.ts](file:///d:/quizetika/src/services/storage.ts) — 旧ジャンルアイコン保存先パス決定ロジック

---

## 5. Phase 39: NGワードマスタ管理画面（2026-07 軽量ディスカバリー）

### Extension Point Analysis
- **既存パターン**: `AdminGenresPage`（`src/app/admin/genres/page.tsx` + `admin-genres-client.tsx`）が「一覧取得 + 追加フォーム + 即時反映」の確立済みパターンを持つ。NGワード管理はこのパターンをそのまま踏襲できる（画像アップロードが不要な分、むしろ単純）。
- **admin ポータル**: `src/app/admin/page.tsx` は既に3枚のナビゲーションカード（モデレーション審査／ユーザー評判管理／ジャンル直接管理）を持つサーバーコンポーネントであり、4枚目のカード追加は既存パターンの機械的拡張で対応可能。
- **依存関係**: NGワードのCRUDロジック自体（重複検知・DB書き込み）は `supabase-governance` の `ngWords.ts`／RPC が所有するため、本スペックはAPI Routeでの薄いブリッジ（認証確認 + `ngWords.ts` 呼び出し + レスポンス整形）のみを担当する。既存の `admin-genres API` が Firestore（現状はSupabase）への直接書き込みを行っているのとは異なり、NGワード管理APIはサービス層への委譲に留まる薄い実装になる。

### Dependency Check
- 新規外部ライブラリの追加は不要。既存の `useAuth`、Tailwind/shadcn コンポーネントをそのまま再利用する。

### Integration Risk Assessment
- **既存機能への影響**: 新規ページ・新規APIルートの追加のみで、既存の `AdminGenresPage` や他の管理画面には影響しない。
- **画像処理系との違い**: ジャンル管理で必要だったローカルファイルアップロード・ディレクトリトラバーサル対策（Risks & Mitigations 参照）は、NGワードがテキストのみのためそのまま持ち込む必要はない（Non-Goals として明記済み）。

## Design Decisions（Phase 39 追記）

### Decision: NGワード管理画面を `AdminGenresPage` と同型のページ + クライアントコンポーネント構成にする
- **Context**: 新規CRUD管理画面を実装するにあたり、ゼロから設計するか既存パターンを踏襲するか検討した。
- **Alternatives Considered**:
  1. 汎用的な「マスタデータ管理」コンポーネントを新設し、ジャンル管理・NGワード管理の両方から再利用する。
  2. `AdminGenresPage` と同型の独立したページ + クライアントコンポーネントとして実装する。
- **Selected Approach**: 案2を採用。
- **Rationale**: 現時点でマスタ管理UIは「ジャンル」「NGワード」の2種類のみであり、両者はフィールド構成（画像の有無等）が異なる。汎用化は将来3種類目のマスタが必要になった時点で再検討すべきであり、今の段階での抽象化は投機的（Simplification原則）。
- **Trade-offs**: 若干のコード重複（一覧表示・フォーム送信のボイラープレート）が生じるが、既存の `AdminGenresPage` の実装から逸脱しないため学習コストが低い。
- **Follow-up**: なし。

## Risks & Mitigations（Phase 39 追記）
- **NGワード一覧の外部露出** — `ng_words` の SELECT を全ユーザーに許可する設計（`supabase-governance` 側RLS）のため、NGワード一覧がAPI経由で取得可能になる。既存のハードコード配列も元々クライアントバンドルに含まれていたため、露出度は同等以下と判断（[[Design Decisions]] は `supabase-governance/research.md` 側にも記録）。
