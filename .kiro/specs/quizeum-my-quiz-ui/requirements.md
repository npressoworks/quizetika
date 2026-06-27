# 要件定義書: quizeum-my-quiz-ui

## はじめに

本ドキュメントは、クイズ投稿SNS「quizeum」における**カスタムクイズ**機能（`/my-quiz`）のフロントエンド UI 要件を定義します。ログインユーザーが、自作クイズ・ブックマーククイズ・ブックマーク問題という3ソースから問題を横断的に集め、キーワード・ジャンル・タグ・出題形式・難易度等で絞り込み、出題数とシャッフル有無を指定して連続プレイを開始できる体験を提供します。

**Phase 23（2026-06-09）**: リスト探索・カスタムクイズ・設定・ナビ拡張フェーズの一環。問題プール合成（`buildMyQuizQuestionPool`）およびアドホックセッション lib（`my-quiz-session`）は `quizeum-core` が提供する。Sidebar への「カスタムクイズ」導線は `quizeum-sidebar-layout` が担当する。

**Phase 26（2026-06-10）**: リスト機能廃止に伴い、カスタムクイズの問題取得元から **ブックマークリスト** ソースを除去し、4ソースから **3ソース** に変更します（要件 8 参照）。`my-quiz` プレイ体験自体は維持します。

## 境界コンテキスト

- **対象範囲（In scope）**:
  - `/my-quiz` ページ（ログイン必須）
  - 3ソース（自作クイズ内問題、ブックマーククイズ内問題、ブックマーク問題）の統合プール選択 UI
  - **Phase 26**: ブックマークリストソースの除去、3ソース UI への改定
  - キーワード・ジャンル・タグ・出題形式・難易度フィルタ
  - 出題数指定（プリセットおよびカスタム）、シャッフル有無
  - フィルタ後プール件数のプレビュー表示
  - 「クイズを始める」による既存プレイエンジンへの遷移（アドホックセッション生成）
  - プレイエンジン側の `mode=my-quiz` 読み取り拡張（最小限）
  - E2E（カスタムクイズ起動・プレイ1問完了まで）
- **対象外（Out of scope）**:
  - フィルタプリセットの保存、URL 共有、復習モード（`/quiz/review`）との統合
  - AI 生成問題、リスト探索（`/lists` — `quizeum-lists-discovery-ui`）
  - クイズ新規作成・編集、ブックマーク一覧 UI の改修
  - Sidebar / BottomNav 項目追加（`quizeum-sidebar-layout`）
  - 問題プール合成ロジック本体、Firestore クエリ最適化（`quizeum-core`）
  - `attempts` 永続化スキーマ変更の正本（`quizeum-core` が `mode: 'my-quiz'` を提供）
- **隣接システムへの期待**:
  - `quizeum-core` が `buildMyQuizQuestionPool`、`MyQuizQuestionCandidate` 型、`my-quiz-session.ts`（`init` / `read` / `advance` / `buildMyQuizPlayUrl`）を提供する
  - ブックマーク取得は既存 `getBookmarkedQuizzes`、`enrichBookmarkedQuestions`、自作クイズは `searchAuthorQuizzes` + `getQuestionsByQuiz` パターンに準拠する（`getBookmarkedLists` は Phase 26 で使用しない）
  - ブックマーク経由の問題は親クイズが `published` のもののみ（既存 `question-attach-search` 契約）
  - 自作ソースは下書き・非公開クイズ内問題を含めてよい
  - プレイ結果・attempt 記録は既存 attempt フローに従う（`saveAttempt` `mode: 'my-quiz'`）

## 要件

### 要件 1: 認証とルーティング (Page: `/my-quiz`)

**目的:** 認証ユーザーとして、Sidebar からカスタムクイズ画面を開きたい。それにより自分に関係する問題だけを横断的にプレイできる。

#### 受け入れ基準

1. When 認証済みユーザーが `/my-quiz` にアクセスしたとき、the My Quiz UI shall カスタムクイズ画面を表示すること。
2. When 未認証ユーザーが `/my-quiz` にアクセスしたとき、the My Quiz UI shall 認証画面（`/login`）へリダイレクトし、ログイン後に `/my-quiz` へ戻れるよう `redirect` クエリを付与すること。
3. While 認証状態の判定中である間、the My Quiz UI shall 画面全体の読み込み表示（スケルトンまたは同等）を表示し、未認証向けコンテンツを描画してはならない。
4. The My Quiz UI shall ページ見出しに「カスタムクイズ」および、3ソース横断プレイである旨の短い説明文を日本語で表示すること。
5. The My Quiz UI shall カスタムクイズ画面本体に `data-testid="my-quiz-page"` を付与すること。

