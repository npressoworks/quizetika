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
- [ ] quizeum-core -- `resetUserReputation`・`banUser`・`unbanUser` メソッド、`adminLogs` スキーマ・型定義、Firestore Security Rules（`adminLogs` 用およびBANユーザー遮断用）、認証ミドルウェア/AuthContext でのBAN検知。Dependencies: none

## Specs (dependency order)
- [ ] quizeum-admin-users-ui -- 管理者専用ユーザー検索・手動スコアリセット・BAN/UNBAN画面（`/admin/users`）の実装、ルートガード。Dependencies: quizeum-core

---

## Phase 8: ブックマーク・リスト・設問再利用（2026-06-05 ディスカバリー）

### Overview（本フェーズ）
ブックマークとリストをクイズ単位・設問単位の両方で作成・管理できるように改良する。ブックマーク画面ではクイズ・リスト・設問を分類表示する。リストは既存 `quizLists` コレクションに `listType`（`quiz` | `question`）を追加し、クイズリスト（`quizIds`）と設問リスト（`questionIds`）を区別する。設問リストには**他者の公開クイズに含まれる公開設問も追加可能**とする。作問時は過去の自作クイズ（下書き含む）を検索し、設問を参照リンク（ドキュメント複製なし）で新規クイズに再利用できるようにする。

### Approach Decision（本フェーズ）
- **Chosen**: 単一コレクション + `listType` — `QuizList` に `listType: 'quiz' | 'question'` を追加し、既存 `quizIds` / `questionIds` をタイプで使い分ける。設問の作問再利用は `sourceQuestionId`（参照）で同一 `questions` ドキュメントを指す。
- **Why**: 型・`questionIds`・`toggleBookmark(..., 'question')` 等の実装断片が既にあり、Phase 5–7 と同様に既存スペック拡張で完結する。別コレクション分割は CRUD・Rules・UI の二重化コストが大きい。
- **Rejected alternatives**:
  - `quiz_lists` / `question_lists` コレクション分離: クエリは明確だが移行・二重実装が過大。
  - 設問リスト後回し（ブックマーク＋作問リンクのみ）: 「リストも各単位で管理」の要望が未達のままになる。

### Scope（本フェーズ）
- **In**:
  - クイズ・リスト・設問のブックマーク API および一覧取得（クイズ／設問は分離、追加日時降順）
  - `QuizList.listType` によるクイズリスト／設問リストの作成・更新・取得（作者別・タイプ別フィルタ）
  - 設問リストへの設問追加: **公開済み**の設問のみ（自作・他者作問を問わない）。ブックマーク済み設問や検索 UI からの追加導線
  - 設問リスト連続プレイ（`attempts.mode = 'question-list'`）
  - 作問時: 自作クイズのキーワード／タグ検索、設問の参照リンク追加（複製しない）
  - `/bookmarks` のタブ（クイズ / リスト / 設問）、リスト編集のタイプ切替・設問 DnD、作問エディタの過去クイズ検索パネル
  - プロフィール「作成したリスト」のタイプ別表示（必要最小限）
  - `docs/` 正本（`db_design.md`, `api_specification.md` 等）と Firestore Rules / Indexes の同期
- **Out**:
  - 他ユーザーの**未公開**クイズ・設問のブックマーク／リスト追加
  - 自作でないクイズからの設問**リンク再利用**（作問エディタ内の参照追加は自作のみ）
  - 設問リストへの下書き・非公開設問の追加
  - 参照リンク設問の「実体編集」が元クイズに波及する詳細 UX（初版は参照表示＋権限境界を Core で定義、編集は元または切り離しポリシーを design で確定）

### Constraints（本フェーズ）
- 既存 `quizLists` ドキュメントは `listType` 未設定時 **`quiz` として後方互換**（読み取り・一覧フィルタ）
- ブックマーク取得: クイズは従来どおり公開クイズに限定可、設問は **親クイズが published** のもののみ一覧に含める
- 設問リスト追加時: `questions` ドキュメント存在 + 親 `quizzes.status === 'published'` を Core で検証
- 参照リンク設問: 新規クイズの `questionIds` に既存 `questions/{id}` を追加。`createQuiz` / `updateQuiz` は参照 ID に対して新規 `questions` ドキュメントを作成しない

### Boundary Strategy（本フェーズ）
- **Core**: `listType`、ブックマーク／リスト／設問の取得 API、設問リスト CRUD、設問リストプレイセッション、`searchAuthorQuizzes`、参照リンク保存、Rules/Indexes、`Attempt.mode` 拡張
- **Play-flow UI**: `/bookmarks` 3タブ、プレイ／結果／クイズ詳細での設問ブックマーク、設問リストプレイ開始
- **Creator-dash UI**: リスト編集（タイプ・設問ピッカー・DnD）、作問エディタの自作クイズ検索・リンク UI
- **Auth-profile UI**: プロフィールのリストタブを `listType` で区別表示（軽微）
- **Shared seam**: 公開設問の追加可否・参照リンクの永続化は Core に1か所集約。UI は検索・ピッカーのみ

## Existing Spec Updates（Phase 8・依存順）
- [x] quizeum-core -- 要件 13–15 の design/tasks/実装: `listType`、`getBookmarkedQuestions` 統合、設問リストプレイ、自作クイズ検索 API、参照リンク `saveQuiz`、Rules/Indexes、`question-list` mode。Dependencies: none
- [x] quizeum-play-flow-ui -- `/bookmarks` タブ（クイズ・リスト・設問）、設問ブックマーク操作、設問リストプレイ導線。Dependencies: quizeum-core
- [x] quizeum-creator-dash-ui -- リスト `listType` 編集・設問追加 UI、作問エディタ過去クイズ検索・リンクパネル。Dependencies: quizeum-core
- [x] quizeum-auth-profile-ui -- プロフィール「作成したリスト」のクイズリスト／設問リスト区別表示。Dependencies: quizeum-core

## Direct Implementation Candidates（Phase 8）
- [x] docs-sync-bookmarks-lists -- `docs/db_design.md`（`listType`, 参照設問フィールド）、`docs/api_specification.md`、`docs/detailed_design.md`、`docs/screen_transition.md` を core/play-flow/creator-dash 実装と同期

## Specs (dependency order)
（Phase 8 では新規 spec なし — 上記 Existing Spec Updates のみ）


