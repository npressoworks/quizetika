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