### 要件 2: 3ソース問題プール選択（Phase 26 で4ソースから改定）

**目的:** 認証ユーザーとして、問題の取得元を3種類から組み合わせて選びたい。それにより関心のある問題集合だけをプレイ対象にできる。

#### 受け入れ基準

1. The My Quiz UI shall 次の3ソースを個別にオン／オフできる UI（チェックボックスまたは同等のトグル）を提供すること:
   - **自作クイズ**: ログインユーザーが作成したクイズ（公開・下書き・非公開を含む）に含まれる問題
   - **ブックマーククイズ**: ブックマークした公開済みクイズに含まれる問題
   - **ブックマーク問題**: ブックマークした個別問題（公開済み親クイズの問題のみ）
2. When ユーザーがソース選択を変更したとき、the My Quiz UI shall `quizeum-core` の `buildMyQuizQuestionPool`（または同等 API）を呼び出し、有効なソースのみを統合した問題候補プールを再取得すること。
3. When 複数ソースで同一 `questionId` が重複するとき、the My Quiz UI shall `quizeum-core` の `buildMyQuizQuestionPool` が返す dedupe 済みプールをそのまま利用すること（dedupe 本体は core が `dedupeQuestionCandidates` と同一規則で実施）。
4. When 有効なソースが1件も選択されていないとき、the My Quiz UI shall 問題プールを空とし、「ソースを1つ以上選択してください」等の案内を表示すること。
5. While 問題プールの取得中である間、the My Quiz UI shall ソース領域またはプレビュー領域にローディング状態を表示すること。
6. If 問題プールの取得に失敗した場合、the My Quiz UI shall エラーメッセージと再試行操作を表示し、サイレントに空プールへフォールバックしてはならない。
7. The My Quiz UI shall 3ソース各トグルに `data-testid` プレフィックス（例: `my-quiz-source-own` / `my-quiz-source-bookmarked-quiz` / `my-quiz-source-bookmarked-question`）を付与すること。
8. The My Quiz UI shall [「ブックマークリスト」ソースのトグルおよび `my-quiz-source-bookmarked-list` を提供してはならない（Phase 26）]。

### 要件 3: フィルタ（キーワード・ジャンル・タグ・出題形式・難易度）

**目的:** 認証ユーザーとして、統合プール内の問題を条件で絞り込みたい。それにより学習したい問題だけを効率よく選べる。

#### 受け入れ基準

**キーワード**
1. The My Quiz UI shall キーワード入力欄を提供し、問題文および親クイズタイトルに対する部分一致検索（既存 `filterQuestionCandidatesByKeyword` 規則）を適用すること。
2. When ユーザーがキーワードを入力したとき、the My Quiz UI shall 300ms デバウンス後にクライアント側フィルタを再適用すること。

**ジャンル・タグ・出題形式・難易度**
3. The My Quiz UI shall ジャンル選択 UI を提供し、有効ジャンルマスタ（`listActiveGenres`）由来の候補から1件選択または未指定を許容すること。
4. The My Quiz UI shall タグフィルタ UI を提供し、検索画面（`ExploreSearchSection`）と同型のタグチップ入力（スペース確定・重複禁止・チップ削除）を用いること。
5. The My Quiz UI shall 出題形式フィルタ UI を提供し、プラットフォームで利用可能な形式（複合形式、選択式、記述式、早押し、並び替え、連想、ウミガメのスープ、〇×式 等）から1件選択または未指定を許容すること。
6. The My Quiz UI shall 難易度フィルタ UI を提供し、1〜5 の範囲指定（最小・最大スライダーまたは同等）を用いること。難易度は**親クイズ**の `difficulty` を参照すること。
7. When ジャンル・タグ・出題形式・難易度のいずれかが指定されているとき、the My Quiz UI shall すべての条件を AND で合成し、統合プールをクライアント側で絞り込むこと。
8. Where 出題形式としてウミガメのスープ（`lateral-thinking`）またはカスタムクイズ対象外と design で定義された形式が指定された場合、the My Quiz UI shall 当該形式の問題のみを残す（除外専用フィルタとしても利用可能）こと。

