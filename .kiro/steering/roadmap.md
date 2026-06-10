# Roadmap

## Overview
本プロジェクトは、クイズ投稿SNS「quizeum」のUIおよびフロントエンド画面群の実装ロードマップです。画面遷移図（`screen_transition.md`）で定義された21枚の画面を、機能ドメインごとに4つのウェーブ（スペック）に分割し、コアシステム（`quizeum-core`）のロジックやデータモデルと密接に結合しながら段階的に構築します。

## Approach Decision
- **Chosen**: 機能別垂直分割アプローチ (Vertical Feature Slicing)
- **Why**: 画面数および機能要件が非常に多いため、一括作成ではなく、認証・プロフィール、プレイ・探索、クリエイター管理、モデレーションという関連の深い垂直スライスごとに分割して設計・実装・検証を回すことで、手戻りを防止し、着実なデータ結合を行います。
- **Rejected alternatives**: 静的モックファースト（水平分割）アプローチ。21画面すべての静的HTML/CSSを先に構築する手法も検討しましたが、ステート管理やAPI連携時の手戻りリスクが高く、段階的な動作確認が難しいため却下しました。

## Scope
- **In**:
  - `screen_transition.md` に記載されている21枚の画面すべてのUIおよびNext.js App Routerでのルーティング設計。
  - Firebase Auth / Firestore / Storage / Gemini API などのコアサービス連携。
  - 親しみやすく洗練されたモダンなスタイリング（Next.js + Vanilla CSS、硬すぎないカジュアルかつプレミアムなデザイン）。
  - ウミガメのスーププレイ画面における「・・・AIが質問を分析中です」等のリッチなインタラクション表示。
- **Out**:
  - インポート機能などのシステム外連携（エクスポート機能はインスコープ）。
  - リアルタイム対戦システムなど、画面遷移図にない未定義機能。

## Constraints
- **Styling**: TailwindCSSは使用せず、Vanilla CSS（CSS Modules等）で柔軟かつ高品質に表現します。
- **Design System**: 洗練されつつも気軽に利用できるカジュアルモダンなデザイン（角丸の積極的な使用、親しみやすいカラーパレット、過度に硬すぎないタイポグラフィ）。
- **State Preservation**: プレイ画面でのリロードやオフライン時のセッション保護を `localStorage` 等で確実に維持します。

## Boundary Strategy
- **Why this split**: 認証、プレイ、クリエイター、管理といった役割ごとに仕様を閉じることで、テスト検証がしやすく、段階的な実装がスムーズになります。
- **Shared seams to watch**: 共通レイアウト（`Header` 等）、`useAuth` によるログイン状態の監視とグローバルステート、共通のCSS変数およびデザインシステムトークン。

## Specs (dependency order)

> 凡例: [x] = spec定義承認済み, [impl] = 実装完了, [ ] = 実装待ち

### Wave 0: コアロジック基盤
- [x][impl] quizeum-core -- Firebase/Firestoreサービスレイヤー、型定義、APIルート等コアロジックの実装。Dependencies: none

### Wave 1: 認証・プロフィール
- [x][impl] quizeum-auth-profile-ui -- 認証画面、プロフィール関連画面、通知一覧、ソーシャルフォロー連携UIの実装。Dependencies: quizeum-core

### Wave 2: プレイフロー
- [x][impl] quizeum-play-flow-ui -- ホーム画面、クイズ詳細・プレイ（通常・ウミガメスープ含む）、結果、弱点克服、リーダーボード、探索（タグ/ジャンル）関連画面UIの実装。Dependencies: quizeum-auth-profile-ui

### Wave 3: クリエイター管理
- [x][impl] quizeum-creator-dash-ui -- クイズおよびクイズリストの作成・編集、作家ダッシュボード（アナリティクス、指摘管理、エクスポート）UIの実装。Dependencies: quizeum-play-flow-ui

### Wave 4: モデレーション・ガバナンス（完了）
- [x][impl] quizeum-moderation-governance-ui -- 管理者モデレーション、マージリクエスト、ジャンル新設申請・投票等コミュニティ自治UIの実装。Dependencies: quizeum-creator-dash-ui

---

## Phase 5: リーダーボード分割 & マイページプレイ履歴（2026-06-03 ディスカバリー）

### Overview（本フェーズ）
クイズ単位リーダーボードを「初回プレイ」と「2回目以降（リプレイ）」に分離し、ログインユーザーがマイページ（自身のプロフィール）から `attempts` に基づくプレイ履歴を閲覧できるようにする。要件・設計の正本は `docs/` および各 `.kiro/specs/*/requirements.md`・`design.md` を同期更新する。

### Approach Decision（本フェーズ）
- **Chosen**: デュアルフィールド方式 — `quizzes.leaderboardFirstPlay` と `quizzes.leaderboardReplay`（各最大5件）
- **Why**: クイズ詳細UIの2タブ表示とトランザクション更新が単純。既存 `leaderboard` 単一配列の「初回／リプレイ」混在を防ぎ、マイグレーションも `leaderboard` → `leaderboardFirstPlay` リネームで完結する。
- **Rejected alternatives**:
  - 単一配列 + `playOrdinal` フィールド: 更新・ソート・上位5抽出が複雑化し、同一ユーザーの初回/リプレイが1配列に混在する。
  - サブコレクション方式: top5 用途に対して過剰な読み取りコストと実装範囲。

### Scope（本フェーズ）
- **In**:
  - F-801/F-802 の要件改定（初回限定 LB / リプレイ LB の表示・登録ルール）
  - 新機能: マイページからのプレイ履歴一覧（本人のみ、ページネーション）
  - `docs/requirements_definition.md`, `docs/db_design.md`, `docs/api_specification.md`, `docs/detailed_design.md`, `docs/screen_transition.md` の同期
  - `quizeum-core` / `quizeum-play-flow-ui` / `quizeum-auth-profile-ui` の spec 更新と実装
- **Out**:
  - 総合リーダーボード（`/leaderboard`）の仕様変更
  - 他人のプロフィールからのプレイ履歴閲覧
  - テストプレイ・未永続化モードの履歴表示
  - 既存 `leaderboard` データの自動再分類（手動マイグレーションスクリプトは別途検討可）

### Constraints（本フェーズ）
- **登録条件（2026-06-03 改定）**: 全問正解は不要。認証済みの永続化対象プレイ完了時に、正解数（`score`）と合計解答時間（`elapsedSeconds`）をリーダーボードへ登録候補とする（テストプレイ等は除外）。初回・リプレイ双方で同一ルール。
- **順位計算（canonical）**: 正解数を優先し、同数ならタイム（`elapsedSeconds`）で順位付け — `score` 降順 → `elapsedSeconds` 昇順。水平思考（ウミガメ）も合格完了時は同一比較式。
- **更新ルール**: 各LB配列で同一 `userId` は最大1エントリ。新記録が既存エントリより優位（正解数が多い、または同点で時間が短い）のときのみ差し替え。差し替えまたは新規挿入後に配列全体をソートし上位5名を保持。初回LBは当該ユーザーの**1回目の完了 attempt** のみが対象（2回目以降はリプレイLBのみ）。
- 「初回プレイ」判定: 対象クイズに対する当該ユーザーの **完了済み** `attempts` が0件のタイミングの完了記録のみ `leaderboardFirstPlay` を更新。2回目以降は `leaderboardReplay` のみ（初回側は不変）
- プレイ履歴: `mode` が `test-play` のものは除外。`completedAt` 降順、初期20件 + 追加読み込み

### Boundary Strategy（本フェーズ）
- **Core** がデータモデル・`saveAttempt` / `updateLeaderboard` / 履歴クエリAPIを所有
- **Play-flow UI** がクイズ詳細の2系統LB表示のみ所有
- **Auth-profile UI** がマイページ履歴セクション（または `/profile/[uid]/history`）のみ所有
- **Shared seam**: 初回/リプレイ判定ロジックは Core に1か所集約し UI は読み取り専用

## Existing Spec Updates（Phase 5・依存順）
- [x] quizeum-core -- `leaderboardFirstPlay` / `leaderboardReplay` 型・永続化、`saveAttempt`・`verify-truth` 内LB振り分け、`listUserPlayHistory` API、既存 `leaderboard` 後方互換読み取り。Dependencies: none
- [x] quizeum-play-flow-ui -- クイズ詳細の「初回プレイランキング」「リプレイランキング」タブ/セクション、E2E更新。Dependencies: quizeum-core
- [x] quizeum-auth-profile-ui -- 本人プロフィールにプレイ履歴専用タブ（API連携・ページング・E2E）。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 5）
- [x] docs-sync -- `docs/requirements_definition.md`（F-801/F-802 + F-108 プレイ履歴）、`docs/db_design.md`、`docs/api_specification.md`、`docs/detailed_design.md`（シーケンス・LB分岐）、`screen_transition.md`（プロフィール・クイズ詳細）を core spec 更新と同時に整合

## Specs (dependency order)
（Phase 5 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 6: ジャンル機能の docs 整合（2026-06-03 ディスカバリー）

### Overview（本フェーズ）
ジャンル関連の実装が `docs/` 正本（`requirements_definition.md`, `db_design.md`, `api_specification.md`, `detailed_design.md`, `screen_transition.md`, `security_architecture.md`）および既存 `.kiro/specs` と乖離している。ハードコードされたジャンル一覧、`canonicalGenreId` 未解決、`getQuizzesByGenre` の仮想統合未適用、`metadata_genres` / `genreRequests` の Security Rules 欠落、重複する `moderation.ts` スタブ等を、**新規 spec なし**で既存4スペック + docs 同期により是正する。

### Approach Decision（本フェーズ）
- **Chosen**: Core-first 垂直整合 — データ層・検証・クエリ・Rules を先に正し、その後 UI を `metadata_genres` 駆動に切り替え
- **Why**: ホーム/エディタ/ジャンル一覧はすべてマスタと `canonicalGenreId` に依存する。UIだけ先に直すとマージ後の一覧漏れや公開時の不正ジャンルが残る
- **Rejected alternatives**:
  - UI-first（ハードコード一覧の統一のみ）: 仮想統合・公開検証が未解決のまま見た目だけ一致する
  - 物理マイグレーション一括（全 `quizzes.genre` 書き換え）: docs の「仮想統合」方針と矛盾しコスト大。`canonicalGenreId` 書き込み時解決 + 読み取り時 `mergedGenreIds` 展開で足りる

### Scope（本フェーズ）
- **In**:
  - `getQuizzesByGenre`: `metadata_genres` 参照 → `mergedGenreIds` 展開 → `where('genre', 'in', [...])`（Firestore `in` 上限10件の分割クエリ含む）
  - `createQuiz` / `updateQuiz`（公開時）: `metadata_genres` 実在検証 + `canonicalGenreId` 非正規化
  - `validateQuizForPublish` / Zod: マスタ存在チェックとの二重整合
  - `firestore.rules` + `firestore.indexes.json`: `metadata_genres`, `genreRequests`, `mergeRequests`（タグ統合と同様パターン）
  - ホーム: `metadata_genres` からのアイコン/表示名ナビ、`/genres/[id]` への遷移
  - クイズエディタ: マスタ駆動セレクト、申請動線維持、承認後の一覧リフレッシュ
  - `/genres/[genreName]`: マスタ `displayName`・`iconImageUrl`、ソート（トレンド/人気/新着）
  - 重複 `moderation.ts` のジャンル API 削除または `tagMerge.ts` へ統合
  - 既存 spec（core / play-flow / creator-dash / moderation-governance）requirements・design・tasks のギャップ追記
  - `docs/db_design.md` のジャンルアイコン「SVG可」記述を SEC-08 方針（PNG/JPEG/GIF のみ）に統一
- **Out**:
  - Cloud Functions への投票・可決処理の完全移行（現状クライアント transaction 維持。Storage アイコン移動の自動化は follow-up 可）
  - 既存クイズの一括 `genre` 物理書き換えバッチ（`runMigration` はマージ可決時のみ）
  - 新規 spec 境界の追加

### Constraints（本フェーズ）
- 仮想統合: クイズ `genre` 文字列は原則不変
- **検索最適化（canonical）**: 公開保存時に `canonicalGenreId` を必ず解決・非正規化。読み取りは `where('canonicalGenreId', '==', resolvedCanonicalId)` を第一選択とし、未バックフィルクイズ向けに `genre in [canonicalId, ...mergedGenreIds]` のフォールバック併用（`api_specification.md` §書き込み時解決・検索高速化）
- タグ検索も同様に `canonicalTagIds` + `array-contains` を正とする（ジャンルと対称）
- ジャンルアイコン: SVG 禁止（`storage.rules` / `uploadImage` と一致）
- Firestore `in` クエリ: 最大10 ID — マージ展開時はチャンク + マージ去重

### Boundary Strategy（本フェーズ）
- **Core**: マスタ CRUD 読み取り、公開時 canonical 解決、ジャンル別クエリ、Rules/Indexes、デッドコード整理
- **Play-flow UI**: ホームナビ、ジャンル一覧ページのメタ表示・ソート・リンク
- **Creator-dash UI**: エディタの動的セレクト（core の list API / 直接 read に依存）
- **Moderation-governance UI**: 申請・投票 UI は概ね実装済み — icon ライフサイクルと spec 文言（SVG 禁止）の整合のみ
- **Shared seam**: `resolveCanonicalGenreId(genreId)` を Core に1か所集約

## Existing Spec Updates（Phase 6・依存順）
- [x] quizeum-core -- `getQuizzesByGenre` 仮想統合、`createQuiz`/`updateQuiz` マスタ検証・`canonicalGenreId`、Rules/Indexes、ジャンルメタ読み取り API、重複 moderation 削除。Dependencies: none
- [x] quizeum-play-flow-ui -- ホーム `metadata_genres` ナビ、`/genres/[genreName]` メタ・ソート、ホーム→ジャンル一覧遷移。Dependencies: quizeum-core
- [x] quizeum-creator-dash-ui -- エディタ動的ジャンルセレクト、承認後リフレッシュ、spec 要件同期。Dependencies: quizeum-core
- [x] quizeum-moderation-governance-ui -- 申請画面の spec/docs 整合（SVG 禁止表記）、任意: 可決時アイコン Storage 整理。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 6）
- [x] docs-sync-genre -- `docs/db_design.md`（SVG 記述修正）、他 docs が既に正しい場合は core 実装に合わせて差分のみ更新
- [ ] e2e-genre-alignment -- ジャンル一覧・新設申請・マージ後の一覧表示の E2E 追加/更新

## Specs (dependency order)
（Phase 6 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 7: 管理者向けユーザー管理ツール（2026-06-04 ディスカバリー）

### Overview（本フェーズ）
システム管理者（Super Admin）向けに、不適切なユーザーの信頼スコアやモデレータティアーを緊急時に手動でリセットする機能、およびアカウントの停止（BAN/UNBAN）処理機能を提供し、監査ログとして `adminLogs` に記録する。専用画面 `/admin/users` を新設し、そこで特定のユーザーUIDによる検索、情報表示、リセットおよびBAN/UNBAN処理を実行可能にする。また、BANされたユーザーのログインやアクセスを多重防御で遮断する。

### Approach Decision（本フェーズ）
- **Chosen**: `/admin/users` 専用画面の新設 + Core 側リセット・BANトランザクション + `adminLogs` 保存 + 多重防御（ミドルウェア、AuthContext、Firestore Rulesでのアクセス遮断）
- **Why**: 既存のモデレーション画面と分離しつつ、重大な権限リセットとアカウント制御（BAN）をアトミックに管理し、不正アクセスを確実に防ぐため。
- **Rejected alternatives**:
  - 既存 `/admin/moderation` への統合: 管理機能が1画面に詰め込まれすぎ、将来的な拡張が難しくなるため却下。
  - Firebase Custom Claimsのみによる制御: トークン伝播のタイムラグがあるため、Firestore Rulesとミドルウェア/AuthContextを組み合わせた即時遮断アプローチを採用。

### Scope（本フェーズ）
- **In**:
  - `reputation.ts` への `resetUserReputation` サービス追加（トランザクションによる `users` の `reputationScore: 0` & `moderationTier: 'newcomer'` リセット、および `adminLogs` へのログ挿入）。
  - `isBanned` フィールドの更新（BAN/UNBAN処理）を行うサービスメソッドおよびAPIエンドポイントの追加。
  - `executorId` による厳格な `admin` ロールチェック（多重防衛）。
  - `/admin/users` 画面の新規作成（UIDによるユーザー情報表示、手動リセット・BAN/UNBAN理由の入力、実行アクション）。
  - 既存 `/admin/moderation` 画面から `/admin/users` へのナビゲーションリンク追加。
  - Firestore Security Rules に `adminLogs` の読み書きルール追加、およびBANユーザーの読み書き遮断ルールの追加。
  - ミドルウェアおよび認証コンテキストによるBANユーザーのセッション即時遮断。
- **Out**:
  - ユーザーのアカウント物理削除機能自体。

### Boundary Strategy（本フェーズ）
- **Core** がデータモデル、手動リセット・BAN/UNBAN API、`adminLogs`への書き込み、Firestore Rules、および認証ガードロジックを所有。
- **Admin Users UI** が `/admin/users` での検索および各種実行パネルを所有。
- **Shared seam**: 各種管理者アクションを Core に集約し UI はそれを呼び出す。

## Existing Spec Updates（Phase 7）
- [x][impl] quizeum-core -- `banUser`・`unbanUser` メソッド、`adminLogs` スキーマ・型定義、Firestore Security Rules（`adminLogs` 用およびBANユーザー遮断用）、認証ミドルウェア/AuthContext でのBAN検知。Dependencies: none

## Specs (dependency order)
- [x][impl] quizeum-admin-users-ui -- 管理者専用ユーザー検索・手動スコアリセット・BAN/UNBAN画面（`/admin/users`）の実装、ルートガード。Dependencies: quizeum-core

---

## Phase 8: ブックマーク・リスト・問題再利用（2026-06-05 ディスカバリー）

### Overview（本フェーズ）
ブックマークとリストをクイズ単位・問題単位の両方で作成・管理できるように改良する。ブックマーク画面ではクイズ・リスト・問題を分類表示する。リストは既存 `quizLists` コレクションに `listType`（`quiz` | `question`）を追加し、クイズリスト（`quizIds`）と問題リスト（`questionIds`）を区別する。問題リストには**他者の公開クイズに含まれる公開問題も追加可能**とする。作問時は過去の自作クイズ（下書き含む）を検索し、問題を参照リンク（ドキュメント複製なし）で新規クイズに再利用できるようにする。

### Approach Decision（本フェーズ）
- **Chosen**: 単一コレクション + `listType` — `QuizList` に `listType: 'quiz' | 'question'` を追加し、既存 `quizIds` / `questionIds` をタイプで使い分ける。問題の作問再利用は `sourceQuestionId`（参照）で同一 `questions` ドキュメントを指す。
- **Why**: 型・`questionIds`・`toggleBookmark(..., 'question')` 等の実装断片が既にあり、Phase 5–7 と同様に既存スペック拡張で完結する。別コレクション分割は CRUD・Rules・UI の二重化コストが大きい。
- **Rejected alternatives**:
  - `quiz_lists` / `question_lists` コレクション分離: クエリは明確だが移行・二重実装が過大。
  - 問題リスト後回し（ブックマーク＋作問リンクのみ）: 「リストも各単位で管理」の要望が未達のままになる。

### Scope（本フェーズ）
- **In**:
  - クイズ・リスト・問題のブックマーク API および一覧取得（クイズ／問題は分離、追加日時降順）
  - `QuizList.listType` によるクイズリスト／問題リストの作成・更新・取得（作者別・タイプ別フィルタ）
  - 問題リストへの問題追加: **公開済み**の問題のみ（自作・他者作問を問わない）。ブックマーク済み問題や検索 UI からの追加導線
  - 問題リスト連続プレイ（`attempts.mode = 'question-list'`）
  - 作問時: 自作クイズのキーワード／タグ検索、問題の参照リンク追加（複製しない）
  - `/bookmarks` のタブ（クイズ / リスト / 問題）、リスト編集のタイプ切替・問題 DnD、作問エディタの過去クイズ検索パネル
  - プロフィール「作成したリスト」のタイプ別表示（必要最小限）
  - `docs/` 正本（`db_design.md`, `api_specification.md` 等）と Firestore Rules / Indexes の同期
- **Out**:
  - 他ユーザーの**未公開**クイズ・問題のブックマーク／リスト追加
  - 自作でないクイズからの問題**リンク再利用**（作問エディタ内の参照追加は自作のみ）
  - 問題リストへの下書き・非公開問題の追加
  - 参照リンク問題の「実体編集」が元クイズに波及する詳細 UX（初版は参照表示＋権限境界を Core で定義、編集は元または切り離しポリシーを design で確定）

### Constraints（本フェーズ）
- 既存 `quizLists` ドキュメントは `listType` 未設定時 **`quiz` として後方互換**（読み取り・一覧フィルタ）
- ブックマーク取得: クイズは従来どおり公開クイズに限定可、問題は **親クイズが published** のもののみ一覧に含める
- 問題リスト追加時: `questions` ドキュメント存在 + 親 `quizzes.status === 'published'` を Core で検証
- 参照リンク問題: 新規クイズの `questionIds` に既存 `questions/{id}` を追加。`createQuiz` / `updateQuiz` は参照 ID に対して新規 `questions` ドキュメントを作成しない

### Boundary Strategy（本フェーズ）
- **Core**: `listType`、ブックマーク／リスト／問題の取得 API、問題リスト CRUD、問題リストプレイセッション、`searchAuthorQuizzes`、参照リンク保存、Rules/Indexes、`Attempt.mode` 拡張
- **Play-flow UI**: `/bookmarks` 3タブ、プレイ／結果／クイズ詳細での問題ブックマーク、問題リストプレイ開始
- **Creator-dash UI**: リスト編集（タイプ・問題ピッカー・DnD）、作問エディタの自作クイズ検索・リンク UI
- **Auth-profile UI**: プロフィールのリストタブを `listType` で区別表示（軽微）
- **Shared seam**: 公開問題の追加可否・参照リンクの永続化は Core に1か所集約。UI は検索・ピッカーのみ

## Existing Spec Updates（Phase 8・依存順）
- [x] quizeum-core -- 要件 13–15 の design/tasks/実装: `listType`、`getBookmarkedQuestions` 統合、問題リストプレイ、自作クイズ検索 API、参照リンク `saveQuiz`、Rules/Indexes、`question-list` mode。Dependencies: none
- [x] quizeum-play-flow-ui -- `/bookmarks` タブ（クイズ・リスト・問題）、問題ブックマーク操作、問題リストプレイ導線。Dependencies: quizeum-core
- [x] quizeum-creator-dash-ui -- リスト `listType` 編集・問題追加 UI、作問エディタ過去クイズ検索・リンクパネル。Dependencies: quizeum-core
- [x] quizeum-auth-profile-ui -- プロフィール「作成したリスト」のクイズリスト／問題リスト区別表示。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 8）
- [x] docs-sync-bookmarks-lists -- `docs/db_design.md`（`listType`, 参照問題フィールド）、`docs/api_specification.md`、`docs/detailed_design.md`、`docs/screen_transition.md` を core/play-flow/creator-dash 実装と同期

## Specs (dependency order)
（Phase 8 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 9: 左サイドバーレイアウトへの移行（2026-06-05 ディスカバリー）

### Overview（本フェーズ）
Quizeumの全体レイアウトを従来のヘッダー中心の構成から、PC/タブレットでは左サイドバー、モバイルでは下部ボトムナビ＋上部ミニヘッダーというXやInstagram風のレスポンシブなフルハイブリッドレイアウトへ移行する。これに伴い、ナビゲーションメニューや作問導線を一元化・最適化し、よりモダンでWOW感のあるプレミアムな操作性を提供する。

### Approach Decision（本フェーズ）
- **Chosen**: フルハイブリッドアプローチ（PC/タブレット左サイドバー ＋ モバイルボトムナビ ＋ モバイルミニヘッダー）
- **Why**: あらゆるデバイスで操作性を最大化し、現代のSNSで最も評価されているUXを実現するため。ドロワー方式ではモバイルで主要機能へのアクセスに2タップ必要になるが、ボトムナビの採用により1タップでアクセス可能にする。
- **Rejected alternatives**:
  - モバイルドロワー方式: 共通のサイドバーを使い回せるため実装は容易だが、スマホ操作でのタップステップ数が増えUXが低下するため却下。
  - 常時左固定スリムバー方式: スマホの表示領域が狭くなりクイズの可読性を損ねるため却下。

### Scope（本フェーズ）
- **In**:
  - 新規 `Sidebar` コンポーネントおよび CSS Modules の実装（PC: 275px, タブレット: 70pxにレスポンシブ縮小）。
  - 新規 `BottomNav` コンポーネントおよび CSS Modules の実装（モバイルサイズで画面下部に固定）。
  - 既存 `Header` をモバイル専用ミニヘッダー（ロゴ、アバター、作問等の最小構成）に軽量化。
  - `src/app/layout.tsx` をレスポンシブなグリッドレイアウトへ再構成し、サイドバー幅に応じたメインコンテンツの余白調整を組み込む。
  - ログイン状態（`useAuth`）に応じたメニュー項目（ホーム、通知、ブックマーク、作問、ダッシュボード、プロフィール、ログアウト）の動的表示と、アクティブページのハイライト。
- **Out**:
  - クイズプレイ画面（`/play`）のレイアウト変更（引き続き非表示とする）。
  - サイドバー上の通知バッジなどのリアルタイム状態同期ロジック（UI上の静的バッジ表示枠のみ実装）。

### Constraints（本フェーズ）
- **Vanilla CSS / CSS Modules**: TailwindCSSは使用せず、既存のプレミアムなデザインテーマ（ネオンカラー、Glassmorphism等）を踏襲してVanilla CSSで構築する。
- **プレイ画面の除外**: パスに `/play` が含まれる場合はサイドバー、ボトムナビ、ヘッダーをレンダリングしない。

### Boundary Strategy（本フェーズ）
- **Layout Spec** が `Sidebar`, `BottomNav`, `Header`, `layout.tsx` の表示・スタイル・切り替え制御を所有。
- **Auth-Profile / Play-Flow UI** はレイアウト自体への直接の依存を持たず、サイドバーやボトムナビのメニュー項目から遷移する先の各ページコンテンツを所有。

## Existing Spec Updates（Phase 9・依存順）
（本フェーズでは既存スペックへの直接の機能変更は行わないが、共通レイアウトの移行による干渉を調整）