**フィルタ UI 共通**
9. When ユーザーがフィルタ条件を変更したとき、the My Quiz UI shall 出題数プレビューおよび「クイズを始める」ボタンの有効状態を即時更新すること。
10. When ユーザーがフィルタ一括クリア操作を行ったとき、the My Quiz UI shall キーワード・ジャンル・タグ・出題形式・難易度を初期値に戻すこと（ソース選択および出題設定は維持してよい）。
11. While 1件以上のアクティブなフィルタ条件が存在するとき、the My Quiz UI shall 検索バー直下（またはフィルタパネル外）にアクティブ条件チップを常時表示し、個別解除を可能にすること（検索画面 `ActiveFilterChips` パターンに準拠）。
12. The My Quiz UI shall フィルタパネル領域に `data-testid="my-quiz-filters"`、アクティブ条件チップ行に `data-testid="my-quiz-active-filters"` を付与すること。

### 要件 4: 出題数・シャッフル設定

**目的:** 認証ユーザーとして、絞り込んだ問題から出題数と順序を指定したい。それにより短時間復習と全件学習の両方に対応できる。

#### 受け入れ基準

1. The My Quiz UI shall 出題数プリセット（10問、20問、全件）およびカスタム数値入力を提供すること。
2. When ユーザーがカスタム出題数を入力したとき、the My Quiz UI shall 1 以上の整数のみを受け付け、フィルタ後プール件数を上限として clamp すること。
3. When フィルタ後プール件数が 0 件のとき、the My Quiz UI shall 「クイズを始める」ボタンを無効化すること。
4. When フィルタ後プール件数が出題数より少ないとき、the My Quiz UI shall 実際の出題数をプール件数に自動調整し、ユーザーに「利用可能 N 問から N 問出題」等の説明を表示すること。
5. The My Quiz UI shall シャッフル有無を切り替えるトグル（デフォルト: オン）を提供すること。
6. When シャッフルが有効なとき、the My Quiz UI shall プレイ開始直前にフィルタ後プールから出題数分をランダム順で抽出すること（同一セッション内の順序は固定）。
7. When シャッフルが無効なとき、the My Quiz UI shall フィルタ後プールの安定順（design で定義するソース優先度 + 親タイトル + 問題 ID）で先頭から出題数分を抽出すること。
8. The My Quiz UI shall 出題設定領域に `data-testid="my-quiz-play-settings"`、出題数表示に `data-testid="my-quiz-question-count-preview"` を付与すること。

### 要件 5: プレビューとプレイ開始

**目的:** 認証ユーザーとして、プレイ前に対象件数を確認し、ワンタップで連続プレイを始めたい。それにより意図しない出題を防げる。

#### 受け入れ基準

1. The My Quiz UI shall フィルタ適用後の問題プール件数を常時表示すること（例: 「対象 42 問 / 出題 20 問」）。
2. When フィルタ後プール件数が 0 件のとき、the My Quiz UI shall 空状態メッセージとフィルタ緩和の案内を表示すること。
3. When ユーザーが「クイズを始める」を押したとき、the My Quiz UI shall 出題数・シャッフル設定に従い最終出題リストを確定し、`my-quiz-session` を `sessionStorage` に書き込むこと（`quizeum-core` lib 経由）。
4. When セッション初期化が完了したとき、the My Quiz UI shall 先頭問題の親クイズプレイ画面（`/quiz/[parentQuizId]/play?mode=my-quiz&...`）へ遷移すること。
5. The My Quiz UI shall プレイ開始ボタンに `data-testid="my-quiz-start-play"`、`data-analytics="my-quiz-start-play"` を付与すること。
6. The My Quiz UI shall Firestore への attempt 書き込みや問題プールのサーバー側永続化を実装してはならない（セッション生成と遷移のみ）。

### 要件 6: プレイエンジン連携（最小拡張）

**目的:** クイズプレイヤーとして、カスタムクイズで開始した連続出題を既存プレイ画面で途切れなく続けたい。それにより学習フローが一貫する。

#### 受け入れ基準