## Direct Implementation Candidates（Phase 9）
- [x] layout-css-adjustments -- 各画面コンテンツ（ホーム、プロフィール等）のコンテナ幅やパディングの微調整

## Specs (dependency order)
- [x][impl] quizeum-sidebar-layout -- X/Instagram風左サイドバーおよびボトムナビによる共通ナビゲーションレイアウトの実装。Dependencies: none

---

## Phase 10: 探索検索のタグチップ化・サジェスト強化 & クイズカード情報拡充（2026-06-05 ディスカバリー）

### Overview（本フェーズ）
ホームの統合検索エリアで、タグ入力をスペース（または確定操作）でチップ化し、入力中にタグ名・ジャンル名のサジェストを表示する。あわせてクイズ一覧カードの難易度を☆表記に変更し、ジャンル名と出題形式をカード上に表示する。ジャンル／タグ一覧ページのインラインカードも `QuizCard` へ統一し表示項目を揃える。
さらに、各検索フィールドのフォーカス時に「空クエリでも有益なサジェスト」を表示するスマートサジェスト機能を追加する（2026-06-06 追記）。

### Approach Decision（本フェーズ）
- **Chosen**: チップ付き複合検索コンポーネント + クライアントサイドサジェスト + `QuizCard` 拡張・共通化
- **Why**: ジャンルサジェストは `GenreSearchField` / `filter-genre-suggestions` の実装パターンが既にあり、タグも `metadata_tags` マスタ読み取り（新規 `listActiveTags`）で対称に実装できる。検索ロジックは既存 `searchQuizzes` のタグ・ジャンル・キーワード AND 合成をチップ状態から組み立てれば足り、新規 spec 境界は不要。
- **Rejected alternatives**:
  - チップなしでプレーンテキスト `#tag` のみ: 複数タグの AND 検索が曖昧で、サジェスト選択後の UX が弱い。
  - サーバー専用サジェスト API 新設: マスタ件数規模ではクライアントフィルタで十分。Firestore 読み取りは `listActiveGenres` と同型の1回取得で済む。
  - カード改修をホームのみに限定: ジャンル／タグ一覧が別実装のままだと表示不整合が残る。
  - **週間集計: クライアントサイド直接集計**: `attempts` の全件スキャンは Firestore コスト爆発のため却下。Next.js API Route + サーバーサイドキャッシュ（`revalidate: 1800`）を採用。

### Scope（本フェーズ）
- **In**:
  - ホーム検索バー: タグチップ（スペースで確定、×で削除）、入力中のタグ・ジャンルサジェストドロップダウン
  - チップ・キーワード・フィルタパネル条件の統合と `searchQuizzes` 連携（デバウンス維持）
  - `QuizCard`: 難易度を☆表示（1〜10）、ジャンル表示名、出題形式ラベル
  - `/genres/[genreName]`・`/tags/[tagName]` のインラインカードを `QuizCard` に置換
  - `quizeum-core`: `listActiveTags()`（`metadata_tags` 有効タグ一覧、`listActiveGenres` 対称）
  - 共有ユーティリティ: `getFormatLabel` の `quiz-format.ts` 等への集約（エディタとカードで重複排除）
  - **【スマートサジェスト追加・2026-06-06】**
    - `GenreSearchField` フォーカス時（空クエリ）の初期表示:
      1. ユーザ自身の直近検索ジャンル 最大3件（`localStorage` キー: `quizeum_recent_genres`）
      2. 週間プレイ数の多いジャンル Top5（`/api/genres/weekly-top` から取得）
      - 入力があれば従来の `filterGenreSuggestions` に切り替わる
    - `UnifiedSearchField` フォーカス時（空クエリ・チップなし）の初期表示:
      1. ユーザ自身の直近検索ワード 最大5件（`localStorage` キー: `quizeum_recent_keywords`）
      2. 週間人気タグ Top5（`/api/search/weekly-top` → `topTags`）
      3. 週間人気ワード Top5（`/api/search/weekly-top` → `topKeywords`）
      - 入力があれば従来のタグサジェストに切り替わる
    - 新規 Next.js API Route:
      - `GET /api/genres/weekly-top` — `attempts`（`completedAt >= 7日前`）をジャンル別集計、Top5 返却。`revalidate: 1800`（30分キャッシュ）
      - `GET /api/search/weekly-top` — `search_logs`（`searchedAt >= 7日前`）からキーワード／タグ別集計、各 Top5 返却。`revalidate: 1800`
    - 新規 Firestore コレクション `search_logs`:
      - フィールド: `type: 'keyword' | 'tag'`、`value: string`（タグID またはキーワード正規化済み）、`searchedAt: Timestamp`
      - `searchQuizzes` 呼び出し時に Core サービス内でサイレント書き込み（認証状態に関わらず記録、ただし空クエリは除外）
      - Security Rules: 書き込みは認証済みユーザのみ、読み取りは API Route（Admin SDK）のみ
- **Out**:
  - ジャンル／タグ一覧ページへの検索バー新設（本フェーズはホーム検索エリアが正本）
  - タグ新設申請・マージ UI の変更（`quizeum-moderation-governance-ui`）
  - サーバー側ファジーサジェスト・全文検索エンジン導入
  - クイズ詳細・プレイ画面の難易度表示変更
  - `search_logs` の自動パージ（TTL 設定は Cloud Functions 管轄 — 初版は蓄積のみ）
  - 未認証ユーザの検索ログ収集

### Constraints（本フェーズ）
- タグチップ正規化は既存タグマスタ／`searchQuizzes` のタグ照合規則と一致させる（小文字化・記号除去等）
- ジャンルサジェストは `metadata_genres.displayName` と `genreId` の両方にマッチ
- 難易度☆は 1〜10 スケールを視覚化（例: 塗りつぶし☆×難易度 + 空☆×残り、または ★ N 表記 — 実装前に要件で確定）
- 出題形式は `resolveQuizFormat` + 日本語ラベル（選択式・記述式・ウミガメのスープ等）
- Vanilla CSS / CSS Modules、既存ネオンデザインシステムを踏襲
- **スマートサジェスト*ジャンルで絞り込むの履歴は `localStorage` のみ（Firestore への個人ログ保存なし）
- **週間集計**: `/api/genres/weekly-top` は `attempts` コレクション、`/api/search/weekly-top` は `search_logs` コレクションを参照。各30分キャッシュ
- **`search_logs` 書き込み**: 失敗しても検索処理をブロックしない（fire-and-forget / try-catch で握り潰し）

### Boundary Strategy（本フェーズ）
- **Core**: `listActiveTags`、`searchQuizzes` のチップ配列引数の明確化、`search_logs` への書き込みロジック
- **Play-flow UI**: `TagChipSearchField`（仮称）、サジェスト UI（スマートサジェスト含む）、`QuizCard` 拡張、ジャンル／タグ一覧のカード統一、`useHomeQuizFeed` フィルタ状態拡張
- **API Routes (Core 寄り)**: `/api/genres/weekly-top`、`/api/search/weekly-top`（集計ロジック + サーバーキャッシュ）
- **Shared seam**: タグ正規化・形式ラベルは lib に1か所集約。`localStorage` 操作は `src/lib/recent-search.ts`（仮称）に集約

## Existing Spec Updates（Phase 10・依存順）
- [ ] quizeum-core -- `listActiveTags()`、タグマスタ読み取り API、`searchQuizzes` フィルタ引数（タグチップ配列）の型・結合ロジック明確化、`search_logs` 書き込み（fire-and-forget）。Dependencies: none
- [ ] quizeum-play-flow-ui -- ホーム検索のタグチップ＋タグ／ジャンルサジェスト、`GenreSearchField` フォーカス時スマートサジェスト（直近3件+週間Top5）、`UnifiedSearchField` フォーカス時スマートサジェスト（直近ワード+週間人気ワード/タグ各5件）、`QuizCard` の☆難易度・ジャンル・出題形式、ジャンル／タグ一覧での `QuizCard` 共通化。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 10）
- [ ] format-label-shared -- `getFormatLabel` を `src/lib/quiz-format.ts` 等へ抽出しエディタ・カードで共有
- [ ] weekly-top-api-routes -- `src/app/api/genres/weekly-top/route.ts`、`src/app/api/search/weekly-top/route.ts` の新設（`attempts`・`search_logs` 集計 + `revalidate: 1800`）
- [ ] recent-search-storage -- `src/lib/recent-search.ts` の新設（`localStorage` への直近ジャンル・キーワード読み書きユーティリティ）

## Specs (dependency order)
（Phase 10 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 11: 探索アコーディオン・カルーセル & ジャンルページ検索（2026-06-05 ディスカバリー）

### Overview（本フェーズ）
ホーム画面の検索バー直下に「ジャンルから探す」「出題形式で絞り込む」のアコーディオンを配置し、展開時にジャンルカード／出題形式カードの横スクロールカルーセルを表示する。カード選択は**ページ遷移せずホーム内のクイズグリッドを絞り込む**（ホーム内フィルタ型）。検索バー・フィルタパネルとフィルタ状態を共有し、ジャンルは検索バーのサジェストでも絞り込める。既存 `GenreNav`（ピル横スクロール）は本 UI に置き換える。あわせてジャンル別一覧（`/genres/[genreName]`）にも検索バーとフィルタを追加し、当該ジャンル内でのキーワード・タグ・難易度・出題形式等の絞り込みを可能にする。

### Approach Decision（本フェーズ）
- **Chosen**: 共有探索フィルタ状態 + カルーセル選択 → `searchQuizzes` 連携（ホーム内フィルタ型）
- **Why**: ユーザーが「まず条件を選んでから一覧を見る」探索フローをホーム上で完結できる。Phase 10 の統合検索・タグチップと同一の `searchQuizzes` / `HomeFeedFilters` 系状態を拡張すれば、カルーセル・検索バー・フィルタパネルが一貫して動作する。ジャンルページは `genreId` を URL から固定し、同一コンポーネントを `lockedGenreId` 付きで再利用する。
- **Rejected alternatives**:
  - **ナビゲーション型**（カード → `/genres/[id]` や `/formats/[format]`）: ユーザー選択により却下。探索はホーム上で完結させる。
  - **カルーセル専用 API 新設**: マスタ件数・形式種別は少なく、既存 `listActiveGenres` + 静的形式定義で足りる。
  - **ジャンルページのみクライアント side フィルタ**: ホームと挙動が乖離するため、`searchQuizzes`（ジャンル固定）に統一。

### Scope（本フェーズ）
- **In**:
  - ホーム: 検索バー下のアコーディオン 2 セクション（ジャンル／出題形式）
  - 展開時の横スクロールカルーセル（CSS scroll-snap、Vanilla CSS Modules）。ジャンルカードはアイコン・表示名・説明（任意）
  - カード選択で `filterGenreId` / `filterFormat` を設定し、デバウンス付き `searchQuizzes` でグリッド更新。選択中カードのハイライト、再タップまたはクリアで解除
  - 検索バー（`UnifiedSearchField`）との状態共有: ジャンルサジェスト選択も `filterGenreId` に反映しカルーセル選択状態と同期
  - 既存 `GenreNav` ピルナビの**削除・置換**（要件 1.x の `/genres` 遷移ルールを本フェーズで改定）
  - `quizeum-core`: `SearchFilters` / `searchQuizzes` への `format`（出題形式）フィルタ追加（`resolveQuizFormat` と一致する判定）
  - `HomeFeedFilters` / `hasActiveHomeSearchFilters` への `format` 追加
  - ジャンルページ: ホームと同型の検索バー＋フィルタパネル（`genreId` は URL 固定、ジャンルセレクトは非表示または読み取り専用）。`searchQuizzes` で当該ジャンル内検索
  - 出題形式カルーセル: `getFormatLabel` 対象の有効形式一覧（mixed, multiple-choice, text-input, quick-press, sorting, association, lateral-thinking）
  - テスト: カルーセル選択→グリッド絞り込み、ジャンルページ scoped 検索、format フィルタ結合
- **Out**:
  - `/formats/[format]` 専用ルート新設
  - URL クエリパラメータによるフィルタ共有可能化（将来 follow-up 可）
  - タグ別一覧（`/tags/[tagName]`）への検索バー追加（本フェーズはジャンルページのみ）
  - カルーセル用 Framer Motion 自動スライド・外部 carousel ライブラリ導入
  - サーバー側 format インデックス新設（クライアント側 `resolveQuizFormat` フィルタで足りる）

### Constraints（本フェーズ）
- Vanilla CSS / CSS Modules。横スクロールは `scroll-snap-type: x mandatory` 等で実装（新規 npm 依存なし）
- アコーディオン: WAI-ARIA `button` + `aria-expanded` / `aria-controls` を付与
- 形式フィルタは DB の `quiz.format` 単体ではなく `resolveQuizFormat({ format, questions })` の結果と比較（`QuizCard` と同規則）
- Phase 10（タグチップ・サジェスト）と共存: Phase 10 未完了でも Phase 11 は `UnifiedSearchField` 拡張前提で設計。実装順は Phase 10 → Phase 11 を推奨
- ジャンルページの `genreId` は URL パラメータを正とし、フィルタで他ジャンルへ切り替えない（ジャンル変更はホームまたはカルーセル経由）

### Boundary Strategy（本フェーズ）
- **Core**: `SearchFilters.format`、`searchQuizzes` 内形式フィルタ、`resolveQuizFormat` との整合
- **Play-flow UI**: アコーディオン、ジャンル／形式カルーセル、ホーム状態管理、`GenreNav` 削除、ジャンルページ検索 UI、共有コンポーネント（例: `ExploreFilterSection`）
- **Shared seam**: 探索フィルタ状態の型（`HomeFeedFilters` 拡張）と `searchQuizzes` 呼び出しを lib/hook に1か所集約し、ホーム・ジャンルページで再利用

## Existing Spec Updates（Phase 11・依存順）
- [ ] quizeum-core -- `SearchFilters.format` 追加、`searchQuizzes` 出題形式フィルタ（`resolveQuizFormat` 一致）、必要なら型・テスト。Dependencies: none
- [ ] quizeum-play-flow-ui -- ホームアコーディオン＋カルーセル（ホーム内フィルタ）、`GenreNav` 置換、検索バー状態同期、ジャンルページ検索・フィルタ、`HomeFeedFilters.format` 連携。Dependencies: quizeum-core（format フィルタ）。Phase 10 検索 UI と整合

## Direct Implementation Candidates（Phase 11）
- [ ] explore-filter-hook -- `useExploreQuizFeed`（または `useHomeQuizFeed` 拡張）でホーム／ジャンルページの `searchQuizzes` 呼び出しを共通化

## Specs (dependency order)
（Phase 11 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 12: SuspenseとStreamingによる表示最適化（レイアウト先行表示）

### Overview（本フェーズ）
クイズプレイ中画面を除く、quizeumの**すべての画面**においてアクセス時に白紙や無味乾燥な「ロード中...」表示を出すことを防ぎ、Next.jsのSuspenseとStreamingを利用して共通レイアウトおよび画面の静的フレーム（戻るボタン、タイトル枠、コンテナなど）を即座に描画する。データ解決や認証が必要な部分は `Suspense` の `fallback` としてスケルトン（Skeleton）を配置し、非同期にコンテンツを流し込む。これにより、全画面での体感速度向上とプレミアムなUXを実現する。

### Approach Decision（本フェーズ）
- **Chosen**: RSC + Client Component + Suspense 分離方式
- **Why**: 各画面の `page.tsx` をサーバーコンポーネント（Server Component）として設計することで、Next.jsが初期HTML（静的な枠組み）を即時ストリーミング可能になる。認証状態の監視や非同期データの取得は子コンポーネント（Client Component）に閉じ込め、それを `page.tsx` で `<Suspense>` で囲むことで、美しいスケルトン表示とシームレスなローディング体験が全画面で両立するため。
- **Rejected alternatives**:
  - クライアントサイドでのインラインスケルトン判定（アプローチB）: ファイル分割は防げるが、Next.jsのサーバーサイドからのストリーミング（Streaming）を活用できず、初期表示速度の改善幅が限定的となるため却下。

### Scope（本フェーズ）
- **In**:
  - **すべてのページ（クイズプレイ中画面を除く）**の Server Component 化、静的フレーム（戻るボタン、ヘッダー、タイトル、背景コンテナ等）の先行描画。
  - 対象画面：ホーム（`/`）、クイズ詳細（`/quiz/[id]`）、結果画面（`/quiz/[id]/result`）、弱点克服（`/quiz/review`）、総合リーダーボード（`/leaderboard`）、タグ別一覧（`/tags/[tagName]`）、ジャンル別一覧（`/genres/[genreName]`）、ブックマーク（`/bookmarks`）、通知（`/notifications`）、作家ダッシュボード（`/creator/dashboard`）、クイズ作成・編集（`/quiz/create`, `/quiz/[id]/edit`）、リスト作成・編集・詳細（`/list/*`）、プロフィール関連（`/profile/*`）、モデレーション管理（`/admin/moderation`）、コミュニティ管理（`/community/*`）、管理者ユーザー管理（`/admin/users`）等。
  - 各画面に対応するスケルトンコンポーネントの整備（各UIスペックが担当）。
  - ログイン必須の全画面（`/bookmarks`, `/notifications`, `/creator/dashboard`, `/list/create`, `/profile/edit` 等）に対する Next.js Middleware でのサーバーサイドリダイレクト（Cookie ベース認証）。
- **Out**:
  - クイズプレイ中画面（`/quiz/[id]/play` および `/quiz/test-play/play` など、`/play` パス下のプレイ中画面）。これらはゲームの進行管理上、クライアント側での即時ローディング制御が必須であるため対象外とする。

### Boundary Strategy（本フェーズ）
- **Play-flow UI** が `/quiz/[id]` や結果画面、探索画面等の表示最適化を担当。
- **Creator-dash UI** が `/creator/dashboard` やクイズ・リスト編集画面等の表示最適化を担当。
- **Auth-profile UI** が `/bookmarks` や `/notifications`、プロフィール関連画面等の表示最適化を担当。
- **Admin Users UI** が `/admin/users` の表示最適化を担当.
- **Moderation-governance UI** がモデレーションおよびコミュニティ関連画面の表示最適化を担当。
- **Shared seam**: ミドルウェアのルーティング保護ルール (`src/middleware.ts`)、共通スケルトンコンポーネント。

## Existing Spec Updates（Phase 12）
- [ ] quizeum-play-flow-ui -- クイズプレイ中以外の全画面（ホーム、詳細、結果、探索、復習、リーダーボード）の Server Component 化、静的フレーム即時描画、および `Suspense` + `Skeleton` の適用。Dependencies: none
- [ ] quizeum-creator-dash-ui -- 全所有画面（ダッシュボード、クイズ作成・編集、リスト作成・編集・詳細）の Server Component 化、静的フレーム即時描画、および `Suspense` + `Skeleton` の適用。Dependencies: none
- [ ] quizeum-auth-profile-ui -- 全所有画面（ログイン、プロフィール、プロフィール編集、フォロー一覧、通知、いいね履歴）の Server Component 化、静的フレーム即時描画、および `Suspense` + `Skeleton` の適用。Dependencies: none
- [ ] quizeum-admin-users-ui -- ユーザー管理画面 `/admin/users` の Server Component 化、静的フレーム即時描画、および `Suspense` + `Skeleton` の適用。Dependencies: none
- [ ] quizeum-moderation-governance-ui -- モデレーション `/admin/moderation` およびコミュニティ管理画面（マージ申請、ジャンル新設等）の Server Component 化、静的フレーム即時描画、および `Suspense` + `Skeleton` の適用。Dependencies: none

## Direct Implementation Candidates（Phase 12）
- [ ] middleware-auth-protection -- ログイン必須の全画面に対する Next.js Middleware でのセッションCookieベースのログインガード追加（サーバーサイドリダイレクト）。

## Specs (dependency order)
（Phase 12 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 12 追補: プレイ画面の Suspense 最適化（2026-06-07 ディスカバリー）

### Overview（本追補）
Phase 12 当初 Out としていたクイズプレイ中画面についても、詳細・結果画面と同型の **RSC シェル + Suspense + Skeleton** パターンを適用する。アクセス時の「プレイ環境を準備中...」テキストのみの白紙待機を廃止し、静的フレーム（戻るボタン、プログレス枠、問題パネル外枠等）を即時描画する。ゲーム進行・localStorage セッション・解答インタラクションは Client Component に閉じ込め、データ取得境界のみ Suspense で分離する。

### Approach Decision（本追補）
- **Chosen**: 本番プレイは Server Loader（`getQuiz`）+ Client 本体 / test-play は Server シェル + Client sessionStorage ロード
- **Why**: 本番 `/quiz/[id]/play` は Firestore から `getQuiz` でサーバー取得可能（結果画面と同型）。`/quiz/test-play/play` は draft が `sessionStorage` にありサーバーから読めないため、静的フレームのみ Server、クイズデータ解決は Client 内 Suspense + 共有 `PlaySkeleton` とする。
- **Rejected alternatives**:
  - test-play だけ Phase 12 対象外のまま: UX 不整合（同じ `/play` 系 URL でロード体験が異なる）
  - test-play 用 Server API 新設: sessionStorage 依存の draft をサーバーへ送る必要があり初版スコープ過大

### Scope（本追補）
- **In**:
  - `/quiz/[id]/play` — 全モード（normal / exam / flashcard / lateral / question-list）。`PlaySkeleton`（`data-testid="quiz-play-skeleton"`）、quick-press 難読化の Loader 移管
  - `/quiz/test-play/play` — 静的フレーム即時表示 + Client 内 sessionStorage ロード + 同一 `PlaySkeleton`
  - 既存 `usePlayState` / `useAiPlayState` / localStorage セッション保護ロジック（変更なし）
- **Out**:
  - サイドバー・ボトムナビのプレイ画面への表示（Phase 9 方針維持）
  - プレイ中ゲームロジック・AI 制限・Stripe tier 連携（Phase 13 は別途）
  - `/quiz/test-play/result`（結果画面は Phase 12 済みの対象外追補としない — 必要なら follow-up）

### Boundary Strategy（本追補）
- **Play-flow UI** が両プレイ画面の RSC 分割、`PlaySkeleton`、本番 Loader、test-play Client ロードを所有
- **Shared seam**: `PlaySkeleton` を本番・test-play で共有。quick-press 難読化は lib 関数化して Loader と test-play Client で再利用

## Existing Spec Updates（Phase 12 追補）
- [ ] quizeum-play-flow-ui -- `/quiz/[id]/play` および `/quiz/test-play/play` の Server Component 化、静的フレーム即時描画、`PlaySkeleton` + Suspense 適用。Dependencies: none

## Specs (dependency order)
（Phase 12 追補 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 13: Stripe サブスクリプション（Pro プラン・エンドツーエンド）（2026-06-07 ディスカバリー）

### Overview（本フェーズ）
Stripe を前提に、有料プラン（初版は **Pro のみ**）の購読フローをエンドツーエンドで実装する。Free は全ユーザーのデフォルトのためプラン画面には表示しない。`/pricing` で Pro の特典・価格を提示し、Stripe Checkout で購読開始、Webhook で Firestore エンタイトルメントを更新、Customer Portal で契約管理、プレイ画面の AI 日次制限解除までを一気通貫で届ける。将来 **Premium** ティアを追加しやすいよう、`subscriptionTier`  enum とプラン定義マスタで拡張可能に設計する。

### Approach Decision（本フェーズ）
- **Chosen**: フル垂直スライス — Stripe Checkout + Webhook + Customer Portal + tier ベースエンタイトルメント
- **Why**: 表示のみでは購入後の価値が閉じない。既存 `ask-ai` がサーバー側 `isPremium` を参照しているため、Webhook による信頼できる tier 更新と Rules によるクライアント書き込み遮断が必須。Pro 単体販売でも tier マスタ化しておけば Premium 追加時に UI/API を最小差分で拡張できる。
- **Rejected alternatives**:
  - 表示 + Checkout のみ（Webhook 後回し）: 購入直後に制限が解除されず本番不可
  - Stripe Pricing Table 埋め込み: Quizeum の Vanilla CSS デザインシステムとの統一が難しく、tier 拡張の制御も弱い
  - 単一 `isPremium` boolean のみ: Premium 追加時に機能差分の表現が破綻する

### Scope（本フェーズ）
- **In**:
  - `subscriptionTier: 'free' | 'pro' | 'premium'`（初版販売は `pro` のみ。`free` は暗黙デフォルト、`premium` はスキーマ予約）
  - Firestore `users` への `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd` 等の追加
  - `isPremium` は `tier !== 'free'` の導出（既存 `ask-ai` ゲートとの後方互換）
  - Core: `POST /api/billing/checkout-session`, `POST /api/billing/portal-session`, `POST /api/webhooks/stripe`（raw body 署名検証・冪等）
  - `firestore.rules`: billing フィールドのクライアント書き込み禁止
  - UI: `/pricing`（Pro プランカード、月額/年額、Checkout/Portal CTA）
  - Play-flow: プレイ画面の tier 連携、AI 制限到達時の `/pricing` 誘導、残り質問数表示の tier 反映
  - ナビ導線（サイドバーまたはプロフィールポップアップ等）
  - `docs/db_design.md`, `docs/api_specification.md`, `docs/screen_transition.md` の同期
  - Stripe テストモードでの E2E / 結合テスト
- **Out**:
  - Free プランの比較表示
  - Premium ティアの販売 UI（拡張ポイントのみ設計）
  - §2.5 の他 Pro 特典（模擬試験分析、弱点克服無制限、広告非表示、プライベートクイズ等）— 初版 Pro 特典は **AI 質問無制限** のみ
  - Stripe Elements によるアプリ内決済
  - ギフティング / BtoB 法人ライセンス
  - 管理者による手動 tier 付与 UI

### Constraints（本フェーズ）
- **Stripe v22**: `new Stripe(secretKey)` + async/await。Webhook は Node runtime・raw body 必須
- **Defense-in-depth**: エンタイトルメント判定はサーバーが Firestore を引き直し。クライアント送信の `isPremium` は無視（既存 `ask-ai` パターン踏襲）
- **環境変数**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Vanilla CSS**: 既存ネオンデザインシステムに準拠
- **プラン拡張**: `src/lib/subscription-plans.ts`（仮）に paid tier 定義を集約。UI は `paidTiers.map()` で描画