1. Where URL クエリ `mode=my-quiz` である場合、the Play Flow UI shall `my-quiz-session` から当該 `questionId` の1問のみをプレイ対象として表示すること（既存 `question-list` モードと同型）。
2. When カスタムクイズプレイ中に1問の結果画面を完了したとき、the Play Flow UI shall セッション内に次の問題が残っている場合、次問題の `/quiz/[parentQuizId]/play?mode=my-quiz&...` へ遷移すること。
3. When カスタムクイズセッションの最終問題を完了したとき、the Play Flow UI shall 完了メッセージ（例: 「カスタムクイズを完了しました」）と `/my-quiz` への戻り導線を表示すること。
4. When カスタムクイズプレイ中に attempt を保存するとき、the Play Flow UI shall `mode: 'my-quiz'` およびセッション ID（`sessionId` クエリ）を含めて `saveAttempt` を呼び出すこと（各問題 1 attempt、`totalQuestions: 1` — 既存 `question-list` と同型）。
5. If `sessionStorage` に有効な `my-quiz-session` が存在しない場合、the Play Flow UI shall エラー表示と `/my-quiz` への戻り導線を表示し、サイレントに通常プレイへフォールバックしてはならない。
6. The Play Flow UI shall 通常モード（`mode=normal`）の即時フィードバックフロー（要件 17）をカスタムクイズプレイに適用してはならない（`question-list` と同様、全問完了後に結果画面へ遷移する従来挙動を維持）。
7. The My Quiz UI shall プレイエンジンの問題表示・正誤判定・タイマーロジックの正本を変更してはならない（セッション読み取りと次問題遷移の拡張のみ）。

> **脚注（プレイクライアント拡張の所有）**: `quiz-play-client.tsx` / `quiz-result-client.tsx` への `mode=my-quiz` 最小拡張は **本スペック（quizeum-my-quiz-ui）** が所有する。実装タスクは **6（quiz-play-client）・7（quiz-result-client）**。`quizeum-play-flow-ui` スペック自体は本フェーズでは変更しない（coordination のみ）。

### 要件 7: ローディング・エラー・E2E

**目的:** 開発者として、カスタムクイズの主要フローを自動テストで検証したい。それによりリグレッションを防げる。

#### 受け入れ基準

1. While 初回の問題プール読み込み中である間、the My Quiz UI shall `data-testid="my-quiz-skeleton"` 付きスケルトンを表示すること。
2. The My Quiz UI shall Vanilla CSS（CSS Modules）および日本語 UI ラベルを用い、Tailwind を導入してはならない。
3. When E2E テストがログイン済みユーザーで `/my-quiz` を開いたとき、the My Quiz UI shall 3ソーストグル・フィルタ・出題設定・プレビュー件数・開始ボタンが操作可能であることを `data-testid` で検証可能にすること。
4. When E2E テストがフィルタ後1問以上のプールで「クイズを始める」を実行したとき、the My Quiz UI shall プレイ画面 URL に `mode=my-quiz` が含まれることを検証可能にすること。
5. The My Quiz UI shall `e2e/my-quiz.spec.ts`（または同等）に、ソース選択→プレイ開始→1問プレイ完了（または結果画面表示）までのスモークテストを含めること。

### 要件 8: ブックマークリストソースの除去（Phase 26）
**目的:** 認証ユーザーとして、廃止されたリスト機能に依存しないカスタムクイズ体験を使いたい。それにより取得元が明確で保守しやすい UI になる。

#### 受け入れ基準

1. The My Quiz UI shall [`my-quiz-source-panel`（または同等）において「ブックマークリスト」ラベル・トグル・説明文を表示してはならない]。
2. When [ユーザーがカスタムクイズ画面を初回表示したとき], the [My Quiz UI] shall [デフォルトで3ソース（自作・ブックマーククイズ・ブックマーク問題）のうち、少なくとも1ソースが有効な状態を提供すること（Phase 23 既定と整合 — design で確定可）]。
3. When [問題プールを再取得するとき], the [My Quiz UI] shall [`buildMyQuizQuestionPool` にブックマークリスト由来のフラグを渡してはならない]。
4. When [フィルタ結果テーブルに取得元種別を表示するとき], the [My Quiz UI] shall [`bookmarked-list` ラベルを表示してはならない]。
5. The [My Quiz UI] shall [`getBookmarkedLists` の呼び出しを実装してはならない]。

**境界・隣接**
6. The [My Quiz UI] shall [カスタムクイズプレイ（`mode=my-quiz`）および `my-quiz-session` 契約を維持すること]。
7. The [My Quiz UI] shall [問題プール合成ロジックの正本変更を本要件の範囲に含めない（`quizeum-core` が `buildMyQuizQuestionPool` からブックマークリスト分岐を除去）]。

**アクセシビリティ・テスト支援**
8. The [My Quiz UI] shall [E2E および単体テストから `bookmarked-list` / `bookmarkedLists` シナリオを削除または3ソース前提へ更新すること]。