### Boundary Strategy（本フェーズ）
- **Core** が Stripe API・Webhook・エンタイトルメント永続化・Rules・`resolveUserEntitlements` を所有
- **Billing UI スペック** が `/pricing` と Checkout/Portal 起動・契約状態表示を所有
- **Play-flow UI** がプレイ中の tier 表示・制限誘導のみ所有（購入処理は Core API を UI から呼ぶ）
- **Shared seam**: tier → 機能ゲート（`hasProEntitlements` 等）は Core/lib に1か所集約

## Existing Spec Updates（Phase 13・依存順）
- [ ] quizeum-core -- `subscriptionTier` 型、Stripe Checkout/Portal サービス、Webhook ハンドラ、エンタイトルメント更新、Firestore Rules（billing フィールド保護）、`ask-ai` の tier 検証整合、`isPremium` 導出。Dependencies: none
- [ ] quizeum-play-flow-ui -- プレイ画面 `isPremium`/tier 連携（auth から導出）、AI 制限インジケーター・上限ダイアログの `/pricing` 誘導。Dependencies: quizeum-core
- [ ] quizeum-auth-profile-ui -- （任意・軽微）プロフィールまたは設定からの契約状態表示・Portal 導線。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 13）
- [ ] stripe-env-setup -- `.env.local` / デプロイ環境への Stripe キー・Price ID 設定、Stripe Dashboard で Pro Product/Price 作成手順を README または docs に記載
- [ ] docs-sync-billing -- `docs/db_design.md`（users サブスクフィールド）、`docs/api_specification.md`（billing API）、`docs/screen_transition.md`（`/pricing` 追加）
- [ ] firestore-rules-billing -- `isPremium` / `subscriptionTier` 等のクライアント書き込み遮断（viability チェックで検出された showstopper）

## Specs (dependency order)
- [ ] quizeum-billing-subscription-ui -- `/pricing` 画面、Pro プラン表示、Checkout/Portal CTA、契約状態 UI、ナビ導線。Dependencies: quizeum-core

---

## Phase 15: 通常モードプレイフィードバックフロー（2026-06-08 ディスカバリー）

### Overview（本フェーズ）
通常モードのプレイ体験を、回答後の即時正誤表示・「次へ」／「結果を見る」・スキップ（不正解）・楽観的結果遷移に改定する。「解答データを送信中...」を廃止し、結果画面の Suspense シェルを即時活用する。

### Approach Decision（本フェーズ）
- **Chosen**: 統一フィードバックフロー + 楽観的結果遷移（アプローチ A）
- **Why**: 全問題形式で一貫した学習 UX。`saveAttempt` 完了待ちを結果画面側にオフロードし Phase 12 の Suspense 投資を活かせる
- **Rejected alternatives**:
  - 早押しパターンの横展開のみ: 重複コード増、送信中画面は残る
  - 試験モードも同一フロー: ユーザー指定により通常のみ

### Scope（本フェーズ）
- **In**: `mode=normal` のフィードバック・スキップ・楽観的遷移、`usePlayState` 分離、`PostAnswerFeedback`、結果 Client の optimistic 読取
- **Out**: exam / flashcard / lateral / question-list / test-play、`saveAttempt` API 変更

### Constraints（本フェーズ）
- スキップ = 空回答と同等（`failedQuestionIds`）
- 通常モードでは詳細画面の即時正誤トグルを無効化（常に新フロー）

## Existing Spec Updates（Phase 15）
- [ ] quizeum-play-flow-ui -- 要件 17 追加、要件 3/5/15 改定、`usePlayState` 分離、楽観的結果遷移。Dependencies: none

## Specs (dependency order)
（Phase 15 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 20: 〇×問題形式の本格対応（2026-06-09 ディスカバリー）

### Overview（本フェーズ）
出題形式として **〇×問題（`true-false`）** をクリエイターが選べるようにし、プレイ時は **〇／×ボタンを1タップするだけで即回答** できる UX を提供する。型・バリデーション・採点ロジックは既に部分実装済みだが、エディタでの形式選択・作問 UI・プレイ専用 UI・形式ラベル／探索フィルタが未整備であり、現状は選択式と同じ `ChoiceAnswerPanel`（ラジオ＋「解答を確定する」）で体験が分かれていない。

### Approach Decision（本フェーズ）
- **Chosen**: 専用 `TrueFalseAnswerPanel` + `true-false` を第一級 `QuizFormat` として統合（アプローチ A）
- **Why**: データモデル（`choices` に固定「〇」「✕」2件）は既存テストデータ・バリデーションと互換。プレイは専用パネルで1タップ即送信、作問は正解トグル（〇／×）のみの簡素 UI にできる。`resolveQuizFormat`・探索カルーセル・`getFormatLabel` へ `true-false` を追加すれば他形式と対称になる。
- **Rejected alternatives**:
  - `ChoiceAnswerPanel` に `mode="true-false"` を追加: 確定ボタン除去は可能だが、大きな〇×ボタン・作問 UI 簡素化・形式ラベル分離が混在し保守コスト増
  - `correctTextAnswerList` ベースへ移行: 既存 Firestore データ・`isChoiceAnswerCorrect` 経路と非互換。移行コストに見合わない

### Scope（本フェーズ）
- **In**:
  - `Quiz.format` に `'true-false'` を追加（`types`・`quiz-format.ts`・`resolveQuizFormat` で単一形式クイズとして解決）
  - 作問エディタ: 出題形式カードに「〇×式」追加、複合形式の問題タイプトグルに「〇×」追加、`handleToggleQuestionType` / `addDefaultQuestion` / 形式一括変換で `true-false` 初期データ（固定 〇／× 選択肢 + 正解指定 UI）
  - プレイ UI: `TrueFalseAnswerPanel`（大きな 〇／× ボタン、タップ即 `submitAnswer`）。本番プレイ・test-play・弱点克服（review）で `true-false` 時に使用
  - 通常モード（Phase 15）フィードバックフローとの統合: 1タップ送信後は他形式と同様に正誤表示 → 次へ
  - `getFormatLabel` / `getFormatIcon` / `getFormatDescription` / `explore-formats.ts` への `true-false` 追加
  - 既存 `quiz-validation`（選択肢2件・正解1件）の維持。作問時は選択肢テキストを「〇」「✕」に固定（編集不可でも可 — design で確定）
  - E2E: 〇×形式クイズの作問→プレイ→1タップ回答
- **Out**:
  - 既存 `multiple-choice` の2択 UI 変更
  - 試験モード専用の別 UX（本フェーズは通常モード中心。exam でも同パネル使用で足りる）
  - `saveAttempt` API・採点ロジックの変更（`isChoiceAnswerCorrect` 継続）
  - ウミガメ・早押し・連想への〇×適用

### Constraints（本フェーズ）
- 選択肢は常に2件（`choiceText`: 「〇」「✕」）。正解はどちらか1つのみ（`isCorrect: true` は1件）
- 1タップ回答 = ボタン押下と同時に `onConfirm(choiceId)` を呼ぶ（確定ボタンなし）
- データ後方互換: 既存 `type: 'true-false'` 問題はそのままプレイ可能
- Vanilla CSS / CSS Modules、既存プレイ画面デザインシステムに準拠
- Phase 15 未完了でも本フェーズは独立実装可能（フィードバック有無は `isNormalFeedbackFlow` に従う）

### Boundary Strategy（本フェーズ）
- **Core**: `QuizFormat` 型拡張、`resolveQuizFormat` の `true-false` 単一形式解決、バリデーション文言・デフォルト選択肢ヘルパ（任意）
- **Creator-dash UI**: 形式選択・問題タイプトグル・〇×作問 UI（正解トグル）
- **Play-flow UI**: `TrueFalseAnswerPanel`、本番/test-play/review への組み込み、形式ラベル・探索カルーセル
- **Shared seam**: 固定 〇／× 選択肢の生成は `src/lib/true-false-defaults.ts`（仮）等に1か所集約

## Existing Spec Updates（Phase 20・依存順）
- [ ] quizeum-core -- `Quiz.format` に `true-false`、`resolveQuizFormat` 単一形式対応、形式ラベル lib 更新、デフォルト選択肢ヘルパ（任意）。Dependencies: none
- [ ] quizeum-creator-dash-ui -- エディタ形式カード・複合トグル・〇×作問 UI・形式変換ロジック。Dependencies: quizeum-core
- [ ] quizeum-play-flow-ui -- `TrueFalseAnswerPanel`、プレイ／test-play／review 統合、探索形式カルーセル。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 20）
- [ ] true-false-e2e -- 〇×形式の作問→プレイ E2E 追加
- [ ] docs-sync-true-false -- `docs/db_design.md` の `true-false` 単一形式記述、`docs/screen_transition.md` 形式一覧の同期

## Specs (dependency order)
（Phase 20 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 21: ホームフィード無限スクロール & フィルタUI再編（2026-06-09 ディスカバリー）

### Overview（本フェーズ）
トップ（ホーム）画面の探索 UX を整理する。ジャンル・出題形式の絞り込みを検索エリア（`ExploreSearchSection`）のフィルタ領域へ移設し、ホーム直下の `ExploreAccordionsPanel` は廃止する。ジャンル・出題形式は現状と同様の横スクロールカルーセル（`GenreCarousel` / `FormatCarousel`）を踏襲し、`ExploreAccordion` による折りたたみは廃止して**常時表示**とする（難易度・問題数・プレイ状況のみ「フィルター」ボタンで開閉）。クイズ一覧は初回少量取得＋スクロール末端での自動追加読み込み（無限スクロール）に改修し、スクロール時は検索バー行を画面上部に固定表示する。

### Approach Decision（本フェーズ）
- **Chosen**: Firestore カーソルページング（タブフィード）+ 検索モード用オフセットカーソル（ハイブリッド検索の段階的取得）+ `position: sticky` 検索バー
- **Why**: 新着／人気／トレンド／フォロー TL は単一 Firestore クエリで `startAfter` カーソルが自然に適用できる。`searchQuizzes` はマルチクエリ＋クライアント合成のため、初版は「バッチ取得＋オフセットカーソル」で段階的に結果を返し、UI は単一の `loadMore` 契約で扱う。ジャンル／形式 UI のフィルタパネル集約は DOM 簡素化とスクロール量削減に直結する。
- **UI 確定（2026-06-09）**: ジャンル・出題形式は横スクロールカルーセルを維持。アコーディオンは廃止しカルーセルを常時表示。コンパクトなドロップダウン／セレクト方式は採用しない。
- **Rejected alternatives**:
  - **アコーディオン維持＋フィルタ内に複製**: 二重 UI となり Phase 11 要件と矛盾し、スクロール量が増える。
  - **コンパクトドロップダウン／セレクト**: 現状カルーセルの視認性・タップしやすさを損なう。
  - **全件一括取得のクライアント分割表示**: 現状の limit 30/100 取得を配列 slice するだけでは通信量・初回表示が改善しない。
  - **外部 infinite scroll ライブラリ導入**: `IntersectionObserver` + 既存フック拡張で十分。依存追加は不要。

### Scope（本フェーズ）
- **In**:
  - ホーム: `ExploreAccordionsPanel` の削除
  - `ExploreSearchSection` へジャンル・出題形式の横スクロールカルーセルを移設（`GenreSearchField` + `GenreCarousel`、`FormatCarousel` を再利用）
  - ジャンル・出題形式カルーセルは `ExploreAccordion` なしで**常時表示**（「フィルター」ボタンの開閉対象外）。難易度・問題数・プレイ状況のみ従来どおりフィルタパネルで開閉
  - フィルタパネル選択と `HomeFeedFilters.genreId` / `format` の既存状態共有（統合検索バーのジャンルサジェストとの同期維持）
  - `useExploreQuizFeed` の無限スクロール対応: `loadMore` / `hasMore` / `loadingMore`、初回ページサイズ（例: 20件）
  - タブ（新着／人気／トレンド／フォロー TL）およびフィルタ／検索有効時の追加読み込み
  - スクロール時の検索バー行（`searchBar`）の sticky 固定（サイドバーレイアウト・モバイル BottomNav との z-index 整合）
  - 追加読み込み中のフッタースケルトン／スピナー、末尾到達時の「これ以上ありません」または非表示
  - `quizeum-core`: 一覧 API のカーソル返却（`PaginatedQuizResult { items, nextCursor }`）、`searchQuizzes` の段階的取得拡張
  - フィルタ・タブ・検索条件変更時は一覧をリセットして先頭ページから再取得
  - E2E / フックテスト: スクロール追加読み込み、sticky 検索バー、フィルタ内ジャンル・形式選択
- **Out**:
  - ジャンル別一覧（`/genres/[genreName]`）・タグ別一覧（`/tags/[tagName]`）への無限スクロール適用（将来拡張可）
  - クイック検索チップ行・フィルタパネル全体の sticky 化（検索バー行のみ In）
  - URL クエリによるフィルタ共有可能化（Phase 11 Out の継続）
  - `searchQuizzes` の全文検索エンジン化・サーバー専用サジェスト API 新設
  - 出題形式専用ルート（`/formats/[format]`）の新設

### Constraints（本フェーズ）
- ページサイズはタブ・検索で共通定数（初期 20 件、設計で確定可）
- デバウンス 300ms は検索・フィルタ変更時の先頭再取得に維持。追加読み込みはデバウンス不要
- プレイ状況フィルタ（未プレイ／プレイ済み）はクライアント側後段フィルタのまま。件数不足時は追加読み込みを継続するロジックを UI 層で考慮（`hasMore` かつ表示件数が閾値未満なら自動追読み込み可）
- sticky は `searchBar` 行のみ。背景・blur・z-index は既存ネオンデザインと Sidebar / BottomNav と競合しないこと
- Vanilla CSS / CSS Modules。Phase 11 要件 13 のホームアコーディオン正本は本フェーズで**検索セクション内の常時表示カルーセル正本**へ改定（`quizeum-play-flow-ui` requirements 更新が必要）
- ジャンルカルーセル上部の `GenreSearchField`（ジャンル名絞り込み）は現状どおり維持してよい
- Firestore カーソルは `DocumentSnapshot` 相当を base64url 等でエンコード（既存 `attempts` プレイ履歴パターンと整合）

### Boundary Strategy（本フェーズ）
- **Core**: `getLatestQuizzes` / `getPopularQuizzes` / `getTrendingQuizzes` / `getFollowedTimeline` / `getQuizzesByGenre` のカーソル対応、`searchQuizzes` の `cursor` + `limit` 拡張、`PaginatedQuizResult` 型
- **Play-flow UI**: `ExploreSearchSection` へカルーセル常時表示を統合（アコーディオン廃止）、`ExploreAccordionsPanel` ホームからの除去、`useExploreQuizFeed` 無限スクロール、`IntersectionObserver` センティネル、sticky 検索バー CSS
- **Shared seam**: ページング契約は `src/types` または `quiz.ts` に1か所。ホームのみが初版の消費者

## Existing Spec Updates（Phase 21・依存順）
- [ ] quizeum-core -- 公開クイズ一覧・検索 API のカーソルページング（`PaginatedQuizResult`）、`searchQuizzes` 段階的取得。Dependencies: none
- [ ] quizeum-play-flow-ui -- 検索セクションへジャンル／出題形式カルーセル常時表示（アコーディオン廃止）、ホーム無限スクロール、sticky 検索バー、Phase 11 要件 13 のホーム UI 正本改定。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 21）
- [ ] home-feed-e2e -- ホーム無限スクロール・sticky 検索バー・フィルタ内ジャンル選択の E2E
- [ ] useExploreQuizFeed-tests -- フックの loadMore / リセット / hasMore の単体テスト

## Specs (dependency order)
（Phase 21 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 22: ホーム／検索 IA 分離 & ディスカバリーホーム（2026-06-09 ディスカバリー）

### Overview（本フェーズ）
情報設計（IA）を再編する。現行の統合検索＋タブ＋無限スクロール画面（`HomeClient` / `ExploreSearchSection`）は **`/search` の検索メニュー**へ移設し、`/` にはディスカバリー向けの新ホームを新設する。新ホームは「おすすめクイズ（トレンド Top 10）」「おすすめジャンル（カルーセル）」「新着クイズ（カルーセル）」の3セクションで構成し、各「もっと見る」およびジャンルカードから検索画面へ深いリンクで遷移する。検索画面ではフィルタパネルを閉じても、検索バー直下にアクティブなフィルタ条件を常時表示する。

### Approach Decision（本フェーズ）
- **Chosen**: ルート分離 + URL クエリ（アプローチ A）
- **Why**: ホームを軽量な発見体験に、検索を条件指定＋一覧探索に役割分担できる。ジャンル選択・タブ指定・フィルタパネル初期展開を URL で表現すれば、カルーセルからの導線がリロード後も再現でき、E2E も安定する。
- **Rejected alternatives**:
  - **クライアント state のみ**: リロードでフィルタ・タブが失われ、ジャンル深いリンク不可。
  - **単一ページ内タブ（ホーム｜検索）**: 「ホームを検索メニューに降格」という IA 要件とずれる。

### Scope（本フェーズ）
- **In**:
  - **新ホーム `/`**: 3セクション構成
    1. **おすすめクイズ**: `getTrendingQuizzes(10)` 相当のトレンド Top 10 を横スクロールカルーセル（`QuizCard` ベース）で表示。「もっと見る」→ `/search?tab=trending`
    2. **おすすめジャンル**: ジャンルカルーセル（`GenreCarousel` 再利用可）。ジャンルクリック → `/search?genreId={id}`（検索画面でジャンルフィルタ選択状態）。「もっと見る」→ `/search?openFilters=1`（フィルタパネルを開いた初期状態）
    3. **新着クイズ**: `getLatestQuizzes(N)` を横スクロールカルーセルで表示（初版 N=10 想定）。「もっと見る」→ `/search?tab=latest`
  - **検索画面 `/search`**: 現行 `HomeClient` の機能を移設（統合検索・タブ・無限スクロール・ジャンル／形式カルーセル等。Phase 21 実装内容も本ルートが正本）
  - **URL クエリ契約**（検索画面）:
    - `tab`: `latest` | `popular` | `trending` | `timeline`（未指定時は `latest`）
    - `genreId`: ジャンルフィルタ初期値（`HomeFeedFilters.genreId`）
    - `format`, `q`, `tags` 等: 必要最小限でフィルタ同期（design で確定）
    - `openFilters=1`: フィルタパネル初期展開
  - **フィルタ条件の常時表示**: フィルタパネルを閉じても検索バー下にアクティブ条件チップ（ジャンル・出題形式・難易度・問題数・タグ・プレイ状況等）を表示。各チップに × で個別解除、一括クリアは既存 `onClearAll` と整合
  - **ナビ更新**（`quizeum-sidebar-layout`）: Sidebar / BottomNav に「検索」→ `/search` を追加。ホーム → `/`（新ディスカバリー画面）。ロゴリンクは `/` を維持
  - **Core**: 新ホーム向けデータ取得は既存 `getTrendingQuizzes` / `getLatestQuizzes` / `listActiveGenres`（およびおすすめジャンル用に `/api/genres/weekly-top` のメタ結合）を再利用。新規 ranking エンジンは不要
  - RSC + Suspense: 新ホーム各セクションは Phase 12 パターン（シェル先行 + スケルトン）に準拠
  - `docs/screen_transition.md`・`docs/requirements_definition.md`（F-601 等）のホーム／検索記述更新
  - E2E: 新ホーム各「もっと見る」→ 検索タブ／フィルタ状態、ジャンルカード → ジャンルフィルタ、フィルタチップ常時表示
- **Out**:
  - パーソナライズドおすすめ（プレイ履歴・協調フィルタ）
  - ホームでの統合検索・タブ・無限スクロール（すべて `/search` へ移管）
  - 検索画面以外（ジャンル別一覧 `/genres/*`）への URL クエリフィルタ共通化
  - おすすめジャンルの手動キュレーション UI
  - Phase 21 未完了分の一括実装（Phase 22 は IA 分離と新ホームを優先。検索 UI 再編は `/search` 移設時に Phase 21 と整合）

### Constraints（本フェーズ）
- おすすめクイズの定義は **トレンド順 Top 10** に固定（`getTrendingQuizzes` / `getTrendingQuizzesPage` と同一ソート規則）
- おすすめジャンル: 初版は **`listActiveGenres` 全アクティブジャンルをカルーセル表示**（週間 Top への差し替えは follow-up 可。UI 契約はカルーセル＋クリック遷移のみ固定）
- 新着カルーセル: **`getLatestQuizzes(10)`** と `tab=latest` の一覧が同一ソート規則であること
- Vanilla CSS / CSS Modules。横スクロールカルーセルは Phase 11 の `scroll-snap` パターンを再利用
- Phase 21 で Out としていた「URL クエリによるフィルタ共有可能化」は、**本フェーズでは `/search` ルートに限り In** とする
- BottomNav: モバイルは項目数制約のため、ホーム（`/`）と検索（`/search`）の2導線を Sidebar / BottomNav で明示（既存通知・ブックマーク等とのレイアウトは design で調整）

### Boundary Strategy（本フェーズ）
- **Core**: 既存一覧 API の再利用のみ。URL ↔ `HomeFeedFilters` / タブ状態のパース・シリアライズは `src/lib/search-url-state.ts`（仮）等 lib に1か所集約
- **Play-flow UI**: 新 `HomeDiscoveryClient`（仮）、`/search` への `SearchClient`（現 `HomeClient` 移設）、`ExploreSearchSection` のフィルタチップ常時表示、`QuizCarousel`（仮）新規コンポーネント
- **Sidebar-layout**: ナビ項目追加・active 判定（`/` と `/search` を区別）
- **Shared seam**: 検索画面のフィルタ状態は `HomeFeedFilters` + `activeTab` を正とし、URL クエリはその投影。ホームカルーセルは読み取り専用でフィルタ状態を持たない

## Existing Spec Updates（Phase 22・依存順）
- [ ] quizeum-core -- 検索 URL 状態の型・パース／シリアライズ lib（`tab` / `genreId` / `openFilters` 等）、既存 API 再利用の要件明記。Dependencies: none
- [ ] quizeum-play-flow-ui -- 新ホーム `/`（3カルーセル＋もっと見る深いリンク）、検索 `/search`（現ホーム移設）、フィルタ条件常時表示チップ、`screen_transition` 同期。Dependencies: quizeum-core（URL 状態 lib）
- [ ] quizeum-sidebar-layout -- Sidebar / BottomNav に「検索」追加、ホーム／検索のアクティブ判定。Dependencies: none（ルート確定後）

## Direct Implementation Candidates（Phase 22）
- [ ] docs-sync-home-search-ia -- `docs/screen_transition.md`（`/` 新ホーム、`/search` 検索）、`docs/requirements_definition.md`（F-601 ホーム／検索分離）
- [ ] search-url-state-lib -- `src/lib/search-url-state.ts`（仮）: クエリ ↔ フィルタ／タブ変換、単体テスト
- [ ] home-search-ia-e2e -- 新ホーム「もっと見る」・ジャンルクリック・検索フィルタチップ表示の E2E

## Specs (dependency order)
（Phase 22 では新規 spec なし — 上記 Existing Spec Updates のみ）

---

## Phase 23: リスト探索・マイクイズ・設定・ナビ拡張（2026-06-09 ディスカバリー）

### Overview（本フェーズ）
ナビゲーションと個人向け学習体験を拡張する。Sidebar / BottomNav に「リスト」「マイクイズ」を追加し、リストの検索・公開/非公開切り替えページを新設する。マイクイズでは、自作クイズ・ブックマーククイズ・ブックマークリスト内クイズ・ブックマーク問題を横断して検索・フィルタし、条件と出題数を指定してプレイを開始できる。あわせて、廃止されたリアクション機能のマイページ導線を削除し、アカウントポップアップに「設定」（ダーク/ライトテーマ切り替え等）を追加する。

### Approach Decision（本フェーズ）
- **Chosen**: 機能別3スペック + 既存スペック更新 + 小規模直接実装（アプローチ A）
- **Why**: リスト探索・マイクイズ・設定/テーマは責務とデータフローが異なる。マイクイズは問題プール合成・セッション生成・プレイ起動と複数レイヤにまたがり単一スペックにまとめると20タスク超とレビュー境界が曖昧になる。リスト探索は既存 `quiz-list.ts` の再利用で独立実装可能。設定/テーマはアプリシェル横断のため専用スペックが適切。
- **Rejected alternatives**:
  - **単一 `quizeum-personal-hub-ui` スペック**: リスト・マイクイズ・設定を1本化。実装・レビュー単位が肥大化し、Phase 22 のナビ項目増と競合する。
  - **play-flow への丸ごと吸収**: `quizeum-play-flow-ui` は既に Phase 21/22 でホーム/検索 IA 再編中。マイクイズのセッション契約とリスト探索を同時に載せるとスペック境界が不明瞭になる。

### Scope（本フェーズ）
- **In**:
  - **リスト** (`/lists`): キーワード検索、公開リスト / 非公開リスト（本人の未公開）タブ切り替え、クイズリスト・問題リストの種別表示、リスト詳細 (`/list/[id]`) への導線
  - **マイクイズ** (`/my-quiz`): ログイン必須。4ソース（自作クイズ内問題＝公開・下書き・非公開を含む、ブックマーククイズ内問題、ブックマークリスト内クイズの問題、ブックマーク問題）の統合プール、キーワード・ジャンル・タグ・出題形式・難易度等のフィルタ、出題数指定、シャッフル有無、プレイ開始
  - **設定** (`/settings`): アカウントポップアップから遷移。ダーク/ライトテーマ切り替え（`localStorage` 永続化、初版は CSS 変数の `[data-theme]` 切替）。プロフィール編集 (`/profile/edit`) への導線
  - **ナビ**: Sidebar に「リスト」「マイクイズ」追加。アカウントポップアップに「設定」追加
  - **マイページ**: 本人プロフィールから「リアクション履歴」ボタンを削除（機能廃止に伴う導線整理）
  - **Core**: リスト検索クエリ（公開フィード + 本人非公開）、マイクイズ用アドホック問題セッション（既存 `question-list-session` パターン拡張または `my-quiz-session` 新設）
  - `docs/screen_transition.md` 同期、E2E（リスト検索、マイクイズ起動、テーマ切替、リアクション導線削除）
- **Out**:
  - リアクション機能本体の削除（`reaction.ts` / Firestore `reactions` コレクションのデータマイグレーション）— 本フェーズは UI 導線削除のみ
  - `/profile/[uid]/likes` ルートの即時削除（404 化は follow-up 可。初版はマイページからのリンク削除を正とする）
  - マイクイズの URL 共有可能化・保存済みプリセット
  - リストのソーシャル機能（フォロー、ランキング）
  - 設定の通知音・言語・アクセシビリティ詳細（テーマ以外は follow-up）
  - サーバー側ユーザー設定永続化（初版テーマはクライアント `localStorage` のみ）

### Constraints（本フェーズ）
- リスト公開/非公開: **公開** = `isPublished === true` のリスト（`getLatestQuizLists` 相当 + キーワード絞り込み）。**非公開** = ログインユーザー本人の `isPublished === false` のみ（`getQuizListsByAuthor(uid, includeUnpublished: true)` のサブセット）
- マイクイズ: 非公開・下書きクイズの問題は自作ソースにのみ含める。ブックマークソースは公開済み親クイズの問題に限定（既存 `question-attach-search` 契約に準拠）
- マイクイズプレイ: 既存プレイエンジンに `mode=my-quiz` 分岐を追加し、アドホックセッション（`my-quiz-session`）で連続出題（保存リスト不要）。`mode=question-list` とは別契約
- テーマ: Vanilla CSS。`:root`（dark）と `[data-theme="light"]` でトークン二系統。Tailwind 不使用
- モバイル BottomNav: 現行5項目（ホーム・検索・通知・ブックマーク・プロフィール）に2項目追加は過密。**初版は Sidebar 優先追加、BottomNav は design で「リスト」「マイクイズ」の配置方針を決定**（例: プロフィールポップアップ経由、または「その他」シート）
- ログイン必須: マイクイズ・非公開リストタブ・設定の一部

### Boundary Strategy（本フェーズ）
- **quizeum-lists-discovery-ui**: `/lists` ページ、検索 UI、公開/非公開タブ、リストカード一覧
- **quizeum-my-quiz-ui**: `/my-quiz` ページ、4ソース統合フィルタ、出題数・プレイ開始、セッション初期化
- **quizeum-user-settings-ui**: `/settings`、テーマ Provider/切替、ライトトークン定義
- **quizeum-sidebar-layout**: ナビ項目・ポップアップメニュー・モバイル導線
- **quizeum-auth-profile-ui**: マイページからリアクション履歴削除
- **quizeum-core**: `searchLists`（仮）、マイクイズセッション lib、必要なら Firestore インデックス
- **Shared seam**: 問題プール取得ロジックは `question-attach-search` / `useQuestionAttachSearch` を Core または lib に抽出し、リストエディタとマイクイズで共有

## Existing Spec Updates（Phase 23・依存順）
- [x][impl] quizeum-core -- リスト検索 API、マイクイズ用アドホックセッション lib、問題プール lib、`my-quiz` attempt 契約。Dependencies: none
- [x][impl] quizeum-sidebar-layout -- 「リスト」「マイクイズ」ナビ、「設定」ポップアップ、モバイル Header ポップアップ。Dependencies: none
- [x][impl] quizeum-auth-profile-ui -- マイページ「リアクション履歴」導線削除、F-407 skip。Dependencies: none

## Direct Implementation Candidates（Phase 23）
- [x] remove-reaction-history-e2e -- F-407 を `test.skip`（10.3 で実施済み）
- [ ] docs-sync-phase23 -- `docs/screen_transition.md` に `/lists` `/my-quiz` `/settings` を追記

## Specs (dependency order)
- [x][impl] quizeum-lists-discovery-ui -- リスト検索ページ（公開/非公開切替）。Dependencies: quizeum-core
- [x][impl] quizeum-my-quiz-ui -- マイクイズ（4ソース統合フィルタ・出題数指定・プレイ開始）。Dependencies: quizeum-core
- [x][impl] quizeum-user-settings-ui -- 設定ページとダーク/ライトテーマ。Dependencies: quizeum-sidebar-layout

---

## Phase 24: UI 刷新 — shadcn/ui + Tailwind（2026-06-09 ディスカバリー）

### Overview（本フェーズ）
Quizeum 全体の UI を shadcn/ui + Tailwind CSS で再構築する。既存の Vanilla CSS / CSS Modules（約 80 ファイル・130 コンポーネント）を段階的に置き換え、**機能・ルーティング・データフローは維持**する。ライト/ダークテーマは shadcn の `dark` クラス戦略と既存 `ThemeProvider` / `localStorage` 永続化を統合する。

### Visual Direction（本フェーズ）
- **Chosen**: **shadcn 標準寄せ** — shadcn/ui デフォルトのクリーンな UI を正とする
- **Why**: 保守性・一貫性・コンポーネント再利用を最大化。カスタム Glassmorphism / ネオングロー等の再現コストを避け、shadcn エコシステムのデフォルトパターンに揃える。
- **Rejected alternatives**:
  - **ブランド維持（ネオン紫/ティール + Glassmorphism 移植）**: shadcn 標準から乖離し、テーマ保守コストが高い。
- **具体方針**:
  - shadcn CLI デフォルトテーマ（neutral/zinc 系、`--radius` 等）をベースに採用
  - 既存 `variables.css` のネオン/Glassmorphism トークンは**移植しない**（移行完了後に削除）
  - カスタム色は最小限（必要なら `--primary` のみ微調整。初版はデフォルト優先）
  - タイポグラフィ: shadcn 推奨（Geist または Inter）。Google Fonts の Outfit 依存は撤廃可
  - カード・サーフェス: shadcn `Card` / 標準 border + shadow。glass-blur 不使用
  - ダークモード: shadcn 標準 `dark` パレット。ライトをデフォルト表示とするかは design で決定（`ThemeProvider` 既存 default=dark は shadcn 標準に合わせて見直し可）

### Approach Decision（本フェーズ）
- **Chosen**: 基盤スペック + ドメイン別垂直スライス（アプローチ B）
- **Why**: 全コンポーネント一括置換は 20 タスク超・レビュー不能。基盤（Tailwind/shadcn/トークン）を先に固め、ドメイン単位で CSS Modules を削除する strangler パターンがリスク最小。各スライス完了時に E2E で機能回帰を確認できる。
- **Rejected alternatives**:
  - **単一 `quizeum-ui-refresh` スペック**: 全 UI を 1 本化。タスク数・レビュー境界・並列実装が困難。
  - **水平レイヤー（Primitives → Layout → Pages）**: 途中状態で CSS Modules と Tailwind が長期混在し、トークン二重管理が発生しやすい。
  - **ビジュアル刷新のみ（Tailwind なし）**: ユーザー要件（shadcn/ui 採用）を満たさない。
  - **ブランド維持型テーマ移植**: 上記 Visual Direction で却下。

### Scope
- **In**:
  - Tailwind CSS v4（または Next.js 16 推奨構成）+ shadcn/ui 初期化（`components.json`, `src/components/ui/*` Radix プリミティブ）
  - shadcn デフォルト CSS 変数（`globals.css`）を正としたテーマ定義。既存 `variables.css` は移行期のみ共存し、全スライス完了後に削除
  - `ThemeProvider` を shadcn 互換（`class="dark"` on `<html>` または dual サポート）に移行。`localStorage` 永続化・FOUC 防止スクリプト維持
  - 全ドメイン UI 再構築: シェル、探索、個人ハブ、クイズライフサイクル、エディタ、管理/クリエイター
  - 既存 Playwright E2E の selector 更新（`data-testid` 優先維持）
  - `.kiro/steering/tech.md` / `structure.md` のスタック記述更新
- **Out**:
  - 新機能追加（IA 変更、新ルート、API 変更）
  - バックエンド / Firestore / 認可ロジック変更
  - 旧 Quizeum ビジュアル（ネオングロー、Glassmorphism、body gradient）の再現
  - Framer Motion 導入（未使用のまま）
  - Stripe Pricing Table 等サードパーティ埋め込みのスタイル統一

### Constraints
- **機能維持**: 全ルート・インタラクション・認可・プレイ契約は変更しない（見た目と DOM 構造の最小限変更のみ）
- **Play 没入型**: `/play` パスでは Sidebar/BottomNav 非表示 — 移行後も `LayoutWrapper` 契約を維持
- **React 19 / Next.js 16**: shadcn/ui 最新 CLI で互換確認済みであること
- **混在期間**: 各スライス完了まで未移行ドメインは CSS Modules のまま共存可。スライス完了時に当該 `.module.css` を削除
- **E2E**: 各スライス完了時に関連 Playwright spec をグリーンに保つ

### Boundary Strategy（本フェーズ）
- **quizeum-ui-foundation**: Tailwind/shadcn セットアップ、トークン、テーマ bridge、`cn()` ユーティリティ、steering 更新
- **quizeum-ui-layout-shell**: Sidebar / Header / BottomNav / LayoutWrapper
- **quizeum-ui-discovery**: ホーム、検索、ジャンル/タグ探索、リスト探索、カルーセル
- **quizeum-ui-personal**: プロフィール、ブックマーク、通知、設定、マイクイズ、ログイン
- **quizeum-ui-quiz-lifecycle**: クイズ詳細、プレイ、結果、復習、リーダーボード
- **quizeum-ui-editor**: クイズエディタ、リストエディタ、DnD ソート
- **quizeum-ui-admin-creator**: 管理画面、モデレーション、クリエイターダッシュボード、コミュニティツール
- **Shared seam**: shadcn プリミティブ（Button, Input, Dialog, Tabs, Skeleton 等）は foundation で提供し、全スライスが `src/components/ui/` を共有

## Existing Spec Updates（Phase 24・依存順）
- [ ] steering-tech-structure -- `tech.md` / `structure.md` のスタイリング方針を Tailwind + shadcn に改定。Dependencies: quizeum-ui-foundation（方針確定後）
- [ ] quizeum-sidebar-layout -- シェル移行後 requirements/design の Tailwind 禁止条項を削除・更新。Dependencies: quizeum-ui-layout-shell
- [ ] quizeum-play-flow-ui -- 探索 UI 移行に伴う design 更新。Dependencies: quizeum-ui-discovery
- [ ] quizeum-lists-discovery-ui -- リスト UI 移行に伴う design 更新。Dependencies: quizeum-ui-discovery
- [ ] quizeum-user-settings-ui -- テーマ切替を shadcn 方式に更新。Dependencies: quizeum-ui-foundation
- [ ] quizeum-auth-profile-ui -- プロフィール UI 移行。Dependencies: quizeum-ui-personal
- [ ] quizeum-my-quiz-ui -- マイクイズ UI 移行。Dependencies: quizeum-ui-personal
- [ ] quizeum-billing-subscription-ui -- 料金 UI 移行。Dependencies: quizeum-ui-personal
- [ ] quizeum-creator-dash-ui -- ダッシュボード UI 移行。Dependencies: quizeum-ui-admin-creator
- [ ] quizeum-moderation-governance-ui -- モデレーション UI 移行。Dependencies: quizeum-ui-admin-creator
- [ ] quizeum-admin-users-ui -- ユーザー管理 UI 移行。Dependencies: quizeum-ui-admin-creator

## Direct Implementation Candidates（Phase 24）
- [ ] e2e-selector-audit -- 移行各スライスで `data-testid` 欠落・class 依存 selector を洗い出し更新
- [ ] css-modules-cleanup -- 全スライス完了後に未参照 `.module.css` と `variables.css` レガシー削除

## Specs (dependency order)
- [x] quizeum-ui-foundation -- Tailwind + shadcn 初期化、トークン、テーマ bridge。Dependencies: none
- [x] quizeum-ui-layout-shell -- 共通シェル再構築。Dependencies: quizeum-ui-foundation
- [x] quizeum-ui-discovery -- 探索・リスト UI 再構築。Dependencies: quizeum-ui-layout-shell
- [x] quizeum-ui-personal -- 個人ハブ UI 再構築。Dependencies: quizeum-ui-layout-shell
- [x] quizeum-ui-quiz-lifecycle -- クイズ詳細/プレイ/結果 UI 再構築。Dependencies: quizeum-ui-layout-shell
- [x] quizeum-ui-editor -- エディタ UI 再構築。Dependencies: quizeum-ui-foundation, quizeum-ui-layout-shell
- [x] quizeum-ui-admin-creator -- 管理/クリエイター UI 再構築。Dependencies: quizeum-ui-layout-shell

---

## Phase 25: AI作問・サムネ生成（Gemini / Pro限定）（2026-06-10 ディスカバリー）

### Overview（本フェーズ）
クイズエディタに **Gemini ベースの AI 作問**を追加する。Pro プラン（有効契約）ユーザのみがプロンプトを入力して「生成」を実行し、**10問を一括生成**して出題形式に合わせた JSON をパースし、エディタの問題カードへ即時反映する。あわせてクイズの **タイトル・説明文** を基にしたサムネイル画像の AI 生成（Pro 限定、1日20回）を提供する。無料ユーザには機能を非表示または Pro 誘導のみ表示する。プレイ時の水平思考 AI（`ask-ai` / `verify-truth`）とは **別の日次カウンタ** と API 境界とする。

### Approach Decision（本フェーズ）
- **Chosen**: 単一 Gemini 呼び出し + 構造化 JSON（`responseSchema`）+ サーバー側バリデーション + Firebase Storage へのアップロード（**アプローチ A — ユーザー確認済み 2026-06-10**）
- **反映モード（確認済み）**: 生成 10 問は既存問題リストへ **追加**（末尾追記。既存問題の削除・上書きは行わない）
- **Why**: 10問一括は1リクエストでテーマ一貫性と UX（待ち時間）を両立できる。既存 `addDefaultQuestion` / `quiz-validation` の型・フィールド契約にマッピングすればエディタ反映は state 更新のみ。サムネは生成バイナリを `uploadImage` + `getQuizCoverPath` で Storage 化し、現行 picsum スタブを置換する。
- **Rejected alternatives**:
  - **10回個別 API 呼び出し**: 遅延・コスト・レート制限消費が10倍。一括生成の UX と矛盾。
  - **クライアント直接 Gemini 呼び出し**: API キー漏洩・エンタイトルメント改ざん・レート制限回避のリスク。
  - **サムネ外部 URL のみ（Storage なし）**: OGP・CDN 信頼性・永続化に弱い。既存 `thumbnailUrl` 契約と不整合。

### Scope（本フェーズ）
- **In**:
  - `POST /api/quiz/ai-generate-questions` — 認証必須、Pro エンタイトルメント必須、プロンプト + クイズ `format`（+ 任意でタイトル・説明・ジャンルコンテキスト）→ 10問 JSON → サーバー検証済み `Question[]` 返却
  - `POST /api/quiz/ai-generate-thumbnail` — 認証必須、Pro 必須、タイトル + 説明文 → 画像生成 → Storage アップロード → `thumbnailUrl` 返却
  - 日次制限（JST 0時リセット、既存 `ask-ai` と同型）: 作問生成 **100回/日/ユーザ**、サムネ生成 **20回/日/ユーザ**（**Pro ユーザにも適用**）
  - カウンタ: `users/{uid}/dailyAiAuthoringCounts/{docId}`（`questions` / `thumbnail`）— プレイ用 `dailyAiTurnCounts` と分離
  - エディタ UI: AI 作問パネル（プロンプト入力・生成・ローディング・エラー・上限到達・Pro 誘導）、生成結果の問題リスト末尾への **追加反映**（既存問題は保持）
  - エディタ UI: サムネ AI 生成ボタン（メタデータセクション）、生成中状態、上限・Pro 誘導
  - `resolveUserEntitlements` によるサーバー側 Pro 判定（クライアント tier 盲信禁止）
  - 出題形式別 JSON スキーマ: `multiple-choice`, `true-false`, `text-input`, `quick-press`, `sorting`, `association`。**`mixed` は各問タイプをスキーマ内で列挙**。`lateral-thinking` は初版 **Out**（真相・秘密設定の品質リスク — follow-up で専用プロンプト）
  - E2E・API 単体テスト（モック Gemini）、`pricing-display` の Pro 特典文言更新
- **Out**:
  - Premium ティア独自の作問上限（Pro と同一扱い）
  - 1問ずつの逐次生成 UI（初版は10問一括のみ）
  - 問題単位 `imageUrl` の AI 生成
  - プレイ時 AI（`ask-ai` / `verify-truth`）の制限・プロンプト変更
  - 無料ユーザのお試し生成（1回など）
  - 生成問題の自動公開・Firestore 自動保存（反映はエディタ state のみ。保存は既存下書き/公開フロー）

### Constraints（本フェーズ）
- Gemini: 既存 `GEMINI_API_KEY` / `GEMINI_MODEL_ID` を流用。テキスト作問は flash 系、画像は Imagen 対応モデルまたは Gemini 画像生成 API（design でモデル ID 確定・viability 確認済み前提）
- JSON 出力はサーバーで Zod / 既存 `quiz-validation` と二段階検証。不合格フィールドは除外またはエラー返却（design で確定）
- プロンプト最大長・禁止コンテンツ方針は `ask-ai`（100文字）より緩め（例: 500文字）— requirements で確定
- 生成問題数は固定 **10問**（不足時はエラー、超過は切り捨て）
- モデレーター免除: プレイ AI と同様 `moderationTier` moderator/senior_moderator は作問レート制限免除可（design で確定）
- shadcn + Tailwind（Phase 24 移行後エディタ）に UI を追加

### Boundary Strategy（本フェーズ）
- **quizeum-core**: API Routes、Gemini クライアント、プロンプト/パース util、日次カウンタ、Pro ゲート、Storage アップロード、JSON→`Question` マッピング、Firestore Rules（カウンタ doc のクライアント書き込み遮断）
- **quizeum-ai-quiz-authoring**: 機能要件・UX・API 契約・エディタ統合コンポーネント（`AiQuizAuthoringPanel` 等）、E2E
- **quizeum-ui-editor**: エディタレイアウトへのパネル差し込み・`data-testid` 維持（ロジックは ai-quiz-authoring コンポーネントへ委譲）
- **Shared seam**: `mapAiJsonToQuestions(format, raw)` を Core lib に1か所集約。UI は返却 `Question[]` を `setQuestions` に渡すのみ

## Existing Spec Updates（Phase 25・依存順）
- [ ] quizeum-core -- `ai-generate-questions` / `ai-generate-thumbnail` API、日次カウンタ、`mapAiJsonToQuestions`、Storage 連携、Rules。Dependencies: none
- [ ] quizeum-ui-editor -- エディタへの AI パネル・サムネ生成ボタンのレイアウト統合、`triggerThumbnail` picsum スタブ削除。Dependencies: quizeum-ai-quiz-authoring（コンポーネント契約）

## Direct Implementation Candidates（Phase 25）
- [ ] docs-sync-ai-authoring -- `docs/api_specification.md`、`docs/requirements_definition.md`（Pro 特典・AI 作問）、`pricing-display.ts` 特典文言
- [ ] ai-authoring-e2e -- Pro ユーザでの生成・反映・上限 429・無料ユーザ Pro 誘導

## Specs (dependency order)
- [ ] quizeum-ai-quiz-authoring -- Gemini AI 作問（10問一括）とサムネ生成の Pro 限定 UX・API 契約・レート制限。Dependencies: quizeum-core（エンタイトルメント・既存型）

---

## Phase 26: リスト機能の完全廃止（2026-06-10 ディスカバリー）

### Overview（本フェーズ）
Phase 8 / Phase 23 で導入した **クイズリスト・問題リスト** 機能（`quizLists` コレクション、`list` / `question-list` プレイモード、リスト探索・作成・編集・ブックマーク・プロフィール表示・マイクイズのブックマークリストソース）を **完全廃止** する。UI・API・型・Firestore Rules/Indexes を削除し、関連データ（`quizLists`、`targetType=list` のブックマーク）をマイグレーションスクリプトで削除する。ブックマークのクイズ/問題、マイクイズ（自作・ブックマーククイズ・ブックマーク問題ソース）、問題参照リンク作問は **維持** する。

### Approach Decision（本フェーズ）
- **Chosen**: Core-first 垂直削除 — データ層・型・Rules・マイグレーションを先に正し、その後 UI ドメイン別に並列削除
- **Why**: `quizLists` に依存する UI/API が多岐にわたる。Core を先に削除しないと中間状態でビルド破綻や幽霊導線が残る。既存スペック境界（core / play-flow / creator-dash 等）に沿った Path E 分解で、Phase 23 の `quizeum-lists-discovery-ui` を含むリスト関連要件を一括で無効化できる。
- **Rejected alternatives**:
  - **UI のみ先行削除（データ残存）**: ユーザー確認により却下。`quizLists` データと Rules が残り保守コストが継続する。
  - **単一 `quizeum-lists-removal` 新規スペック**: 20タスク超・7スペック横断のため、既存スペック更新の方がレビュー境界と所有権が明確。
  - **段階的廃止（プレイのみ残す）**: ユーザー確認の full_scope により却下。

### Scope（本フェーズ）
- **In**:
  - **ルート削除**: `/lists`, `/list/create`, `/list/[id]`, `/list/[id]/edit`
  - **Core 削除**: `quiz-list.ts`, `quiz-list-utils.ts`, `question-list-session.ts`, `question-list-validation.ts`, `searchLists`, リスト CRUD、問題リスト CRUD、リストブックマーク API、`Attempt.mode` の `list` / `question-list`、`listId` フィールド（新規保存停止）、`QuizList` / `QuizListType` 型
  - **Firestore**: `quizLists` コレクション Rules/Indexes 削除、マイグレーションスクリプト（`quizLists` 全削除、`bookmarks` の `targetType=list` 削除）
  - **UI 削除**: サイドバー/ヘッダー「リスト」ナビ、ブックマーク「リスト」タブ、プロフィール「作成したリスト」、リストエディタ・探索コンポーネント、作家ダッシュボード「リスト作成」CTA
  - **プレイ削除**: `mode=list` / `question-list` の開始導線・結果画面のリスト内次へナビ・`question-list-session`
  - **マイクイズ**: `bookmarkedLists` / `bookmarked-list` ソースの除去（4ソース → 3ソース）
  - **スペック**: `quizeum-lists-discovery-ui` を obsolete 化、Phase 8/23/24 のリスト関連要件を各スペックから削除または deprecated マーク
  - **docs 同期**: `db_design.md`, `api_specification.md`, `detailed_design.md`, `screen_transition.md`, `requirements_definition.md`, `product.md`（コア機能記述）
  - **テスト/E2E**: リスト専用テスト削除、横断テストのリスト参照除去
- **Out**:
  - 既存 `attempts` ドキュメントの物理削除（履歴データは残す。`mode=list|question-list` の過去レコードは表示ラベルを汎用化するか非表示 — design で確定）
  - ブックマーク（クイズ・問題）機能の廃止
  - マイクイズ機能自体の廃止
  - 問題参照リンク作問（`sourceQuestionId`）の廃止
  - 名前が紛らわしい別機能: `QuizListSkeleton`（ダッシュボードクイズ一覧）、`QuizListSort`（探索ソート）、`sortable-sorting-list`（並べ替え問題タイプ）、`listActiveTags` 等

### Constraints（本フェーズ）
- **データ削除**: 本番適用前にステージングでマイグレーション検証。バッチ削除は Firestore 500件制限に従う
- **ビルド整合**: Core 削除コミット後、参照する UI スペックは同一 PR または依存順で追随し、中間状態の main 破綻を避ける
- **後方互換**: 廃止後は `/list/*` `/lists` は 404 または `/` リダイレクト（design で確定）
- **機能維持**: ブックマークはクイズ/問題の2タブに集約。マイクイズは自作・ブックマーククイズ・ブックマーク問題の3ソース

### Boundary Strategy（本フェーズ）
- **quizeum-core**: 型・サービス・Rules・Indexes・マイグレーション・attempt 契約からリスト関連を除去
- **quizeum-play-flow-ui**: ブックマークリストタブ、リストプレイ導線、結果ナビ
- **quizeum-creator-dash-ui**: リストエディタ、作成 CTA、エクスポート
- **quizeum-auth-profile-ui** / **quizeum-ui-personal**: プロフィールリストタブ
- **quizeum-my-quiz-ui**: ブックマークリストソース除去
- **quizeum-sidebar-layout** / **quizeum-ui-layout-shell**: ナビ項目削除
- **quizeum-ui-editor**: リストエディタ UI 削除
- **quizeum-ui-discovery**: `/lists` 探索 UI 削除
- **quizeum-lists-discovery-ui**: **obsolete** — 新規実装・要件追加は行わない。既存 tasks はキャンセル扱い
- **Shared seam**: マイグレーションスクリプトは Core 管轄の `scripts/` に1か所集約

## Existing Spec Updates（Phase 26・依存順）
- [ ] quizeum-core -- `quizLists` サービス/型/Rules/Indexes 削除、`searchLists` 削除、リストブックマーク削除、attempt `list`/`question-list` 契約削除、データマイグレーションスクリプト。Dependencies: none
- [ ] quizeum-play-flow-ui -- ブックマーク「リスト」タブ削除、リストプレイ/結果ナビ削除、関連 E2E 更新。Dependencies: quizeum-core
- [ ] quizeum-creator-dash-ui -- リスト作成/編集 UI・CTA・エクスポート削除。Dependencies: quizeum-core
- [ ] quizeum-auth-profile-ui -- プロフィール「作成したリスト」削除。Dependencies: quizeum-core
- [ ] quizeum-my-quiz-ui -- `bookmarkedLists` ソース除去、3ソース UI へ改定。Dependencies: quizeum-core
- [ ] quizeum-sidebar-layout -- 「リスト」ナビ削除、active 判定整理。Dependencies: none（ルート削除後）
- [ ] quizeum-ui-editor -- リストエディタコンポーネント削除。Dependencies: quizeum-core
- [ ] quizeum-ui-discovery -- `/lists` 探索 UI 削除。Dependencies: quizeum-core
- [ ] quizeum-lists-discovery-ui -- **obsolete 化**（要件・タスクを cancelled 扱い、spec に廃止注記）。Dependencies: 上記完了後

## Direct Implementation Candidates（Phase 26）
- [ ] migrate-delete-quizlists -- `scripts/` マイグレーション: `quizLists` 全削除 + `bookmarks(targetType=list)` 削除
- [ ] docs-sync-lists-removal -- `docs/*` と `.kiro/steering/product.md` からリスト機能記述を削除
- [ ] e2e-cleanup-lists -- `e2e/lists-discovery.spec.ts`, `e2e/quiz-list.spec.ts`, `phase8.spec.ts` リスト部分の削除/更新
- [ ] obsolete-lists-discovery-spec -- `quizeum-lists-discovery-ui/spec.json` に `obsolete: true` または phase 注記

## Specs (dependency order)
（Phase 26 では新規 spec なし — 上記 Existing Spec Updates のみ）
