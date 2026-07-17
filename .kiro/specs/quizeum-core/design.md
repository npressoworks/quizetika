# Technical Design Document: quizetika-core

## Overview
本ドキュメントは、クイズ投稿SNS「quizetika」における核心的なコアシステム（`quizetika-core`）の技術設計仕様を定義します。クイズの作成・下書き・厳格な公開バリデーション、ローカルセッション保護と自動同期を備えたプレイ環境、AIを活用したステートレスなウミガメのスープ（水平思考クイズ）対話、退会時のAuth即時物理削除と大規模非同期クレンジング、そしてコミュニティモデレーションやマージ合意によるメタデータ仮想統合を含みます。

本システムは、Next.jsのApp RouterおよびReact、TypeScriptのフルスタック構成に加え、Firebase（Auth, Firestore, Storage）および外部AI（Gemini API）のハイブリッドアーキテクチャを採用し、セキュリティとパフォーマンス、ユーザー体験（UX）を最高レベルで実現します。

**Phase 5（2026-06）**: クイズ単位リーダーボードを初回プレイ／リプレイの二系統に分割し、正解数優先・同点時タイムの順位規則で更新する。全問正解は不要。あわせて本人向けプレイ履歴取得APIをコア層に追加する（表示UIは `quizetika-auth-profile-ui` が担当）。

**Phase 6（2026-06）**: ジャンル・タグメタデータを `docs/` 正本に整合する。公開保存時に `canonicalGenreId` / `canonicalTagIds` を解決・非正規化し、一覧・検索は正規識別子クエリを優先しつつ legacy クイズ向けに `genre in` フォールバックを併用する（C2 方式）。`metadata-resolution` ライブラリに解決ロジックを集約し、`tagMerge.ts` をガバナンスの単一経路とする。
また、悪質ユーザーのBAN（アカウント停止）機能を追加し、Firestore Security Rulesによるデータ書き込みの即時遮断、監査ログ記録、認証セッションの強制無効化（Cookie連携）を設計する。

**Phase 8（2026-06）**: ブックマークをクイズ・クイズリスト・問題の3分類で取得し、問題ブックマークは親クイズ公開時のみ許可する。リストに `listType`（`quiz` | `question`）を追加し、問題リストには他者の公開問題も追加可能とする。問題リスト連続プレイは既存クイズリストと同様に**問題ごとに1 attempt**（`mode: 'question-list'`）を記録する。作問時は自作クイズを検索し、問題を参照リンク（ドキュメント複製なし）で再利用する。参照問題の編集は **Copy-on-Write 切り離し** とする（内容変更時のみ新規 `questions` ドキュメントを作成し、未変更 of 参照は既存 ID を維持）。

**Phase 9（2026-06）**: トップページの統合検索機能（ジャンル、タグ、クイズ名、作者名を単一検索バーで同時検索可能にするハイブリッド検索ロジック）をコア層の設計仕様として追加します。

**Phase 10（2026-06）**: ホーム統合検索のタグチップ化を支える `listActiveTags`（存続タグマスタ一覧）と、`searchQuizzes` への複数タグ AND フィルタ（`SearchFilters.tags`）を追加する。タグ照合は `getQuizzesByTag` / 要件 11.3 と同一の canonical 優先＋legacy フォールバック規則を `quiz-tag-match` に集約する（UI サジェストは `quizetika-play-flow-ui` が担当）。

**Phase 11（2026-06）**: ホーム内フィルタ型探索およびジャンル別一覧 scoped 検索を支える `SearchFilters.format`（出題形式）追加と、`searchQuizzes` 後段での `resolveQuizFormat` 一致フィルタを実装する。形式判定は UI カード表示（`quizetika-play-flow-ui`）と同一 lib 規則を用い、Firestore インデックス新設は行わない。

**Phase 10 スマートサジェスト追記（2026-06-06）**: 検索フィールドの空クエリフォーカス時スマートサジェストを支える集計基盤を追加。`search_logs` コレクションへの検索ログ記録（`searchQuizzes` 内部で fire-and-forget）、週間人気ジャンル Top5 集計 API（`GET /api/genres/weekly-top`）、週間人気ワード／タグ Top5 集計 API（`GET /api/search/weekly-top`）を提供する。ユーザー個人履歴の保存は UI 側 `localStorage` のみで処理する。

**Phase 13（2026-06-07）**: Stripe を前提とした Pro プラン・サブスクリプション基盤をコア層に追加する。`subscriptionTier`（`free` | `pro` | `premium`）によるエンタイトルメント、Checkout Session / Customer Portal Session API、Webhook による契約状態同期、および `ask-ai` の tier ベース制限判定を一貫実装する（プラン表示 UI は `quizetika-billing-subscription-ui` が担当）。

**Phase 14（2026-06-08）**: 水平思考クイズの真相自動判定を、必須キーワード文字列全一致による AI バイパス（旧 B2 ハイブリッド）から、裏設定・真相キーワード・プレイヤー要約を AI に渡す意味判定へ改定する。本番 `/api/attempt/verify-truth` は常に AI 呼び出しとし、テストプレイのローカルキーワード判定は変更しない。

**Phase 16（2026-06）**: 水平思考プレイ画面の UX 改修。真相入力をチャット下部へ統合（「質問する」／「回答する」切替）、諦め API・解説開示、経過時間表示、不合格時の固定2種フィードバック、諦め／合格時の入力ロックとグレーアウト、プレイヤー向けルール説明。

**Phase 17（2026-06-08）**: 水平思考の認証・二層 AI 質問制限・諦めフロー改定。未登録はウミガメのみ会員必須。無料 tier は同一クイズ 30回/日 + 全クイズ横断 150回/日。質問正規化キャッシュで全カウンタ非消費。上限到達時は `limitType` 付き Pro 誘導。諦め時は真相非表示とチャット内ナビ（結果画面へ／リスト文脈で次の問題へ）。Phase 16 の諦め解説開示は本フェーズで上書き廃止。

**Phase 18（2026-06-09）**: 模擬試験（`exam`）・フラッシュカード（`flashcard`）完了試行をクイズ単位リーダーボード（初回プレイ・リプレイ）の登録対象外とする。初回／リプレイ振り分け用の prior 完了件数は**全永続化モード**（test-play 除く）をカウントし、先に exam/flashcard で完了したユーザーは以降の通常モード等の登録対象試行をリプレイ側のみに振り分ける。判定ロジックは `leaderboard-update.ts` に集約する。

**Phase 20（2026-06-09）**: 〇✕問題（`true-false`）を第一級出題形式として整備。`Quiz.format` 拡張、`true-false-defaults.ts` による固定「〇」「✕」選択肢の生成・正規化、`resolveQuizFormat` の単一形式解決、探索形式フィルタとの整合。プレイ／作問 UI は隣接スペックが担当。

**Phase 21（2026-06-09）**: ホーム向け公開クイズ一覧の段階的取得 API を追加する。タブ別フィードは Firestore `startAfter` カーソル、複合検索は既存ハイブリッドパイプライン上のオフセットカーソルでページ分割する。共通応答型 `PaginatedQuizResult` を定義し、`quizetika-play-flow-ui` の無限スクロールが単一契約で消費できるようにする。

**Phase 22（2026-06-09）**: ディスカバリーホーム（`/`）向けに既存一覧 API（トレンド Top 10・新着 Top 10・有効ジャンル一覧）を再利用し、検索画面（`/search`）向け URL クエリと探索タブ／フィルタ状態の相互変換 lib（`search-url-state.ts`）を追加する。UI・ナビは隣接スペックが担当。

**Phase 23（2026-06-09）**: リスト探索（`/lists`）向け `searchLists`、カスタムクイズ（`/my-quiz`）向け4ソース問題プール合成（`buildMyQuizQuestionPool`）、アドホック連続プレイ用 `my-quiz-session`、および `Attempt.mode: 'my-quiz'` と `saveAttempt` の1問単位検証バイパスをコア層に追加する。UI は `quizetika-lists-discovery-ui` / `quizetika-my-quiz-ui` が担当。

**Phase 30（2026-06-21）**: ユーザープロフィール情報に `snsLinks` オブジェクト（YouTube, X, Instagram, TikTokのURL）を追加します。更新時の各URLに対する正規ドメイン（`youtube.com`, `x.com`, `twitter.com`, `instagram.com`, `tiktok.com`）の検証と一括保存、および Firebase Storage からのSNSロゴ画像URL取得（キャッシュ併用）をコア層に追加します（UIは `quizetika-auth-profile-ui` が担当）。

### Goals
- ページの初期HTML読み込み時間を通常トラフィック下で平均0.5秒以内に維持する。
- プレイ中の不意なリロードやオフライン切断時における解答データ損失をローカルで保護・復元する。
- ユーザー退会時、アトミックな書き込み制限（最大500件）を回避しつつ即時Auth物理削除と非同期ジョブによる関連データの安全なクレンジングを完了する。
- 水平思考クイズにおいて、セキュアなサーバーサイド呼び出し、二層ターン制限（無料：同一クイズ30回/日・全クイズ横断150回/日）、正規化同一質問キャッシュによる低コストで高精度なAI判定を実装する。
- 初回プレイ／リプレイの二系統リーダーボードを、単一の順位比較ロジックで一貫更新し、不正なクライアント改ざんをサーバー側トランザクションで防ぐ。
- 本人プレイ履歴をページング付きで安全に返却する（他ユーザーからの取得は拒否）。
- ジャンル・タグの仮想統合を保存・一覧・弱点克服フィルタまで一貫適用し、canonical 単一クエリで探索性能を確保する（legacy フォールバック併用）。
- BANされたユーザーによるシステムへの不正書き込み（Firestore / API）を即座にブロックし、既存の認証セッションを強制的にログアウトさせる。
- クイズ・リスト・問題の分類ブックマーク、問題リスト CRUD/プレイ、自作クイズ検索、参照リンク問題の保存整合をコア層で一貫提供する。
- 統合検索機能（ユニバーサル検索）のため、タイトル・説明・作者・タグ・ジャンルの並行ハイブリッド検索とクライアントデデュプ・フィルタロジックを最適化する。
- **Phase 10**: タグマスタ一覧 API（`listActiveTags`）と、タグチップ配列による複数タグ AND 複合検索の一貫実装。
- **Phase 11**: 出題形式（`format`）フィルタ付き複合検索。ジャンル固定 scoped 検索（`genreId` + 他条件 AND）の一貫実装。形式判定は `quiz-format-match` + `resolveQuizFormat` に集約。
- **Phase 10 スマートサジェスト**: `search_logs` コレクションへの検索ログ fire-and-forget 実装、週間ジャンル Top5 / 週間ワード·タグ Top5 集計 API Route の提供。
- **Phase 13 Stripe サブスクリプション（2026-06）**: Pro プラン購読（Checkout / Webhook / Customer Portal）、`subscriptionTier` ベースのエンタイトルメント、水平思考 AI 質問制限の tier 連動、課金フィールドの Rules 保護。
- **Phase 14 真相 AI 意味判定（2026-06）**: `buildVerifyTruthPrompt` に `truthKeywords` をエッセンス参照として組み込み、`verify-truth` ルートからキーワード即合格バイパスを除去する。
- **Phase 16 水平思考プレイ UX（2026-06）**: チャット統合入力、諦め API、経過時間、固定不合格メッセージ、`quiz-play-client` レイアウト改修。
- **Phase 17 ウミガメ認証・制限・諦め改定（2026-06）**: 二層日次制限、`normalizeQuestionText` キャッシュ、横断カウンタ、`limitType` 付き 429、諦め API の真相非返却、attempt `listId` 引き継ぎ。
- **Phase 18 模擬試験・フラッシュカード LB 非対象（2026-06）**: `isLeaderboardEligibleAttempt` によるモード除外、全モード prior 件数カウントによる初回権利消滅、`saveAttempt` / `verify-truth` 共通更新パス。
- **Phase 20 〇✕問題形式（2026-06）**: `true-false` の第一級 format 化、固定選択肢 lib、公開検証・形式解決・ラベル整合。
- **Phase 21 ホームフィード段階的取得（2026-06）**: `PaginatedQuizResult`、タブ別ページ API、複合検索のページ分割、カーソル encode/decode lib。
- **Phase 22 ホーム／検索 IA（2026-06）**: ディスカバリーホーム向け Top 10 一覧再利用、`search-url-state.ts` による URL ↔ 探索状態変換。
- **Phase 23 リスト探索・カスタムクイズ Core API（2026-06）**: `searchLists`、`buildMyQuizQuestionPool` , `my-quiz-session`、`my-quiz` 試行記録、`saveAttempt` 1問契約。
- **Phase 28 解答詳細トラッキングとサーバー検証（2026-06）**: 全問題形式に対応する `QuestionAnswerDetail` 構造設計、`saveAttempt` 内でのサーバー二重検証（件数・正誤・問題ID実在性）、オンライン復旧時の一括バッチ同期（`syncPendingAttempts`）設計。
- **Phase 30 プロフィールSNSリンク登録・表示機能**: 各SNSリンクの正確なドメイン検証と一括永続化の保証、および Firebase Storage からの各SNSロゴダウンロードURLの高速取得（インメモリキャッシュ付き）の提供。

### Non-Goals
- 外部システムや外部ファイルからのクイズ・クイズリストの一括インポート機能の実装。
- リアルタイムマルチプレイヤー対戦プレイ用の接続・ポーリング基盤の構築。
- 広告配信用のアドサーバー基盤そのものの構築。

---

## Boundary Commitments

### This Spec Owns
- **データ永続化と整合性**: `users`, `quizzes`, `quizLists`, `follows`, `bookmarks`, `attempts`, `feedbackReports`, `flags`, `reactions`, `notifications`, `metadata_genres`, `metadata_tags`, `mergeRequests`, `genreRequests`, `quizReviews`, `reviewResetRequests`, `adminLogs`（BAN/UNBAN等の監査ログ）などのFirestoreスキーマおよびトランザクション設計。
- **アカウント削除プロセス**: Next.js API Routeを経由した即時Auth物理削除と、Cloud Tasks/Cloud Functionsを連動させた非同期ジョブ分割によるアトミックバッチ匿名化。
- **ユーザーBAN/UNBAN処理とアクセス制限**: `users` の `isBanned` 等のアカウント状態管理、管理者用APIルート、Firestore Security Rulesによるデータ書き込み制限（`isNotBanned()`）、および認証セッション無効化のトリガー（クッキー `quizetika_banned` を使用した強制遷移）。
- **水平思考プレイ判定ロジック**: サーバーAPIを仲介するGemini API連携（直近最大20回分の会話履歴参照を伴うステートフル化）、**Phase 17**: 正規化同一質問キャッシュ（全カウンタ非消費）、二層日次制限（無料：同一クイズ30回/日・`dailyAiTurnCounts/_global` で横断150回/日）、`limit-exceeded` + `limitType`、**Phase 14**: 真相提出時は裏設定・真相キーワード（エッセンス）・プレイヤー要約を AI に渡す意味判定（常時 AI 呼び出し、文字列一致バイパスなし）。**Phase 17**: 諦め API は不合格完了のみ（`revealText` 非返却）。
- **メタデータ管理（Phase 6 拡張）**: 表記揺れタグの自動名寄せ、タグマスタ自動 create、ジャンルマスタ検証、`canonicalGenreId` / `canonicalTagIds` 書き込み時解決、C2 一覧クエリ、`listActiveGenres` / `searchQuizzes`、ガバナンス単一経路（`tagMerge.ts`）、`metadata_*` Security Rules。
- **オフライン/セッション保護**: クライアントローカル永続ストレージでの進捗永続化およびオンライン復帰時の自動バッチ同期。
- **クイズリーダーボード（初回／リプレイ）**: `quizzes.leaderboardFirstPlay` / `quizzes.leaderboardReplay` の更新ロジック、順位比較、トランザクション内の attempt 回数判定。
- **プレイ履歴クエリ**: 認証済み本人向け `attempts` 一覧 of ページング取得（クイズタイトル非正規化の解決を含む）。
- **Phase 8 — 分類ブックマーク**: 3種 `toggleBookmark`、公開親クイズ検証、分類一覧取得、問題ブックマーク通知。
- **Phase 8 — 問題リスト**: `listType` 付きリスト CRUD、公開問題追加検証、問題 ID 並び替え、問題リストエクスポート、`question-list` attempt 記録契約。
- **Phase 8 — 参照リンク作問**: `searchAuthorQuizzes`、参照 ID のみの保存パス、Copy-on-Write 切り離し、共有問題の安全な参照解除。
- **Phase 9 — 統合検索コアロジック**: `searchQuizzes` API における複数インデックス並行クエリ（タグ、作者名、ジャンル名等）、クライアント側マージ・重複排除、および大文字小文字を区別しない各種項目（タイトル、説明、作者名、タグ、ジャンル）の部分一致フィルタリング処理。
- **Phase 10 — タグマスタ一覧とタグ AND 検索**: `listActiveTags`、`quiz-tag-match` 純関数、`searchQuizzes` の `filters.tags` 拡張。
- **Phase 11 — 出題形式フィルタと scoped 検索**: `SearchFilters.format`、`quiz-format-match` 純関数、`searchQuizzes` 後段形式フィルタ（`resolveQuizFormat` 一致）。ジャンル固定 scoped 検索は既存 `genreId` + `expandGenreIdsForQuery` を維持。
- **Phase 10 スマートサジェスト（2026-06-06 追記）**: `search_logs` コレクションのスキーマ（`userId`, `queryText`, `tags[]`, `genreId`, `loggedAt`）および TTL、`searchQuizzes` 内での fire-and-forget ログ書き込み。`GET /api/genres/weekly-top` / `GET /api/search/weekly-top` の集計 API Route（server-side Firestore Admin SDK、Next.js revalidate: 1800）。ユーザー個人履歴の保存は UI 側 `localStorage` のみ（Core に記録しない）。
- **Phase 13 — Stripe サブスクリプション（2026-06）**: `users` の契約 tier・Stripe 識別子・契約状態フィールド、`subscription-plans` マスタ、`resolveUserEntitlements`、Checkout / Portal / Webhook API Routes、Webhook 冪等ログ（`stripe_processed_events`）、Firestore Rules による課金フィールドのクライアント書き込み遮断、`AskAiQuestionAPI` の tier 連動。
- **Phase 30 — SNSリンク連携**: ユーザーの `snsLinks`（マップ）の構造設計、プロフィール更新時のバリデーション（ドメインおよびURL形式）、および `storage.ts` 内の `getSnsLogoUrl` ヘルパー（インメモリキャッシュ付き）の定義。
- **Phase 39 — NGワードマスタ参照によるコンテンツ検証**: `quiz-validation.ts` の禁止語判定ロジック（`containsNgWord`/`validateQuizForPublish`）が `supabase-governance` 所有の `ng_words` マスタを参照する契約、および取得失敗時の安全側フェイルクローズ処理。

### Out of Boundary
- 外部APIへの直接のクライアント通信（AI呼び出しなど）はSecurity Rulesで拒否され、すべてNext.js API Routeを経由します。
- クイズデータの一括JSONインポートは行わず、手動によるエクスポート（ダウンロード）パッケージ生成のみを担当します。
- プラットフォーム総合リーダーボード（`/leaderboard`）の集計・表示。
- プロフィール／プロフィール画面のプレイ履歴UIレイアウト（`quizetika-auth-profile-ui`）。
- クイズ詳細画面のリーダーボードタブUI（`quizetika-play-flow-ui`）。
- 管理者向けBAN/UNBAN操作画面のUIレイアウトおよび表示コンポーネント（`quizetika-admin-users-ui` が担当）。
- **Phase 6**: ホーム/エディタ/ジャンル一覧の UI、ジャンル新設・マージ画面のレイアウト、既存クイズの一括 `genre` 物理書き換え、Cloud Functions への投票移行。
- **Phase 8**: `/bookmarks` タブ UI、リスト/作問エディタのピッカー・DnD・検索パネル（`quizetika-play-flow-ui` / `quizetika-creator-dash-ui`）。プロフィールのリストタイプ別表示（`quizetika-auth-profile-ui`）。
- **Phase 10–11**: ホーム／ジャンルページの探索 UI（タグチップ、アコーディオン、カルーセル、フィルタ状態管理）は `quizetika-play-flow-ui` が担当。
- **Phase 10 スマートサジェスト — 境界外**: ユーザー個人の直近検索履歴の保存（`localStorage` のみ）、スマートサジェスト UI ドロップダウンのレンダリング（`quizetika-play-flow-ui`）。
- **Phase 13 — 課金 UI**: `/pricing` 画面、プランカード、購入・契約管理 CTA、Checkout 成功／キャンセル後の画面フィードバック（`quizetika-billing-subscription-ui`）。プレイ画面の残り質問数・制限誘導（`quizetika-play-flow-ui`）。Stripe Dashboard での Product/Price 作成・税設定。
- **Phase 14**: テストプレイのローカル `truthKeywords` 部分一致判定（`checkTruthKeywordsLocally` / `test-play-client.tsx`）。
- **Phase 16**: 水平思考本番プレイ UI（`quiz-play-client.tsx`）のチャット統合入力・諦め・経過時間・ルール説明（`quizetika-play-flow-ui` 境界と重複するが実装はコア play ルート）。
- **Phase 17 — プレイ/課金 UI**: 未登録向けボタン表記、制限到達 Pro 誘導（`/pricing`）、諦め後チャット内ナビ、ルール説明の上限数値更新（`quizetika-play-flow-ui`）。Free プラン上限説明（`quizetika-billing-subscription-ui` の `pricing-display.ts`）。
- **Phase 18 — モード選択警告 UI**: 模擬試験・フラッシュカードのランキング非対象および初回プレイ権利消滅の事前告知（`quizetika-play-flow-ui`）。
- **Phase 20 — 〇× UI**: 専用プレイ回答パネル（`quizetika-play-flow-ui`）、作問正解トグル（`quizetika-creator-dash-ui`）。
- **Phase 39 — NGワード管理**: NGワードマスタ（`ng_words`）自体の登録・編集・有効/無効切替ロジックおよびそのRPC（`supabase-governance` が担当）。管理者向けNGワード管理UI（`quizetika-moderation-governance-ui` が担当）。

### Allowed Dependencies
- **外部AI API**: 生成AI自動判定に必要な外部API（Google Gemini API等）。
- **アセットストレージ**: カバー画像やアバター画像を管理する Firebase Storage。
- **バックエンド基盤**: ユーザー認証およびデータの永続化を行う Firebase Auth, Cloud Firestore。
- **外部決済（Phase 13）**: Stripe Checkout Sessions API、Customer Portal、Webhook（署名検証）。
- **Phase 39 — NGワードマスタ読み取り**: `supabase-governance` が所有する `ng_words` テーブル（`is_active = true` の語句一覧を読み取り専用で参照）。

### Revalidation Triggers
- `spec.json` の型定義（`User`, `Quiz`, `Attempt` 等）のスキーマ変更。
- 退会処理時における匿名化対象コレクションの追加。
- AI自動真相判定のプロンプト構成やGemini APIのインターフェース変更。
- `leaderboardFirstPlay` / `leaderboardReplay` フィールド追加および旧 `leaderboard` 読み取り互換の廃止方針。
- プレイ履歴APIのレスポンス形状またはページングカーソル形式の変更。
- `metadata_genres` / `metadata_tags` スキーマ変更、canonical 解決アルゴリズム変更、ジャンル一覧クエリのフォールバック廃止。
- `QuizList.listType` 追加および未設定リストのデフォルト解釈変更。
- `Attempt.mode` に `question-list` 追加、参照リンク問題の Copy-on-Write 契約変更。
- `BookmarkFeed` / `BookmarkedQuestionEntry` レスポンス形状の変更。
- **Phase 10**: `SearchFilters.tags` の意味変更、`listActiveTags` の存続タグ定義（`canonicalId == null`）変更、`quiz-tag-match` 照合規則変更。
- **Phase 11**: `SearchFilters.format` の許容値集合変更、`quiz-format-match` / `resolveQuizFormat` 推定規則変更（`quizetika-play-flow-ui` のカード・カルーセル表示と連動再検証）。
- **Phase 10 スマートサジェスト**: `search_logs` コレクションの TTL・スキーマ変更、`GET /api/genres/weekly-top` / `GET /api/search/weekly-top` のレスポンス形状変更、`searchQuizzes` の fire-and-forget ログ書き込み報啄ルール変更。
- **Phase 13**: `User` の `subscriptionTier` / 課金関連フィールド追加、`resolveUserEntitlements` の tier 解釈変更、Checkout / Portal / Webhook API のリクエスト・レスポンス形状変更、`subscription-plans` マスタへの `premium` tier 追加。
- **Phase 17**: `FREE_TIER_PER_QUIZ_LIMIT` / `FREE_TIER_GLOBAL_DAILY_LIMIT` の変更、`dailyAiTurnCounts/_global` doc 契約変更、`limit-exceeded` の `limitType` 追加、諦め API 応答形状変更（`revealText` 廃止）、`normalizeQuestionText` 規則変更。
- **Phase 18**: `isLeaderboardEligibleAttempt` の除外モード集合変更、`countPriorCompletedAttempts` のカウント対象（全モード／test-play 除外）変更。
- **Phase 28**: `Attempt.questionAnswerDetails` のデータ定義変更、`saveAttempt` 内検証ロジック（件数・正解数・問題ID実在）の変更、`PendingSyncAttempt` キュー構造変更。
- **Phase 30**: `User.snsLinks` のオブジェクト定義変更、SNSドメイン検証ルールの変更、Storage上のSNSロゴパスや拡張子の変更。
- **Phase 39**: `ng_words` の列構成（`word`／`is_active`）変更、NGワード取得関数の戻り値形状の変更、取得失敗時のフェイルクローズ方針の変更。

---

## Architecture

### Existing Architecture Analysis
既存のコードベースには、クライアントから直接Firestoreを操作する簡易的なサービス（`src/services/quiz.ts` 等）がすでに実装されています。
本設計はこれを拡張し、重要な更新処理や複雑なビジネスロジック（退会、NGワード検証、AI対話）において、Firestore Security Rulesによる不正書き込みの遮断と、セキュアなサーバーAPI Route（Next.js）および Cloud Functions による二重の検証・処理を強制するハイブリッドモデルを適用します。

### Architecture Pattern & Boundary Map

```mermaid
graph TB
    Client[Client UI / Browser]
    ApiRouter[NextJS API Router]
    Storage[Firebase Storage]
    AuthService[Firebase Auth]
    CloudFunctions[Cloud Functions]
    CloudTasks[Cloud Tasks Queue]
    Gemini[Gemini AI API]
    Firestore[(Cloud Firestore)]

    Client --> AuthService
    Client --> Storage
    Client --> Firestore
    Client --> ApiRouter

    ApiRouter --> Gemini
    ApiRouter --> CloudTasks
    ApiRouter --> Firestore

    CloudTasks --> CloudFunctions
    CloudFunctions --> Firestore
    CloudFunctions --> Storage
```

### Technology Stack

| Layer                    | Choice / Version             | Role in Feature                                             | Notes                                             |
| ------------------------ | ---------------------------- | ----------------------------------------------------------- | ------------------------------------------------- |
| Frontend / CLI           | Next.js v16.2.6 (App Router) | ユーザーUIの提供、ローカルセッション永続化                  | React v19.2.4、TypeScript                         |
| Backend / Services       | Next.js API Routes           | セキュアなAI判定プロキシ、即時退会Auth削除、Cloud Tasks登録 | Firebase Admin SDK                                |
| Data / Storage           | Cloud Firestore              | 全データの永続化とアトミックカウント更新                    | `firestore.indexes.json` で複合インデックスを管理 |
| Messaging / Events       | Cloud Tasks                  | 退会時非同期分割匿名化ジョブの遅延実行                      | Cloud Functions と連携                            |
| Infrastructure / Runtime | Firebase Storage             | アバターやカバー画像の保存（上限2MB）                       | Storage Security Rules による認証保護             |

---

## File Structure Plan

### Directory Structure
```
src/
├── app/
│   └── api/
│       ├── admin/
│       │   └── users/
│       │       ├── ban/
│       │       │   └── route.ts  # 管理者ユーザーBAN API (12.1)
│       │       └── unban/
│       │           └── route.ts  # 管理者ユーザーUNBAN API (12.2)
│       ├── attempt/
│       │   ├── ask-ai/
│       │   │   └── route.ts      # AI質問判定API (4.1, 4.2)
│       │   └── verify-truth/
│       │       └── route.ts      # AI真相判定API (4.5, 4.6, 9.8)
│       └── user/
│           ├── delete-account/
│           │   └── route.ts      # 即時退会Auth物理削除API (1.4)
│           └── play-history/
│               └── route.ts      # 本人プレイ履歴API (10.1–10.5)
├── lib/
│   ├── leaderboard-ranking.ts    # 順位比較・マージ・top5抽出 (9.4–9.6)
│   ├── metadata-resolution.ts    # canonical 解決・マージ展開・クイズ保存用メタ適用 (2.x, 11.x) [Phase 6 新規]
│   ├── quiz-format.ts            # resolveQuizFormat（形式推定）(17.x) [既存]
│   ├── quiz-format-match.ts      # クイズ×出題形式照合（検索用）(17.x) [Phase 11 新規]
│   └── quiz-tag-match.ts         # クイズ×タグ照合（AND 検索用）(16.x) [Phase 10 新規]
├── services/
│   ├── attempt.ts                # saveAttempt内LB更新、listUserPlayHistory、review genreFilter (3.x, 9.x, 10.x, 3.7)
│   ├── bookmark.ts               # ブックマークのアトミック管理 (5.3)
│   ├── moderation.ts             # 通報・自動保留のみ (7.1–7.3)。ジャンルAPIスタブ削除 [Phase 6]
│   ├── reputation.ts             # BAN/UNBANサービスと監査ログ記録 (12.1, 12.2)
│   ├── tagMerge.ts               # マージ投票・ジャンル新設（単一経路）(7.4–7.8, 11.7)
│   ├── quiz-list.ts              # リストの管理 (5.4)
│   ├── quiz.ts                   # saveQuiz canonical化、getQuizzesByGenre/Tag、searchQuizzes (2.x, 11.x)
│   ├── storage.ts                # Storageアセット操作、自動クレンジング (1.5, 5.1)
│   └── user.ts                   # バッジ付与、プロフィール編集 (1.2, 1.3)
└── types/
    └── index.ts                  # すべての型定義ファイル (1.1, 2.2, 3.5, etc)
```

### Modified Files
- `src/types/index.ts` — **Phase 30**: `User` インターフェースに `snsLinks` オブジェクト（オプショナル）を追加。また、称号、ウミガメスープ履歴、必須キーワード `truthKeywords` などの型定義を網羅。
- `src/services/user.ts` — **Phase 30**: `UpdateProfileData` の拡張、`validateProfileData` 内での各SNS正規ドメインの検証（正規表現パターン適用）、および `updateProfile` への `snsLinks` 保存処理の統合。
- `src/services/storage.ts` — **Phase 30**: 各SNS名（youtube, x, instagram, tiktok）から Storage 上の `assets/logos/` 内にある画像のダウンロードURLを非同期に取得して返す `getSnsLogoUrl` ヘルパー（インメモリキャッシュ付き）を追加。
- `src/services/quiz.ts` — クイズ公開時バリデーション（ウミガメスープにおけるキーワード設定検証）等を追加。
- `src/services/quiz-validation.ts` — ウミガメスープ形式の時、必須キーワードが最低1つ指定されているかどうかの検証を追加。
- `src/services/ask-ai-utils.ts` — 会話履歴を反映したシステムインラインプロンプト構築と Gemini Chat API 連携用マッピングロジックを追加。
- `src/services/verify-truth-utils.ts` — **Phase 14**: `buildVerifyTruthPrompt` に `truthKeywords` 引数を追加しエッセンス参照をプロンプトへ組み込む。**Phase 16**: 不合格 REASON 指示と固定2種 `advice` 正規化。`verifyKeywords` はテストプレイ向けに維持。
- `src/app/api/attempt/ask-ai/route.ts` — Firestore から履歴を取得して直近20回分の履歴を Gemini に渡しステートフルな呼び出しを行うよう修正。
- `src/app/api/attempt/verify-truth/route.ts` — **Phase 14**: キーワード即合格バイパスを削除し、常に AI 意味判定を実行。**Phase 16**: Admin SDK 化、クライアント計測 `elapsedSeconds` の保存、不合格 `advice` の固定2種正規化。
- `src/app/api/attempt/give-up-lateral/route.ts` — **Phase 16 新規**、**Phase 17**: `revealText` 返却廃止、不合格完了のみ。
- `src/services/lateral-give-up-utils.ts` — **Phase 16 新規**。諦め時表示テキスト解決（`explanation` 優先、未設定時 `aiContextDetails`）。
- `src/hooks/useElapsedSeconds.ts` — **Phase 16 新規**。プレイ中の経過秒数カウント。
- `src/lib/format-play-elapsed.ts` — **Phase 16 新規**。経過時間の表示フォーマットと API 保存用正規化。
- `src/app/quiz/[id]/play/quiz-play-client.tsx` — **Phase 16**: チャット統合入力（質問／回答切替）、諦め UI、経過時間、ルール説明、入力ロック。
- `src/app/quiz/[id]/play/play.module.css` — **Phase 16**: 入力モード切替・統合真相入力・グレーアウト・ルール説明スタイル。
- `src/components/quiz/quiz-editor.tsx` — ウミガメスープ形式の問題作成時に、タグ風UIで必須キーワードを追加・削除できるフォームを追加。
- `src/types/index.ts` — `leaderboardFirstPlay` / `leaderboardReplay`、`PlayHistoryEntry` 等を追加。
- `src/lib/leaderboard-ranking.ts` — **新規**。順位比較・ユーザー1枠マージ・上位5抽出の純関数。
- `src/services/attempt.ts` — 全問正解ガードを撤廃し、トランザクション内で初回／リプレイLBを更新。`listUserPlayHistory` を追加。
- `src/app/api/attempt/verify-truth/route.ts` — 共通LB更新ヘルパーを利用（重複ロジック削除）。
- `src/app/api/user/play-history/route.ts` — **新規**。IDトークン検証後、本人のみ履歴を返却。
- `firestore.indexes.json`（またはプロジェクト既定のインデックス定義）— `attempts`: `userId` + `completedAt` 降順クエリ用複合インデックスを追加。
- `tests/lib/leaderboard-ranking.test.ts` — **新規**。順位・マージ・top5の単体テスト。
- `tests/services/attempt-leaderboard.test.ts` — **新規**。初回／リプレイ振り分けの統合テスト。
- `src/lib/metadata-resolution.ts` — **新規**（Phase 6）。`resolveCanonicalGenreId`, `resolveCanonicalTagIds`, `expandGenreIdsForQuery`, `assertActiveGenre`, `ensureTagMasters`.
- `src/services/quiz.ts` — `saveQuiz` で canonical 埋め込み、`getQuizzesByGenre` C2 クエリ、`getQuizzesByTag` を `canonicalTagIds` 優先に、`searchQuizzes` 追加。
- `src/services/quiz-validation.ts` — 公開時ジャンルマスタ存在チェック（`assertActiveGenre` 連携）。
- `src/services/attempt.ts` — `getFailedQuestions` の genreFilter を `expandGenreIdsForQuery` 利用に変更。
- `src/services/moderation.ts` — `submitGenreRequest` / `resolveGenreRequest` 削除（`tagMerge.ts` に統一）。
- `src/types/index.ts` — `GenreMetadata`, `TagMetadata` 型追加。
- `firestore.rules` — `metadata_genres`, `metadata_tags`, `mergeRequests`, `genreRequests`（`detailed_design.md` §6.5 準拠）。
- `firestore.indexes.json` — `(status, canonicalGenreId, createdAt|playCount|bookmarksCount)` 複合インデックス。
- `tests/lib/metadata-resolution.test.ts` — **新規**。
- `tests/services/quiz-genre-query.test.ts` — **新規**（canonical + legacy フォールバック union）。

**Phase 8 追加ファイル**:
- `src/lib/question-list-validation.ts` — **新規**。`listType` ガード、親クイズ `published` 検証、タイプ不一致操作拒否。
- `src/lib/linked-question.ts` — **新規**。参照リンク判定、Copy-on-Write 切り離し、共有問題削除ガード。
- `src/services/author-quiz-search.ts` — **新規**。`searchAuthorQuizzes`（自作・下書き含むキーワード/タグ検索）。
- `src/services/bookmark.ts` — 問題登録時検証、分類フィード取得、問題 BM 通知（13.x）。
- `src/services/question.ts` — 問題一覧 enrich、リスト追加を validation 経由に（14.x）。
- `src/services/quiz-list.ts` — `listType`、問題並び替え、タイプ別一覧、問題リストエクスポート（14.x）。
- `src/services/quiz.ts` — 参照リンク保存パス統合（15.x）。また、`searchQuizzes` API を拡張してタグ、作者名、ジャンル名、タイトルを網羅する並行クエリとクライアント側ハイブリッド部分一致フィルタを実装（Phase 9）。
- `src/services/quiz-list-utils.ts` — `buildQuestionListExportPackage`、`reorderQuestionIds`。
- `src/types/index.ts` — `QuizListType`, `listType`, `Attempt.mode` 拡張、`BookmarkFeed` 型。
- `firestore.indexes.json` — `quizLists`: `authorId` + `listType` + `createdAt`（任意、タイプ別一覧用）。
- `tests/services/quiz-search-universal.test.ts` — **新規**。統合検索（ハイブリッド検索）における並行クエリ、重複排除、および部分一致フィルタの単体テスト（Phase 9）。
- `tests/lib/linked-question.test.ts` — **新規**。
- `tests/services/bookmark-phase8.test.ts` — **新規**。
- `tests/services/quiz-list-question-type.test.ts` — **新規**。
- `tests/services/quiz-linked-question.test.ts` — **新規**。
- `tests/services/author-quiz-search.test.ts` — **新規**。

**Phase 10 追加ファイル**:
- `src/lib/quiz-tag-match.ts` — **新規**。クイズが指定タグ（canonical 解決済み）を満たすかの純関数（要件 16.7–16.8）。
- `src/services/quiz.ts` — `listActiveTags()` 追加、`SearchFilters.tags` 拡張、`searchQuizzes` にタグ AND 合成ロジック。
- `tests/lib/quiz-tag-match.test.ts` — **新規**。canonical / legacy / マージ旧タグの照合。
- `tests/services/quiz-list-active-tags.test.ts` — **新規**。存続タグのみ・ソート・空配列。
- `tests/services/quiz-search-tags-and.test.ts` — **新規**。単一/複数タグ AND、キーワード併用、タグのみ、重複除去。

**Phase 11 追加ファイル**:
- `src/lib/quiz-format-match.ts` — **新規**。`resolveQuizFormat` を用いたクイズ×指定形式の一致判定（要件 17.1, 17.6）。
- `src/services/quiz.ts` — `SearchFilters.format` 追加、`searchQuizzes` 後段に形式フィルタを挿入。
- `tests/lib/quiz-format-match.test.ts` — **新規**。`format` フィールドあり／問題から推定／不一致。
- `tests/services/quiz-search-format-filter.test.ts` — **新規**。形式のみ、genreId+format、tags+format+keyword、format 未指定 regression、scoped genre 漏れなし。

---

## System Flows

### タグ AND 複合検索フロー（Phase 10）

```mermaid
sequenceDiagram
    participant UI as play-flow-ui
    participant QS as searchQuizzes
    participant MR as metadata-resolution
    participant QTM as quiz-tag-match
    participant DB as Firestore

    UI->>QS: searchQuizzes(keyword, { tags, genreId, ... })
    QS->>QS: normalizeTag + dedupe tags
    QS->>MR: resolveCanonicalTagIds(tags)
    MR-->>QS: canonicalIds[]
    alt keyword 空 & 複数タグ
        loop 各タグ
            QS->>DB: getQuizzesByTag (canonical 優先)
        end
        QS->>QS: quizId で intersect
    else keyword あり or 単一タグ
        QS->>QS: Phase 9 母集団取得
    end
    QS->>QTM: quizMatchesAllTags(quiz, specs)
    QTM-->>QS: AND 一致のみ
    QS->>QS: genre / difficulty フィルタ
    QS-->>UI: Quiz[]
```

### タグマスタ一覧フロー（Phase 10）

```mermaid
sequenceDiagram
    participant UI as useActiveTags
    participant QS as listActiveTags
    participant DB as metadata_tags

    UI->>QS: listActiveTags()
    QS->>DB: where canonicalId == null
    DB-->>QS: TagMetadata[]
    QS->>QS: id 付与 + tagName ソート
    QS-->>UI: TagMetadata[]
```

### 出題形式フィルタ付き複合検索フロー（Phase 11）

```mermaid
sequenceDiagram
    participant UI as play-flow-ui
    participant QS as searchQuizzes
    participant QFM as quiz-format-match
    participant RF as resolveQuizFormat
    participant DB as Firestore

    UI->>QS: searchQuizzes(keyword, { format, genreId, tags, ... })
    QS->>DB: Phase 9/10 母集団取得
    QS->>QS: needle / tags AND / genre expand
    QS->>QFM: applyFormatFilter after genre step
    loop 各クイズ
        QFM->>RF: resolveQuizFormat(quiz)
        RF-->>QFM: QuizFormat
        QFM-->>QS: match boolean
    end
    QS->>QS: difficulty / questionCount
    QS-->>UI: Quiz[]
```

### 検索ログ fire-and-forget フロー（Phase 10 スマートサジェスト追記）

```mermaid
sequenceDiagram
    participant UI as play-flow-ui
    participant SQ as searchQuizzes
    participant SL as search-log.ts
    participant DB as Firestore (search_logs)

    UI->>SQ: searchQuizzes(queryText, filters)
    SQ->>SL: writeSearchLog(uid, queryText, tags, genreId)   
    Note over SQ,SL: void返却・非待機（fire-and-forget）
    SL-->>DB: search_logs.add(...)   
    Note over SL,DB: 失敗しても SQ は継続
    SQ->>SQ: 検索処理（Phase 9/10/11 パイプライン）
    SQ-->>UI: Quiz[]
```

**フロー上の決定**:
- `writeSearchLog` は `async` だが `await` せず `void` で呼び出す。完了を待たないため検索レイテンシに影響しない。
- 未認証（uid なし）または空クエリの場合は `writeSearchLog` を呼び出さず早期リターン。
- `search_logs` ドキュメントの内部エラーは `console.error` のみ（据広げしない）。

### 週間人気ジャンル Top5 集計フロー（Phase 10 スマートサジェスト追記）

```mermaid
sequenceDiagram
    participant UI as play-flow-ui
    participant API as GET /api/genres/weekly-top
    participant DB as Firestore (search_logs + plays)

    UI->>API: GET /api/genres/weekly-top
    Note over API: Next.js revalidate: 1800 (30分キャッシュ)
    API->>DB: attemptsコレクションを直近で7日間で絞る
    DB-->>API: attempts[]
    API->>API: genreIdでグループ集計→ ソート→ Top5
    API-->>UI: { genres: GenreWeeklyEntry[] }
```

**フロー上の決定**:
- `attempts` コレクションを集計源とする（`completedAt >= now - 7日` フィルタ）。`search_logs` はアクセスログ疲の統計に使わず、実際のプレイ完了数を正確に反映するため `attempts` 連用。
- `status === 'published'` で有効なジャンルがある attempt のみ集計対象（test-play attempt を含む不完全な attempt は失敗してもスキップ）。
- API エラー時は HTTP 500 を返し、代替データフォールバックを和えない（要件 18.5）。

### 週間人気ワード／タグ Top5 集計フロー（Phase 10 スマートサジェスト追記）

```mermaid
sequenceDiagram
    participant UI as play-flow-ui
    participant API as GET /api/search/weekly-top
    participant DB as Firestore (search_logs)

    UI->>API: GET /api/search/weekly-top
    Note over API: Next.js revalidate: 1800
    API->>DB: search_logsを loggedAt >= now-7日 で絞る
    DB-->>API: SearchLogEntry[]
    API->>API: queryText をグループ集計→ Top5 キーワード
    API->>API: tags[] を展開集計→ Top5 タグ
    API-->>UI: { keywords: string[], tags: string[] }
```

**フロー上の決定**:
- `queryText` が空なログはキーワード集計から除外。`tags` が空のログはタグ集計から除外。
- キーワードとタグは別フィールドで返す（要件 18.8）。
- API エラー時は HTTP 500、代替データフォールバックなし（要件 18.10）。



### クイズリーダーボード更新フロー（`saveAttempt` / `verify-truth` 共通）

```mermaid
sequenceDiagram
    autonumber
    participant Svc as AttemptService / VerifyTruthAPI
    participant Rank as leaderboard-ranking.ts
    participant DB as Firestore

    Svc->>DB: トランザクション開始
    Svc->>DB: 当該 userId+quizId の完了済み attempts 件数を取得（新規 attempt 作成前・**全モード**・test-play 除く）
    alt 当該試行の mode が exam または flashcard
        Note over Svc: LB 更新スキップ（attempt 保存・playCount++ のみ）
    else 登録対象モード（normal / review / list / question-list / lateral 合格等）
        alt 完了済み件数 == 0（今回が初回完了）
            Note over Svc: 対象 board = firstPlay
        else 完了済み件数 >= 1（リプレイ）
            Note over Svc: 対象 board = replay（firstPlay は変更しない）
        end
        Svc->>Rank: isStrictlyBetter / mergeUserEntryAndTakeTop5
        Rank-->>Svc: 更新後配列（最大5件）
        Svc->>DB: leaderboardFirstPlay または leaderboardReplay 更新
    end
    Svc->>DB: attempts 作成、playCount++、コミット
```

**フロー上の決定（Phase 18 改定）**:
- 全問正解チェックは行わない。ゲスト・`test-play` は LB 更新対象外（attempt 永続化自体が行われない）。
- **`exam` / `flashcard`**: attempt は永続化するが、初回・リプレイいずれの LB も更新しない。
- **prior 件数カウント**: LB 登録対象の試行を保存するときのみ `countPriorCompletedAttempts` を呼ぶが、カウント対象は**モードを問わない**完了済み永続化試行（test-play 除く）。先に exam/flashcard のみ完了したユーザーは、次の normal 等で prior >= 1 となり **replay のみ**更新される。
- **`verify-truth`**: 合格完了時も同一 `buildLeaderboardUpdatesForQuiz` 経路。prior 件数はトランザクション前に全モードで集計（既存実装を維持）。

### 水平思考クイズ（ウミガメのスープ）ステートフルAI質問対話フロー

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant Client as プレイ画面 (/play)
    participant API as AI質問API (/api/attempt/ask-ai)
    participant AI as Gemini API
    participant DB as Firestore (Database)

    Player->>Client: 質問を入力し送信 (最大100文字)
    Client->>API: askAiQuestion(attemptId, questionText)
    activate API
    API->>DB: attempts/{id} の対話履歴を取得
    DB-->>API: attemptsData
    
    alt 正規化一致でセッションキャッシュに存在 (Phase 17)
        API-->>Client: キャッシュ回答 (isFromCache = true)
        Note over API: AI呼び出しなし。attempt・クイズ別・横断カウンタすべて非消費
    else キャッシュなし
        API->>DB: dailyAiTurnCounts/{quizId} と /_global を取得
        DB-->>API: perQuizCount, globalCount
        alt 無料ユーザーかつ per-quiz >= 30 または global >= 150
            API-->>Client: 429 limit-exceeded + limitType
        else 制限内
            API->>DB: クイズの裏設定 (aiContextDetails) を取得
            DB-->>API: aiContextDetails
            API->>API: 履歴から直近最大20回分をマッピング
            API->>AI: Gemini Chat API で履歴付きで呼び出し (ステートフル)
            AI-->>API: 判定結果 (Yes/No/Irrelevant/Unknown) + コメント
            API->>DB: 履歴追加 & attempt.aiTurnCount++ & 両カウンタ++ (Transaction)
            API-->>Client: 判定結果、turnsRemaining (perQuiz/global)
        end
    end
    deactivate API
```

### 水平思考クイズ（ウミガメのスープ）AI 意味的真相自動判定フロー（Phase 14）

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant Client as プレイ画面 (/play)
    participant API as 真相判定API (/api/attempt/verify-truth)
    participant AI as Gemini API
    participant DB as Firestore (Database)

    Player->>Client: 「回答する」で真相要約を提出 (100〜1000文字)
    Client->>API: verifyTruth(attemptId, truthSummary, elapsedSeconds)
    activate API
    API->>DB: truthKeywords と aiContextDetails を取得 (Admin SDK)
    DB-->>API: truthKeywords, aiContextDetails
    API->>AI: 裏設定 + エッセンスキーワード + プレイヤー要約のプロンプトを送信
    alt AI 判定成功
        AI-->>API: VERDICT + REASON (MISSING_ESSENCE / UNRELATED)
        alt AIによる合格判定
            API->>DB: attempt完了、elapsedSeconds保存、LB更新 (Transaction)
            API-->>Client: { isCorrect: true, advice: null }
        else AIによる不合格判定
            API->>DB: 不合格履歴の追加
            API-->>Client: { isCorrect: false, advice: 固定2種のいずれか }
        end
    else AI 利用不能
        API-->>Client: 503 ai-error（再試行可能、文字列一致代替合格なし）
    end
    deactivate API
```

### 水平思考クイズ — 諦めフロー（Phase 17、Phase 16 解説開示を廃止）

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant Client as プレイ画面 (/play)
    participant API as 諦めAPI (/api/attempt/give-up-lateral)
    participant DB as Firestore (Admin SDK)

    Player->>Client: 諦め操作を確認
    Client->>API: giveUp(attemptId, userId, elapsedSeconds)
    activate API
    API->>DB: attempt 本人確認・未完了チェック
    API->>DB: attempt 不合格完了、elapsedSeconds保存、playCount++ (Transaction)
    API-->>Client: { completed: true }（revealText なし）
    deactivate API
    Client->>Client: 入力ロック、チャット内にナビボタン表示
    Note over Client: 常に「結果画面へ」。listId ありなら「次の問題へ」も表示
```

### ユーザー退会・非同期データクレンジングフロー

```mermaid
sequenceDiagram
    autonumber
    actor User as 退会ユーザー
    participant API as 退会API (/api/user/delete-account)
    participant Auth as Firebase Auth
    participant CloudTasks as Cloud Tasks
    participant Function as onDeleteUserJob (Cloud Functions)
    participant DB as Firestore
    participant Storage as Firebase Storage

    User->>API: 退会申請を送信 (認証トークン付き)
    activate API
    API->>DB: users/{uid}.deleteStatus = 'delete_pending' に変更
    Note over API: 同期フェーズ: 軽量・即時完了
    API->>Auth: 該当 uid を即座に物理削除
    Note over API: 同一メールでの再登録を解放
    API->>CloudTasks: uid を含めてジョブを登録
    API-->>User: 退会成功レスポンス (ログアウト処理実行)
    deactivate API

    Note over CloudTasks, Function: 非同期フェーズ
    CloudTasks->>Function: ジョブの起動
    activate Function
    Function->>DB: quizzes, quizLists 内の authorId = uid を検索
    Function->>DB: 100件のチャンクに分割し、authorName="退会済みユーザー"に匿名化 (公開維持)
    Function->>DB: 指摘・通知・リアクションを同様に匿名化
    Function->>Storage: avatars/{uid}/* を物理削除
    Function->>DB: users/{uid} ドキュメント自体を物理削除
    deactivate Function
```

### クイズ保存時のメタデータ解決フロー（Phase 6）

```mermaid
sequenceDiagram
    autonumber
    participant Editor as QuizEditor / saveQuiz
    participant Meta as metadata-resolution.ts
    participant Val as quiz-validation.ts
    participant DB as Firestore

    Editor->>Val: validateQuizForPublish (published のみ)
    Editor->>Meta: assertActiveGenre(genre)
    Meta->>DB: metadata_genres/{genre}
    alt マスタ不存在
        Meta-->>Editor: validation-error
    end
    Editor->>Meta: resolveCanonicalGenreId(genre)
    Editor->>Meta: resolveCanonicalTagIds(normalizedTags)
    Meta->>Meta: ensureTagMasters (未登録タグは create)
    Editor->>DB: batch.set quizzes (genre, canonicalGenreId, canonicalTagIds 保持)
```

**フロー上の決定**: `genre` 表示用文字列は変更しない。下書きもジャンル必須（要件2.1）。テストプレイは `saveQuiz` を経由せず canonical 未設定を許容。

### ジャンル別公開クイズ一覧（C2 読み取り）フロー（Phase 6）

```mermaid
sequenceDiagram
    autonumber
    participant UI as GenreExplore / Home
    participant Quiz as quiz.ts
    participant Meta as metadata-resolution.ts
    participant DB as Firestore

    UI->>Quiz: getQuizzesByGenre(genreId, sort, limit)
    Quiz->>Meta: resolveCanonicalGenreId(genreId)
    Quiz->>Meta: expandGenreIdsForQuery(canonicalId)
    Note over Meta: [canonicalId, ...mergedGenreIds] 最大10件ずつチャンク
    par Canonical クエリ
        Quiz->>DB: where status=published, canonicalGenreId==canonicalId, orderBy
    and Legacy フォールバック
        Quiz->>DB: where status=published, genre in chunk, orderBy
    end
    Quiz->>Quiz: 結果を quizId で dedupe、ソート規則でマージ、limit 適用
    Quiz-->>UI: Quiz[]
```

**フロー上の決定**: 正規識別子が空の legacy クイズは `genre in` のみヒット。canonical ヒットと legacy ヒットの重複は `id` で除去。

---

## Requirements Traceability

| Requirement | Summary                                               | Components                               | Interfaces                                            | Flows                           |
| ----------- | ----------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| 1.1         | ユーザー登録および認証                                | User Authentication                      | Firebase Auth                                         | -                               |
| 1.2         | プロフィール編集                                      | `UserService`                            | `updateProfile`                                       | -                               |
| 1.3         | 称号バッジ自動付与                                    | `UserService`                            | `checkAndAwardBadges`                                 | -                               |
| 1.4         | 退会時即時Auth削除                                    | `DeleteAccountAPI`                       | `/api/user/delete-account`                            | 退会フロー                      |
| 1.5         | 大規模関連データの非同期匿名化                        | `onDeleteUserJob`                        | Cloud Functions Trigger                               | 退会フロー                      |
| 1.6         | 退会保留中のアクセス遮断                              | Security Rules                           | `deleteStatus != 'delete_pending'`                    | -                               |
| 2.1         | 下書き（タイトル・ジャンル・問題文必須）              | `QuizService`                            | `saveQuiz('draft')`                                   | メタデータ解決フロー            |
| 2.2         | ジャンルマスタ存在検証                                | `metadata-resolution`                    | `assertActiveGenre`                                   | メタデータ解決フロー            |
| 2.3         | 公開時バリデーション & NGチェック                     | `QuizService`                            | `saveQuiz('published')`                               | メタデータ解決フロー            |
| 2.4         | 保存時 canonical 非正規化                             | `metadata-resolution`                    | `resolveCanonical*`                                   | メタデータ解決フロー            |
| 2.5         | 未登録タグのマスタ自動 create                         | `metadata-resolution`                    | `ensureTagMasters`                                    | メタデータ解決フロー            |
| 2.6         | タグ名寄せ & 類似サジェスト                           | `QuizService`                            | `normalizeTag`, `getSimilarTag`                       | -                               |
| 2.7         | クイズタイトル更新時の非正規化同期                    | `QuizService`                            | `updateQuiz`                                          | -                               |
| 2.8         | クイズ削除時のカスケードクリーンアップ                | `QuizService`                            | `deleteQuiz`                                          | -                               |
| 2.9         | 作成クイズ一括エクスポート                            | `QuizService`                            | `exportQuizzes`                                       | -                               |
| 2.10        | 必須キーワード(エッセンス)のタグ風UI入力              | `QuizCreator` / UI                       | `truthKeywords`                                       | -                               |
| 2.11        | 公開時必須キーワードバリデーション                    | `QuizService`                            | `validateQuizForPublish`                              | -                               |
| 2.12        | テストプレイは canonical 不要                         | `test-play`                              | sessionStorage 経路                                   | -                               |
| 3.1         | 通常モードプレイ                                      | `AttemptService`                         | `saveAttempt`                                         | -                               |
| 3.2         | 解答セッションローカル永続化                          | `LocalAttemptSession`                    | `saveToLocalStorage`                                  | -                               |
| 3.3         | オフラインプレイ結果と自動同期                        | `LocalAttemptSession`                    | `syncPendingAttempts`                                 | -                               |
| 3.4         | オフラインリストプレイの進行ブロック                  | `LocalAttemptSession`                    | `checkConnectivity`                                   | -                               |
| 3.5         | プレイ結果画面（良問評価・難易度投票）                | `ReviewService`                          | `submitReview`                                        | -                               |
| 3.6         | 永続化試行保存とLB更新委譲                            | `AttemptService`                         | `saveAttempt`                                         | リーダーボード更新フロー        |
| 3.7         | 弱点克服ジャンルフィルタ（マージ展開）                | `AttemptService`                         | `getFailedQuestions`                                  | -                               |
| 9.1         | 永続化完了時のLB評価（登録対象モードのみ）            | `leaderboard-update.ts`                  | `isLeaderboardEligibleAttempt`                        | リーダーボード更新フロー        |
| 9.2         | exam/flashcard は LB 非登録                           | `leaderboard-update.ts`                  | `isLeaderboardEligibleAttempt`                        | リーダーボード更新フロー        |
| 9.3         | prior 件数は全モード（test-play 除く）                | `AttemptService`, `verify-truth`         | `countPriorCompletedAttempts`                         | リーダーボード更新フロー        |
| 9.4         | prior 0 → firstPlay のみ                              | `leaderboard-ranking.ts`                 | `resolveLeaderboardBoard`                             | リーダーボード更新フロー        |
| 9.5         | prior >= 1 → replay のみ                              | `leaderboard-ranking.ts`                 | `resolveLeaderboardBoard`                             | リーダーボード更新フロー        |
| 9.6         | exam 先 → 通常は replay のみ                          | `AttemptService`                         | `saveAttempt` (tx)                                    | リーダーボード更新フロー        |
| 9.7         | 正解数優先・同点タイム順                              | `leaderboard-ranking.ts`                 | `compareLeaderboard`                                  | -                               |
| 9.8         | ユーザー1枠・厳密優位時のみ差し替え                   | `leaderboard-ranking.ts`                 | `mergeUserEntryAndTakeTop5`                           | -                               |
| 9.9         | 上位5件保持                                           | `leaderboard-ranking.ts`                 | `mergeUserEntryAndTakeTop5`                           | -                               |
| 9.10        | 全問正解不要                                          | `AttemptService`                         | `saveAttempt`                                         | -                               |
| 9.11        | ウミガメ合格時の同一LB規則                            | `VerifyTruthAPI`                         | `/api/attempt/verify-truth`                           | 真相判定フロー                  |
| 9.12        | review/list/question-list は引き続き登録対象          | `leaderboard-update.ts`                  | `isLeaderboardEligibleAttempt`                        | -                               |
| 9.13–9.14   | モード選択警告 UI は Out                              | —                                        | `quizetika-play-flow-ui`                              | Out of boundary                 |
| 10.1        | 本人履歴・完了日時降順                                | `AttemptService` / PlayHistoryAPI        | `listUserPlayHistory`                                 | -                               |
| 10.2        | test-play 除外                                        | `AttemptService`                         | `listUserPlayHistory`                                 | -                               |
| 10.3        | 表示用メタデータ                                      | `AttemptService`                         | `listUserPlayHistory`                                 | -                               |
| 10.4        | 初回20件+カーソル                                     | `PlayHistoryAPI`                         | `GET /api/user/play-history`                          | -                               |
| 10.5        | 他人の履歴拒否                                        | `PlayHistoryAPI`                         | `GET /api/user/play-history`                          | -                               |
| 4.1–4.4     | ウミガメ会員必須・attempt 作成                        | `quiz-detail-client`, `AttemptService`   | `createLateralAttemptSession`                         | 認証フロー                      |
| 4.5         | 最大20回分の会話履歴を参照したステートフルAI質問      | `AskAiQuestionAPI`                       | `/api/attempt/ask-ai`                                 | 質問対話フロー                  |
| 4.6–4.7     | 無料 tier 二層制限（30/クイズ・150/日横断）           | `ask-ai-utils`, `AskAiQuestionAPI`       | `checkAiTurnLimits`, `dailyAiTurnCounts`              | 質問対話フロー                  |
| 4.8–4.9     | Pro 無制限・サーバー側 tier 参照                      | `EntitlementService`, `AskAiQuestionAPI` | `/api/attempt/ask-ai`                                 | 質問対話フロー                  |
| 4.10        | 正規化キャッシュ（全カウンタ非消費）                  | `ask-ai-utils`                           | `normalizeQuestionText`, `findCachedAnswer`           | 質問対話フロー                  |
| 4.11        | 上限到達・Pro 誘導（真相提出は継続可）                | `AskAiQuestionAPI`                       | `limit-exceeded` + `limitType`                        | 質問対話フロー                  |
| 4.12        | プレイ画面2カラム（チャット＋ルール）                 | UI Component                             | `quiz-play-client` (lateral)                          | -                               |
| 4.19        | チャット統合入力（質問／回答切替）                    | UI Component                             | `quiz-play-client`                                    | -                               |
| 4.20        | プレイ中経過時間（チャットヘッダー）                  | `useElapsedSeconds`                      | `format-play-elapsed`                                 | -                               |
| 4.21        | 諦め・真相非表示・不合格完了                          | `GiveUpLateralAPI`                       | `/api/attempt/give-up-lateral`                        | 諦めフロー（Phase 17）          |
| 4.22–4.23   | チャット内ナビ（結果／次の問題）                      | UI Component                             | `quiz-play-client`                                    | 諦めフロー（play-flow-ui）      |
| 4.24        | 諦め／合格時の入力ロック・グレーアウト                | UI Component                             | `quiz-play-client`                                    | -                               |
| 4.25        | 完了時 elapsedSeconds 保存                            | `VerifyTruthAPI`, `GiveUpLateralAPI`     | verify-truth, give-up-lateral                         | 真相判定／諦めフロー            |
| 4.26        | プレイヤー向けルール説明（右パネル）                  | UI Component                             | `quiz-play-client`                                    | -                               |
| 4.27        | 真相／諦め API の認証・本人確認                       | API Routes                               | verify-truth, give-up-lateral                         | -                               |
| 4.7         | 裏設定・エッセンス・要約の AI 意味判定                | `VerifyTruthAPI`, `verify-truth-utils`   | `buildVerifyTruthPrompt`, `/api/attempt/verify-truth` | 真相判定フロー                  |
| 4.8         | 文字列完全一致を合格条件としない                      | `verify-truth-utils`                     | `buildVerifyTruthPrompt`                              | 真相判定フロー                  |
| 4.9         | キーワードをエッセンス参照として AI に指示            | `verify-truth-utils`                     | `buildVerifyTruthPrompt`                              | 真相判定フロー                  |
| 4.10        | AI 失敗時は再試行・代替合格なし                       | `VerifyTruthAPI`                         | `/api/attempt/verify-truth`                           | 真相判定フロー                  |
| 4.11–4.12   | 真相判定合格/不合格フロー                             | `VerifyTruthAPI`                         | `/api/attempt/verify-truth`                           | 真相判定フロー                  |
| 19.1–19.23  | Stripe サブスクリプション（Phase 13）                 | `EntitlementService`, billing APIs       | `/api/billing/*`, `/api/webhooks/stripe`              | 購読・Webhook フロー            |
| 5.1         | フォロー/フォロワーアトミック更新                     | `UserService`                            | `followUser`                                          | -                               |
| 5.2         | タイムラインフィード表示                              | `QuizService`                            | `getFollowedTimeline`                                 | -                               |
| 5.3         | ブックマークアトミック更新                            | `BookmarkService`                        | `toggleBookmark`                                      | -                               |
| 5.4         | クイズリスト作成・編集・削除                          | `QuizListService`                        | `createQuizList`                                      | -                               |
| 5.5         | リスト連続プレイ (Attempt.listId)                     | `AttemptService`                         | `saveAttempt(mode='list')`                            | -                               |
| 5.6         | クイズリストパッケージエクスポート                    | `QuizListService`                        | `exportQuizList`                                      | -                               |
| 6.1         | クローズド指摘フィードバック送信                      | `ReviewService`                          | `submitFeedbackReport`                                | -                               |
| 6.2         | 指摘解決時の修正完了オート通知                        | `ReviewService`                          | `resolveReport`                                       | -                               |
| 6.3         | 👍/👎良問投票（作成者除外）                             | `ReviewService`                          | `submitReview`                                        | -                               |
| 6.4         | 仮リセット期間中の評価マスク                          | UI Component                             | `QuizDetailView`                                      | -                               |
| 6.5         | 評価リセット承認時の非同期クリーンアップ              | `ReviewService`                          | `resetReviews`                                        | -                               |
| 7.1         | コンテンツ通報とアトミック更新                        | `ModerationService`                      | `flagContent`                                         | -                               |
| 7.2         | 5回通報時の自動保留（非公開）                         | `ModerationService`                      | `flagContent` (Function)                              | -                               |
| 7.3         | 管理者審査（公開復帰/永久非公開）                     | `ModerationService`                      | `resolveFlag`                                         | -                               |
| 7.4         | タグ/ジャンル仮想マージ提案・投票                     | `TagMergeService`                        | `createMergeRequest`, `voteMergeRequest`              | -                               |
| 7.5         | マージ可決 70%                                        | `TagMergeService`                        | `voteMergeRequest` (tx)                               | -                               |
| 7.6         | 新ジャンル申請                                        | `TagMergeService`                        | `submitGenreRequest`                                  | -                               |
| 7.7         | ジャンルアイコン SVG 禁止                             | `storage.ts` / UI                        | `uploadImage` MIME 検証                               | -                               |
| 7.8         | ジャンル新設可決 80%                                  | `TagMergeService`                        | `voteGenreRequest`                                    | -                               |
| 11.1        | ジャンル一覧（マージ統合）                            | `QuizService`                            | `getQuizzesByGenre`                                   | C2 読み取りフロー               |
| 11.2        | canonical 優先 + legacy フォールバック                | `QuizService`                            | `getQuizzesByGenre`                                   | C2 読み取りフロー               |
| 11.3        | タグ一覧（canonical）                                 | `QuizService`                            | `getQuizzesByTag`                                     | -                               |
| 11.4        | 有効ジャンルマスタ一覧                                | `QuizService`                            | `listActiveGenres`                                    | -                               |
| 11.5        | 複合検索                                              | `QuizService`                            | `searchQuizzes`                                       | -                               |
| 11.6        | メタデータ Rules                                      | `firestore.rules`                        | metadata_* / mergeRequests                            | -                               |
| 11.7        | ガバナンス単一経路                                    | `TagMergeService`                        | `tagMerge.ts` のみ                                    | -                               |
| 11.8        | クイズの統合検索 (ユニバーサル検索)                   | `QuizService`                            | `searchQuizzes`                                       | -                               |
| 11.9        | ハイブリッド・マルチクエリ検索 (並行クエリとデデュプ) | `QuizService`                            | `searchQuizzes`                                       | -                               |
| 16.1–16.5   | 有効タグマスタ一覧                                    | `QuizService`                            | `listActiveTags`                                      | タグマスタ読み取りフロー        |
| 16.6–16.13  | 複数タグ AND 複合検索                                 | `QuizService`, `quiz-tag-match`          | `searchQuizzes`, `resolveCanonicalTagIds`             | タグ AND 検索フロー             |
| 16.14–16.15 | サジェスト API 非対象                                 | —                                        | Out of boundary                                       | -                               |
| 17.1–17.3   | 出題形式フィルタ                                      | `QuizService`, `quiz-format-match`       | `SearchFilters.format`, `resolveQuizFormat`           | 形式フィルタ検索フロー          |
| 17.4–17.5   | ジャンル固定 scoped 検索                              | `QuizService`                            | `searchQuizzes` + `expandGenreIdsForQuery`            | 形式フィルタ検索フロー          |
| 17.6        | UI と同一形式判定                                     | `quiz-format-match`                      | `resolveQuizFormat`                                   | -                               |
| 17.7–17.8   | インデックス/UI Out                                   | —                                        | Out of boundary                                       | -                               |
| 18.1–18.5   | 週間人気ジャンル Top5 集計                            | `GenresWeeklyTopAPI`                     | `GET /api/genres/weekly-top`                          | 週間ジャンル Top5 フロー        |
| 18.6–18.10  | 週間人気ワード／タグ Top5 集計                        | `SearchWeeklyTopAPI`                     | `GET /api/search/weekly-top`                          | 週間ワード／タグ Top5 フロー    |
| 18.11–18.13 | 検索ログ記録（fire-and-forget）                       | `QuizService`, `search-log`              | `writeSearchLog`                                      | 検索ログ fire-and-forget フロー |
| 18.14–18.16 | 境界明示（履歴は UI 側、Core 不保存）                 | —                                        | Out of boundary                                       | -                               |
| 12.1        | ユーザーのBANと監査ログ記録                           | `ReputationService` / API Route          | `/api/admin/users/ban`                                | -                               |
| 12.2        | BAN解除と監査ログ記録                                 | `ReputationService` / API Route          | `/api/admin/users/unban`                              | -                               |
| 12.3        | BAN中の書き込み拒否と強制ログアウト                   | Security Rules / AuthContext             | `isNotBanned()`, `quizetika_banned` Cookie            | -                               |
| 8.1         | 初期HTML読み込み速度0.5秒以内                         | Performance                              | SSR Cache / Optimization                              | -                               |
| 8.2         | 高負荷時エラー率0.1%未満                              | Infrastructure                           | High Availability                                     | -                               |
| 8.3         | クローラー向け高速HTMLとOGPメタデータ                 | SSR Component                            | `getServerSideProps` / Metadata                       | -                               |

---

## Components and Interfaces

### Component Summary Table

| Component                      | Domain/Layer | Intent                                                                 | Req Coverage                                      | Key Dependencies (P0/P1)                                                              | Contracts             |
| ------------------------------ | ------------ | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `UserService`                  | Service      | ユーザープロフィール、称号、フォロー管理                               | 1.2, 1.3, 5.1                                     | Firestore (P0)                                                                        | Service, State        |
| `metadata-resolution`          | Lib          | canonical 解決・マージ ID 展開・タグマスタ ensure                      | 2.2, 2.4, 2.5, 11.x                               | Firestore (P0)                                                                        | Pure functions + IO   |
| `QuizService`                  | Service      | クイズ保存・一覧・検索・エクスポート                                   | 2.1–2.9, 11.1–11.5, 16.1–16.13, 17.1–17.5         | metadata-resolution (P0), quiz-tag-match (P0), quiz-format-match (P0), Firestore (P0) | Service               |
| `quiz-tag-match`               | Lib          | クイズ×タグの canonical/legacy 照合（AND 用）                          | 16.7, 16.8                                        | normalizeTag (P0)                                                                     | Pure functions        |
| `quiz-format-match`            | Lib          | クイズ×出題形式の一致判定（`resolveQuizFormat` 使用）                  | 17.1, 17.6                                        | quiz-format (P0)                                                                      | Pure functions        |
| `TagMergeService`              | Service      | マージ投票・ジャンル新設（`tagMerge.ts`）                              | 7.4–7.8, 11.7                                     | Firestore (P0)                                                                        | Service, State        |
| `leaderboard-ranking`          | Lib          | LB順位比較・マージ・top5・board 振り分け                               | 9.4, 9.5, 9.6, 9.7–9.9                            | -                                                                                     | Pure functions        |
| `leaderboard-update`           | Lib          | LB 登録対象判定・更新ペイロード組み立て                                | 9.1, 9.2, 9.12                                    | leaderboard-ranking (P0)                                                              | Pure functions        |
| `AttemptService`               | Service      | 解答永続化、LB更新、本人プレイ履歴、オフライン同期                     | 3.1, 3.2, 3.3, 3.4, 3.6, 5.5, 9.1–9.11, 10.1–10.3 | Firestore (P0), LocalStore (P1), leaderboard-update (P0), leaderboard-ranking (P0)    | Service, State, Batch |
| `/api/genres/weekly-top`       | API Route    | 週間人気ジャンル Top5 集計（attemptsコレクションかまの直近 7日間集計） | 18.1–18.5                                         | Firestore Admin SDK (P0)                                                              | HTTP GET, 30min cache |
| `/api/search/weekly-top`       | API Route    | 週間人気ワード／タグ Top5 集計（search_logsから）                      | 18.6–18.10                                        | Firestore Admin SDK (P0)                                                              | HTTP GET, 30min cache |
| `search-log`                   | Lib          | fire-and-forget 検索ログ書き込み                                       | 18.11–18.13                                       | Firestore (P0)                                                                        | Pure function + IO    |
| `/api/user/play-history`       | API Route    | 本人プレイ履歴の認可付き取得                                           | 10.1, 10.4, 10.5                                  | AuthAdmin (P0), AttemptService (P0)                                                   | API                   |
| `BookmarkService`              | Service      | クイズ・リストのブックマークアトミック管理                             | 5.3                                               | Firestore (P0)                                                                        | Service, State        |
| `QuizListService`              | Service      | リストの作成、ドラッグ＆ドロップ、パッケージング                       | 5.4, 5.6                                          | Firestore (P0), QuizService (P1)                                                      | Service, State        |
| `ReviewService`                | Service      | 良問評価、間違い指摘、修正通知、リセットバッチ                         | 3.5, 6.1, 6.2, 6.3, 6.5                           | Firestore (P0), CloudTasks (P1)                                                       | Service, State, Batch |
| `ModerationService`            | Service      | 通報、自動保留、審査のみ                                               | 7.1, 7.2, 7.3                                     | Firestore (P0)                                                                        | Service, State        |
| `ReputationService`            | Service      | 信頼スコア、モデレータ資格、BAN/UNBAN、監査ログ記録                    | 12.1, 12.2                                        | Firestore (P0)                                                                        | Service, State, Tx    |
| `/api/admin/users/ban`         | API Route    | 管理者用ユーザーBAN API                                                | 12.1                                              | AuthAdmin (P0), ReputationService (P0)                                                | API                   |
| `/api/admin/users/unban`       | API Route    | 管理者用ユーザーUNBAN API                                              | 12.2                                              | AuthAdmin (P0), ReputationService (P0)                                                | API                   |
| `/api/user/delete-account`     | API Route    | 即時Auth物理削除とCloud Tasksジョブ登録                                | 1.4                                               | AuthAdmin (P0), CloudTasks (P0)                                                       | API                   |
| `/api/attempt/ask-ai`          | API Route    | 水平思考 AI 質問（二層制限・正規化キャッシュ・Phase 17）               | 4.5–4.11, 4.8–4.9                                 | Gemini API (P0), Firestore (P0), ask-ai-utils (P0), EntitlementService (P0)           | API                   |
| `/api/attempt/verify-truth`    | API Route    | 水平思考のAI意味的真相判定（Phase 14/16）                              | 4.13–4.18, 4.25, 4.27                             | Gemini API (P0), Firestore Admin (P0), verify-truth-utils (P0)                        | API                   |
| `/api/attempt/give-up-lateral` | API Route    | 水平思考の諦め・不合格完了（Phase 17: 真相非返却）                     | 4.21, 4.25, 4.27                                  | Firestore Admin (P0)                                                                  | API                   |

---

### Component Interface Details

#### `UserService`
- **Intent**: ユーザープロフィール情報の管理、アトミックな称号バッジ付与、フォロー管理。
- **Requirements**: `1.2, 1.3, 5.1`

```typescript
export interface UserService {
  // プロフィール更新 (1.2)
  updateProfile(uid: string, data: { displayName: string; bio: string; followedGenres: string[] }): Promise<void>;
  
  // 称号バッジの判定とアトミック付与 (1.3)
  checkAndAwardBadges(uid: string): Promise<Badge[]>;
  
  // ユーザーのフォロー/解除トグル (5.1)
  followUser(followerId: string, followingId: string): Promise<{ isFollowing: boolean }>;
}
```
- **Preconditions**: `uid` が Firebase Auth 上で認証されていること。
- **Postconditions**: 称号バッジ付与時に条件を満たした場合、`users.badges` 配列にアトミックに Badge オブジェクトが追加される。

#### `metadata-resolution`
- **Intent**: ジャンル・タグの canonical 解決、マージ ID 展開、保存時マスタ整合を単一実装に集約。
- **Requirements**: `2.2, 2.4, 2.5, 11.2`

```typescript
export interface GenreMetadata {
  id: string;
  displayName: string;
  iconImageUrl: string | null;
  canonicalId: string | null;
  mergedGenreIds: string[];
  isActive: boolean;
}

/** ジャンルID → 統合先 canonical ID（自身が canonical なら自分） */
export async function resolveCanonicalGenreId(genreId: string): Promise<string>;

/** 正規化タグID配列 → canonicalTagIds（マスタ参照） */
export async function resolveCanonicalTagIds(tagIds: string[]): Promise<string[]>;

/** 一覧用: [canonicalId, ...mergedGenreIds] を dedupe（Firestore in 上限10でチャンク） */
export function chunkIdsForInQuery(ids: string[], chunkSize?: number): string[][];

export async function expandGenreIdsForQuery(genreId: string): Promise<string[]>;

export async function assertActiveGenre(genreId: string): Promise<void>;

/** 未登録タグを metadata_tags に create（canonicalId=null, mergedTagIds=[]） */
export async function ensureTagMasters(
  tagIds: string[],
  createdBy: string
): Promise<void>;
```
- **Invariants**: `resolveCanonicalGenreId` は `canonicalId` チェーンを辿り循環を検出。`genre` 表示値は変更しない。

#### `QuizService`
- **Intent**: クイズの保存、編集、Zod検証、NGワード二重検証付き公開、ジャンル/タグ一覧・複合検索、エクスポート。
- **Requirements**: `2.1–2.9, 11.1–11.5, 16.1–16.13, 17.1–17.5`

```typescript
export type QuizListSort = 'latest' | 'popular' | 'trending';

export interface SearchFilters {
  genreId?: string;
  /** 正規化済みタグ識別子の配列。複数指定時は AND（すべてを含むクイズのみ） */
  tags?: string[];
  /** 出題形式。`resolveQuizFormat` 結果と一致するクイズのみ返す（Phase 11） */
  format?: QuizFormat;
  difficultyMin?: number;
  difficultyMax?: number;
  minQuestions?: number;
  maxQuestions?: number;
}

export interface QuizService {
  saveQuiz(
    quiz: Omit<Quiz, 'id' | 'playCount' | 'bookmarksCount' | 'createdAt' | 'updatedAt'>,
    status: 'draft' | 'published'
  ): Promise<string>;
  normalizeTag(input: string): string;
  getSimilarTagSuggest(tag: string): Promise<string | null>;
  listActiveGenres(): Promise<GenreMetadata[]>;
  /** 存続タグ（canonicalId == null）のみ。UI サジェスト用 */
  listActiveTags(): Promise<TagMetadata[]>;
  getQuizzesByGenre(genreId: string, sort: QuizListSort, limit: number): Promise<Quiz[]>;
  getQuizzesByTag(tagId: string, sort: QuizListSort, limit: number): Promise<Quiz[]>;
  searchQuizzes(
    queryText: string,
    filters: SearchFilters,
    currentUserId?: string
  ): Promise<Quiz[]>;
  deleteQuiz(quizId: string): Promise<void>;
  exportQuizzes(uid: string): Promise<QuizExportPackage>;
}
```
- **Validation Hooks**: `saveQuiz` 内で `assertActiveGenre` → `resolveCanonicalGenreId` / `resolveCanonicalTagIds` → `ensureTagMasters` の順。公開時は既存 Zod + NG チェック。
- **`getQuizzesByGenre`（C2）**: (1) `canonicalGenreId == resolvedCanonicalId` クエリ (2) `genre in expandIds` チャンククエリ (3) `Map<id, Quiz>` で dedupe、(4) `sort` に応じてマージソート。
- **`getQuizzesByTag`**: 第一選択 `where('canonicalTagIds','array-contains', resolvedTagId)`。フォールバック `tags array-contains` は legacy 用に残す。
- **`searchQuizzes` (Phase 9 統合検索)**: 
  - `queryText` が指定された場合、大文字小文字を無視した並行 Firestore クエリを実行して母集団となるクイズ一覧を取得し、クライアントサイドで統合（`id` で dedupe）する：
    1. タグ一致クエリ: `where('tags', 'array-contains', normalizedQuery)` (タグ正規化適用)
    2. 作者名完全一致クエリ: `where('authorName', '==', queryText)`
    3. ジャンル一致クエリ: `getQuizzesByGenre(queryText, 100)` (マージされたジャンルもカバー)
    4. 新着クイズクエリ (全体母集団の担保): `getLatestQuizzes(100)`
  - 重複排除されたクイズ配列に対し、アプリ（サービス）層で `title`, `description`, `authorName`, `genre`, `tags` のいずれかが `queryText` (小文字化された needle) を含むかどうかの部分一致フィルタをかける。
  - さらに、詳細フィルター（`difficultyMin/Max`, `minQuestions/MaxQuestions`）を適用して最終結果を返す。
- **`listActiveTags`（Phase 10）**:
  - `metadata_tags` を `where('canonicalId', '==', null)` で読み取り（マージ吸収済みタグは除外）。
  - 各 doc に `id: doc.id` を付与。`tagName` が無い場合も `id` で返す。
  - `tagName` の `localeCompare('ja')` で昇順ソート（同順時は `id`）。
  - 0 件は `[]`。失敗時は例外をそのまま throw（ハードコードフォールバック禁止）。
- **`searchQuizzes` タグ AND 拡張（Phase 10）**:
  1. `filters.tags` を受け取り、各要素を `normalizeTag` → `Set` で重複除去。
  2. `resolveCanonicalTagIds` で canonical ID 配列を得る（入力と同順、1:1 対応の `TagMatchSpec[]` を構築）。
  3. **母集団 `base` の決定**（既存 Phase 9 ロジックを維持）:
     - `needle` あり → 既存の並行クエリ＋dedupe。
     - `needle` なし・`tags` のみ（1 件）→ `getQuizzesByTag(tags[0], 100, 'latest')` を第一候補。
     - `needle` なし・`tags` 複数 → 各タグで `getQuizzesByTag` を実行し、`quiz.id` で集合積（intersect）して母集団化（上限 100/タグ）。
     - `needle` なし・タグなし → 既存どおり `genreId` または `getLatestQuizzes`。
  4. **キーワード部分一致**（`needle` あり時）— 既存フィルタを適用。
  5. **`quizMatchesAllTags(quiz, specs)`** で AND 絞り込み（`tags` 未指定時はスキップ）。
  6. **ジャンルフィルタ** — `expandGenreIdsForQuery` + `genre` / `canonicalGenreId` 照合（`genreId` 未指定時はスキップ）。
  7. **出題形式フィルタ（Phase 11）** — `filters.format` 指定時のみ `quizMatchesFormat` を適用（未指定時はスキップ）。
  8. **数値フィルタ** — `difficultyMin/Max`, `minQuestions/maxQuestions`。
- **Canonical パイプライン順序（Phase 9–11 統一）**: `母集団取得 → needle 部分一致 → tags AND → genre → format → difficulty/questionCount`。すべて AND 合成。実装はこの順序で後段フィルタを適用すること（デバッグ・テストの期待値固定用）。
- **`searchQuizzes` 出題形式フィルタ拡張（Phase 11）** — 上記ステップ 7 の詳細:
  1. 判定は **`quiz.format` 直読み禁止**。必ず `resolveQuizFormat({ format: quiz.format, questions: quiz.questions })` と比較（要件 17.6）。`QuizCard` / 形式カルーセルと同一 lib を使用。
  2. **scoped 検索（要件 17.4–17.5）**: ジャンル別一覧ページは UI が `genreId` を常に渡す。ステップ 6 により他ジャンルは除外済み。形式・タグ・キーワードは追加 AND。
  3. **母集団と形式のみ指定**: `needle` 空・`tags` 空・`genreId` 空・`format` あり → 既存どおり `getLatestQuizzes(100)` を母集団とし、ステップ 7 で形式フィルタ（上限 100 件は Phase 10 と同型の探索用途許容。Phase 11 Non-Goal）。
- **Note**: リーダーボード更新は `AttemptService` / `verify-truth` に集約。

#### `quiz-tag-match`（`src/lib/quiz-tag-match.ts`）

| Field        | Detail                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| Intent       | 単一クイズが指定タグ（canonical 解決済み）を満たすかを判定。複数タグ AND の共通ロジック |
| Requirements | 16.7, 16.8                                                                              |

```typescript
export interface TagMatchSpec {
  /** resolveCanonicalTagIds の結果 */
  canonicalId: string;
  /** normalizeTag 済みの入力タグ */
  normalizedInput: string;
}

/** 要件 11.3 と同型: canonicalTagIds 優先、legacy tags フォールバック */
export function quizMatchesTag(
  quiz: Pick<Quiz, 'tags' | 'canonicalTagIds'>,
  spec: TagMatchSpec
): boolean;

export function quizMatchesAllTags(
  quiz: Pick<Quiz, 'tags' | 'canonicalTagIds'>,
  specs: TagMatchSpec[]
): boolean;
```

- **照合順序**: (1) `quiz.canonicalTagIds` に `spec.canonicalId` が含まれる → 一致。(2) `quiz.tags` を `normalizeTag` した集合に `spec.normalizedInput` または `spec.canonicalId` が含まれる → 一致。(3) それ以外は不一致。
- **Invariants**: `getQuizzesByTag` と同一規則。UI 層はチップ値として `normalizeTag` 済み `id` を渡す。

#### `quiz-format-match`（`src/lib/quiz-format-match.ts`）

| Field        | Detail                                               |
| ------------ | ---------------------------------------------------- |
| Intent       | 単一クイズの有効出題形式が指定形式と一致するかを判定 |
| Requirements | 17.1, 17.6                                           |

```typescript
import type { QuizFormat } from './quiz-format';

/** resolveQuizFormat 結果と指定 format の厳密一致 */
export function quizMatchesFormat(
  quiz: Pick<Quiz, 'format' | 'questions'>,
  format: QuizFormat
): boolean;

/** format 未指定時は true（フィルタ無効） */
export function applyFormatFilter(
  quizzes: Quiz[],
  format?: QuizFormat
): Quiz[];
```

- **判定規則**: `resolveQuizFormat(quiz) === format`。`quiz.format` が未設定の旧データは問題 `type` から推定（`quiz-format.ts` 既存ロジック）。
- **レガシーデータ（validate-design 2026-06-05 反映）**: `quiz.format` 未設定かつ `questions` が空配列のとき、`resolveQuizFormat` は `'mixed'` を返す（既存 lib 挙動。要件 17.6 と一致）。このため **`format: 'mixed'` フィルタのみヒット**し、他形式フィルタでは不一致となる。テストフィクスチャ `{ format: undefined, questions: [] }` で期待値を固定する。
- **Invariants**: `quizetika-play-flow-ui` の `QuizCard` / 形式カルーセルは同一 `QuizFormat` 型および `getFormatLabel` を使用。コアはラベル変換を行わない。

#### `TagMergeService`（`src/services/tagMerge.ts`）
- **Intent**: マージ提案・投票、ジャンル新設申請・可決の単一実装（`moderation.ts` のジャンルスタブは削除）。
- **Requirements**: `7.4–7.8, 11.7`

```typescript
// 既存 export を維持: createMergeRequest, voteMergeRequest, submitGenreRequest, voteGenreRequest, runMigration
// 可決閾値: merge 70% (weightedFor>=5), genre 80% (weightedFor>=5)
```

#### `leaderboard-ranking`（純関数ライブラリ）
- **Intent**: 要件9の順位規則および初回／リプレイ board 振り分けを単一実装に集約する。
- **Requirements**: `9.4, 9.5, 9.7–9.9`

```typescript
export type LeaderboardBoard = 'firstPlay' | 'replay';

/** a が b より上位なら負の数、同順位なら 0、下位なら正の数（sort 用） */
export function compareLeaderboardRecords(
  a: Pick<LeaderboardRecord, 'score' | 'elapsedSeconds'>,
  b: Pick<LeaderboardRecord, 'score' | 'elapsedSeconds'>
): number;

export function isStrictlyBetter(
  candidate: Pick<LeaderboardRecord, 'score' | 'elapsedSeconds'>,
  existing: Pick<LeaderboardRecord, 'score' | 'elapsedSeconds'>
): boolean;

export function mergeUserEntryAndTakeTop5(
  entries: LeaderboardRecord[],
  userId: string,
  incoming: Omit<LeaderboardRecord, 'completedAt'> & { completedAt: Date }
): LeaderboardRecord[];

export function resolveLeaderboardBoard(priorCompletedAttemptCount: number): LeaderboardBoard;
```
- **Invariants**: ソートは `score` 降順 → `elapsedSeconds` 昇順。返却配列は最大5要素。同一 `userId` は最大1件。

#### `leaderboard-update`（純関数ライブラリ）
- **Intent**: LB 登録対象モードの判定と、`saveAttempt` / `verify-truth` 共通の更新ペイロード組み立てを集約する（Phase 18）。
- **Requirements**: `9.1, 9.2, 9.3, 9.6, 9.12`

```typescript
/** guest / test-play / exam / flashcard を除外。review, list, question-list, normal 等は対象 */
export function isLeaderboardEligibleAttempt(
  attempt: Pick<Attempt, 'userId' | 'mode'>
): boolean;

export function buildLeaderboardUpdatesForQuiz(
  quiz: Quiz,
  priorCompletedCount: number,
  entry: LeaderboardRecord,
  mode: Attempt['mode']
): { board: LeaderboardBoard; updates: LeaderboardFieldUpdates } | null;
```

- **Invariants**:
  - `exam` / `flashcard` は `null` を返し LB フィールド更新なし。
  - `priorCompletedCount` は呼び出し元が**全モード**の完了件数（test-play 除く）を渡す。`resolveLeaderboardBoard(priorCompletedCount)` で `firstPlay` / `replay` を決定。
  - 登録対象外モードでも attempt 永続化・`playCount++` は `AttemptService` 側で継続（本モジュールは LB 更新のみ担当）。

#### `AttemptService`
- **Intent**: プレイ結果の永続化、トランザクション内リーダーボード更新、本人プレイ履歴クエリ、オフライン同期。
- **Requirements**: `3.1, 3.2, 3.3, 3.4, 3.6, 5.5, 9.1–9.11, 10.1–10.3`

```typescript
export interface AttemptService {
  saveAttempt(attemptData: Omit<Attempt, 'id' | 'completedAt'>): Promise<string>;
  updateFailedQuestions(uid: string, quizId: string, solvedQuestionIds: string[]): Promise<void>;

  listUserPlayHistory(params: {
    uid: string;
    limit?: number;       // default 20
    cursor?: string | null;
  }): Promise<PlayHistoryPage>;
}

export interface PlayHistoryEntry {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  mode: Attempt['mode'];
  completedAt: Date;
  elapsedSeconds: number;
}

export interface PlayHistoryPage {
  items: PlayHistoryEntry[];
  nextCursor: string | null;
}
```
- **Preconditions (`saveAttempt`)**: `userId` がゲストでないこと。`score` / `totalQuestions` / `failedQuestionIds` の整合性検証は現行どおり。
- **Postconditions (`saveAttempt`)**: トランザクション内で prior 完了件数（全モード・test-play 除く）に基づき、**登録対象モードのみ** `firstPlay` または `replay` を更新。`exam` / `flashcard` は attempt 保存のみ。
- **Implementation Notes（Phase 18）**:
  - `countPriorCompletedAttempts` は LB 登録対象試行保存時のみ呼び出すが、フィルタは `completedAt != null` のみ（モード不問）。
  - 既存の `priorCompletedCount = isLeaderboardEligible ? count(...) : 0` パターンを維持。exam 保存時は count 不要（LB スキップ）。
- **Implementation Notes**: クイズタイトルは `quizzes` を `quizId` でバッチ取得して `PlayHistoryEntry` に埋める。カーソルは `completedAt` + `attemptId` の不透明エンコード（例: Base64 JSON）。
- **Phase 6 (`getFailedQuestions`)**: `genreFilter` 指定時は `expandGenreIdsForQuery(genreFilter)` で ID 集合を得て、`quiz.genre` または `quiz.canonicalGenreId` が集合に含まれるかでフィルタ。

#### `/api/user/play-history`
- **Intent**: クライアントからの本人プレイ履歴取得を ID トークンで保護する。
- **Requirements**: `10.1, 10.4, 10.5`

| Method | Endpoint                 | Request                                                                 | Response          | Errors   |
| ------ | ------------------------ | ----------------------------------------------------------------------- | ----------------- | -------- |
| GET    | `/api/user/play-history` | Query: `limit?`, `cursor?` — Header: `Authorization: Bearer <ID_TOKEN>` | `PlayHistoryPage` | 401, 403 |

- **Preconditions**: `verifyIdToken` 成功。クエリの `uid` を受け付けない（トークンの `uid` のみ使用）。
- **Postconditions**: トークン `uid` と一致する履歴のみ返却。他人指定は 403。

---

## Data Models

### Domain Model

```typescript
// 1. ユーザー情報 (Users)
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
  followedGenres: string[];
  badges: Badge[];
  createdQuizzesCount: number;
  totalPlayCount: number;
  followersCount: number;
  followingCount: number;
  reputationScore: number;
  moderationTier: 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator';
  reputationHistory: ReputationEventLog[];
  lastReputationCalculatedAt: Date | null;
  totalFailedQuestionsCount: number;
  deleteStatus: 'active' | 'delete_pending';
  isBanned?: boolean;            // BAN状態フラグ (12.1)
  bannedReason?: string;          // BAN理由 (12.1)
  bannedAt?: Date;                // BAN実行日時 (12.1)
  createdAt: Date;
  updatedAt: Date;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt: Date;
}

export interface ReputationEventLog {
  eventId: string;
  delta: number;
  reason: string;
  createdAt: Date;
}

// 2. クイズ (Quizzes)
export interface Quiz {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  difficulty: number; // 1〜5 の整数
  genre: string;
  tags: string[];
  originalTags: string[];
  questions: Question[];
  questionCount: number;
  status: 'draft' | 'published' | 'suspended';
  flagsCount: number;
  playCount: number;
  bookmarksCount: number;
  positiveCount: number;
  negativeCount: number;
  tempPositiveCount: number;
  tempNegativeCount: number;
  reviewScore: number | null;
  reviewBadge: string | null;
  isReviewMasked: boolean;
  activeResetRequestId: string | null;
  canonicalGenreId: string;
  canonicalTagIds: string[];
  /** @deprecated 読み取り互換のみ。書き込みは firstPlay / replay を使用 */
  leaderboard?: LeaderboardRecord[];
  leaderboardFirstPlay: LeaderboardRecord[];
  leaderboardReplay: LeaderboardRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  type: 'true-false' | 'multiple-choice' | 'text-input' | 'sorting' | 'association' | 'lateral-thinking';
  questionText: string;
  explanation: string;
  imageUrl: string | null;
  hint: string | null;
  limitTime: number | null;
  correctTextAnswerList?: string[];
  choices?: Choice[];
  sortingItems?: SortingItem[];
  associationHints?: string[];
  aiContextDetails?: string;
  truthKeywords?: string[]; // ウミガメスープ用必須正解キーワード (2.7)
  correctCount: number;
  incorrectCount: number;
}

export interface Choice {
  id: string;
  choiceText: string;
  isCorrect: boolean;
  selectedCount: number;
}

export interface SortingItem {
  id: string;
  text: string;
  correctOrder: number;
}

export interface LeaderboardRecord {
  userId: string;
  displayName: string;
  score: number;           // 正解数（第1キー）
  elapsedSeconds: number;  // 合計解答時間・秒（第2キー）
  completedAt: Date;
}

// 3. プレイ履歴 (Attempts)
export interface Attempt {
  id: string;
  userId: string;
  quizId: string;
  listId?: string;
  mode: 'normal' | 'exam' | 'flashcard' | 'review' | 'list';
  score: number;
  totalQuestions: number;
  elapsedSeconds: number;
  failedQuestionIds: string[];
  difficultyVote?: number | null;
  aiQuestionsHistory?: AiQuestion[];
  aiTurnCount: number;
  aiTurnLimit: number | null;
  completedAt: Date;
}

export interface AiQuestion {
  id: string;
  questionText: string;
  answerType: 'yes' | 'no' | 'irrelevant' | 'unknown';
  aiComment?: string;
  isFromCache: boolean;
  createdAt: Date;
}

// 4. 指摘レポート (feedbackReports)
export interface FeedbackReport {
  id: string;
  quizId: string;
  quizTitle: string;
  questionId: string;
  questionText: string;
  selectedChoiceText?: string;
  reporterId: string;
  creatorId: string;
  category: 'typo' | 'fact' | 'alternative';
  content: string;
  status: 'open' | 'resolved';
  createdAt: Date;
}
```

### Physical Data Model（Firestore `quizzes` 追記）

| フィールド             | 型                    | 制約              | 説明                             |
| ---------------------- | --------------------- | ----------------- | -------------------------------- |
| `leaderboardFirstPlay` | `LeaderboardRecord[]` | 最大5 / 必須 `[]` | 初回完了 attempt のランキング    |
| `leaderboardReplay`    | `LeaderboardRecord[]` | 最大5 / 必須 `[]` | 2回目以降のランキング            |
| `leaderboard`          | `LeaderboardRecord[]` | 任意              | 移行期間の読み取りフォールバック |

**`attempts` クエリ（プレイ履歴）**: `where('userId','==',uid)` + `orderBy('completedAt','desc')` + `limit` + `startAfter(cursor)`。`mode != 'test-play'` はクエリ後フィルタまたは将来 `where('mode','not-in',...)`（インデックス要検討）。

### Physical Data Model（メタデータ・Phase 6）

**`metadata_genres/{genreId}`**

| フィールド       | 型             | 説明                                 |
| ---------------- | -------------- | ------------------------------------ |
| `id`             | string         | ドキュメントIDと一致                 |
| `displayName`    | string         | 表示名                               |
| `iconImageUrl`   | string \| null | ジャンルアイコン URL                 |
| `canonicalId`    | string \| null | 統合先（自身が canonical なら null） |
| `mergedGenreIds` | string[]       | 統合された旧ジャンルID               |
| `isActive`       | boolean        | 探索・作問で利用可能                 |

**`quizzes` 追記（書き込み時解決）**

| フィールド         | 書き込みタイミング                 |
| ------------------ | ---------------------------------- |
| `canonicalGenreId` | 毎回 `saveQuiz`（draft/published） |
| `canonicalTagIds`  | 毎回 `saveQuiz`、タグ変更時再計算  |

**Firestore 複合インデックス（Phase 6 追加）**

| コレクション | フィールド                                                       | 用途               |
| ------------ | ---------------------------------------------------------------- | ------------------ |
| `quizzes`    | `status` ASC, `canonicalGenreId` ASC, `createdAt` DESC           | ジャンル一覧・新着 |
| `quizzes`    | `status` ASC, `canonicalGenreId` ASC, `playCount` DESC           | 人気               |
| `quizzes`    | `status` ASC, `canonicalGenreId` ASC, `bookmarksCount` DESC      | トレンド           |
| `quizzes`    | `status` ASC, `canonicalTagIds` ARRAY_CONTAINS, `createdAt` DESC | タグ一覧           |

### Migration Strategy

```mermaid
flowchart LR
  A[読み取り] --> B{leaderboardFirstPlay あり?}
  B -->|Yes| C[そのまま使用]
  B -->|No| D[leaderboard を firstPlay として扱う]
  E[書き込み] --> F[firstPlay / replay のみ更新]
```

- 新規クイズ作成時は `leaderboardFirstPlay: []`, `leaderboardReplay: []` を初期化。
- 既存ドキュメントの一括移行スクリプトは Phase 5 対象外（手動／別タスク）。読み取り側で `leaderboard ?? []` を `leaderboardFirstPlay` のフォールバックとする。

**Phase 6 canonical バックフィル（任意・Out of scope）**

```mermaid
flowchart LR
  A[読み取り C2] --> B[canonical クエリ]
  A --> C[genre in フォールバック]
  D[オプション夜間バッチ] --> E[空 canonicalGenreId を saveQuiz 同等ロジックで埋める]
```

- 必須ではない: C2 フォールバックで legacy は一覧に含まれる。バッチは運用判断で別タスク。

---

## Phase 8: ブックマーク・リスト・問題再利用

### Architecture Pattern（Phase 8）

```mermaid
graph TB
    subgraph core [quizetika-core Phase 8]
        BookmarkSvc[BookmarkService]
        QuizListSvc[QuizListService]
        QuestionSvc[QuestionService]
        AuthorSearch[AuthorQuizSearchService]
        LinkedQ[linked-question lib]
        Validation[question-list-validation lib]
        QuizSvc[QuizService]
    end
    Firestore[(Firestore)]
    NotifySvc[NotificationService]

    BookmarkSvc --> Validation
    BookmarkSvc --> NotifySvc
    QuizListSvc --> Validation
    QuizListSvc --> QuestionSvc
    AuthorSearch --> QuizSvc
    QuizSvc --> LinkedQ
    LinkedQ --> Firestore
    BookmarkSvc --> Firestore
    QuizListSvc --> Firestore
    QuestionSvc --> Firestore
```

**パターン**: Option C Hybrid（gap 分析推奨）。既存サービスを拡張し、参照リンクと検証は `src/lib/` に純関数集約。UI は呼び出しのみ。

### 問題リストプレイ契約

クイズリスト（要件 5.5）と対称とし、問題リストは**収録問題ごとに1件の attempt** を記録する。

| フィールド       | 値                    |
| ---------------- | --------------------- |
| `mode`           | `'question-list'`     |
| `listId`         | 問題リスト ID         |
| `quizId`         | 当該問題の親クイズ ID |
| `totalQuestions` | 1（問題単位プレイ）   |

プレイ画面ルーティングは隣接 UI が担当。コアは `getQuestionsInList(listId)` で順序付き `Question[]` と親クイズメタを返す。

### 参照リンク保存フロー

```mermaid
sequenceDiagram
    autonumber
    participant Editor as Creator UI
    participant QuizSvc as QuizService
    participant Linked as linked-question.ts
    participant DB as Firestore

    Editor->>QuizSvc: saveQuiz with questions payload
    QuizSvc->>Linked: partitionReferenceAndOwned(questions)
    Linked-->>QuizSvc: referenceIds ownedToWrite
    loop each referenceId
        QuizSvc->>Linked: assertAuthorOwnsSourceQuiz(authorId, questionId)
        Linked->>DB: read questions and parent quiz
    end
    loop each owned question
        alt content unchanged reference
            Note over QuizSvc: questionIds only no question doc write
        else content modified reference
            QuizSvc->>Linked: detachCopyOnWrite(question)
            Linked->>DB: create new questions doc
        else owned new or edited
            QuizSvc->>DB: batch set question doc
        end
    end
    QuizSvc->>DB: update quizzes questionIds and denorm questions
```

**Copy-on-Write 方針（design 確定）**: エディタが参照問題の内容を変更して保存した場合のみ新規 `questions/{id}` を発行し、当該クイズの `questionIds` を差し替える。未変更の参照は既存 ID をそのまま `questionIds` に追加し、問題ドキュメントへの書き込みは行わない。クイズから参照を外しただけでは問題ドキュメントを削除しない。

### Requirements Traceability（Phase 8）

| Requirement | Summary               | Components                                    | Interfaces                          | Flows            |
| ----------- | --------------------- | --------------------------------------------- | ----------------------------------- | ---------------- |
| 13.1        | 3種 BM トグル         | `BookmarkService`                             | `toggleBookmark`                    | -                |
| 13.2        | 公開問題のみ BM 登録  | `BookmarkService`, `question-list-validation` | `assertQuestionBookmarkable`        | -                |
| 13.3        | 非公開親は BM 拒否    | 同上                                          | 同上                                | -                |
| 13.4        | 3分類一覧             | `BookmarkService`                             | `getBookmarkFeed`                   | -                |
| 13.5        | クイズ BM 公開のみ    | `BookmarkService`                             | `getBookmarkedQuizzes`              | -                |
| 13.6        | 問題 BM に親メタ      | `BookmarkService`                             | `enrichBookmarkedQuestions`         | -                |
| 13.7        | 問題 BM 通知          | `BookmarkService`, `NotificationService`      | `createNotification`                | BM 成功後        |
| 14.1        | 作成時 listType       | `QuizListService`                             | `createQuizList`                    | -                |
| 14.2        | 未設定は quiz 扱い    | `QuizListService`                             | `resolveListType`                   | -                |
| 14.3        | クイズリスト操作      | `QuizListService`                             | `addQuizToList` 等                  | -                |
| 14.4        | 問題リストメンバー    | `QuestionService`                             | `addQuestionToList`                 | -                |
| 14.5–14.6   | 公開問題のみ追加      | `question-list-validation`                    | `assertQuestionListAddable`         | -                |
| 14.7        | タイプ不一致拒否      | `question-list-validation`                    | `assertListTypeOperation`           | -                |
| 14.8        | question-list attempt | `QuizListService`, `AttemptService`           | `getQuestionsInList`, `saveAttempt` | 問題リストプレイ |
| 14.9        | タイプ別一覧          | `QuizListService`                             | `getQuizListsByAuthor`              | -                |
| 14.10       | 問題リスト export     | `QuizListService`                             | `exportQuestionList`                | -                |
| 15.1        | 自作検索              | `AuthorQuizSearchService`                     | `searchAuthorQuizzes`               | -                |
| 15.2        | 問題詳細              | `QuestionService`                             | `getQuestionsByQuiz`                | -                |
| 15.3        | 参照リンク            | `QuizService`, `linked-question`              | `saveQuiz` 参照パス                 | 参照リンク保存   |
| 15.4        | 非自作拒否            | `linked-question`                             | `assertAuthorOwnsSourceQuiz`        | -                |
| 15.5        | 重複 doc 禁止         | `QuizService`                                 | 参照パス                            | 同上             |
| 15.6        | 参照解除のみ          | `linked-question`                             | `canDeleteQuestionDoc`              | -                |

### Components（Phase 8）

| Component                  | Domain  | Intent          | Req                  | Key Dependencies                             | Contracts      |
| -------------------------- | ------- | --------------- | -------------------- | -------------------------------------------- | -------------- |
| `BookmarkService`          | Service | 分類 BM と通知  | 13.1–13.7            | Firestore P0, validation P0, Notification P1 | Service        |
| `QuizListService`          | Service | listType リスト | 14.1–14.10           | Firestore P0, validation P0                  | Service        |
| `AuthorQuizSearchService`  | Service | 自作クイズ検索  | 15.1–15.2            | QuizService P0                               | Service        |
| `linked-question`          | Lib     | 参照リンク保存  | 15.3–15.6            | Firestore read P0                            | Pure functions |
| `question-list-validation` | Lib     | 公開/タイプ検証 | 13.2–13.3, 14.5–14.7 | Firestore read P0                            | Pure functions |

#### BookmarkService（Phase 8 拡張）

| Field        | Detail                                        |
| ------------ | --------------------------------------------- |
| Intent       | 3分類ブックマーク取得と問題 BM のガード・通知 |
| Requirements | 13.1–13.7                                     |

**Contracts**: Service

```typescript
interface BookmarkFeed {
  quizzes: Quiz[];
  lists: QuizList[];
  questions: BookmarkedQuestionEntry[];
}

interface BookmarkedQuestionEntry {
  question: Question;
  parentQuizId: string;
  parentQuizTitle: string;
  bookmarkedAt: Date;
}

interface BookmarkServicePhase8 {
  getBookmarkFeed(userId: string): Promise<BookmarkFeed>;
  toggleBookmark(
    userId: string,
    targetId: string,
    targetType: 'quiz' | 'list' | 'question'
  ): Promise<boolean>;
}
```

- **13.2–13.3**: `targetType === 'question'` のとき `assertQuestionBookmarkable(questionId)` をトランザクション前に実行。
- **13.4**: 既存3 getter を内部利用し `BookmarkFeed` を組み立て。
- **13.6**: `enrichBookmarkedQuestions` が親 `quizzes` を chunk 取得し `status === 'published'` のみ残す。
- **13.7**: 新規 BM かつ `question.authorId !== userId` のとき `createNotification({ type: 'bookmark', ... })`。

#### QuizListService（Phase 8 拡張）

```typescript
type QuizListType = 'quiz' | 'question';

function resolveListType(list: QuizList): QuizListType;

interface QuizListServicePhase8 {
  createQuizList(input: CreateQuizListInput): Promise<string>;
  getQuizListsByAuthor(
    authorId: string,
    options?: { listType?: QuizListType; includeUnpublished?: boolean }
  ): Promise<QuizList[]>;
  getQuestionsInList(listId: string): Promise<QuestionInListEntry[]>;
  reorderQuestionList(listId: string, newOrder: string[]): Promise<void>;
  exportQuestionList(listId: string, authorId: string): Promise<QuestionListExportPackage>;
}

interface QuestionInListEntry {
  question: Question;
  parentQuizId: string;
  parentQuizTitle: string;
}
```

- **14.2**: `listType` 未設定は `'quiz'`。
- **14.7**: `assertListTypeOperation(list, 'quiz' | 'question')` を各 mutate 前に呼ぶ。
- **14.10**: 自作問題はフルデータ、他者問題は ID + 親クイズ参照のみ（クイズリスト export と対称）。

#### AuthorQuizSearchService

```typescript
interface SearchAuthorQuizzesParams {
  authorId: string;
  keyword?: string;
  tag?: string;
  includeDrafts?: boolean; // default true
}

interface AuthorQuizSearchService {
  searchAuthorQuizzes(params: SearchAuthorQuizzesParams): Promise<Quiz[]>;
}
```

- **実装**: `getQuizzesByAuthor(authorId, true)` で取得後、アプリ層で `keyword`（title/description 部分一致）と `tag`（`tags` 配列）をフィルタ。Firestore 全文検索は使わない（初版）。

#### linked-question（lib）

```typescript
type QuestionSavePartition = {
  referenceOnlyIds: string[];
  ownedToWrite: Question[];
  detachCopies: Question[];
};

function partitionQuestionsForSave(
  quizId: string,
  authorId: string,
  questions: Question[],
  priorQuestionIds: string[]
): Promise<QuestionSavePartition>;

function assertAuthorOwnsSourceQuiz(
  authorId: string,
  questionId: string
): Promise<void>;

function canDeleteQuestionDoc(
  questionId: string,
  excludingQuizId: string
): Promise<boolean>;
```

- **15.4**: 参照追加時、問題の `authorId` がリクエスト `authorId` と一致することを要求（自作クイズ内の問題のみリンク可）。
- **15.6**: `updateQuiz` の問題削除で `canDeleteQuestionDoc === false` なら `questions` コレクションからは削除しない。

### Data Models（Phase 8）

**`quizLists` ドキュメント追加**:

| Field      | Type                   | Default                        | Notes      |
| ---------- | ---------------------- | ------------------------------ | ---------- |
| `listType` | `'quiz' \| 'question'` | 既存 doc は読み取り時 `'quiz'` | 作成時必須 |

**`Question`（エディタ送信用、永続化は既存 doc 再利用）**:

| Field      | Type                     | Notes                                          |
| ---------- | ------------------------ | ---------------------------------------------- |
| `linkKind` | `'owned' \| 'reference'` | エディタ→保存 API のみ。Firestore 必須ではない |

**`Attempt.mode`**: `'question-list'` を追加。

**後方互換**: `listType` 未設定の既存リストは CRUD・プレイ・export すべてクイズリストとして動作。

### Migration Strategy（Phase 8）

- **データマイグレーション不要**: 読み取り時 `resolveListType` でデフォルト `'quiz'`。
- **新規作成から** `listType` を必須書き込み。
- **Rules**: `quizLists` create/update で `listType in ['quiz','question']` を推奨（未設定 create は UI から常に送信）。

---

## Error Handling

### Error Strategy
- **通信切断・ネットワーク障害**:
  - `AttemptService` の保存処理に失敗した場合、プレイヤーの進捗および最終結果を `persistent local client storage` (browser local storage) にシリアライズして退避します。
  - オンライン復帰を自動検知した際、バックグラウンドで溜まった未同期履歴を一括で Firestore に同期します。
- **NGワード自動検出・コンテンツ保留**:
  - サーバーサイドでのNGワード検証で不適切表現を検知した場合は、トランザクションを強制ロールバックし、`quizzes.status` を自動的に `'suspended'` に設定した上で、作成者への警告通知を送信します。
- **ウミガメスープ制限超過（Phase 17）**:
  - 無料ユーザーが同一クイズ30回/日または全クイズ横断150回/日のいずれかに到達した場合、API Route は `429`（`error: limit-exceeded`, `limitType: per-quiz | global-daily`）を返却する。真相提出 API は引き続き利用可能。プレイ UI は Pro プラン（`/pricing`）への誘導を表示する（`quizetika-play-flow-ui` 境界）。
- **メタデータ検証（Phase 6）**:
  - 無効ジャンル・未解決タグで `saveQuiz` が失敗した場合、`validation-error` としてフィールド `genre` / `tags` にメッセージを返す（クライアントはエディタで表示）。
- **Phase 8 — ブックマーク/リスト**:
  - 非公開親問題の BM・問題リスト追加は `QuestionNotBookmarkableError` / `QuestionNotListAddableError`（422）で拒否。
  - クイズリストへの問題追加・問題リストへのクイズ追加は `ListTypeMismatchError`（422）。
  - 非自作問題のリンクは `ReferenceLinkForbiddenError`（403）。

---

## Testing Strategy

### Unit Tests
- **リーダーボード順位**: `compareLeaderboardRecords` が正解数優先・同点タイム短い方上位を満たすこと。
- **リーダーボードマージ**: 同一ユーザーの非優位記録で差し替えないこと、優位記録で差し替えること、5件超過時に下位が落ちること。
- **`resolveLeaderboardBoard`**: prior 件数 0 → `firstPlay`、1以上 → `replay`。
- **`isLeaderboardEligibleAttempt`（Phase 18）**: `exam` / `flashcard` が `false` であること。`normal` / `review` / `list` が `true` であること。
- **タグ正規化の検証**: `normalizeTag` が全半角トリム、小文字化、記号排除を完璧に行うかを検証。
- **称号バッジ条件判定**: 累計プレイ数が条件（例：100回）を満たした際に、正確に該当バッジを配列に追加するロジックをモック検証。
- **同一質問キャッシュの検証（Phase 17）**: `normalizeQuestionText` により表記ゆれ一致時に AI を呼び出さず、クイズ別・横断・`aiTurnCount` いずれも増加しないこと。
- **真相判定プロンプト（Phase 14）**: `buildVerifyTruthPrompt` が裏設定・`truthKeywords`・プレイヤー要約を含み、エッセンス意味判定の指示を含むこと。
- **真相判定不合格正規化（Phase 16）**: `parseTruthVerifyResponse` が AI 生出力を固定2文言に正規化すること。
- **必須キーワード検証ロジック（テストプレイ用）**: `verifyKeywords` / `checkTruthKeywordsLocally` が全半角正規化を行い部分一致判定できること（本番 `verify-truth` ルートからは呼び出さない）。
- **会話履歴マッピング検証**: 履歴から直近20回の Q&A ペアが正しく Gemini SDK の `Content[]` 型にマッピングされることを単体テスト。
- **canonical 解決**: `resolveCanonicalGenreId` が `canonicalId` チェーンを辿ること、循環で reject すること。
- **in チャンク**: `chunkIdsForInQuery` が 10 件上限で分割すること。
- **C2 union**: canonical のみ・legacy のみ・重複ありの3ケースで dedupe 後件数が期待通り。
- **resolveListType**: 未設定リストが `quiz`、明示 `question` がそのまま返ること。
- **partitionQuestionsForSave**: 参照 ID のみのとき `ownedToWrite` が空であること。
- **canDeleteQuestionDoc**: 他クイズが `questionIds` に含むとき `false`。

### Integration Tests
- **初回プレイLB**: 1回目の `saveAttempt`（`mode: normal`）が `leaderboardFirstPlay` のみ更新し `leaderboardReplay` を変更しないこと。
- **リプレイLB**: 2回目の `saveAttempt`（`mode: normal`）が `leaderboardReplay` のみ更新し、初回LB上の当該ユーザー行を変更しないこと。
- **exam/flashcard 非登録（Phase 18）**: `mode: exam` または `flashcard` の `saveAttempt` 後、両 LB 配列が更新されないこと（`playCount` は増加）。
- **exam 先 → 通常は replay のみ（Phase 18）**: 同一 user+quiz で exam 完了後に normal 完了すると、`leaderboardReplay` のみ更新され `leaderboardFirstPlay` は空のままであること。
- **normal 先 → exam → normal**: 初回 normal で firstPlay 登録後、exam は LB 不変、3回目 normal は replay のみ更新すること。
- **本人プレイ履歴API**: 有効トークンで 200、他ユーザー指定相当の不正アクセスで 403、test-play 除外を検証。
- **退会時非同期クレンジング**: API Routeに退会リクエストを送信し、Auth物理削除完了とCloud Tasksへのジョブ登録、およびFirestore匿名化が整合性高く動作することを検証。
- **ウミガメスープ AI 意味的真相判定（Phase 14）**:
  - 真相提出時に常に Gemini API を呼び出し、キーワード文言が要約に無くてもエッセンスが捉えられていれば合格となること（モック AI）。
  - キーワードが要約に全て含まれていても、AI が不合格と判定した場合は不合格となること（文字列バイパス廃止の確認）。
  - AI 失敗時に 503 を返し、文字列一致による代替合格を行わないこと。
- **ウミガメスーププレイ UX（Phase 16/17）**:
  - 不合格時 `advice` が「必須要素が足りていません。」または「提出された内容は真相と異なります。」のいずれかのみであること。
  - 諦め API が `revealText` を返さず `completed: true` のみ返し attempt を `score: 0` で完了すること（Phase 17）。
  - 合格・諦め時にクライアント送信 `elapsedSeconds` が attempt に保存されること。
  - `limit-exceeded` が `limitType` を区別し、30回目（per-quiz）と150回目（global）で正しい型を返すこと。
- **saveQuiz canonical**: 下書き保存後 `canonicalGenreId` / `canonicalTagIds` が非空であること。
- **getQuizzesByGenre**: マージ済み旧ジャンル `genre` のクイズが canonical クエリまたは fallback で返ること。
- **voteGenreRequest**: 可決後 `listActiveGenres` に新ジャンルが含まれること。
- **getFailedQuestions**: マージ子ジャンルの誤答が親ジャンルフィルタに含まれること。
- **ユーザーBAN/UNBAN機能の検証**:
  - `banUser` が `isBanned: true`, 理由, 日時を設定し、`adminLogs` に `action: 'ban'` を記録すること。
  - `unbanUser` が BAN解除時に `isBanned: false` を設定し、`bannedReason` / `bannedAt` フィールドを削除し、`adminLogs` に `action: 'unban'` を記録すること。
  - 管理者以外の権限（モデレータ等）によるBAN/UNBAN API呼び出しが `403 Forbidden` / `権限エラー` で拒否されること。
  - `firestore.rules` の `isNotBanned()` チェックにより、`isBanned: true` のユーザーからの全書込が Firestore 上で拒否されること。
- **Phase 8 — ブックマーク分類**: `getBookmarkFeed` が3分類を返し、非公開親の問題が questions から除外されること。
- **Phase 8 — listType**: 問題リストに公開問題追加成功、下書き親問題は拒否、クイズリストへの問題追加は拒否。
- **Phase 8 — 参照リンク**: 同一 `questionId` を2クイズが参照しても `questions` ドキュメントが1つのまま。参照解除後も他クイズ参照時は doc 残存。
- **Phase 8 — searchAuthorQuizzes**: タグ・キーワードで自作下書きがヒットすること。
- **Phase 9 — 統合検索（ユニバーサル検索）**:
  - キーワード「作者名」「タグ名」「ジャンル名」「タイトルの一部」を入力して `searchQuizzes` を呼び出した際に、対象のクイズが漏れなく返ってくること。
  - 複数ソースから取得されたクイズがIDで適切に重複排除（dedupe）されていること。
  - 部分一致フィルタによって大文字小文字に関わらずキーワードがマッチすること。
- **Phase 10 — タグマスタとタグ AND 検索**:
  - `listActiveTags` が `canonicalId != null` のマージ済みタグを含まないこと。
  - `searchQuizzes('', { tags: ['a','b'] })` がタグ a と b の両方を持つクイズのみ返すこと（legacy `tags` のみのクイズも canonical 解決で一致すれば含む）。
  - `searchQuizzes('keyword', { tags: ['x'] })` がキーワード部分一致 **かつ** タグ x を満たすクイズのみ返すこと。
  - `filters.tags` に重複指定しても結果が単一タグ指定と一致すること。
- **Phase 11 — 出題形式フィルタ**:
  - `searchQuizzes('', { format: 'multiple-choice' })` が選択式クイズのみ返すこと（`format` フィールドあり／問題推定の両方）。
  - `searchQuizzes('', { genreId: 'science', format: 'lateral-thinking' })` が当該ジャンル内のウミガメ形式のみ返すこと（他ジャンル混入なし）。
  - `searchQuizzes('keyword', { tags: ['js'], format: 'mixed' })` がキーワード・タグ・形式の AND を満たすこと。
  - `format` 未指定時、Phase 10 regression が維持されること。
- **Phase 13 — Stripe サブスクリプション**:
  - Checkout API: free ユーザーが `sessionUrl` を取得、active pro が 409 を返すこと。
  - Portal API: active pro が `sessionUrl`、free が 404 を返すこと。
  - Webhook: `customer.subscription.updated` で `subscriptionTier` / `isPremium` が同期されること。同一 `eventId` 二重送信で二重更新されないこと。
  - ask-ai: active pro ユーザーが31回目（per-quiz）・151回目（global）も 429 にならないこと。free ユーザーは per-quiz 30回目または global 150回目で 429 + `limitType`。
  - Rules: クライアント SDK から `subscriptionTier` 変更が拒否されること。

### Unit Tests（Phase 10）
- **`quiz-tag-match`**: `canonicalTagIds` のみ一致、legacy `tags` のみ一致、マージ旧タグ文字列一致、不一致。
- **`listActiveTags`**: 空コレクション、ソート安定、`canonicalId` フィルタ。

### Unit Tests（Phase 11）
- **`quiz-format-match`**: `format` フィールド一致、問題 type からの推定一致、不一致、`applyFormatFilter` の未指定パススルー。
- **レガシーフィクスチャ**: `{ format: undefined, questions: [] }` は `mixed` フィルタのみ一致、`multiple-choice` 等では不一致。

### E2E / UI Tests
- **解答中断と自動復旧**: プレイ中にブラウザを強制リロードし、`localStorage` から解答進捗が100%正しく復元され、プレイが継続できるかをシミュレート。

---

## Security Considerations
- **Firestore Security Rules**:
  - ユーザーの `badges`, `reputationScore`, `totalPlayCount` などの重要パラメータは、クライアントからの更新（`update`）を Security Rules で完全に拒否し、サーバーサイド（Cloud Functions）およびトランザクションのみで更新を許可。
  - `deleteStatus == 'delete_pending'` である間、第三者からの読み取りをSecurity Rulesで拒否。
  - **BANユーザーの書き込み拒否 (isNotBanned)**: 
    - `isNotBanned()` ヘルパーを定義し、書き込みアクションを実行する全ルール（`create`, `update`, `delete`）に `&& isNotBanned()` を追加。
    - `isNotBanned()` は、`/users/$(request.auth.uid)` ドキュメントの `isBanned` フィールドが `true` でないことを検証する。これにより、不正アカウントによるデータ改ざんを完全に防ぐ。
  - **Phase 6**: `metadata_tags` / `metadata_genres` は read 全公開。create は認証ユーザー（タグは `canonicalId==null` 初期化）。update は `canonicalId` セットまたは `merged*Ids` の `hasAll` 拡張のみ（`detailed_design.md` §6.5）。`mergeRequests` / `genreRequests` はモデレータ権限で create/update を制限（`isModeratorOrAbove()`）。
  - **Phase 8**: `quizLists` の update は `authorId == request.auth.uid` を維持。`listType` 変更は create 後固定（update でのタイプ変更は拒否可）。問題リストへの追加はサーバー/クライアント双方で公開検証（Rules 単独では親クイズ状態まで検証困難なためサービス層が正本）。
  - **Phase 13 — 課金フィールド保護**: `users` の `subscriptionTier`, `isPremium`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd` は owner の create/update で変更不可。書き込みは Admin SDK（Webhook / billing API）のみ。`stripe_processed_events` はクライアントアクセス不可。
- **APIキーの秘匿**:
  - Stripe Secret Key / Webhook Secret はサーバー環境変数のみ。`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` のみクライアント露出可。
  - Google Gemini API キーなどの認証情報はNext.jsのサーバー環境変数としてのみ管理し、クライアントへは一切露出させません。

---

## Performance & Scalability
- **N+1問題の完全排除 (非正規化)**:
  - クイズ一覧表示時にユーザーのアバターや名前を都度フェッチするのを防ぐため、`quizzes` ドキュメント内に `authorName`, `authorAvatar` を非正規化して非同期冗長保持します。
- **Firestore `in` クエリ制限 (10件) の回避**:
  - ジャンルマージ展開・ブックマーク展開では `in` を最大10 ID ごとにチャンクし、並行フェッチ後にアプリ側で dedupe する。
- **canonical 単一クエリ優先（Phase 6）**:
  - バックフィル済みクイズは `canonicalGenreId ==` の単一インデックスクエリのみで済み、マージ展開 `in` の回数を削減する。

---

## Phase 13: Stripe サブスクリプション（Pro プラン）

### Overview（本フェーズ）
ログインユーザーが Pro プランを Stripe Checkout で購読し、Webhook 同期後に水平思考 AI 質問の二層日次制限（無料：30/クイズ・150/日横断）が解除されるエンドツーエンド基盤をコア層に実装する。Free は暗黙デフォルト（`free` tier）。初版販売は Pro のみ。`premium` はスキーマ予約。

### Goals（Phase 13）
- Checkout / Portal / Webhook による信頼できる契約状態の単一正本（Firestore `users`、Admin SDK 書き込み）。
- `subscriptionTier` ベースのエンタイトルメント解決を `ask-ai` に集約適用。
- 課金フィールドのクライアント改ざんを Rules で物理遮断。
- `subscription-plans` マスタにより Premium 追加時の差分を最小化。

### Non-Goals（Phase 13）
- `/pricing` UI、プレイ画面誘導 UI、Stripe Elements によるアプリ内決済。
- Premium 販売、§2.5 の他 Pro 特典、管理者手動 tier 付与。

### Architecture Pattern（Phase 13）

```mermaid
sequenceDiagram
    participant UI as Billing_UI
    participant CheckoutAPI as CheckoutSessionAPI
    participant PortalAPI as PortalSessionAPI
    participant Stripe as Stripe
    participant Webhook as StripeWebhookAPI
    participant Ent as EntitlementService
    participant FS as Firestore_Admin
    participant AskAI as AskAiQuestionAPI

    UI->>CheckoutAPI: POST checkout-session Bearer
    CheckoutAPI->>Ent: resolve tier free only
    CheckoutAPI->>Stripe: checkout.sessions.create
    Stripe-->>UI: redirect Checkout
    Stripe->>Webhook: subscription events
    Webhook->>Ent: map price to tier
    Ent->>FS: update users billing fields
    UI->>PortalAPI: POST portal-session Bearer
    PortalAPI->>Stripe: billingPortal.sessions.create
    AskAI->>Ent: hasUnlimitedAiQuestions uid
    Ent->>FS: read users latest
```

**選択パターン**: Server-authoritative entitlements + Stripe-hosted Checkout/Portal。クライアントはセッション URL のみ受け取り、契約状態は Webhook が正本。

### Technology Stack（Phase 13 追加分）

| Layer   | Choice / Version    | Role in Feature                  | Notes                                                         |
| ------- | ------------------- | -------------------------------- | ------------------------------------------------------------- |
| Backend | `stripe` ^22.2.0    | Checkout / Portal / Webhook 検証 | `new Stripe(secretKey)`、async/await のみ                     |
| Data    | Firestore Admin SDK | 課金フィールド書き込み           | 既存 `getAdminFirestore()` を再利用                           |
| Config  | 環境変数            | Price ID マッピング              | `STRIPE_PRICE_CREATOR_MONTHLY`, `STRIPE_PRICE_CREATOR_YEARLY` |

Stripe ベストプラクティスに従い、Checkout Sessions API を使用する。`payment_method_types` は指定しない（dynamic payment methods 有効）。

### File Structure Plan（Phase 13）

#### Directory Structure
```
src/
├── lib/
│   ├── subscription-plans.ts       # paid tier 定義・Price ID マッピング
│   └── stripe/
│       └── server.ts               # Stripe シングルトンクライアント
├── services/
│   ├── subscription.ts             # Checkout/Portal 作成、Customer 解決
│   └── entitlement.ts              # resolveUserEntitlements, tier 判定
├── types/
│   └── subscription.ts             # SubscriptionTier, SubscriptionStatus 等
└── app/api/
    ├── billing/
    │   ├── checkout-session/route.ts
    │   └── portal-session/route.ts
    └── webhooks/
        └── stripe/route.ts           # raw body 署名検証・冪等処理
```

#### Modified Files
- `src/types/index.ts` — `User` に課金フィールド追加
- `src/context/auth-context.tsx` — 読み取り時 `subscriptionTier` デフォルト `free`
- `src/app/api/attempt/ask-ai/route.ts` — `resolveUserEntitlements` 利用
- `firestore.rules` — 課金フィールドの owner 書き込み禁止
- `docs/db_design.md` / `docs/api_specification.md` — 同期（direct impl 候補）

### Requirements Traceability（Phase 13）

| Requirement | Summary                      | Components                                  | Interfaces                           | Flows          |
| ----------- | ---------------------------- | ------------------------------------------- | ------------------------------------ | -------------- |
| 4.6–4.7     | 無料 tier 二層制限（30/150） | `ask-ai-utils`, `AskAiQuestionAPI`          | `/api/attempt/ask-ai`                | AI 質問フロー  |
| 4.8         | Pro 以上は制限なし           | `EntitlementService`                        | `/api/attempt/ask-ai`                | AI 質問フロー  |
| 4.9         | サーバー側契約参照           | `AskAiQuestionAPI`                          | `/api/attempt/ask-ai`                | AI 質問フロー  |
| 19.1–19.4   | tier モデル・状態解釈        | `EntitlementService`, `User` 型             | —                                    | —              |
| 19.5–19.8   | Checkout 購読開始            | `CheckoutSessionAPI`, `SubscriptionService` | `POST /api/billing/checkout-session` | 購読フロー     |
| 19.9–19.12  | Webhook 同期・冪等           | `StripeWebhookAPI`, `EntitlementService`    | `POST /api/webhooks/stripe`          | Webhook フロー |
| 19.13–19.14 | Customer Portal              | `PortalSessionAPI`, `SubscriptionService`   | `POST /api/billing/portal-session`   | 契約管理フロー |
| 19.15–19.17 | エンタイトルメント適用       | `EntitlementService`, `AskAiQuestionAPI`    | `/api/attempt/ask-ai`                | AI 質問フロー  |
| 19.18–19.19 | 改ざん防止                   | `firestore.rules`, Admin SDK のみ書込       | Rules                                | —              |
| 19.20–19.23 | 境界（UI 外）                | —                                           | —                                    | —              |

### Components and Interfaces（Phase 13）

| Component               | Domain/Layer      | Intent                                | Req Coverage                    | Key Dependencies                         | Contracts  |
| ----------------------- | ----------------- | ------------------------------------- | ------------------------------- | ---------------------------------------- | ---------- |
| `subscription-plans.ts` | lib               | paid tier・Price マッピングの単一正本 | 19.2, 19.3                      | env Price IDs (P0)                       | State      |
| `EntitlementService`    | service           | tier 解釈・AI 無制限判定              | 4.2–4.4, 19.1–19.4, 19.15–19.17 | Firestore Admin (P0)                     | Service    |
| `SubscriptionService`   | service           | Stripe Customer / Session 作成        | 19.5–19.8, 19.13–19.14          | Stripe API (P0), EntitlementService (P0) | Service    |
| `CheckoutSessionAPI`    | API Route         | 購読開始セッション発行                | 19.5–19.8                       | SubscriptionService (P0)                 | API        |
| `PortalSessionAPI`      | API Route         | 契約管理セッション発行                | 19.13–19.14                     | SubscriptionService (P0)                 | API        |
| `StripeWebhookAPI`      | API Route         | 契約イベント同期                      | 19.9–19.12                      | Stripe, EntitlementService (P0)          | API, Event |
| `AskAiQuestionAPI`      | API Route（改修） | tier ベース制限                       | 4.2–4.4, 19.15–19.17            | EntitlementService (P0)                  | API        |

#### EntitlementService

| Field        | Detail                                                         |
| ------------ | -------------------------------------------------------------- |
| Intent       | ユーザーの契約状態を単一規則で解釈し、機能ゲート判定を提供する |
| Requirements | 4.2, 4.3, 4.4, 19.1–19.4, 19.15–19.17, 19.18, 19.19            |

**Service Interface**
```typescript
type SubscriptionTier = 'free' | 'pro' | 'premium';
type SubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled'
  | 'incomplete' | 'unpaid' | 'paused';

interface UserEntitlements {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  hasPaidEntitlements: boolean;
  hasUnlimitedAiQuestions: boolean;
}

interface EntitlementService {
  resolveUserEntitlements(uid: string): Promise<UserEntitlements>;
  applySubscriptionFromStripe(input: StripeSubscriptionSnapshot): Promise<void>;
}
```

- **hasPaidEntitlements**: `subscriptionTier` が `pro` または `premium` かつ `subscriptionStatus` が `active` または `trialing`。
- **hasUnlimitedAiQuestions**: `hasPaidEntitlements` または `moderationTier` が `moderator` / `senior_moderator`。
- **isPremium 導出**: `hasPaidEntitlements` と同値で Webhook 更新時に `users.isPremium` も同期書き込み（`ask-ai` 後方互換）。
- **未設定フィールド**: `subscriptionTier` 未設定は `free` として解釈。

#### SubscriptionService

**Service Interface**
```typescript
interface CreateCheckoutSessionInput {
  uid: string;
  email: string;
  priceInterval: 'monthly' | 'yearly';
}

interface CreateCheckoutSessionResult {
  sessionUrl: string;
}

interface CreatePortalSessionInput {
  uid: string;
}

interface SubscriptionService {
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
  createPortalSession(input: CreatePortalSessionInput): Promise<{ sessionUrl: string }>;
  getOrCreateStripeCustomer(uid: string, email: string): Promise<string>;
}
```

**Checkout 契約**:
- `mode: 'subscription'`
- `client_reference_id`: Firebase `uid`
- `customer`: 既存 `stripeCustomerId` または新規作成（`metadata.firebaseUid`）
- `line_items`: `[{ price: envPriceId, quantity: 1 }]`
- `success_url`: `{APP_URL}/pricing?checkout=success`
- `cancel_url`: `{APP_URL}/pricing?checkout=canceled`
- `payment_method_types` は省略（dynamic payment methods）

**重複購読拒否（19.7）**: `resolveUserEntitlements` で `hasPaidEntitlements === true` のとき `409 already-subscribed`。

#### CheckoutSessionAPI / PortalSessionAPI

| Method | Endpoint                        | Request                                             | Response                 | Errors        |
| ------ | ------------------------------- | --------------------------------------------------- | ------------------------ | ------------- |
| POST   | `/api/billing/checkout-session` | `{ priceInterval: 'monthly' \| 'yearly' }` + Bearer | `{ sessionUrl: string }` | 401, 409, 500 |
| POST   | `/api/billing/portal-session`   | Bearer のみ                                         | `{ sessionUrl: string }` | 401, 404, 500 |

認証パターンは `ban/route.ts` と同一（`extractBearerToken` → `verifyFirebaseIdToken`）。BAN ユーザーは `403`。

#### StripeWebhookAPI

| Field        | Detail                                       |
| ------------ | -------------------------------------------- |
| Intent       | Stripe 契約イベントを冪等に Firestore へ反映 |
| Requirements | 19.9–19.12                                   |

**Runtime**: `nodejs`（Edge 不可）。**Body**: `await request.text()` で raw body を `stripe.webhooks.constructEvent` に渡す。

**処理対象イベント**:
- `checkout.session.completed` — `client_reference_id` から uid、`subscription` ID を取得
- `customer.subscription.created` / `updated` / `deleted`
- `invoice.payment_failed` — `past_due` 反映（grace: 期間終了まで `active` 維持は Stripe デフォルトに従う）

**冪等性**: `stripe_processed_events/{eventId}` に Admin SDK で存在確認後処理。重複は `200` で即返却。

**Price → tier マッピング**: `subscription-plans.ts` の `priceIdToTier` で解決。初版は Pro Price のみ → `pro`。未知 Price はログ警告し更新スキップ。

### Data Models（Phase 13）

#### `users` 追記フィールド

| Field                  | Type                           | Writer          | Notes                        |
| ---------------------- | ------------------------------ | --------------- | ---------------------------- |
| `subscriptionTier`     | `'free' \| 'pro' \| 'premium'` | Webhook / Admin | デフォルト `free`            |
| `stripeCustomerId`     | `string?`                      | Webhook / Admin |                              |
| `stripeSubscriptionId` | `string?`                      | Webhook / Admin |                              |
| `subscriptionStatus`   | `SubscriptionStatus?`          | Webhook / Admin |                              |
| `currentPeriodEnd`     | `Timestamp?`                   | Webhook / Admin |                              |
| `isPremium`            | `boolean?`                     | Webhook / Admin | `hasPaidEntitlements` と同期 |

#### `stripe_processed_events`（新規）

| Field         | Type        | Notes                                |
| ------------- | ----------- | ------------------------------------ |
| `eventId`     | `string`    | Stripe `event.id`（ドキュメント ID） |
| `type`        | `string`    | イベント種別                         |
| `processedAt` | `Timestamp` |                                      |

Rules: クライアント read/write 禁止（マッチなし → deny）。

#### subscription-plans マスタ

```typescript
interface PaidTierDefinition {
  tier: 'pro' | 'premium';
  displayName: string;
  priceIds: { monthly: string; yearly: string };
  featureKeys: readonly ('unlimited_ai_questions')[];
}

export const PAID_TIER_DEFINITIONS: readonly PaidTierDefinition[];
export function priceIdToTier(priceId: string): SubscriptionTier | null;
export function hasFeature(tier: SubscriptionTier, feature: string): boolean;
```

初版 `PAID_TIER_DEFINITIONS` は Pro のみ。Premium 追加時は定義配列に1エントリ追加。

### Error Handling（Phase 13）

| Category         | Response                     | Behavior                                      |
| ---------------- | ---------------------------- | --------------------------------------------- |
| 401              | 未認証 Checkout/Portal       | ログイン要求メッセージ                        |
| 409              | 既存有料契約で Checkout      | `already-subscribed`、Portal 導線ヒント       |
| 404              | Portal で customer 未存在    | `no-subscription`                             |
| 400              | 無効 `priceInterval`         | バリデーションエラー                          |
| 429              | ask-ai 制限（Phase 17 二層） | `limit-exceeded` + `limitType` + Pro 誘導文言 |
| Webhook 署名失敗 | 400                          | 状態更新なし、ログ記録                        |

### Security Considerations（Phase 13）

**Firestore Rules（`users/{userId}` 更新）** — owner 更新時に以下を不変条件として追加:
- `subscriptionTier`, `isPremium`, `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `currentPeriodEnd`

**create 時**: 上記フィールドが未設定、または `subscriptionTier == 'free'` かつ `isPremium == false` のみ許可。

**Webhook ルート**: Bearer 認証なし。Stripe 署名のみ。ミドルウェアは `/api` を除外済み。

### Testing Strategy（Phase 13）

**Unit Tests**
- `priceIdToTier` — Pro monthly/yearly 解決、未知 ID → null
- `resolveUserEntitlements` — free / active pro / canceled pro / moderator 免除
- `hasFeature` — pro のみ `unlimited_ai_questions`

**Integration Tests**
- Checkout API: 有効トークン + free user → `sessionUrl`、既存 pro → 409
- Portal API: pro user → `sessionUrl`、free user → 404
- Webhook: 署名付き `customer.subscription.updated` モック → `users.subscriptionTier` 更新
- Webhook 冪等: 同一 `eventId` 二重 POST → 単一更新
- ask-ai: pro ユーザーで 21 回目も 200（カウンタ更新あり、429 なし）

**E2E（Stripe テストモード）**
- `/pricing` から Checkout 開始 URL 取得（UI スペックと連携）

### Migration Strategy（Phase 13）

1. Rules 更新（課金フィールド保護）を先にデプロイ。
2. 型・`EntitlementService` 追加（既存 `isPremium` 読み取り互換）。
3. Webhook エンドポイントを Stripe Dashboard に登録。
4. Checkout / Portal API 有効化。
5. `ask-ai` を `EntitlementService` に切替。

既存 `isPremium: true` 手動設定ユーザーは Webhook 同期まで維持。長期は tier 正本へ移行。

---

## Phase 14: ウミガメのスープ真相判定 — AI 意味判定への改定（2026-06-08）

### Design Decision

| 項目             | 旧（B2 ハイブリッド）                       | 新（Phase 14）            |
| ---------------- | ------------------------------------------- | ------------------------- |
| 合格経路         | `verifyKeywords` 全一致 → AI バイパス即合格 | 常に AI 意味判定          |
| キーワードの役割 | 文字列部分一致のゲート                      | AI へのエッセンス参照材料 |
| AI 失敗時        | キーワード全一致なら合格可能                | 503 返却、代替合格なし    |
| テストプレイ     | ローカル部分一致（変更なし）                | 同左（Out of boundary）   |

**採用理由**: 作問者が登録する `truthKeywords` は「到達すべき核心のヒント」であり、プレイヤーの自然な表現（同義語・言い換え）を文字列一致で弾くと誤不合格が発生する。裏設定とキーワードを併せて AI に渡すことで、意図を保ちつつ表現揺れを許容できる。

**却下した代替案**:
- キーワード全一致時のみバイパス維持 — 要件 4.8「文字列完全一致を合格条件としない」と矛盾。
- クライアント側判定 — セキュリティ・一貫性のためサーバー API のみが正本。

### Architecture Integration

- **変更範囲は VerifyTruthAPI 境界に閉じる**: `verify-truth-utils.ts`（プロンプト）+ `verify-truth/route.ts`（分岐削除）+ 単体テスト。
- **API レスポンス形状は不変**: `{ isCorrect: boolean, advice: string | null }`（`isBypass` は docs のみの記述で実装に存在しない）。
- **LB 更新・認証・履歴追加ロジックは不変**: 合格時トランザクション、不合格時 `aiTruthAttempts` 追加は現行のまま。

### `buildVerifyTruthPrompt` 契約（改修）

```typescript
/**
 * 真相判定プロンプトを構築する（Phase 14: truthKeywords をエッセンス参照に含める）
 */
export function buildVerifyTruthPrompt(
  aiContextDetails: string,
  playerTruth: string,
  truthKeywords: string[]
): string;
```

**プロンプトに追加するセクション（要旨）**:
- `【必須エッセンス（作問者が指定した核心的要素）】` — `truthKeywords` を箇条書き
- 判定基準追記: エッセンスの**意味**がプレイヤー要約に反映されていれば合格可。キーワードの文言そのものの出現は不要。ただし裏設定の核心的因果関係との整合は必須。
- 既存のセキュリティ防衛ルール（プロンプトインジェクション無視）は維持。

### File Structure Plan（Phase 14）

#### Modified Files
| ファイル                                    | 責務                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/verify-truth-utils.ts`        | `buildVerifyTruthPrompt` シグネチャ拡張、エッセンスセクション追加。`verifyKeywords` は export 維持（テストプレイ／単体テスト用） |
| `src/app/api/attempt/verify-truth/route.ts` | `verifyKeywords` 分岐削除。`buildVerifyTruthPrompt(..., truthKeywords)` を常時呼び出し                                           |
| `tests/services/verify-truth-utils.test.ts` | プロンプトにキーワード・エッセンス指示が含まれるテスト追加。`buildVerifyTruthPrompt` 呼び出しを3引数に更新                       |

#### Out of Scope（変更しない）
| ファイル                                             | 理由                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `src/lib/test-play.ts` (`checkTruthKeywordsLocally`) | 要件・境界でテストプレイは現状維持                              |
| `src/app/quiz/test-play/play/test-play-client.tsx`   | 同上                                                            |
| `src/app/quiz/[id]/play/quiz-play-client.tsx`        | Phase 14 時点では API 契約不変。Phase 16 でプレイ UX を改修済み |
| `src/types/index.ts`                                 | `truthKeywords` 型は既存のまま                                  |

#### Direct Implementation Candidate
- `docs-sync-truth-verify` — `docs/api_specification.md`, `docs/detailed_design.md`, `docs/requirements_definition.md` の B2 ハイブリッド記述を Phase 14 に同期

### Requirements Traceability（Phase 14）

| Requirement | Summary                       | Components                             | Interfaces                                            | Flows          |
| ----------- | ----------------------------- | -------------------------------------- | ----------------------------------------------------- | -------------- |
| 4.7         | 3要素を AI に渡す意味判定     | `VerifyTruthAPI`, `verify-truth-utils` | `buildVerifyTruthPrompt`, `/api/attempt/verify-truth` | 真相判定フロー |
| 4.8         | 文字列一致を合格条件としない  | `verify-truth-utils`                   | `buildVerifyTruthPrompt`                              | 真相判定フロー |
| 4.9         | キーワードをエッセンス参照に  | `verify-truth-utils`                   | `buildVerifyTruthPrompt`                              | 真相判定フロー |
| 4.10        | AI 失敗時再試行・代替合格なし | `VerifyTruthAPI`                       | `/api/attempt/verify-truth`                           | 真相判定フロー |
| 4.11–4.12   | 合格/不合格後処理             | `VerifyTruthAPI`                       | `/api/attempt/verify-truth`                           | 真相判定フロー |

### Testing Strategy（Phase 14）

**Unit**
- `buildVerifyTruthPrompt('裏', '要約', ['キーワードA'])` が裏設定・要約・キーワード・エッセンス判定指示を含む。
- `truthKeywords` が空配列でもプロンプトが生成され、AI 判定可能（公開時は最低1件必須だが実行時フォールバックは `[]` 許容）。

**Integration（モック Gemini）**
- ルートが `verifyKeywords` を呼ばず常に `generateContent` を呼ぶ。
- モック CORRECT → LB 更新・`completedAt` 設定。
- モック INCORRECT → `advice` 返却、attempt 未完了。
- Gemini 例外 → 503 `ai-error`。

### Risks & Mitigations

| Risk                                         | Mitigation                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 毎回 AI 呼び出しでコスト・レイテンシ増       | 要件上のトレードオフとして受容。質問キャッシュ（4.5）とは独立                            |
| AI の過寛容判定                              | エッセンス＋裏設定の両方参照をプロンプトで明示。作問者は `aiContextDetails` で詳細を保持 |
| 回帰: キーワード全一致で即合格していたプレイ | 意図的な仕様変更。E2E で意味判定ケースを追加検討                                         |

---

## Phase 16: 水平思考プレイ UX 改修（2026-06）

### Design Decision

| 項目                 | 方針                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| 真相入力             | 右カラムの独立フォームを廃止し、チャット下部で「質問する」／「回答する」を切替            |
| 諦め                 | 専用 API で解説のみ返却（`explanation` 優先）。裏設定は諦め確定後にのみサーバー経由で開示 |
| 不合格フィードバック | AI 生出力をそのまま表示せず、`REASON: MISSING_ESSENCE` / `UNRELATED` を固定2文言に正規化  |
| 経過時間             | クライアントで1秒刻みカウント。チャットヘッダーのみ表示。完了時に API へ送信して永続化    |
| 入力ロック           | 合格・諦め（および諦め処理中）で質問・真相・モード切替を無効化。送信ボタンはグレーアウト  |
| ルール説明           | 右パネルにプレイヤー向け要点のみ（システム内部のキャッシュ・判定詳細は記載しない）        |

### `parseTruthVerifyResponse` 契約（Phase 16 追記）

不合格時の `advice` は常に次のいずれか:

- `TRUTH_FAILURE_MISSING_ESSENCE` → 「必須要素が足りていません。」
- `TRUTH_FAILURE_UNRELATED` → 「提出された内容は真相と異なります。」

プロンプトは AI に `REASON: MISSING_ESSENCE` / `REASON: UNRELATED` のみ出力させ、3行目以降のヒント出力を禁止する。

### `getLateralRevealText` 契約

```typescript
export function getLateralRevealText(question: Question): string;
```

優先順: `question.explanation`（trim 後非空）→ `question.aiContextDetails` → フォールバック文言。

### File Structure Plan（Phase 16）

#### New Files
| ファイル                                       | 責務                                        |
| ---------------------------------------------- | ------------------------------------------- |
| `src/app/api/attempt/give-up-lateral/route.ts` | 諦め・不合格完了・解説返却                  |
| `src/services/lateral-give-up-utils.ts`        | 解説テキスト解決                            |
| `src/hooks/useElapsedSeconds.ts`               | 経過秒数フック                              |
| `src/lib/format-play-elapsed.ts`               | 表示フォーマット・`normalizeElapsedSeconds` |
| `tests/api/give-up-lateral.test.ts`            | 諦め API テスト                             |
| `tests/services/lateral-give-up-utils.test.ts` | 解説テキスト単体テスト                      |
| `tests/lib/format-play-elapsed.test.ts`        | フォーマット単体テスト                      |

#### Modified Files
| ファイル                                      | 責務                                     |
| --------------------------------------------- | ---------------------------------------- |
| `src/services/verify-truth-utils.ts`          | 不合格 REASON 指示、固定メッセージ正規化 |
| `src/app/api/attempt/verify-truth/route.ts`   | Admin SDK、`elapsedSeconds` 保存         |
| `src/app/quiz/[id]/play/quiz-play-client.tsx` | 統合入力 UI、諦め、経過時間、ルール説明  |
| `src/app/quiz/[id]/play/play.module.css`      | スタイル                                 |

### Requirements Traceability（Phase 16）

| Requirement | Summary                           | Components                                  | Interfaces                       |
| ----------- | --------------------------------- | ------------------------------------------- | -------------------------------- |
| 4.6         | 2カラム（チャット＋ルール／解説） | `quiz-play-client`                          | lateral レイアウト               |
| 4.12        | 不合格は固定2種メッセージ         | `verify-truth-utils`                        | `parseTruthVerifyResponse`       |
| 4.13        | 質問／回答切替                    | `quiz-play-client`                          | チャット入力欄                   |
| 4.14        | 経過時間表示                      | `useElapsedSeconds`, `format-play-elapsed`  | チャットヘッダー                 |
| 4.15        | 諦め・解説開示                    | `GiveUpLateralAPI`, `lateral-give-up-utils` | `/api/attempt/give-up-lateral`   |
| 4.16        | 入力ロック・グレーアウト          | `quiz-play-client`                          | `lateralInputLocked`             |
| 4.17        | 経過秒数永続化                    | verify-truth, give-up-lateral               | `elapsedSeconds` body            |
| 4.18        | プレイヤー向けルール説明          | `quiz-play-client`                          | 右パネル                         |
| 4.19        | Admin SDK + 本人確認              | API Routes                                  | Bearer + `verifyFirebaseIdToken` |

### Testing Strategy（Phase 16）

**Unit**: `getLateralRevealText` の優先順、`formatPlayElapsedSeconds` / `normalizeElapsedSeconds`、`parseTruthVerifyResponse` の REASON 正規化。

**Integration**: `give-up-lateral` の認証・409（完了済み）・`revealText` 返却。`verify-truth` の不合格 `advice` 固定文言。

---

## Phase 17: ウミガメ認証・二層制限・諦めフロー改定（2026-06-08）

### Design Decision

| 項目             | 方針                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 正本モジュール   | **Option C（Hybrid）**: 制限定数・正規化・キャッシュ検索を `ask-ai-utils.ts` に集約。API はオーケストレーション、UI は play-flow / billing 境界                            |
| 二層制限         | 無料: 同一クイズ **30回/日**（`dailyAiTurnCounts/{quizId}`）+ 全クイズ横断 **150回/日**（`dailyAiTurnCounts/_global`）。JST 深夜0時リセットは既存 `getJstDateKey()` を流用 |
| 制限判定順       | Pro 有効契約 → スキップ。キャッシュヒット → 全カウンタ非消費。新規質問 → per-quiz と global の**両方**をチェックし、先に到達した方の `limitType` を返却                    |
| 正規化キャッシュ | `normalizeQuestionText`: trim → lowercase → 空白文字（半角・全角 `\u3000`）除去。サーバー `findCachedAnswer` とクライアント `useAiPlayState` が同一関数を import           |
| カウンタ更新     | 新規 AI 呼び出し成功時のみ、同一 Firestore Transaction で `attempt.aiTurnCount++`、`dailyAiTurnCounts/{quizId}.count++`、`dailyAiTurnCounts/_global.count++`               |
| `turnsRemaining` | 成功応答に `{ perQuiz: number \| null, globalDaily: number \| null }` を返却（Pro は両方 `null`）。キャッシュヒット時も現残数を返し UI 同期                                |
| 諦め API         | 成功応答は `{ completed: true }` のみ。`getLateralRevealText` / `revealText` は本番 API から除去（破壊的変更、クライアント同時デプロイ）                                   |
| 諦め UI          | 真相・解説を右パネル／チャットに表示しない。チャット内 CTA: 常に「結果画面へ」。`attempt.listId != null` のとき「次の問題へ」も表示（`quizetika-play-flow-ui`）            |
| lateral `listId` | `createLateralAttemptSession` がクエリ `listId` を受け取り attempt に保存。リスト連続プレイ文脈のナビ出し分けに使用                                                        |
| 認証             | ウミガメのみ会員必須（他モードはゲスト可）。詳細画面ボタン表記は play-flow-ui。プレイ直アクセスは `/login?redirect=...` で戻り先付与を推奨                                 |
| entitlements     | `quiz-play-client` の `isPremium: false` ハードコードを廃止し、サーバー `resolveUserEntitlements` 結果を props または初期データで受け取る                                  |

### `normalizeQuestionText` 契約

```typescript
/** 前後空白除去・小文字化・空白文字統一（半角/全角） */
export function normalizeQuestionText(text: string): string;

/** 正規化一致で履歴を検索。ヒット時は isFromCache 付きコピーを返す */
export function findCachedAnswer(
  questionText: string,
  history: AiQuestion[]
): AiQuestion | null;
```

クライアントのインライン正規化（`useAiPlayState` L31–36）を廃止し、上記を単一 import に統一する。

### `checkAiTurnLimits` 契約

```typescript
export const FREE_TIER_PER_QUIZ_LIMIT = 30;
export const FREE_TIER_GLOBAL_DAILY_LIMIT = 150;
export const DAILY_AI_TURN_GLOBAL_DOC_ID = '_global' as const;

export type AiTurnLimitType = 'per-quiz' | 'global-daily';

export interface AiTurnLimitCheckInput {
  perQuizCount: number;
  globalDailyCount: number;
  hasUnlimitedAiQuestions: boolean;
}

export interface AiTurnLimitCheckResult {
  exceeded: boolean;
  limitType?: AiTurnLimitType;
  turnsRemaining: { perQuiz: number | null; globalDaily: number | null };
}

export function checkAiTurnLimits(input: AiTurnLimitCheckInput): AiTurnLimitCheckResult;
```

### `ask-ai` API 応答契約（Phase 17 追記）

**成功（200）**:
```typescript
{
  answerType: AiAnswerType;
  aiComment: string;
  isFromCache: boolean;
  turnsRemaining: { perQuiz: number | null; globalDaily: number | null };
}
```

**制限超過（429）**:
```typescript
{
  error: 'limit-exceeded';
  limitType: 'per-quiz' | 'global-daily';
  message: string; // Pro 購読で解除される旨
}
```

真相提出 API（`verify-truth`）は制限対象外。上限到達後も真相検証は継続可能（要件 4.11）。

### `give-up-lateral` API 応答契約（Phase 17 改定）

**成功（200）**:
```typescript
{ completed: true }
```

`revealText` フィールドは返却しない。`lateral-give-up-utils.ts` はテスト・将来用途のため残置可だが本番ルートからは呼ばない。

### Firestore: `dailyAiTurnCounts` スキーマ

パス: `users/{uid}/dailyAiTurnCounts/{docId}`

| docId      | 意味             | フィールド                                             |
| ---------- | ---------------- | ------------------------------------------------------ |
| `{quizId}` | クイズ別日次     | `count: number`, `dateKey: string`（JST `YYYY-MM-DD`） |
| `_global`  | 全クイズ横断日次 | 同上                                                   |

`dateKey` が当日と異なる場合は Transaction 内で `count` を 0 にリセットしてから increment。Rules は既存 `users/{uid}` サブコレクション方針に従い Admin SDK のみ書き込み。

### File Structure Plan（Phase 17）

#### Modified Files（コア）
| ファイル                                       | 責務                                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/ask-ai-utils.ts`                 | 定数 30/150、`normalizeQuestionText`、`checkAiTurnLimits`、`findCachedAnswer` 正規化対応、`AskAiResponse.turnsRemaining` 形状変更 |
| `src/app/api/attempt/ask-ai/route.ts`          | 横断カウンタ読み書き、二重制限 429 + `limitType`、Transaction で3カウンタ同期                                                     |
| `src/hooks/useAiPlayState.ts`                  | 共有正規化 import、クライアント側 20 回ガード削除（サーバー正本）、`limitType` エラー処理                                         |
| `src/app/api/attempt/give-up-lateral/route.ts` | `revealText` 除去、`{ completed: true }` のみ                                                                                     |
| `src/services/attempt.ts`                      | `aiTurnLimit: 30`、`createLateralAttemptSession` に `listId` 引き継ぎ                                                             |
| `tests/services/ask-ai-utils.test.ts`          | 30/150、正規化キャッシュ、二重制限、`limitType`                                                                                   |
| `tests/api/give-up-lateral.test.ts`            | `revealText` 非期待、`completed: true` のみ                                                                                       |

#### 隣接スペック境界（本スペックは契約のみ定義、実装は各 UI スペック）
| ファイル                                      | スペック                            | 責務                                                                               |
| --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `src/app/quiz/[id]/play/quiz-play-client.tsx` | `quizetika-play-flow-ui`            | Pro 誘導（`/pricing`）、諦め後チャット CTA、`entitlements` 連携、ルール説明 30/150 |
| `src/app/quiz/[id]/quiz-detail-client.tsx`    | `quizetika-play-flow-ui`            | 未登録「会員登録してプレイする」（✅ 実装済）                                       |
| `src/lib/pricing-display.ts`                  | `quizetika-billing-subscription-ui` | Free プラン「30回/クイズ・150回/日横断」文言                                       |

#### New Files（推奨）
| ファイル                          | 責務                                                 |
| --------------------------------- | ---------------------------------------------------- |
| `tests/api/ask-ai-limits.test.ts` | ask-ai 統合テスト（モック Firestore + entitlements） |

### Requirements Traceability（Phase 17）

| Requirement | Summary                     | Components                               | Interfaces                  |
| ----------- | --------------------------- | ---------------------------------------- | --------------------------- |
| 4.1         | 未登録ボタン表記            | `quiz-detail-client`                     | play-flow-ui                |
| 4.2         | 未登録ウミガメ→ログイン誘導 | `quiz-detail-client`, `quiz-play-client` | `/login?redirect=`          |
| 4.3         | 他モードはゲスト可          | 通常プレイ attempt 作成                  | `guest` userId              |
| 4.4         | 認証済み lateral attempt    | `createLateralAttemptSession`            | `attempt.ts`                |
| 4.5         | AI 質問（履歴20件）         | `AskAiQuestionAPI`                       | `/api/attempt/ask-ai`       |
| 4.6         | 同一クイズ 30回/日          | `ask-ai-utils`, `ask-ai/route`           | `FREE_TIER_PER_QUIZ_LIMIT`  |
| 4.7         | 横断 150回/日               | `ask-ai-utils`, `ask-ai/route`           | `dailyAiTurnCounts/_global` |
| 4.8         | Pro 無制限                  | `EntitlementService`                     | `hasUnlimitedAiQuestions`   |
| 4.9         | サーバー側 tier 判定        | `ask-ai/route`                           | `resolveUserEntitlements`   |
| 4.10        | 正規化キャッシュ非消費      | `ask-ai-utils`                           | `normalizeQuestionText`     |
| 4.11        | 上限 Pro 誘導・真相可       | `ask-ai/route`, play UI                  | `limit-exceeded`            |
| 4.12–4.20   | レイアウト・真相・経過時間  | 既存 Phase 14/16 資産                    | verify-truth, play UI       |
| 4.21        | 諦め真相非表示              | `give-up-lateral/route`                  | `{ completed: true }`       |
| 4.22        | チャット内「結果画面へ」    | `quiz-play-client`                       | play-flow-ui                |
| 4.23        | リスト文脈「次の問題へ」    | `quiz-play-client`, `attempt.listId`     | play-flow-ui                |
| 4.24–4.27   | 入力ロック・完了保存・認証  | 既存 Phase 16 資産                       | verify-truth, give-up       |

### Testing Strategy（Phase 17）

**Unit（`ask-ai-utils`）**
- `normalizeQuestionText('  Hello　World  ')` と `'hello world'` が同一キーになること。
- per-quiz 29→30 で `limitType: 'per-quiz'`、global 149→150 で `limitType: 'global-daily'`。
- Pro（`hasUnlimitedAiQuestions: true`）は常に `exceeded: false`。
- 正規化一致キャッシュで `checkAiTurnLimits` を呼ばずに応答組み立て可能であること（API 統合で検証）。

**Integration**
- `ask-ai`: Transaction が per-quiz + global + attempt を原子的に更新すること（モック）。
- `give-up-lateral`: 200 で `revealText` キーが存在しないこと。attempt `score: 0`, `completedAt` 設定。
- `createLateralAttemptSession`: `listId` クエリパラメータが attempt に保存されること。

**Regression**
- Phase 14 真相 AI 意味判定、Phase 16 固定不合格メッセージ・経過秒数は維持。

### Risks & Mitigations

| Risk                             | Mitigation                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| 横断カウンタの Transaction 競合  | 読み取り順序を固定（attempt → per-quiz doc → global doc）。失敗時は 503 で再試行可能に |
| `revealText` 廃止の破壊的変更    | API と play UI を同一デプロイ。テストを Phase 17 契約に更新                            |
| クライアント/server 正規化不一致 | `normalizeQuestionText` を `ask-ai-utils` に単一化し双方 import                        |
| `listId` 未伝播で 4.23 未達      | lateral attempt 作成時に URL `listId` を必ず引き継ぐ                                   |
| 結果画面での真相表示             | 要件はプレイ画面のみ明示。結果画面は真相を出さない現行方針を維持（別途確認可）         |

---

## Phase 18: 模擬試験・フラッシュカード LB 非対象（2026-06-09）

### 1. Boundary Commitments

| Owns                                                              | Out of Boundary                                    |
| ----------------------------------------------------------------- | -------------------------------------------------- |
| `isLeaderboardEligibleAttempt` の `exam` / `flashcard` 除外       | クイズ詳細の警告 UI（`quizetika-play-flow-ui`）    |
| prior 件数の全モードカウント契約（`countPriorCompletedAttempts`） | プラットフォーム総合 `/leaderboard`                |
| `saveAttempt` / `verify-truth` の LB 更新分岐                     | 既存 LB 表示 UI・E2E（play-flow 側は警告のみ追加） |
| `tests/lib/leaderboard-update.test.ts`（新規）                    | docs 同期（Direct Implementation 可）              |

### 2. Design Decision

**採用: 単一関数拡張（Option A）**

`leaderboard-update.ts` の `isLeaderboardEligibleAttempt` に `exam` / `flashcard` を追加除外するのみ。prior 件数は既存 `countPriorCompletedAttempts`（モード不問）を維持し、初回権利消滅を自然に実現する。

| Option                                 | 説明                       | 不採用理由                              |
| -------------------------------------- | -------------------------- | --------------------------------------- |
| A. `isLeaderboardEligibleAttempt` 拡張 | 最小差分、既存フロー維持   | — **採用**                              |
| B. 別途 `countRankingEligibleAttempts` | 登録対象モードのみカウント | exam 先プレイ後の replay 振り分けが破綻 |
| C. `firstPlayConsumed` ユーザーフラグ  | 明示的権利消滅             | スキーマ追加・マイグレーション過大      |

### 3. File Structure Plan（Phase 18）

| ファイル                                     | 操作       | 責務                                                                 |
| -------------------------------------------- | ---------- | -------------------------------------------------------------------- |
| `src/lib/leaderboard-update.ts`              | **Modify** | `exam` / `flashcard` 除外、`buildLeaderboardUpdatesForQuiz` 契約維持 |
| `src/services/attempt.ts`                    | **Verify** | prior count 呼び出し条件は現状維持（変更不要想定）                   |
| `src/app/api/attempt/verify-truth/route.ts`  | **Verify** | prior 全モードカウントは現状維持                                     |
| `tests/lib/leaderboard-update.test.ts`       | **New**    | モード別 eligibility、build 結果 null/非 null                        |
| `tests/services/attempt-leaderboard.test.ts` | **Modify** | exam 非登録、exam→normal replay の統合ケース                         |

### 4. Requirements Traceability（Phase 18）

| Req       | Summary                  | Component                                                 | Notes                             |
| --------- | ------------------------ | --------------------------------------------------------- | --------------------------------- |
| 9.1       | 登録対象のみ LB 評価     | `isLeaderboardEligibleAttempt`                            |                                   |
| 9.2       | exam/flashcard 非登録    | 同上                                                      | 両 board 対象外                   |
| 9.3       | 除外モード集合           | 同上                                                      | guest, test-play, exam, flashcard |
| 9.4–9.5   | prior 全モード → board   | `countPriorCompletedAttempts` + `resolveLeaderboardBoard` |                                   |
| 9.6       | exam 先 → replay のみ    | `saveAttempt` 統合テスト                                  |                                   |
| 9.7–9.11  | 順位規則・ウミガメ       | 既存 Phase 5 資産                                         | 変更なし                          |
| 9.12      | review/list 等は対象維持 | `isLeaderboardEligibleAttempt`                            | 明示テスト                        |
| 9.13–9.14 | 警告 UI Out              | play-flow-ui                                              |                                   |

### 5. Testing Strategy（Phase 18）

**Unit（`leaderboard-update.test.ts`）**
- `isLeaderboardEligibleAttempt({ mode: 'exam' })` → `false`
- `isLeaderboardEligibleAttempt({ mode: 'flashcard' })` → `false`
- `isLeaderboardEligibleAttempt({ mode: 'normal' })` → `true`（認証済 userId）
- `buildLeaderboardUpdatesForQuiz(..., mode: 'exam')` → `null`

**Integration（`attempt-leaderboard.test.ts`）**
- exam 完了後 `leaderboardFirstPlay` / `leaderboardReplay` いずれも undefined
- exam → normal: replay のみ更新、firstPlay 空

**Regression**
- 既存初回／リプレイ LB テスト（normal のみ）維持

### 6. Risks & Mitigations

| Risk                                          | Mitigation                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| 既存 exam 完了データが LB に残存              | 本フェーズは新規更新のみ制御。過去データの手動削除は Out                         |
| verify-truth と saveAttempt の prior 集計差異 | verify-truth は既に全モードカウント。saveAttempt も count 関数はモード不問で統一 |

**Effort**: **XS**（半日）— 1 関数 + テスト追加

**Document Status（Phase 18 設計）**: 本節に反映。`spec.json` → `phase: design-generated`。

---

## Phase 20: 〇✕問題形式（`true-false`）コア整合（2026-06-09）

### 1. Boundary Commitments

| Owns                                               | Out of Boundary                                          |
| -------------------------------------------------- | -------------------------------------------------------- |
| `Quiz.format` に `'true-false'` 追加               | 〇／× 専用プレイ UI（`quizetika-play-flow-ui`）          |
| `resolveQuizFormat` の単一形式解決                 | 作問エディタ正解トグル UI（`quizetika-creator-dash-ui`） |
| `true-false-defaults` による固定選択肢生成・正規化 | `ChoiceAnswerPanel` の改修                               |
| 公開検証（2択・正解1件・ラベル正規化）             |                                                          |
| `quiz-format-labels` の「〇✕問題」ラベル           |                                                          |
| 既存 `isChoiceAnswerCorrect` 採点経路の維持        |                                                          |

### 2. Architecture Decision

**パターン**: 既存 `choices` モデルを維持し、Core/lib に固定ラベル生成を集約する（Build）。`correctTextAnswerList` への移行は却下（Adopt 不要・データ非互換）。

**`resolveQuizFormat` 改定**:
- `SINGLE_FORMAT_TYPES` に `'true-false'` を追加
- 全問題が `true-false` のみ → `'true-false'`（現状の `mixed` フォールバックを削除）
- `format: 'true-false'` 明示時は公開検証で全問題 `true-false` を要求

### 3. Core Library: `true-false-defaults.ts`

```typescript
export type TrueFalseCorrectSide = 'maru' | 'batsu';

export const TRUE_FALSE_LABELS = { maru: '〇', batsu: '✕' } as const;

/** 新規問題・形式変換時のデフォルト選択肢（正解トグル反映） */
export function createTrueFalseChoices(correctSide: TrueFalseCorrectSide): Choice[];

/** 既存 choices から正解側を推定（読み取り専用・エディタ初期化用） */
export function resolveTrueFalseCorrectSide(choices: Choice[] | undefined): TrueFalseCorrectSide;

/** 保存前正規化: ID は可能な限り維持し choiceText/isCorrect のみ矯正 */
export function normalizeTrueFalseChoices(
  choices: Choice[] | undefined,
  correctSide: TrueFalseCorrectSide
): Choice[];
```

**保存パス**: `QuizService.saveQuiz`（または `quiz-validation` 直前）で `type === 'true-false'` の問題に `normalizeTrueFalseChoices` を適用。`format === 'true-false'` のクイズは `questions[].type` を強制 `true-false`。

### 4. Validation Rules（`quiz-validation.ts` 拡張）

| チェック                                      | 下書き         | 公開         |
| --------------------------------------------- | -------------- | ------------ |
| 選択肢件数 === 2                              | ✓              | ✓            |
| `isCorrect === true` が1件                    | ✓              | ✓            |
| `choiceText` が「〇」「✕」に正規化可能        | 正規化して保存 | 正規化後検証 |
| `format === 'true-false'` → 全問 `true-false` | —              | ✓            |

**後方互換**: 既存データでラベルが「○」「×」等の場合、読み取り・採点は `isCorrect` + ID で継続。新規保存時のみ `normalizeTrueFalseChoices` で「〇」「✕」へ統一。

### 5. File Structure Plan（Phase 20）

| ファイル                                            | 操作       | 責務                                                     |
| --------------------------------------------------- | ---------- | -------------------------------------------------------- |
| `src/types/index.ts`                                | **Modify** | `Quiz.format` に `'true-false'`                          |
| `src/lib/true-false-defaults.ts`                    | **New**    | 固定選択肢生成・正規化・正解側推定                       |
| `src/lib/quiz-format.ts`                            | **Modify** | `SINGLE_FORMAT_TYPES` 追加、`resolveQuizFormat` 修正     |
| `src/lib/quiz-format-labels.ts`                     | **Modify** | `true-false` → ラベル「〇✕問題」、説明・アイコン         |
| `src/services/quiz-validation.ts`                   | **Modify** | `true-false` 公開検証・形式整合                          |
| `src/services/quiz.ts`                              | **Modify** | 保存時 `true-false` 正規化（任意で validation 内集約可） |
| `tests/lib/true-false-defaults.test.ts`             | **New**    | 生成・正規化・正解側推定                                 |
| `tests/lib/quiz-format.test.ts`                     | **Modify** | 単一 `true-false` → format 解決                          |
| `tests/services/quiz-validation-true-false.test.ts` | **New**    | 公開拒否・正規化                                         |

**変更なし（確認のみ）**: `choice-answer-utils.ts` / `usePlayState` の `isChoiceAnswerCorrect` 経路、`quiz-format-match.ts`（`resolveQuizFormat` 連動で自動整合）。

### 6. Requirements Traceability（Phase 20）

| Req         | Summary                     | Component                                      |
| ----------- | --------------------------- | ---------------------------------------------- |
| 20.1–20.3   | 第一級 format・単一形式解決 | `quiz-format.ts`, `types`                      |
| 20.4–20.5   | 公開検証・正規化            | `quiz-validation.ts`, `true-false-defaults.ts` |
| 20.6        | 後方互換読み取り            | 採点経路維持                                   |
| 20.7–20.8   | 採点・単一正解              | `choice-answer-utils`                          |
| 20.9–20.10  | 形式フィルタ・ラベル        | `quiz-format-match`, `quiz-format-labels`      |
| 20.11–20.12 | mixed 共存                  | `quiz-format.ts`, validation                   |
| 20.13–20.15 | 境界 Out                    | play-flow / creator-dash                       |

### 7. Testing Strategy（Phase 20）

| 種別            | 検証                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| **Unit**        | `createTrueFalseChoices('maru')` → 〇正解・✕不正解、`resolveQuizFormat` 全問 true-false |
| **Unit**        | `normalizeTrueFalseChoices` が ID 維持しラベル矯正                                      |
| **Integration** | `validateQuizForPublish` が 3 択・正解0件を拒否                                         |
| **Regression**  | `test_data.json` の既存 `true-false` 問題が採点可能                                     |

**Effort**: **S**（1日）

**Document Status（Phase 20 設計）**: 本節に反映。

---

## Phase 21: ホーム向け公開クイズ一覧の段階的取得

### 1. Overview

ホーム探索 UI が全件一括取得（limit 30〜100）から初回少量＋続き読み込みへ移行するため、コア層に共通ページング契約を追加する。タブ別フィード（新着・人気・トレンド・フォロー TL）は単一 Firestore クエリに `startAfter` を適用し、複合検索（`searchQuizzes`）は既存ハイブリッド合成結果を安定ソートしたうえでオフセットカーソルによりスライスする（根本置換は行わない）。

**既定ページサイズ**: `HOME_FEED_PAGE_SIZE = 20`（要件 21.15）

### 2. Boundary Commitments（Phase 21）

| Owns                                | Out                                     |
| ----------------------------------- | --------------------------------------- |
| `PaginatedQuizResult` 型            | 無限スクロール UI・IntersectionObserver |
| `quiz-feed-cursor.ts` encode/decode | sticky 検索バー CSS                     |
| タブ別 `*Page` API                  | ジャンル別・タグ別一覧の段階的取得      |
| `searchQuizzesPaginated`            | プレイ状況クライアント後段フィルタ      |
| 無効カーソル時のエラー応答          | 全文検索エンジン新設                    |

### 3. Architecture

```mermaid
sequenceDiagram
    participant UI as useExploreQuizFeed
    participant QS as quiz.ts
    participant FC as quiz-feed-cursor
    participant FS as Firestore

    UI->>QS: fetchHomeTabFeedPage(tab, limit, cursor?)
    QS->>FS: query + orderBy + limit(N+1)
    FS-->>QS: docs
    QS->>FC: encodeQuizFeedCursor(lastDoc)
    QS-->>UI: PaginatedQuizResult

    UI->>QS: searchQuizzesPaginated(q, filters, limit, cursor?)
    QS->>QS: materializeFilteredSet (既存 pipeline)
    QS->>QS: slice(offset, offset+limit)
    QS->>FC: encodeSearchOffsetCursor(offset+len)
    QS-->>UI: PaginatedQuizResult
```

**パターン選択**:
- **タブフィード**: Firestore ネイティブカーソル（`listUserPlayHistory` と同型の base64url JSON）
- **複合検索**: オフセットカーソル + クエリ／フィルタ fingerprint 検証（条件変更時は UI がリセットする前提）

### 4. Data Models & Contracts

#### `PaginatedQuizResult`（`src/types/index.ts`）

```typescript
export interface PaginatedQuizResult {
  items: Quiz[];
  nextCursor: string | null;
}
```

#### タブフィードカーソル（`QuizFeedCursor`）

```typescript
interface QuizFeedCursorPayload {
  v: 1;
  kind: 'latest' | 'popular' | 'trending' | 'timeline';
  quizId: string;
  /** ソートキー（createdAt ms / playCount / bookmarksCount） */
  sortKey: number | string;
}
```

- encode: `Buffer.from(JSON.stringify(payload)).toString('base64url')`
- decode 失敗・`v` 不一致・`kind` 不一致 → エラー throw（要件 21.6、先頭フォールバック禁止）

#### 検索オフセットカーソル（`SearchOffsetCursor`）

```typescript
interface SearchOffsetCursorPayload {
  v: 1;
  offset: number;
  /** normalize 済み queryText + stable JSON(filters) の短い hash */
  fingerprint: string;
}
```

- 続き要求時、fingerprint が現在リクエストと一致しない場合はエラー（条件変更検知）
- 素材化上限 `SEARCH_MATERIALIZE_CAP = 200`（初版）。offset が cap を超える場合は `nextCursor: null`

### 5. Service API（`src/services/quiz.ts`）

| 関数                                                                       | 用途                 | カーソル方式                         |
| -------------------------------------------------------------------------- | -------------------- | ------------------------------------ |
| `getLatestQuizzesPage({ limit?, cursor? })`                                | 新着タブ             | Firestore `startAfter`               |
| `getPopularQuizzesPage({ limit?, cursor? })`                               | 人気タブ             | 同上（`playCount` desc）             |
| `getTrendingQuizzesPage({ limit?, cursor? })`                              | トレンドタブ         | 同上（`bookmarksCount` desc）        |
| `getFollowedTimelinePage({ followerId, limit?, cursor? })`                 | フォロー TL          | 同上（既存 30 author `in` 制限維持） |
| `searchQuizzesPaginated(queryText, filters, { limit?, cursor?, userId? })` | フィルタ／検索有効時 | オフセット                           |

**実装規則**:
1. 各 `*Page` は `limit + 1` 件取得し、超過分があれば `hasMore` とし最後の1件を捨てる（play history パターン）
2. 既存 `getLatestQuizzes(n)` 等は内部で `getLatestQuizzesPage({ limit: n })` の `.items` を返す薄いラッパーに変更し、呼び出し互換を維持
3. `searchQuizzesPaginated` は既存 `searchQuizzes` のフィルタパイプラインを `materializeSearchQuizzes(queryText, filters)` に抽出し、初回／続きで共有
4. 素材化結果は `sortQuizzesForList(..., 'latest')` で安定ソート（検索モードの既定並び）

**`materializeSearchQuizzes` 抽出**:
- 現行 `searchQuizzes` L754–845 を private 相当の純粋関数へ移動
- `searchQuizzes`（非ページング）は `materializeSearchQuizzes` の全件返却を維持（ジャンル scoped ページ等の既存利用者向け後方互換）

### 6. File Structure Plan（Phase 21）

| ファイル                                      | 操作       | 責務                                                              |
| --------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `src/types/index.ts`                          | **Modify** | `PaginatedQuizResult`                                             |
| `src/lib/quiz-feed-cursor.ts`                 | **New**    | タブ／検索カーソル encode・decode・fingerprint                    |
| `src/services/quiz.ts`                        | **Modify** | `*Page` API、`materializeSearchQuizzes`、`searchQuizzesPaginated` |
| `tests/lib/quiz-feed-cursor.test.ts`          | **New**    | カーソル round-trip・無効入力                                     |
| `tests/services/quiz-feed-pagination.test.ts` | **New**    | タブページング重複なし、検索 offset、無効カーソルエラー           |

### 7. Requirements Traceability（Phase 21）

| Req         | Summary               | Component                                            |
| ----------- | --------------------- | ---------------------------------------------------- |
| 21.1–21.6   | 共通ページング契約    | `PaginatedQuizResult`, `quiz-feed-cursor`            |
| 21.7–21.9   | タブ別並び            | `get*QuizzesPage`                                    |
| 21.10–21.11 | フォロー TL           | `getFollowedTimelinePage`                            |
| 21.12–21.14 | 複合検索段階取得      | `searchQuizzesPaginated`, `materializeSearchQuizzes` |
| 21.15–21.17 | 件数・重複・published | 各 `*Page` 実装                                      |
| 21.18–21.21 | 境界 Out              | play-flow UI                                         |

### 8. Testing Strategy（Phase 21）

| 種別            | 検証                                                            |
| --------------- | --------------------------------------------------------------- |
| **Unit**        | カーソル encode/decode ラウンドトリップ、壊れた base64 で throw |
| **Unit**        | fingerprint 不一致 cursor でエラー                              |
| **Integration** | `getLatestQuizzesPage` 2ページ連続で ID 重複なし                |
| **Integration** | `searchQuizzesPaginated` offset 0/20 で合計件数整合             |
| **Regression**  | 既存 `searchQuizzes` / `getLatestQuizzes(10)` 呼び出し互換      |

**Effort**: **M**（2〜3日）

**Document Status（Phase 21 設計）**: 本節に反映。

---

## Phase 22: ディスカバリーホーム向けデータ提供と検索 URL 状態

### 1. Overview

Phase 22 は新規 ranking エンジンを追加せず、既存 `getTrendingQuizzes` / `getLatestQuizzes` / `listActiveGenres` をディスカバリーホーム（`/`）向けに再利用する。検索画面（`/search`）の深いリンク（タブ・ジャンル・フィルタ展開）を支える URL クエリ契約を `src/lib/search-url-state.ts` に1か所集約し、UI は parse/serialize のみを呼び出す。

**定数**:
- `DISCOVERY_CAROUSEL_SIZE = 10`（トレンド・新着カルーセル共通）

### 2. Boundary Commitments（Phase 22）

| Owns                                  | Out                         |
| ------------------------------------- | --------------------------- |
| `search-url-state.ts` parse/serialize | ディスカバリーホーム UI     |
| `SearchUrlState` 型                   | 検索画面 UI・フィルタチップ |
| 既存 API 再利用の件数契約             | Sidebar / BottomNav         |
| 無効クエリの正規化                    | パーソナライズドおすすめ    |

### 3. Architecture

```mermaid
flowchart LR
  subgraph Discovery["/ (play-flow UI)"]
    D1[getTrendingQuizzes(10)]
    D2[getLatestQuizzes(10)]
    D3[listActiveGenres]
  end
  subgraph Search["/search (play-flow UI)"]
    S1[parseSearchUrlState]
    S2[serializeSearchUrlState]
  end
  Lib["search-url-state.ts"]
  S1 --> Lib
  S2 --> Lib
  D1 --> QuizSvc["quiz.ts"]
  D2 --> QuizSvc
  D3 --> GenreSvc["metadata_genres read"]
```

### 4. Data Models & Contracts

#### `SearchUrlState`（`src/lib/search-url-state.ts`）

```typescript
import type { HomeFeedFilters } from '@/lib/home-feed-filters';
import type { HomeFeedTab } from '@/hooks/useExploreQuizFeed';

export interface SearchUrlState {
  tab: HomeFeedTab;
  filters: HomeFeedFilters;
  openFilters: boolean;
  /** UI 専用。URL には `playStatus` として反映可 */
  playStatus: 'all' | 'unplayed' | 'played';
}
```

#### URL クエリマッピング（初版）

| Query key                         | State field           | 既定値 / 正規化                                                            |
| --------------------------------- | --------------------- | -------------------------------------------------------------------------- |
| `tab`                             | `tab`                 | 未指定 → `latest`。許可: `latest` \| `popular` \| `trending` \| `timeline` |
| `genreId`                         | `filters.genreId`     | 空文字可                                                                   |
| `format`                          | `filters.format`      | `QuizFormat` または空                                                      |
| `q`                               | `filters.searchQuery` | trim                                                                       |
| `tags`                            | `filters.tagChips`    | カンマ区切り、各要素 `normalizeTag`                                        |
| `difficultyMin` / `difficultyMax` | 数値フィルタ          | 1–5、範囲 clamp                                                            |
| `minQuestions` / `maxQuestions`   | 数値フィルタ          | 1–50、範囲 clamp                                                           |
| `playStatus`                      | `playStatus`          | `all` \| `unplayed` \| `played`                                            |
| `openFilters`                     | `openFilters`         | `1` のみ true                                                              |

**シリアライズ規則**:
- 既定値と同一のパラメータは URL から省略（短い共有 URL）
- `openFilters=1` のみ真を表現（`0` は出力しない）
- `tags` は正規化済み ID をソートしてカンマ連結（順序安定）

**パース規則**:
- 未知キーは無視
- 無効 `tab` → `latest`
- 数値範囲外 → clamp または既定値（design 実装時に単体テストで固定）
- 出力は常に `DEFAULT_HOME_FEED_FILTERS` をベースに merge

#### ディスカバリーホーム向け読み取り

| 用途                       | API                                           | 件数         |
| -------------------------- | --------------------------------------------- | ------------ |
| おすすめクイズ（トレンド） | `getTrendingQuizzes(DISCOVERY_CAROUSEL_SIZE)` | 10           |
| 新着クイズ                 | `getLatestQuizzes(DISCOVERY_CAROUSEL_SIZE)`   | 10           |
| ジャンル                   | `listActiveGenres()`                          | 全アクティブ |

- いずれも公開中クイズのみ（既存実装をそのまま利用）
- 検索画面 `tab=trending` / `tab=latest` の先頭ページは同一ソート規則（要件 22.12–22.13）

### 5. Public API

```typescript
export const DISCOVERY_CAROUSEL_SIZE = 10;

export function parseSearchUrlState(
  searchParams: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>
): SearchUrlState;

export function serializeSearchUrlState(state: SearchUrlState): URLSearchParams;

/** Next.js router 用: クエリ文字列（先頭 ? なし） */
export function buildSearchUrlQuery(state: Partial<SearchUrlState>): string;
```

- `play-flow-ui` の `useSearchUrlState` hook は本 lib をラップし、`useRouter` / `useSearchParams` で同期する（core は Next.js に非依存）

### 6. File Structure Plan（Phase 22）

| ファイル                             | 操作       | 責務                                     |
| ------------------------------------ | ---------- | ---------------------------------------- |
| `src/lib/search-url-state.ts`        | **New**    | parse / serialize / 定数                 |
| `src/lib/home-feed-filters.ts`       | **Modify** | （任意）`cloneHomeFeedFilters` ヘルパ    |
| `tests/lib/search-url-state.test.ts` | **New**    | 双方向整合・無効 tab・genreId 深いリンク |

**変更なし（再利用）**: `getTrendingQuizzes`, `getLatestQuizzes`, `listActiveGenres` in `quiz.ts` / genre service

### 7. Requirements Traceability（Phase 22）

| Req         | Summary            | Component                   |
| ----------- | ------------------ | --------------------------- |
| 22.1–22.4   | ディスカバリー一覧 | 既存 `quiz.ts` / genre list |
| 22.5–22.11  | URL 契約           | `search-url-state.ts`       |
| 22.12–22.13 | Phase 21 整合      | 既存 `*Page` API            |
| 22.14–22.17 | 境界 Out           | play-flow / sidebar UI      |

### 8. Testing Strategy（Phase 22）

| 種別     | 検証                                                       |
| -------- | ---------------------------------------------------------- |
| **Unit** | `tab=trending` → parse → serialize → 同一 tab              |
| **Unit** | `genreId=prog` + `openFilters=1` round-trip                |
| **Unit** | 無効 `tab=foo` → `latest`                                  |
| **Unit** | 既定フィルタ serialize で空クエリ（または `tab` のみ省略） |

**Effort**: **S**（1日）

**Document Status（Phase 22 設計）**: 本節に反映。

---

## Phase 23: リスト探索・カスタムクイズ Core API

### 1. Overview

Phase 23 は、隣接 UI スペック（`quizetika-lists-discovery-ui` / `quizetika-my-quiz-ui`）が消費する3つのコア契約を追加する。(1) 公開／本人非公開リストのキーワード探索 `searchLists`、(2) 4ソース統合の問題プール `buildMyQuizQuestionPool`、(3) 保存リストなし連続プレイ用 `my-quiz-session` と `Attempt.mode: 'my-quiz'` 試行記録。既存 `question-list-session` / `question-attach-search` / `dedupeQuestionCandidates` パターンを拡張し、新規 ranking エンジンやサーバー側セッション永続化は行わない。

**定数**:
- `DEFAULT_LIST_SEARCH_LIMIT = 50`（`searchLists` 既定上限）
- `MY_QUIZ_SESSION_KEY = 'quizetika_my_quiz_session'`（`question-list-session` とキー分離）

### 2. Boundary Commitments（Phase 23）

| Owns                                                  | Out                                           |
| ----------------------------------------------------- | --------------------------------------------- |
| `searchLists`（`quiz-list.ts`）                       | リスト探索ページ UI（`/lists`）               |
| `buildMyQuizQuestionPool` / `MyQuizQuestionCandidate` | カスタムクイズフィルタ UI・出題数設定         |
| `my-quiz-session.ts`（sessionStorage CRUD + URL）     | プレイ画面レイアウト（my-quiz-ui が最小拡張） |
| `Attempt.mode: 'my-quiz'`、`sessionId?`               | Sidebar / BottomNav ナビ追加                  |
| `saveAttempt` 1問契約（`question-list` / `my-quiz`）  | カスタムクイズ URL 共有可能化・プリセット保存 |
| Firestore composite index 2件（`quizLists`）          | リアクション履歴削除・テーマ永続化            |

**Allowed dependencies**: 既存 `getLatestQuizLists` / `getQuizListsByAuthor` クエリパターン、`bookmark.ts` 取得 API、`author-quiz-search.ts`、`question-attach-search.ts` の dedupe、`resolveQuizFormat`、`resolveListType`。

**Revalidation triggers**: `searchLists` 引数変更、`MyQuizQuestionCandidate` フィールド追加、セッション URL クエリ変更、`saveAttempt` 検証規則変更は隣接 UI スペックの再検証が必要。

### 3. Architecture

```mermaid
flowchart TB
  subgraph ListsDiscovery["quizetika-lists-discovery-ui"]
    ULS[useListsSearch]
  end
  subgraph MyQuizUI["quizetika-my-quiz-ui"]
    UMP[useMyQuizPool]
    MQS[my-quiz-session]
    QPC[quiz-play-client mode=my-quiz]
  end
  subgraph Core["quizetika-core"]
    SL[searchLists]
    POOL[buildMyQuizQuestionPool]
    SESS[my-quiz-session.ts]
    SA[saveAttempt]
  end
  FS[(Firestore quizLists / quizzes / bookmarks)]
  SS[(sessionStorage)]
  ULS --> SL
  SL --> FS
  UMP --> POOL
  POOL --> FS
  MQS --> SESS
  SESS --> SS
  QPC --> SESS
  QPC --> SA
  SA --> FS
```

**データフロー要約**:
1. **リスト探索**: UI → `searchLists({ visibility, keyword?, authorId?, limit? })` → Firestore クエリ → in-memory キーワード filter → `QuizList[]`
2. **カスタムクイズプール**: UI → `buildMyQuizQuestionPool(userId, flags)` → 4ソース並行収集 → `dedupeQuestionCandidates` 相当で merge → `MyQuizQuestionCandidate[]`（UI 側フィルタは core 外）
3. **カスタムクイズプレイ**: UI が出題リスト確定 → `initMyQuizSession(sessionId, entries)` → `buildMyQuizPlayUrl` → 各問完了時 `saveAttempt({ mode: 'my-quiz', totalQuestions: 1, sessionId?, ... })`

### 4. Data Models & Contracts

#### 4.1 searchLists（`src/services/quiz-list.ts`）

```typescript
import type { QuizList } from '@/types';

/** リスト探索の公開/非公開区分 */
export type ListSearchVisibility = 'public' | 'private';

export interface SearchListsParams {
  /** public: isPublished === true のみ / private: authorId 本人かつ isPublished === false */
  visibility: ListSearchVisibility;
  /** タイトル・説明への部分一致（case-insensitive）。空・未指定はフィルタなし */
  keyword?: string;
  /** visibility === 'private' のとき必須 */
  authorId?: string;
  /** 取得上限。未指定時 DEFAULT_LIST_SEARCH_LIMIT（50） */
  limit?: number;
}

export const DEFAULT_LIST_SEARCH_LIMIT = 50;

export async function searchLists(params: SearchListsParams): Promise<QuizList[]>;
```

**Preconditions**:
- `visibility === 'private'` のとき `authorId` が非空文字列。未指定・空文字は `throw new Error(...)`（要件 23.3）

**Query 規則**:
| visibility | Firestore クエリ                                                                                              | 後段 filter       |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ----------------- |
| `public`   | `where('isPublished','==',true)` + `orderBy('createdAt','desc')` + `limit(n)`                                 | keyword in-memory |
| `private`  | `where('authorId','==',uid)` + `where('isPublished','==',false)` + `orderBy('createdAt','desc')` + `limit(n)` | keyword in-memory |

**Keyword filter**（in-memory）:
- `searchTextIncludes(title, keyword) || searchTextIncludes(description ?? '', keyword)`（`normalize-search-text` 利用、`getLatestQuizLists` 後段 filter と同型）
- キーワード trim 後空文字 → filter スキップ

**Postconditions**:
- 返却配列は `createdAt` 降順（要件 23.7）
- 件数 ≤ `limit ?? DEFAULT_LIST_SEARCH_LIMIT`（要件 23.8–23.9）
- public 結果に `isPublished === false` を含まない（要件 23.1, 23.4）
- private 結果に `authorId !== params.authorId` を含まない（要件 23.2）
- 各要素の種別は `resolveListType(list)` で解釈可能（要件 23.10）

#### 4.2 buildMyQuizQuestionPool（`src/lib/my-quiz-pool.ts`）

```typescript
import type { QuizFormat } from '@/types';

export type MyQuizSource =
  | 'own'
  | 'bookmarked-quiz'
  | 'bookmarked-list'
  | 'bookmarked-question';

export interface MyQuizQuestionCandidate {
  questionId: string;
  questionText: string;
  parentQuizId: string;
  parentQuizTitle: string;
  source: MyQuizSource;
  genreId: string;
  tags: string[];
  format: QuizFormat;
  /** 親クイズ difficulty（1–5） */
  difficulty: number;
}

export interface MyQuizSourceFlags {
  ownQuizzes: boolean;
  bookmarkedQuizzes: boolean;
  bookmarkedLists: boolean;
  bookmarkedQuestions: boolean;
}

export async function buildMyQuizQuestionPool(
  userId: string,
  flags: MyQuizSourceFlags
): Promise<MyQuizQuestionCandidate[]>;
```

**4ソース収集規則**（有効フラグのみ。全 false → 空配列 — 要件 24.6）:

| Source                | フラグ                | 取得経路                                                                                               | 公開制約                                                              |
| --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `own`                 | `ownQuizzes`          | `searchAuthorQuizzes({ authorId: userId, includeDrafts: true })` → 各 `getQuestionsByQuiz`             | 公開・下書き・非公開すべて（要件 24.2）                               |
| `bookmarked-quiz`     | `bookmarkedQuizzes`   | `getBookmarkedQuizzes(userId)` → 各クイズの全問題                                                      | 公開済みのみ（bookmark feed 既存規則）                                |
| `bookmarked-list`     | `bookmarkedLists`     | `getBookmarkedLists(userId)` → `resolveListType === 'quiz'` のみ → `getQuizzesInList` → 各クイズの問題 | 公開済みクイズの問題のみ。問題リストの直接メンバーは除外（要件 24.4） |
| `bookmarked-question` | `bookmarkedQuestions` | `enrichBookmarkedQuestions(userId)`                                                                    | 親クイズ公開済みのみ（要件 24.5, 24.9）                               |

**Merge / dedupe**:
- ソース priority 順に flat 化: `own` → `bookmarked-quiz` → `bookmarked-list` → `bookmarked-question`
- `dedupeQuestionCandidates`（`question-attach-search.ts`）を再利用し `questionId` 先勝ち（要件 24.8）
- 候補→`MyQuizQuestionCandidate` 変換時に `resolveQuizFormat(parentQuiz)` で `format` を付与

**認証**: 呼び出し元（UI / Server Action）が `userId` を渡す。core 関数内では Firebase Auth を直接参照しない（既存 service 層パターン）。

#### 4.3 my-quiz-session（`src/lib/my-quiz-session.ts`）

`question-list-session.ts` と同型の sessionStorage lib。`listId` の代わりに `sessionId`（UUID v4、呼び出し元が生成）を保持する。

```typescript
export const MY_QUIZ_SESSION_KEY = 'quizetika_my_quiz_session';

export interface MyQuizSessionEntry {
  questionId: string;
  parentQuizId: string;
}

export interface MyQuizSession {
  sessionId: string;
  entries: MyQuizSessionEntry[];
  currentIndex: number;
}

export function initMyQuizSession(sessionId: string, entries: MyQuizSessionEntry[]): void;
export function readMyQuizSession(): MyQuizSession | null;
export function syncMyQuizSessionIndex(index: number): void;
export function advanceMyQuizSession(): MyQuizSessionEntry | null;
export function peekNextMyQuizEntry(): MyQuizSessionEntry | null;
export function clearMyQuizSession(): void;

/** プレイ画面 URL（mode=my-quiz 専用） */
export function buildMyQuizPlayUrl(session: MyQuizSession, index: number): string;
```

**URL 契約**（`buildMyQuizPlayUrl` 出力）:

```
/quiz/{parentQuizId}/play?mode=my-quiz&sessionId={uuid}&questionId={id}&qIndex={n}
```

**Postconditions**:
- `QUESTION_LIST_SESSION_KEY`（`quizetika_question_list_session`）とは別キーで衝突しない（要件 25.5）
- URL `qIndex` と `currentIndex` は `syncMyQuizSessionIndex` で同期（`question-list` 同型 — 要件 25.2）
- セッション欠落時 `readMyQuizSession()` は `null`（要件 25.4。UI がエラー表示）

**Out of scope**: サーバー永続化、URL によるセッション共有（要件 25.14）

#### 4.4 Attempt.mode `my-quiz`（`src/types/index.ts`）

```typescript
export interface Attempt {
  // ...
  /**
   * `my-quiz`: カスタムクイズ連続プレイ（問題ごとに1 attempt、親 `quizId`、`totalQuestions: 1`）
   * `question-list`: 問題リスト連続プレイ（同上、`listId` 必須）
   */
  mode:
    | 'normal'
    | 'exam'
    | 'flashcard'
    | 'review'
    | 'list'
    | 'question-list'
    | 'my-quiz'
    | 'test-play';
  listId?: string | null;
  /** カスタムクイズセッション ID（`my-quiz` モード時のみ任意付与） */
  sessionId?: string | null;
  // ...
}

/** カスタムクイズプレイ attempt の契約 */
export function satisfiesMyQuizAttemptContract(
  attempt: Pick<Attempt, 'mode' | 'quizId' | 'totalQuestions'>
): boolean {
  return (
    attempt.mode === 'my-quiz' &&
    !!attempt.quizId &&
    attempt.totalQuestions === 1
  );
}
```

**試行記録規則**（要件 25.6–25.9）:
- `mode: 'my-quiz'`、`totalQuestions: 1`、`quizId` = 当該問題の親クイズ ID
- `sessionId` は任意（URL クエリから UI が付与）
- `listId` は不要（`null` / 省略）

**リーダーボード**（要件 25.10）:
- `isLeaderboardEligibleAttempt` は変更不要。`my-quiz` は `question-list` と同様 **登録対象**（`exam` / `flashcard` / `test-play` / guest のみ除外 — 既存 `leaderboard-update.test.ts` の `question-list` 期待に整合）
- 各問題1 attempt のため、同一親クイズに対する prior 件数は連続プレイ中に増加し、2問目以降はリプレイ board のみ更新されうる（既存振り分け規則をそのまま適用）

**プレイ履歴**（要件 25.11）:
- `listUserPlayHistory` は `NON_PERSISTED_PLAY_MODES` に `my-quiz` を含めない → 履歴に含める

#### 4.5 saveAttempt 1問契約修正（`src/services/attempt.ts`）

現行 L92–95 は親クイズの全問題数と `totalQuestions` を常に照合するため、`question-list` / `my-quiz` の1問試行で誤って reject する。**1問モードのみ検証パスを分岐**する。

```typescript
function isSingleQuestionAttemptMode(mode: Attempt['mode']): boolean {
  return mode === 'question-list' || mode === 'my-quiz';
}
```

**検証分岐**:

| 検証                             | 通常モード                             | `question-list` / `my-quiz`                                           |
| -------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| `totalQuestions` vs クイズ全問数 | 一致必須                               | **`totalQuestions === 1` のみ必須**（全問数照合スキップ — 要件 25.8） |
| `failedQuestionIds`              | クイズ内 ID の subset                  | 同上（当該1問 ID のみ — 要件 25.9）                                   |
| `score` vs 計算                  | `actualTotalQuestions - failed.length` | **`1 - failedQuestionIds.length`（0 または 1）**                      |
| `question-list` 契約             | —                                      | `listId` 非空（既存 `satisfiesQuestionListAttemptContract`）          |
| `my-quiz` 契約                   | —                                      | `satisfiesMyQuizAttemptContract`（`sessionId` は任意）                |

**実装位置**: `runTransaction` 内、L91 付近。`actualTotalQuestions` は通常モードのみ使用。1問モードでは `expectedTotal = 1` 固定。

### 5. Firestore Indexes（Phase 23）

`firestore.indexes.json` に以下を追加（`getLatestQuizLists` / private 探索クエリ用。現行ファイルに未登録）:

```json
{
  "collectionGroup": "quizLists",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "quizLists",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "authorId", "order": "ASCENDING" },
    { "fieldPath": "isPublished", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### 6. File Structure Plan（Phase 23）

| ファイル                                         | 操作               | 責務                                                                         |
| ------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------- |
| `src/services/quiz-list.ts`                      | **Modify**         | `searchLists`, `SearchListsParams`, `DEFAULT_LIST_SEARCH_LIMIT`              |
| `src/lib/my-quiz-pool.ts`                        | **New**            | `buildMyQuizQuestionPool`, 型定義, 4ソース収集                               |
| `src/lib/my-quiz-session.ts`                     | **New**            | sessionStorage CRUD, `buildMyQuizPlayUrl`                                    |
| `src/lib/question-attach-search.ts`              | **Modify**（任意） | `MyQuizSource` 用に dedupe の入力型をジェネリック化するか、pool 側で adapter |
| `src/types/index.ts`                             | **Modify**         | `Attempt.mode` + `sessionId`, `satisfiesMyQuizAttemptContract`               |
| `src/services/attempt.ts`                        | **Modify**         | `saveAttempt` 1問検証分岐                                                    |
| `firestore.indexes.json`                         | **Modify**         | `quizLists` composite 2件                                                    |
| `tests/services/search-lists.test.ts`            | **New**            | public/private/keyword/authorId 必須                                         |
| `tests/lib/my-quiz-pool.test.ts`                 | **New**            | 4ソース merge, dedupe, published 除外                                        |
| `tests/lib/my-quiz-session.test.ts`              | **New**            | round-trip, URL, キー分離                                                    |
| `tests/services/attempt-single-question.test.ts` | **New**            | `question-list` / `my-quiz` saveAttempt 成功、全問数不一致 reject しない     |
| `tests/lib/leaderboard-update.test.ts`           | **Modify**         | `my-quiz` eligibility 追加                                                   |

**変更なし（再利用）**: `bookmark.ts`, `author-quiz-search.ts`, `question-list-session.ts`, `leaderboard-update.ts`（eligibility ロジック本体）

### 7. Requirements Traceability（Phase 23）

| Req         | Summary               | Component                                             |
| ----------- | --------------------- | ----------------------------------------------------- |
| 23.1–23.4   | 公開/非公開区分       | `searchLists` visibility 分岐                         |
| 23.5–23.6   | キーワード絞り込み    | in-memory filter                                      |
| 23.7–23.9   | 並び・件数上限        | Firestore orderBy + `DEFAULT_LIST_SEARCH_LIMIT`       |
| 23.10       | リスト種別            | `resolveListType`（既存）                             |
| 23.11–23.13 | 境界 Out              | lists-discovery UI                                    |
| 24.1–24.6   | 4ソース統合           | `buildMyQuizQuestionPool`                             |
| 24.7–24.9   | メタデータ・dedupe    | `MyQuizQuestionCandidate`, `dedupeQuestionCandidates` |
| 24.10–24.12 | 境界 Out              | my-quiz UI                                            |
| 25.1–25.5   | アドホックセッション  | `my-quiz-session.ts`                                  |
| 25.6–25.9   | 試行記録・saveAttempt | `Attempt`, `saveAttempt`                              |
| 25.10–25.11 | LB・履歴              | `isLeaderboardEligibleAttempt`（既存）, play history  |
| 25.12–25.14 | 境界 Out              | my-quiz-ui play client                                |

### 8. Testing Strategy（Phase 23）

| 種別            | 検証                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| **Unit**        | `searchLists` public — `isPublished false` 除外、keyword 部分一致       |
| **Unit**        | `searchLists` private — `authorId` 未指定で throw、他人リスト除外       |
| **Unit**        | `searchLists` — 既定 limit 50、createdAt 降順                           |
| **Unit**        | `buildMyQuizQuestionPool` — 全 flags false → `[]`                       |
| **Unit**        | `buildMyQuizQuestionPool` — 同一 questionId 重複時先勝ち（own 優先）    |
| **Unit**        | `buildMyQuizQuestionPool` — bookmark 経路で非公開親クイズ除外           |
| **Unit**        | `my-quiz-session` — init/read/advance/peek/clear、URL に `mode=my-quiz` |
| **Unit**        | `MY_QUIZ_SESSION_KEY` ≠ `QUESTION_LIST_SESSION_KEY`                     |
| **Integration** | `saveAttempt` `my-quiz` — 親クイズ10問でも `totalQuestions:1` で成功    |
| **Integration** | `saveAttempt` `question-list` — 同上（回帰）                            |
| **Integration** | `saveAttempt` `my-quiz` — `failedQuestionIds` に存在しない ID で reject |
| **Regression**  | `isLeaderboardEligibleAttempt({ mode: 'my-quiz' }) === true`            |
| **Regression**  | 通常 `normal` モード — 全問数不一致は従来どおり reject                  |

**Effort**: **M**（2〜3日）

**Document Status（Phase 23 設計）**: 本節に反映。

---

## Phase 26: リスト機能の完全廃止（Core）

### 1. Overview

Phase 26 は Phase 8 / Phase 23 で追加した `quizLists` エコシステムをコア層から除去する。`searchLists`・リスト CRUD・`question-list-session`・リストブックマーク・`list` / `question-list` の新規試行保存を廃止し、マイグレーションで `quizLists` と `targetType=list` ブックマークを削除する。`my-quiz`（3ソース）・クイズ/問題ブックマーク・参照リンク作問は維持する。

**設計確定（要件 26.15）**:
- 過去 `attempts`（`mode=list|question-list`）は**物理削除しない**。プレイ履歴 API は返却し、表示ラベルは **`レガシープレイ`** に正規化（`play-history-client.ts` と API マッパーで共通化）。

### 2. Boundary Commitments（Phase 26）

| Owns                                               | Out                                                |
| -------------------------------------------------- | -------------------------------------------------- |
| 型・サービス・Rules・Indexes からリスト関連除去    | `/lists`・`/list/*` UI（play-flow / creator-dash） |
| `scripts/migrate-delete-quizlists.mjs`             | Sidebar「リスト」ナビ（sidebar-layout）            |
| `saveAttempt` の `list` / `question-list` 新規拒否 | プロフィール「作成したリスト」（auth-profile）     |
| `buildMyQuizQuestionPool` 3ソース化                | 既存 `attempts` ドキュメント削除                   |

**Allowed dependencies**: 既存 `bookmark.ts`（quiz/question）、`my-quiz-session.ts`、`author-quiz-search.ts` は維持。

**Revalidation triggers**: `BookmarkFeed` 型変更、`Attempt.mode` 保存拒否、`MyQuizPoolFlags` から `bookmarkedLists` 削除は隣接 UI スペックの再検証が必要。

### 3. Architecture

```mermaid
flowchart LR
  subgraph Remove["削除対象"]
    QL[quiz-list.ts]
    QLS[question-list-session.ts]
    QLV[question-list-validation.ts]
    FS[(quizLists)]
  end
  subgraph Keep["維持"]
    BM[bookmark.ts quiz/question]
    MQP[my-quiz-pool.ts 3ソース]
    MQS[my-quiz-session.ts]
    SA[saveAttempt my-quiz only]
  end
  UI[隣接 UI] --> BM
  UI --> MQP
  UI --> MQS
  UI --> SA
  Migrate[migrate-delete-quizlists.mjs] --> FS
```

**実装順序（ビルド整合）**:
1. 型・`saveAttempt` 拒否・`bookmark` 縮小・`my-quiz-pool` 3ソース化
2. サービスファイル削除・import 掃除
3. Rules / Indexes 更新
4. マイグレーションスクリプト（ステージング検証後に本番）

### 4. Data Models & Contracts

#### 4.1 型変更（`src/types/index.ts`）

| 削除                                     | 変更                        |
| ---------------------------------------- | --------------------------- |
| `QuizList`, `QuizListType`               | —                           |
| `Bookmark.targetType` の `'list'`        | `'quiz' \| 'question'` のみ |
| `BookmarkFeed.lists`                     | フィールド削除              |
| `resolveListType()`                      | 関数削除                    |
| `satisfiesQuestionListAttemptContract()` | 関数削除                    |

`Attempt.mode` は **読み取り用** に `'list' \| 'question-list'` を union に残す（既存履歴）。`saveAttempt` は新規書き込み時に拒否。

```typescript
const DEPRECATED_PLAY_MODES = ['list', 'question-list'] as const;

export function assertPlayModeAllowedForSave(mode: Attempt['mode']): void {
  if ((DEPRECATED_PLAY_MODES as readonly string[]).includes(mode)) {
    throw new Error('LIST_PLAY_MODE_DEPRECATED');
  }
}
```

#### 4.2 ブックマーク（`src/services/bookmark.ts`）

- `toggleBookmark(targetType)` — `list` を即拒否（`INVALID_BOOKMARK_TARGET`）
- `getBookmarkFeed()` — `lists` 配列を返さない（`{ quizzes, questions }` のみ）
- `getBookmarkedLists` / `fetchPublishedListsByDocIds` — **削除**

#### 4.3 カスタムクイズプール（`src/lib/my-quiz-pool.ts`）

```typescript
export type MyQuizPoolFlags = {
  own: boolean;
  bookmarkedQuizzes: boolean;
  bookmarkedQuestions: boolean;
  // bookmarkedLists: 削除
};
```

`collectBookmarkedLists` 分岐を削除。dedupe 優先順: `own` → `bookmarkedQuizzes` → `bookmarkedQuestions`（既存規則維持）。

#### 4.4 プレイ履歴ラベル

```typescript
// src/lib/play-history-client.ts
const LEGACY_PLAY_MODE_LABELS: Partial<Record<Attempt['mode'], string>> = {
  list: 'レガシープレイ',
  'question-list': 'レガシープレイ',
};
```

`listUserPlayHistory` 応答に `displayModeLabel` を付与するか、クライアントが `mode` から導出（**正本: lib 1か所**）。

#### 4.5 マイグレーション（`scripts/migrate-delete-quizlists.mjs`）

- Firebase Admin SDK（`reset-firestore.mjs` と同型の env 読み込み）
- `quizLists` 全件: `listDocuments` + `batch.delete`（500件/バッチ）
- `bookmarks` where `targetType == 'list'`: 同上
- `--dry-run` フラグで件数のみ出力
- 本番実行前にステージングで検証必須

#### 4.6 Firestore

- `firestore.rules`: `match /quizLists/{listId}` ブロック削除
- `firestore.indexes.json`: `collectionGroup: quizLists` エントリ4件削除
- `src/lib/firebase/firestore.ts`: `quizListsRef` 削除

### 5. File Structure Plan（Phase 26）

| ファイル                                   | 操作       | 責務                              |
| ------------------------------------------ | ---------- | --------------------------------- |
| `src/services/quiz-list.ts`                | **Delete** | リスト CRUD / searchLists         |
| `src/services/quiz-list-utils.ts`          | **Delete** | リストエクスポート                |
| `src/lib/question-list-session.ts`         | **Delete** | 問題リスト連続プレイ              |
| `src/lib/question-list-validation.ts`      | **Delete** | listType 検証                     |
| `src/lib/profile-list-display.ts`          | **Delete** | プロフィール用ラベル              |
| `src/types/index.ts`                       | **Modify** | 型縮小                            |
| `src/services/bookmark.ts`                 | **Modify** | 2分類のみ                         |
| `src/services/attempt.ts`                  | **Modify** | 廃止モード拒否、契約関数削除      |
| `src/services/attempt-session.ts`          | **Modify** | `listId` 除去                     |
| `src/services/question.ts`                 | **Modify** | `add/removeQuestionFromList` 削除 |
| `src/lib/my-quiz-pool.ts`                  | **Modify** | 3ソース                           |
| `src/lib/play-history-client.ts`           | **Modify** | レガシーラベル                    |
| `src/lib/firebase/firestore.ts`            | **Modify** | `quizListsRef` 削除               |
| `src/services/user.ts`                     | **Modify** | 退会時リスト匿名化削除            |
| `src/app/api/user/delete-account/route.ts` | **Modify** | `quizLists` 参照削除              |
| `firestore.rules`                          | **Modify** | quizLists ルール削除              |
| `firestore.indexes.json`                   | **Modify** | quizLists インデックス削除        |
| `scripts/migrate-delete-quizlists.mjs`     | **New**    | データ削除                        |
| `tests/services/search-lists.test.ts`      | **Delete** | —                                 |
| `tests/services/quiz-list-*.test.ts`       | **Delete** | —                                 |
| `tests/lib/question-list-*.test.ts`        | **Delete** | —                                 |
| `tests/lib/my-quiz-pool.test.ts`           | **Modify** | 3ソース                           |
| `tests/services/bookmark.test.ts`          | **Modify** | list 拒否                         |
| `tests/services/attempt.test.ts`           | **Modify** | 廃止モード拒否                    |
| `tests/lib/leaderboard-update.test.ts`     | **Modify** | list モード除外                   |

**変更なし（名前注意）**: `QuizListSort`（探索ソート）、`QuizListSkeleton`（ダッシュボードクイズ一覧）はリスト機能と無関係 — 削除しない。

### 6. Requirements Traceability（Phase 26）

| Req         | Summary           | Component                                       |
| ----------- | ----------------- | ----------------------------------------------- |
| 26.1–26.2   | API/型除去        | ファイル削除、`types/index.ts`                  |
| 26.3–26.4   | ブックマーク2分類 | `bookmark.ts`                                   |
| 26.5–26.6   | 新規試行拒否      | `attempt.ts` `assertPlayModeAllowedForSave`     |
| 26.7        | 3ソースプール     | `my-quiz-pool.ts`                               |
| 26.8–26.11  | データ・Rules     | migration script, rules, indexes                |
| 26.12–26.13 | 退会・BAN         | `user.ts`, rules                                |
| 26.14–26.15 | 履歴維持・ラベル  | `play-history-client.ts`, `listUserPlayHistory` |
| 26.16–26.18 | 境界 Out          | 隣接 UI                                         |

### 7. Testing Strategy（Phase 26）

| 種別            | 検証                                                     |
| --------------- | -------------------------------------------------------- |
| **Unit**        | `toggleBookmark('list')` → reject                        |
| **Unit**        | `saveAttempt({ mode: 'list' })` → reject                 |
| **Unit**        | `buildMyQuizQuestionPool` — `bookmarkedLists` フラグなし |
| **Unit**        | `formatPlayHistoryMode('list')` → `レガシープレイ`       |
| **Integration** | migration dry-run が件数を返す（emulator）               |
| **Regression**  | `my-quiz` / `question` bookmark 従来動作                 |
| **Regression**  | `saveAttempt({ mode: 'my-quiz' })` 成功                  |

**Effort**: **M**（2〜3日、UI スペックと同一 PR または Core 先行マージ推奨）

**Document Status（Phase 26 設計）**: 本節に反映。Phase 8 / Phase 23 のリスト関連節は **廃止**（履歴参照のみ）。

---

## Phase 27: クイズ公開範囲（公開 / 非公開 / フォロワー限定）（Core）

### 1. Overview

Phase 27 は `quizzes.visibility` を導入し、ライフサイクル `status` と直交する公開範囲を制御する。`private` および `followers` の**設定**は Pro 契約（またはモデレーター免除）必須。ダウングレード後も既存の限定公開は維持し、`public → private|followers` のみ無料ユーザーに拒否する。閲覧判定は `src/lib/quiz-access.ts` に集約し、フィード・詳細・プレイ API・Rules で defense-in-depth する。

**設計確定（Discovery A1 確定 2026-06-10）**:
- `followers` の**作成・設定**も `private` と同様 Pro 必須（無料ユーザーは選択不可）。
- 既存 `visibility` 未設定ドキュメントは **`public`** として読み取り・クエリする。

### 2. Boundary Commitments（Phase 27）

| Owns                                               | Out                                                                         |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| `Quiz.visibility` 型・デフォルト・マイグレーション | エディタ公開範囲 UI（ui-editor）                                            |
| `canViewQuiz` / `assertCanSetQuizVisibility`       | 未認可詳細・プレイ UX（ui-quiz-lifecycle）                                  |
| 全公開フィード/検索/TL クエリの visibility 合成    | `/pricing` 特典 copy（billing-subscription-ui）                             |
| `createQuiz` / `updateQuiz` Pro ゲート             | OGP メタの文言デザイン（lifecycle UI が表示、Core は noindex フラグ提供可） |
| Firestore Rules read 制限                          | Stripe Webhook 改修                                                         |
| ブックマーク検証への閲覧規則適用                   | シークレットリンク                                                          |

**Allowed dependencies**: `resolveUserEntitlements`（`entitlement.ts`）、`isFollowing`（`user.ts`）、既存 `getQuizzesByAuthor` / 一覧 API。

**Revalidation triggers**: `Quiz` 型変更、Rules 変更、一覧 API フィルタ変更は play-flow / ui-discovery / auth-profile / my-quiz-ui の再検証が必要。

### 3. Architecture

```mermaid
flowchart TD
  subgraph CoreLib["src/lib/quiz-access.ts"]
    resolveVis["resolveQuizVisibility()"]
    canView["canViewQuiz()"]
    assertSet["assertCanSetQuizVisibility()"]
  end
  subgraph Services["Services"]
    create["createQuiz / updateQuiz"]
    feeds["getLatest / search / timeline"]
    getQ["getQuiz + assertView"]
    bm["bookmark-validation"]
    attempt["attempt / quick-press APIs"]
  end
  subgraph Entitlement["entitlement.ts"]
    pro["hasProEntitlements()"]
  end
  create --> assertSet
  assertSet --> pro
  feeds --> resolveVis
  getQ --> canView
  canView --> isFollowing["isFollowing()"]
  bm --> canView
  attempt --> canView
  Rules["firestore.rules"] --> resolveVis
```

#### 3.1 型（`src/types/index.ts`）

```typescript
export type QuizVisibility = 'public' | 'private' | 'followers';

export interface Quiz {
  // ...existing
  visibility?: QuizVisibility; // 未設定 = public（読み取り時正規化）
}
```

- `draft` 保存時: `visibility` を任意で保持。探索対象外は `status` で従来どおり。
- `published` 保存時: `visibility` 省略時は **`public`** を書き込む（新規）。既存 doc は読み取り時 `resolveQuizVisibility` で `public` フォールバック。

#### 3.2 閲覧判定（`src/lib/quiz-access.ts` — **New**）

```typescript
export function resolveQuizVisibility(
  quiz: Pick<Quiz, 'visibility'>
): QuizVisibility {
  return quiz.visibility ?? 'public';
}

export type CanViewQuizInput = {
  quiz: Pick<Quiz, 'authorId' | 'status' | 'visibility'>;
  viewerUid: string | null | undefined;
  isFollower?: boolean; // 呼び出し側が事前解決可（Rules 外）
  isSeniorModeratorOrAdmin?: boolean;
};

export function canViewQuiz(input: CanViewQuizInput): boolean {
  const { quiz, viewerUid } = input;
  if (quiz.status === 'suspended') {
    return (
      !!input.isSeniorModeratorOrAdmin ||
      (!!viewerUid && quiz.authorId === viewerUid)
    );
  }
  if (quiz.status === 'draft') {
    return !!viewerUid && quiz.authorId === viewerUid;
  }
  // published
  if (viewerUid && quiz.authorId === viewerUid) return true;
  if (input.isSeniorModeratorOrAdmin) return true;
  const vis = resolveQuizVisibility(quiz);
  if (vis === 'public') return true;
  if (vis === 'private') return false;
  // followers
  return !!viewerUid && !!input.isFollower;
}
```

**サーバー取得パターン**（詳細・プレイ・API）:

```typescript
export async function assertCanViewQuiz(
  quiz: Quiz,
  viewerUid: string | null,
  opts?: { skipFollowCheck?: boolean }
): Promise<void> {
  let isFollower = false;
  if (
    viewerUid &&
    quiz.authorId !== viewerUid &&
    resolveQuizVisibility(quiz) === 'followers'
  ) {
    isFollower = await isFollowing(viewerUid, quiz.authorId);
  }
  if (!canViewQuiz({ quiz, viewerUid, isFollower, ... })) {
    throw new QuizAccessDeniedError('QUIZ_ACCESS_DENIED');
  }
}
```

#### 3.3 設定時 Pro ゲート（`assertCanSetQuizVisibility`）

```typescript
const PRO_VISIBILITY: QuizVisibility[] = ['private', 'followers'];

export async function assertCanSetQuizVisibility(
  uid: string,
  nextVisibility: QuizVisibility,
  prevVisibility?: QuizVisibility
): Promise<void> {
  if (!PRO_VISIBILITY.includes(nextVisibility)) return;
  const entitlements = await resolveUserEntitlements(uid);
  if (canAccessProVisibility(entitlements)) return; // pro/premium active OR moderator exempt
  // 既存 private/followers の維持（同一値への no-op 更新）は許可
  if (prevVisibility === nextVisibility) return;
  throw new ProRequiredForVisibilityError('pro-required-for-visibility');
}
```

- **モデレーター免除**: `canAccessAiAuthoring` と同型 — `moderationTier` が `moderator` / `senior_moderator` なら Pro なし可（design 確定）。
- **ダウングレード**: Webhook は visibility を触らない。無料ユーザーが `public → private|followers` を試みたときのみ 403。

#### 3.4 サービス層変更（`src/services/quiz.ts`）

| 関数                                                                                           | 変更                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `createQuiz`                                                                                   | `visibility` 引数受け取り → `assertCanSetQuizVisibility` → 永続化                                                                            |
| `updateQuiz`                                                                                   | 同上。`prev.visibility` と `next.visibility` を比較                                                                                          |
| `getLatestQuizzes*` / `getPopular*` / `getTrending*` / `getQuizzesByGenre` / `getQuizzesByTag` | `where('visibility','==','public')` 追加（未バックフィル doc は migration またはクライアント後段フィルタ — **正本: バックフィル + クエリ**） |
| `searchQuizzes` / `materializeSearchQuizzes`                                                   | published + public のみ                                                                                                                      |
| `getFollowedTimelinePage`                                                                      | published + (`public` OR `followers`) + authorId in following                                                                                |
| `getQuizzesByAuthor(authorId, false)`                                                          | published + **public** のみ                                                                                                                  |
| `getQuizzesByAuthor(authorId, true)`                                                           | 作者本人 API — 全 status/visibility（ダッシュボード用）                                                                                      |

**インデックス例**（`firestore.indexes.json`）:

- `status ASC, visibility ASC, createdAt DESC`
- `status ASC, visibility ASC, bookmarksCount DESC`（トレンド）
- 既存 index に `visibility` フィールドを追加する形で設計時に diff 確定

#### 3.5 Firestore Rules（`firestore.rules`）

```javascript
function quizVisibility() {
  return !('visibility' in resource.data) || resource.data.visibility == 'public'
    ? 'public'
    : resource.data.visibility;
}

function canReadQuiz() {
  return resource == null
    || quizVisibility() == 'public'
    || (isAuthenticated() && resource.data.authorId == request.auth.uid)
    || isSeniorModeratorOrAdmin()
    || (quizVisibility() == 'followers'
        && isAuthenticated()
        && exists(/databases/$(database)/documents/follows/$(request.auth.uid + '_' + resource.data.authorId)))
    || (resource.data.status == 'suspended' && ...); // 既存 suspended 規則と合成
}
```

- `private` + `published`: 作者・mod のみ（上記 `authorId` / mod 分岐）。
- **create/update**: クライアント直 write 経路がある場合、`visibility in ['public','private','followers']` 検証。Pro ゲートは **サーバー API 正本**（Rules だけでは tier 検証困難 — Admin SDK / API route 経由保存を正とする既存パターン踏襲）。

#### 3.6 隣接サービス

| モジュール                                     | 変更                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/bookmark-validation.ts`               | `canViewQuiz` 相当チェック（published + 閲覧可）                        |
| `src/lib/my-quiz-pool.ts`                      | ブックマークソース収集時に閲覧可クイズのみ（自作は従来どおり全 status） |
| `src/app/api/quiz/quick-press-stream/route.ts` | `assertCanViewQuiz`                                                     |
| attempt 保存 API                               | プレイ対象クイズの閲覧可検証                                            |

#### 3.7 マイグレーション（`scripts/migrate-quiz-visibility-public.mjs`）

- 全 `quizzes` where `status == 'published'` and `visibility` 未設定 → `visibility: 'public'` バッチ更新
- `--dry-run` 対応
- ステージング検証後本番

### 4. File Structure Plan（Phase 27）

| ファイル                                                              | 操作    | 責務                                 |
| --------------------------------------------------------------------- | ------- | ------------------------------------ |
| `src/types/index.ts`                                                  | Modify  | `QuizVisibility`, `Quiz.visibility`  |
| `src/lib/quiz-access.ts`                                              | **New** | resolve/canView/assertSet/assertView |
| `src/services/quiz.ts`                                                | Modify  | CRUD ゲート、一覧クエリ              |
| `src/services/entitlement.ts` または `src/lib/pricing-entitlement.ts` | Modify  | `canAccessProVisibility()`           |
| `src/lib/bookmark-validation.ts`                                      | Modify  | 閲覧規則                             |
| `src/lib/my-quiz-pool.ts`                                             | Modify  | ブックマークソース filter            |
| `src/app/api/quiz/quick-press-stream/route.ts`                        | Modify  | access gate                          |
| `firestore.rules`                                                     | Modify  | visibility read                      |
| `firestore.indexes.json`                                              | Modify  | 複合 index                           |
| `scripts/migrate-quiz-visibility-public.mjs`                          | **New** | バックフィル                         |
| `tests/lib/quiz-access.test.ts`                                       | **New** | 閲覧・Pro ゲート                     |
| `tests/services/quiz-visibility.test.ts`                              | **New** | CRUD・一覧 filter                    |

### 5. Requirements Traceability（Phase 27）

| Req         | Summary            | Component                                   |
| ----------- | ------------------ | ------------------------------------------- |
| 27.1–27.4   | 型・既定値         | `types`, `resolveQuizVisibility`            |
| 27.5–27.10  | 閲覧規則           | `quiz-access.ts`, API gates                 |
| 27.11–27.15 | Pro 設定ゲート     | `assertCanSetQuizVisibility`, create/update |
| 27.16–27.19 | 一覧・TL           | `quiz.ts` queries                           |
| 27.20–27.22 | BM・カスタムクイズ | bookmark-validation, my-quiz-pool           |
| 27.23–27.25 | Rules・migration   | rules, indexes, script                      |
| 27.26–27.29 | 境界 Out           | 隣接 UI                                     |

### 6. Testing Strategy（Phase 27）

| 種別            | 検証                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| **Unit**        | `canViewQuiz` — public/private/followers × author/follower/stranger/draft               |
| **Unit**        | `assertCanSetQuizVisibility` — Pro あり/なし、ダウングレード後維持、public→private 拒否 |
| **Unit**        | 一覧 API — private/followers が探索結果に含まれない                                     |
| **Unit**        | フォロー TL — followers クイズがフォロワー向けに含まれる                                |
| **Integration** | migration dry-run 件数                                                                  |
| **Regression**  | 既存 published クイズ（visibility なし）が public 扱いでフィードに残る                  |

**Effort**: **M**（2–3日、UI スペックは Core 完了後）

**Document Status（Phase 27 設計）**: 本節に反映。

---

## Phase 28: クイズプレイ解答詳細トラッキングと二重検証（Core）

### 1. Overview

Phase 28 は、クイズプレイ時の詳細な回答データ（解答秒数、正誤、ヒント使用履歴、選択順、回答変更有無など）を `QuestionAnswerDetail` オブジェクトとして収集し、試行完了時に `attempts` ドキュメントに保存・蓄積する設計仕様である。また、不正なクライアント送信やデータの改ざんを防ぐため、`saveAttempt` 時にサーバーサイドで詳細レコードと全体のスコア・問題数・クイズ内の問題構成に矛盾がないかを二重検証する。オフラインプレイ時のデータは一時退避し、オンライン復旧時に `syncPendingAttempts` 経由でバッチ同期する。

### 2. Boundary Commitments（Phase 28）

| Owns                                                              | Out                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `QuestionAnswerDetail` 型・`Attempt.questionAnswerDetails` 型定義 | クイズプレイ中のタイマー測定・ヒント閲覧・選択肢変更検知 UI フック（lifecycle UI） |
| `saveAttempt` における解答詳細データのサーバー二重検証            | BigQuery への自動データ同期設定（Firebase Extension 管理）                         |
| `syncPendingAttempts` API / 未同期 attempt バッチ処理             | BigQuery 上のデータ展開ビュー（BigQuery ビュー SQL 定義）                          |

**Allowed dependencies**: `attempts` コレクション、`quizzes` コレクション、および `saveAttempt` トランザクション処理。

**Revalidation triggers**: `QuestionAnswerDetail` のスキーマ定義の変更、`saveAttempt` バリデーションエラー条件の変更、または `syncPendingAttempts` バッチ契約の変更。

### 3. Architecture & Data Models

#### 3.1 型定義 (`src/types/index.ts`)

```typescript
export interface QuestionAnswerDetail {
  questionId: string;
  questionType: 'true-false' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking';
  isCorrect: boolean;
  elapsedSeconds: number;                // 小数点を含む解答経過時間（秒）
  hintsUsedCount: number;                // 使用したヒント数

  // 1. 選択式・真偽値クイズ用 (multiple-choice, true-false)
  selectedChoiceId?: string | null;      // 選択した選択肢ID
  choicesOrder?: string[] | null;        // 提示された選択肢IDのシャッフル順
  choicesInteractionsCount?: number;     // 決定までに選択肢をクリック・変更した回数

  // 2. 記述式・短答・早押しクイズ用 (text-input, quick-press, association)
  userAnswer?: string | null;            // 入力された回答文字列
  quickPressSeconds?: number | null;     // 早押しボタンを押すまでの経過時間

  // 3. 並び替えクイズ用 (sorting)
  initialItemOrder?: string[] | null;    // 提示時の初期アイテム順
  finalItemOrder?: string[] | null;      // 最終アイテム順

  // 4. 水平思考クイズ用 (lateral-thinking)
  aiTurnCount?: number | null;           // 質問ターン数
  truthSummary?: string | null;          // 真相解答の最終テキスト
  lateralPlayEndedStatus?: 'passed' | 'gave_up' | null; // 合格/リタイアのステータス
  answerChanged?: boolean;               // 回答変更有無
}

export interface Attempt {
  // ...既存フィールド
  questionAnswerDetails?: QuestionAnswerDetail[]; // 各問題ごとの詳細な解答行動データ（新規追加）
}
```

#### 3.2 サーバーサイド二重検証 (`src/services/attempt.ts`)

`saveAttempt` API は、クライアントから送信されたデータをトランザクションで書き込む前に、サーバーサイドで以下の整合性を検証し、不整合があればエラー（書き込み拒否）とする。

```typescript
// 整合性検証 (double-validation)
if (attemptData.questionAnswerDetails && attemptData.questionAnswerDetails.length > 0) {
  const details = attemptData.questionAnswerDetails;
  
  // 1. 詳細データの件数が全体の総問題数と一致しているか
  if (details.length !== attemptData.totalQuestions) {
    throw new Error(`解答詳細の件数が不整合です。期待される問題数: ${attemptData.totalQuestions}, 送信された詳細件数: ${details.length}`);
  }
  
  // 2. 詳細データ内の正解数（isCorrect == true）が送信されたスコア（score）と一致しているか
  const detailsCorrectCount = details.filter((d) => d.isCorrect).length;
  if (detailsCorrectCount !== attemptData.score) {
    throw new Error(`解答詳細の正解数 (${detailsCorrectCount}) が送信されたスコア (${attemptData.score}) と一致しません`);
  }
  
  // 3. 詳細データ内のすべての questionId が、対象クイズの questionIds に実在しているか
  for (const detail of details) {
    if (!quizQuestionIds.has(detail.questionId)) {
      throw new Error(`該当クイズに存在しない不正な問題IDが解答詳細に含まれています: ${detail.questionId}`);
    }
  }
}
```

#### 3.3 オフラインキューおよびバッチ同期

オフライン時に完了した attempt データは、`QuestionAnswerDetail[]` を含んだ状態で `localStorage` の `PendingSyncAttempt` 配列にキューイングされる。オンライン復旧時、以下の同期関数が呼び出される。

```typescript
export async function syncPendingAttempts(): Promise<number> {
  const pending = getPendingSyncAttempts();
  if (pending.length === 0) return 0;

  let successCount = 0;
  for (const pendingAttempt of pending) {
    try {
      const attempt = pendingSyncToAttempt(pendingAttempt);
      await saveAttempt(attempt); // トランザクション版を呼び出して同期・検証
      clearPendingSyncAttempt(pendingAttempt.localId);
      successCount++;
    } catch (e) {
      console.warn(`[AttemptService] 未同期データの同期に失敗 (localId=${pendingAttempt.localId}):`, e);
    }
  }
  return successCount;
}
```

### 4. File Structure Plan（Phase 28）

| ファイル                          | 操作   | 責務                                                                                         |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| `src/types/index.ts`              | Modify | `QuestionAnswerDetail` 型定義の追加、`Attempt` スキーマ拡張                                  |
| `src/services/attempt.ts`         | Modify | `saveAttempt` トランザクション内での解答詳細二重検証、`syncPendingAttempts` バッチ同期の実装 |
| `src/services/attempt-session.ts` | Modify | クライアント側プレイセッション型定義への `questionAnswerDetails` 拡張                        |

### 5. Requirements Traceability（Phase 28）

| Req  | Summary                     | Component                              |
| ---- | --------------------------- | -------------------------------------- |
| 28.1 | `QuestionAnswerDetail` 保存 | `Attempt` スキーマ定義, `saveAttempt`  |
| 28.2 | サーバー二重検証            | `saveAttempt` 内バリデーションロジック |
| 28.3 | オフラインバッチ同期        | `syncPendingAttempts`                  |

### 6. Testing Strategy（Phase 28）

| 種別           | 検証                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Unit**       | `saveAttempt` 二重検証 — 詳細件数不整合、正誤数不整合、存在しない問題IDの混入で例外がスローされること                    |
| **Unit**       | `syncPendingAttempts` — オンライン復帰時のバッチ同期で、未同期詳細データが正常に永続化され、ローカルキューが空になること |
| **Regression** | `questionAnswerDetails` が空の legacy 試行に対しても `saveAttempt` がエラーなしで成功すること                            |

**Effort**: **S** (既に実装済みのコードの同期)

**Document Status（Phase 28 設計）**: 本節に反映。

---

## Phase 30: プロフィールSNSリンク登録・表示機能（2026-06-21 設計詳細）

### 1. 概要と目標
本フェーズでは、プロフィール画面および編集画面でのSNSリンク（YouTube, X, Instagram, TikTok）機能のデータモデル、検証、およびStorageロゴ取得をコア層に実装します。

### 2. データモデル設計
`User` インターフェース（`src/types/index.ts`）に `snsLinks` オブジェクトを追加します。

```typescript
export interface User {
  // 既存フィールド...
  snsLinks?: {
    youtube?: string;
    x?: string;
    instagram?: string;
    tiktok?: string;
  };
}
```

### 3. バリデーション設計
`src/services/user.ts` にて、`UpdateProfileData` 型に `snsLinks` を追加し、`validateProfileData` 関数にドメインと形式の検証を追加します。

- **URL形式検証**: 各値が存在する場合、`URL` 形式に合致することを検証します。
- **ドメイン検証規則**:
  - `youtube`: `youtube.com` または `youtu.be` に合致すること。
  - `x`: `x.com` または `twitter.com` に合致すること。
  - `instagram`: `instagram.com` に合致すること。
  - `tiktok`: `tiktok.com` に合致すること。
- **検証エラー**: `ProfileValidationError` インターフェースの `field` に `snsLinks.youtube` などのキーを許容し、エラーメッセージを返却します。

### 4. Storageロゴ取得ヘルパー設計
`src/services/storage.ts` に、各SNSのロゴ画像のダウンロードURLを高速に取得するための `getSnsLogoUrl` ヘルパーを追加します。

- **インメモリキャッシュ**: `getDownloadURL` のAPI呼び出しによる遅延を防ぐため、一度取得したURLをインメモリキャッシュ（`snsLogoCache: Record<string, string>`）に保持し、2回目以降はキャッシュから即時に返却します。
- **Storageパス**:
  - `youtube` -> `assets/logos/youtube.png`
  - `x` -> `assets/logos/x.png`
  - `instagram` -> `assets/logos/instagram.png`
  - `tiktok` -> `assets/logos/tiktok.png`

### 5. システムフロー

```mermaid
sequenceDiagram
    autonumber
    participant UI as profile-edit-client
    participant API as updateUserProfile / updateProfile
    participant Val as validateProfileData
    participant DB as Firestore (users)

    UI->>API: updateProfile(uid, { displayName, bio, snsLinks })
    API->>Val: validateProfileData({ displayName, bio, snsLinks })
    alt バリデーション失敗 (形式またはドメイン不一致)
        Val-->>API: ProfileValidationError[]
        API-->>UI: エラー返却・更新中断
    else バリデーション成功
        Val-->>API: エラーなし
        API->>DB: userドキュメント更新 (snsLinks オブジェクトをセット)
        DB-->>API: 成功
        API-->>UI: 完了
    end
```

```mermaid
sequenceDiagram
    autonumber
    participant UI as profile-client
    participant Svc as storage.ts (getSnsLogoUrl)
    participant Cache as snsLogoCache
    participant Store as Firebase Storage

    UI->>Svc: getSnsLogoUrl('youtube')
    Svc->>Cache: キャッシュ存在確認
    alt キャッシュあり
        Cache-->>Svc: url
        Svc-->>UI: url
    else キャッシュなし
        Svc->>Store: getDownloadURL(ref(storage, 'assets/logos/youtube.png'))
        Store-->>Svc: url
        Svc->>Cache: キャッシュに保存
        Svc-->>UI: url
    end
```

### 6. File Structure Plan（Phase 30）

| ファイル                  | 操作   | 責務                                                                                                |
| ------------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `src/types/index.ts`      | Modify | `User` インターフェースへの `snsLinks` オブジェクト定義の追加                                       |
| `src/services/user.ts`    | Modify | `UpdateProfileData` の拡張、`validateProfileData` でのドメイン検証、および `updateProfile` への統合 |
| `src/services/storage.ts` | Modify | `getSnsLogoUrl` ヘルパー（インメモリキャッシュ付き）の追加                                          |

### 7. Requirements Traceability（Phase 30）

| Req  | Summary                   | Component                                               |
| ---- | ------------------------- | ------------------------------------------------------- |
| 1.7  | SNSリンク正規ドメイン検証 | `validateProfileData` 内ドメイン正規表現チェック        |
| 1.8  | バリデーションエラー処理  | `validateProfileData` および `updateProfile` エラー返却 |
| 1.9  | `snsLinks` マップ保存     | `updateProfile` トランザクション / Firestore保存        |
| 1.10 | StorageロゴURL取得        | `storage.ts` の `getSnsLogoUrl`                         |

### 8. Testing Strategy（Phase 30）

| 種別     | 検証                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit** | `validateProfileData` — 正規ドメイン（youtube.com, x.com, twitter.com, instagram.com, tiktok.com）のURLが正しくパスすること                       |
| **Unit** | `validateProfileData` — 不正なドメインのURL（例: google.com, x.com.attacker.com）や、非URL形式が適切に弾かれ、`ProfileValidationError` を返すこと |
| **Unit** | `getSnsLogoUrl` — 指定されたSNS名に対して、Storageアセットパス（assets/logos/）の正しい `getDownloadURL` を呼び出すこと                           |
| **Unit** | `getSnsLogoUrl` — 2回目以降の呼び出しにおいて、`getDownloadURL` APIを呼び出すことなくキャッシュから同一URLを即時返却すること                      |

**Effort**: **S** (既に十分に型やサービス層が整備されている既存コンポーネントへの小規模な機能追加)
**Risk**: **Low** (既存フローへの影響はなく、純粋な追加と入力バリデーションで完結するため)

**Document Status（Phase 30 設計）**: 本節に反映。

## Phase 31: 複合形式における許容問題形式の拡張（2026-07 設計詳細）

### 1. 概要と目標
本フェーズでは、クイズ全体の出題形式が複合（`mixed`）の際、許可される問題タイプを拡張し、「連想（`association`）」形式を組み合わせ可能とします。また、AI一括作問 API においても連想問題を複合形式の生成候補に含めるための設計変更を行います。

### 2. データ検証と定数設計
* `src/services/ai-authoring-types.ts`
  * `MIXED_ALLOWED_QUESTION_TYPES` 定数配列に `'association'` を追加します。
* `src/lib/quiz-format.ts`
  * `resolveQuizFormat` 内の `MIXED_ALLOWED_QUESTION_TYPES` Setオブジェクトに `'association'` を追加します。
* `src/services/quiz-validation.ts`
  * `validateQuizForPublish` における `quiz.format === 'mixed'` の判定で許可される問題タイプ配列 `allowedTypes` に `'association'` を追加します。

### 3. AI作問スキーマ設計
* `src/app/api/quiz/ai-generate-questions/route.ts`
  * `buildQuestionItemSchema` 内で `format === 'mixed'` の条件分岐において、`anyOf` 配列に `schemas['association']` を追加します。これにより、Gemini API に渡す JSON スキーマで連想問題が複合形式の生成ターゲットに含まれるようになります。

### 4. File Structure Plan（Phase 31）

| ファイル                                          | 操作   | 責務                                                                                  |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `src/services/ai-authoring-types.ts`              | Modify | `MIXED_ALLOWED_QUESTION_TYPES` に `'association'` を追加                              |
| `src/lib/quiz-format.ts`                          | Modify | `MIXED_ALLOWED_QUESTION_TYPES` に `'association'` を追加                              |
| `src/services/quiz-validation.ts`                 | Modify | `validateQuizForPublish` 内の `mixed` 判定用 `allowedTypes` に `'association'` を追加 |
| `src/app/api/quiz/ai-generate-questions/route.ts` | Modify | `buildQuestionItemSchema` で `format === 'mixed'` の際に `association` スキーマを追加 |

### 5. Requirements Traceability（Phase 31）

| Req  | Summary                          | Component                                                             |
| ---- | -------------------------------- | --------------------------------------------------------------------- |
| 31.1 | 複合形式での「連想」問題許可     | `validateQuizForPublish` 内の `allowedTypes` に `association` を追加  |
| 31.2 | 複合形式での早押し・ウミガメ制限 | `validateQuizForPublish` の既存制限の維持 (早押し/ウミガメは含めない) |
| 31.3 | AI作問での「連想」スキーマ追加   | `buildQuestionItemSchema` の `anyOf` に `association` スキーマを追加  |

### 6. Testing Strategy（Phase 31）

| 種別     | 検証                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Unit** | `validateQuizForPublish` — 複合形式（`mixed`）のクイズに `association` 問題が含まれている場合、エラーを返さず通過すること                  |
| **Unit** | `validateQuizForPublish` — 複合形式のクイズに `quick-press` または `lateral-thinking` が含まれる場合、適切にバリデーションエラーを返すこと |
| **Unit** | `mapAiJsonToQuestions` — `format: 'mixed'` にて、AIが生成した連想問題が正常にバリデーションを通過してマッピングされること                  |

**Effort**: **XS** (既存の定数やスキーマ配列への要素追加と検証式の書き換えのみ)
**Risk**: **Low** (既存の判定文の配列拡張であり、副作用は極めて低い)

**Document Status（Phase 31 設計）**: 本節に反映。

## Phase 39: NGワードマスタ参照によるコンテンツ検証への移行（2026-07 設計詳細）

### 1. 概要と目標
`quiz-validation.ts` にハードコードされていた `NG_WORD_LIST` 配列を廃止し、`supabase-governance` が所有する `ng_words` マスタ（要件9）を参照する形へ移行する。`quiz-validation.ts` は「Supabase に依存しない純粋関数群（テスト容易性のため分離）」という既存の設計意図（ファイル冒頭コメント）を維持するため、DBアクセスをサービス層に切り出し、`containsNgWord`／`validateQuizForPublish` は NGワード一覧を引数として受け取る純粋関数のまま変更しない。

### 2. アーキテクチャ決定
- **境界の維持**: `quiz-validation.ts` は引き続き Supabase 非依存の純粋関数群とし、NGワード一覧の取得は新規サービス `src/services/ng-words.ts` に切り出す。呼び出し元（`quiz.ts`／`quiz-editor.tsx`）が事前に取得し、引数として渡す。
- **キャッシュ戦略の不採用**: 要件32にリアルタイム性能要求はなく、公開処理1回につき `ng_words` を1回取得するシンプルな都度クエリ方式を採用する（Simplification 原則。キャッシュ層は要件が生じた場合の将来検討事項とし、本フェーズでは導入しない）。
- **フェイルクローズ**: `listActiveNgWords()` が失敗した場合は例外をそのまま呼び出し元へ伝播させ、`saveQuiz('published')` はエラーで中断する。未検証のまま公開を許可しない（要件32.4）。

### 3. Data Contracts

```typescript
// src/services/ng-words.ts
export interface NgWordsService {
  /** is_active = true の NGワード一覧を取得する。失敗時は例外をスローする */
  listActiveNgWords(): Promise<string[]>;
}
```

```typescript
// src/services/quiz-validation.ts（シグネチャ変更）
export function containsNgWord(text: string, ngWords: readonly string[]): boolean;
export function validateQuizForPublish(
  quiz: Quiz,
  ngWords: readonly string[]
): QuizPublishValidationError[];
```
- `NG_WORD_LIST` 定数は削除する。
- `containsNgWord`／`validateQuizForPublish` の呼び出し元は全て `ngWords` 引数を渡すよう更新する（`validateGeneratedQuestions` はNGワード判定を行わないため対象外）。

### 4. System Flow

```mermaid
sequenceDiagram
    participant Editor as quiz-editor.tsx
    participant Svc as quiz.ts
    participant NgSvc as ng-words.ts
    participant DB as Supabase (ng_words)
    participant Val as quiz-validation.ts

    Editor->>Svc: saveQuiz(quiz, 'published')
    Svc->>NgSvc: listActiveNgWords()
    NgSvc->>DB: select word where is_active = true
    alt 取得成功
        DB-->>NgSvc: NGワード配列
        NgSvc-->>Svc: ngWords
        Svc->>Val: validateQuizForPublish(quiz, ngWords)
        alt 禁止語を含む
            Val-->>Svc: ngWordエラー
            Svc-->>Editor: 公開拒否（バリデーションエラー）
        else 禁止語なし
            Val-->>Svc: エラーなし
            Svc-->>Editor: 公開成功
        end
    else 取得失敗
        NgSvc-->>Svc: 例外スロー
        Svc-->>Editor: 公開拒否（サーバーエラー、未検証のまま公開しない）
    end
```

### 5. File Structure Plan（Phase 39）

| ファイル                              | 操作   | 責務                                                                                                                              |
| ------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/ng-words.ts`            | New    | `ng_words` マスタから `is_active = true` の語句一覧を取得する読み取り専用サービス                                                 |
| `src/services/quiz-validation.ts`     | Modify | `NG_WORD_LIST` 定数を削除。`containsNgWord`／`validateQuizForPublish` を `ngWords` 引数受け取りに変更                             |
| `src/services/quiz.ts`                | Modify | クイズ公開処理内で `listActiveNgWords()` を呼び出し `validateQuizForPublish` へ渡す。取得失敗時は公開処理をエラーで中断           |
| `src/components/quiz/quiz-editor.tsx` | Modify | クライアント側事前検証のため NGワード一覧取得を追加。取得失敗時は事前チェックをスキップし、最終防衛線であるサーバー側検証に委ねる |

### 6. Requirements Traceability（Phase 39）

| Req  | Summary                                | Component                                                  |
| ---- | -------------------------------------- | ---------------------------------------------------------- |
| 32.1 | NGワードマスタ参照による禁止語チェック | `ng-words.ts`, `quiz-validation.ts`                        |
| 32.2 | 禁止語検出時の公開拒否                 | `quiz-validation.ts`                                       |
| 32.3 | マスタ更新内容の以降の検証への反映     | `ng-words.ts`（キャッシュなし都度取得により自然に満たす）  |
| 32.4 | マスタ取得失敗時の安全側処理           | `quiz.ts`, `ng-words.ts`                                   |
| 32.5 | マスタ自体のCRUDは対象外               | （`supabase-governance` が担当、[[Out of Boundary]] 参照） |

### 7. Testing Strategy（Phase 39）

| 種別        | 検証                                                                                                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit        | `containsNgWord(text, ngWords)` — 渡された `ngWords` 配列に応じて判定結果が変わり、配列に存在しない語句では検出されないこと                                                          |
| Unit        | `validateQuizForPublish(quiz, ngWords)` — `ngWords` 内の語句をタイトル・説明・問題文・解説のいずれかに含む場合に `field: 'ngWord'` のエラーが返ること                                |
| Integration | `quiz.ts` — `listActiveNgWords()` が例外をスローした場合、`saveQuiz(quiz, 'published')` がエラーをスローしクイズが公開されないこと（`@/lib/supabase/client` のチェーンモックで検証） |
| Integration | `quiz.ts` — `ng_words` に新規登録された語句が、次回の `saveQuiz` 呼び出しから検証対象になること（モックの返り値切り替えで検証）                                                      |

**Effort**: **S**（既存の純粋関数シグネチャ変更 + 新規読み取りサービス1つ + 呼び出し元2箇所の更新）
**Risk**: **Low**（型シグネチャの追加引数化であり、既存の判定ロジック自体は変更しない）

**Document Status（Phase 39 設計）**: 本節に反映。

## Phase 41: 有料プランの多層化と tier 識別子リネーム（2026-07-13）

### Overview（本フェーズ）
既存の `pro` tier を `creator` へ全面リネーム（内部識別子・DB データ・表示名すべて、既存契約者は無停止で移行）し、Free と Creator の中間価格帯を持つ新有料 tier `player`（広告非表示・ウミガメのスープ AI 質問無制限のみを付与し、クイズ限定公開・AI 作問アシスタントは付与しない）を追加する。判定ロジックを「有料か無料か」の単一フラグから tier ごとの capability 集合モデルへ一般化し、将来の tier 追加（`premium` の正式販売等）が既存ゲート箇所の個別修正なしで行えるようにする。

### Boundary Commitments（Phase 41）

**This Spec Owns**
- 契約 tier モデル（`free` / `player` / `creator` / `premium`）の定義と、tier→capability マッピングの単一正本。
- `player` / `creator` それぞれの購読開始（Checkout）・契約管理（Portal）API、および両 tier の月額・年額価格を返す価格取得 API。
- 既存 `pro` 契約者データの `creator` への無停止移行（DB データリネーム）。
- Webhook 経由のエンタイトルメント同期における tier 解決ロジック。

**Out of Boundary**
- `player` / `creator` の具体的な月額・年額金額の決定、および Stripe Dashboard 上の Product/Price 作成そのもの（運用設定、要件33.17）。
- `/pricing` 画面のプランカード表示・並び順・購読 CTA（`quizetika-billing-subscription-ui` が担当）。
- AI 作問アシスタントのアクセス制御 UI・upsell 文言（`quizetika-ai-quiz-authoring` が担当）。
- クイズ公開範囲設定 UI・警告文言（`quizetika-creator-dash-ui` / `quizetika-ui-editor` が担当）。
- `premium` tier の有料販売および固有特典の定義（拡張点の予約のみ、要件33.19）。

**Allowed Dependencies**
- Stripe（Checkout Sessions API, Billing Portal API, Webhook）。既存 Phase 13 実装のクライアント（`getStripeClient()`）をそのまま再利用する。
- Supabase（`users` テーブル、Admin クライアント）。既存 `subscription_tier`（`TEXT`）列をスキーマ変更なしで利用する。

**Revalidation Triggers**
- `SubscriptionCapability` の集合定義（tier→capability マッピング）が変更された場合、`quizetika-ai-quiz-authoring` と `quizetika-creator-dash-ui` は自身のゲート判定が引き続き正しいか再確認が必要。
- `/api/billing/prices` または `/api/billing/checkout-session` のリクエスト/レスポンス契約が変更された場合、`quizetika-billing-subscription-ui` は再統合が必要。
- tier の追加・削除（列挙自体の変更）が発生した場合、全下流仕様（4スペック）は自身の tier 前提を再確認する必要がある。

### Architecture Pattern（Phase 41）

**既存アーキテクチャ分析**: Phase 13 で確立した「Server-authoritative entitlements + Stripe-hosted Checkout/Portal」パターンを維持する。変更の主眼は tier 判定ロジックの一般化であり、Checkout/Portal/Webhook の基本フローは Phase 13 のシーケンスと同一のまま、tier パラメータが追加される。

```mermaid
graph TB
    Plans as SubscriptionPlans
    Ent as EntitlementShared
    QuizAccess as QuizAccessGate
    AiAuthoring as AiAuthoringGate
    Ads as UseAdsHook
    CheckoutAPI as CheckoutSessionAPI
    PricesAPI as BillingPricesAPI
    Webhook as StripeWebhookAPI
    DB as SupabaseUsers

    Plans --> Ent
    Ent --> QuizAccess
    Ent --> AiAuthoring
    Ent --> Ads
    CheckoutAPI --> Plans
    PricesAPI --> Plans
    Webhook --> Plans
    Webhook --> DB
    Ent --> DB
```

**Key Decisions**:
- `EntitlementShared`（`entitlement-shared.ts`）を tier→capability 判定の唯一の正本とし、`QuizAccessGate`・`AiAuthoringGate`・`UseAdsHook` は独自の tier 比較を持たずすべてここへ委譲する（現状 `useAds.ts` が独自実装している重複を解消）。
- `SubscriptionPlans`（`subscription-plans.ts`）は tier→Stripe Price ID のマッピングを tier 引数付き関数として提供し、`CheckoutSessionAPI` と `PricesAPI` の両方から参照される単一正本のまま拡張する。

### Technology Stack（Phase 41 追加分）

| Layer   | Choice / Version                                            | Role in Feature                        | Notes                                |
| ------- | ----------------------------------------------------------- | -------------------------------------- | ------------------------------------ |
| Backend | 既存 `stripe` パッケージ（Phase 13 導入）                   | tier 別 Checkout/Portal セッション発行 | 新規依存追加なし                     |
| Data    | Supabase Postgres（既存 `users.subscription_tier` TEXT 列） | tier データの保持                      | スキーマ変更なし、データリネームのみ |

### Data Models（Phase 41）

#### Domain Model: SubscriptionCapability
tier ごとに付与される特典を、単一の「有料/無料」二値ではなく capability の集合として表現する。

```typescript
// src/services/entitlement-shared.ts
export type SubscriptionCapability =
  | 'ad_free'
  | 'unlimited_ai_questions'
  | 'quiz_visibility_control'
  | 'ai_authoring_assist';

const TIER_CAPABILITIES: Readonly<Record<SubscriptionTier, ReadonlySet<SubscriptionCapability>>> = {
  free: new Set(),
  player: new Set(['ad_free', 'unlimited_ai_questions']),
  creator: new Set(['ad_free', 'unlimited_ai_questions', 'quiz_visibility_control', 'ai_authoring_assist']),
  premium: new Set(['ad_free', 'unlimited_ai_questions', 'quiz_visibility_control', 'ai_authoring_assist']),
};
```
- 不変条件: `free` の capability 集合は常に空。tier が有効な有料契約でない場合（`subscriptionStatus` が `active`/`trialing` 以外）は、実際の tier に関わらず `free` の集合として扱う。
- `premium` は現時点で `creator` と同一集合とする（要件33.3 の拡張点予約。将来 `premium` 固有特典が定義された際にこのマップへ追記するのみで済む）。

#### Logical Data Model
- `users.subscription_tier`（`TEXT`）: 既存カラムをそのまま使用。許容値が `'free' | 'player' | 'creator' | 'premium'` に拡張される（アプリケーション層の型で担保、DB 制約は追加しない — 既存も CHECK 制約なしのため一貫性を維持）。
- 既存 `pro` 値を持つ全行を `creator` へ更新する1回限りのデータマイグレーションを実施する（Migration Strategy 参照）。

### Components and Interfaces（Phase 41）

| Component                    | Domain/Layer | Intent                                             | Req Coverage             | Key Dependencies (P0/P1)                           | Contracts  |
| ---------------------------- | ------------ | -------------------------------------------------- | ------------------------ | -------------------------------------------------- | ---------- |
| `EntitlementShared`（改修）  | service      | tier→capability 判定の単一正本                     | 33.1, 33.2, 33.14, 33.15 | なし（純粋関数）                                   | Service    |
| `SubscriptionPlans`（改修）  | lib          | tier 別 Price ID・価格帯マッピング                 | 33.1, 33.4, 33.17        | env Price IDs (P0)                                 | State      |
| `QuizAccessGate`（改修）     | lib          | 限定公開設定の可否判定                             | 33.14, 33.15             | `EntitlementShared` (P0)                           | Service    |
| `AiAuthoringGate`（改修）    | service      | AI作問アシスタント利用可否判定                     | 33.14, 33.15             | `EntitlementShared` (P0)                           | Service    |
| `UseAdsHook`（改修）         | client hook  | 広告表示可否判定                                   | 33.14                    | `EntitlementShared` (P0)                           | Service    |
| `CheckoutSessionAPI`（改修） | API Route    | tier 別購読開始セッション発行                      | 33.8–33.11               | `SubscriptionPlans` (P0), `EntitlementShared` (P0) | API        |
| `PortalSessionAPI`（既存）   | API Route    | 契約管理セッション発行（tier非依存のため変更なし） | 33.13                    | `EntitlementShared` (P0)                           | API        |
| `BillingPricesAPI`（改修）   | API Route    | player・creator 両価格の取得                       | 33.4                     | `SubscriptionPlans` (P0), Stripe (P0)              | API        |
| `StripeWebhookAPI`（改修）   | API Route    | tier 解決・有料判定の一般化                        | 33.5–33.7, 33.12, 33.16  | `SubscriptionPlans` (P0)                           | API, Event |
| tier データマイグレーション  | migration    | 既存 `pro` → `creator` の無停止データ移行          | 33.5–33.7                | Supabase (P0)                                      | Batch      |

#### EntitlementShared

| Field        | Detail                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intent       | ユーザーの契約 tier・状態から capability 集合を解決し、既存の呼び出し側フィールド（`hasPaidEntitlements`, `hasUnlimitedAiQuestions`）に加え新規 `hasCreatorEntitlements` を提供する |
| Requirements | 33.1, 33.2, 33.14, 33.15, 33.16                                                                                                                                                     |

**Dependencies**
- Inbound: `QuizAccessGate`（限定公開ゲート） — P0 / `AiAuthoringGate`（AI作問ゲート） — P0 / `UseAdsHook`（広告表示） — P0 / `resolveUserEntitlements`（サーバー側解決） — P0

**Contracts**: Service [x] / API [ ] / Event [ ] / Batch [ ] / State [ ]

##### Service Interface
```typescript
export interface UserEntitlements {
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  hasPaidEntitlements: boolean;      // 既存: 有料 tier（player/creator/premium）かつ有効契約
  hasUnlimitedAiQuestions: boolean;  // 既存: hasPaidEntitlements || モデレーター免除
  hasCreatorEntitlements: boolean;   // 新規: quiz_visibility_control / ai_authoring_assist の可否
}

export function computeUserEntitlements(fields: EntitlementUserFields): UserEntitlements;
```
- Preconditions: `fields.subscriptionTier` は `SubscriptionTier` 型の値または未設定（未設定は `free` として解釈、既存動作を維持）。
- Postconditions: `hasCreatorEntitlements` は `creator`/`premium` tier かつ有効契約の場合のみ `true`。`player` tier では常に `false`。
- Invariants: `hasPaidEntitlements === true` かつ `hasCreatorEntitlements === true` は `creator`/`premium` でのみ両立し、`player` では `hasPaidEntitlements === true` かつ `hasCreatorEntitlements === false` となる。

**Implementation Notes**
- Integration: `QuizAccessGate.canAccessProVisibility()` と `AiAuthoringGate.canAccessAiAuthoring()` は `hasPaidEntitlements` 参照を `hasCreatorEntitlements` へ置き換える（モデレーター免除は各ゲート側の既存ロジックを維持）。`UseAdsHook` は独自の `subscriptionTier === 'pro'` 判定を廃止し `computeUserEntitlements().hasPaidEntitlements` を参照する。
- Validation: `hasPaidEntitlements` を参照している全箇所を洗い出し、限定公開・AI作問の2箇所のみ `hasCreatorEntitlements` へ置き換えたことをタスク完了条件に含める（他は「広告非表示・AI質問無制限」の意味で `hasPaidEntitlements` のままで正しい）。
- Risks: capability マップの tier 集合定義に誤りがあると全ゲートに波及するため、tier×capability の全組み合わせを単体テストで固定する。

#### SubscriptionPlans

| Field        | Detail                                                  |
| ------------ | ------------------------------------------------------- |
| Intent       | tier 別の Stripe Price ID・特典キーマッピングの単一正本 |
| Requirements | 33.1, 33.4, 33.17                                       |

**Contracts**: Service [x] / API [ ] / Event [ ] / Batch [ ] / State [x]

##### Service Interface
```typescript
export interface PaidTierDefinition {
  tier: 'player' | 'creator' | 'premium';
  displayName: string;
  priceIds: { monthly: string; yearly: string };
  featureKeys: readonly PaidFeatureKey[];
}

export function getPaidTierDefinitions(): readonly PaidTierDefinition[];
export function getPriceIdForInterval(tier: 'player' | 'creator', interval: PriceInterval): string;
export function priceIdToTier(priceId: string): SubscriptionTier | null;
```
- Preconditions: `player`/`creator` それぞれの Stripe Price ID が環境変数（`STRIPE_PRICE_PLAYER_MONTHLY` 等）に設定済みであること。
- Postconditions: `getPriceIdForInterval()` は指定 tier が未定義の場合は例外をスローする（`pro` 決め打ちだった従来動作の tier 引数化）。

**Implementation Notes**
- Integration: `buildPaidTierDefinitions()` に `player` エントリを追加し、既存 `pro` エントリの `tier` フィールド値を `'creator'` に変更する。Stripe 側の環境変数名（`STRIPE_PRICE_CREATOR_*`）はそのまま維持し、`tier` フィールドの値のみを変更する（環境変数の再作成・Stripe Dashboard 変更は不要）。

#### BillingPricesAPI

| Field        | Detail                                                      |
| ------------ | ----------------------------------------------------------- |
| Intent       | player・creator 両 tier の月額・年額価格を1リクエストで返す |
| Requirements | 33.4                                                        |

**Contracts**: Service [ ] / API [x] / Event [ ] / Batch [ ] / State [ ]

##### API Contract
| Method | Endpoint            | Request | Response                                              | Errors |
| ------ | ------------------- | ------- | ----------------------------------------------------- | ------ |
| GET    | /api/billing/prices | なし    | `{ player: PlanPriceQuote, creator: PlanPriceQuote }` | 500    |

```typescript
interface PlanPriceQuote {
  monthly: { amount: number; currency: 'jpy'; label: string };
  yearly: { amount: number; currency: 'jpy'; label: string };
  savingsLabel?: string;
}
```
既存 `ProPricesResult`（単一 tier 形状）は破壊的に変更される。呼び出し側は `quizetika-billing-subscription-ui` のみのため、依存順（本スペック → billing-ui）により同時性を担保する。

#### CheckoutSessionAPI

| Field        | Detail                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| Intent       | 指定 tier・課金間隔で Checkout セッションを発行し、tier 間のダウングレード購読開始を拒否する |
| Requirements | 33.8, 33.9, 33.10, 33.11                                                                     |

**Contracts**: Service [ ] / API [x] / Event [ ] / Batch [ ] / State [ ]

##### API Contract
| Method | Endpoint                      | Request                                                                 | Response                 | Errors                                                                        |
| ------ | ----------------------------- | ----------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| POST   | /api/billing/checkout-session | `{ plan: 'player' \| 'creator'; priceInterval: 'monthly' \| 'yearly' }` | `{ sessionUrl: string }` | 400（`plan`/`priceInterval` 不正）, 401, 403, 409（重複購読・ダウングレード） |

**Implementation Notes**
- Integration: `createCheckoutSession()`（`services/subscription.ts`）に `plan` 引数を追加。既存の `AlreadySubscribedError`（409）に加え、`creator` 契約中に `player` を指定した場合は新規 `DowngradeNotAllowedError`（409）をスローする（要件33.11）。

#### StripeWebhookAPI

| Field        | Detail                                                                  |
| ------------ | ----------------------------------------------------------------------- |
| Intent       | Stripe Price ID から tier を解決し、有効な有料契約を `users` へ同期する |
| Requirements | 33.5, 33.6, 33.7, 33.12, 33.16                                          |

**Contracts**: Service [ ] / API [x] / Event [x] / Batch [ ] / State [ ]

**Implementation Notes**
- Integration: `buildSnapshotFromSubscription()` の有料判定を `mappedTier === 'pro' || mappedTier === 'premium'` から `mappedTier !== 'free'` へ一般化する。これにより tier 追加時にこの箇所の修正が不要になる。
- Validation: 移行後も既存 Stripe Subscription の Price ID は変更されないため、`priceIdToTier()` が `'creator'` を返すよう `subscription-plans.ts` のマッピングを更新すれば Webhook 側の追加改修は不要。

### File Structure Plan（Phase 41）

| ファイル                                                     | 操作   | 責務                                                                                                                                                                  |
| ------------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/entitlement-shared.ts`                         | Modify | `SubscriptionCapability` と tier→capability マップを追加。`computeUserEntitlements()` に `hasCreatorEntitlements` を追加                                              |
| `src/types/subscription.ts`                                  | Modify | `SubscriptionTier` に `'player'` を追加。`UserEntitlements` に `hasCreatorEntitlements: boolean` を追加                                                               |
| `src/lib/subscription-plans.ts`                              | Modify | `player` tier 定義を追加。既存 `pro` エントリの `tier` を `'creator'` に変更。`getPriceIdForInterval()` を tier 引数付きに変更                                        |
| `src/lib/quiz-access.ts`                                     | Modify | `canAccessProVisibility()` の判定を `hasPaidEntitlements` から `hasCreatorEntitlements` へ変更。`ProRequiredForVisibilityError` のメッセージ文言を Creator 表記へ更新 |
| `src/services/ai-authoring-utils.ts`                         | Modify | `canAccessAiAuthoring()` の判定を `hasCreatorEntitlements` ベースへ変更                                                                                               |
| `src/hooks/useAds.ts`                                        | Modify | 独自の tier 文字列比較を廃止し `computeUserEntitlements()` 呼び出しへ置き換え                                                                                         |
| `src/services/billing-prices.ts`                             | Modify | `fetchProPricesFromStripe()` を `fetchPlanPricesFromStripe()` に変更し、player・creator 両方の価格を返す                                                              |
| `src/services/subscription.ts`                               | Modify | `createCheckoutSession()` に `plan` 引数を追加。`DowngradeNotAllowedError` を新規追加                                                                                 |
| `src/app/api/billing/checkout-session/route.ts`              | Modify | リクエストボディから `plan` を検証・伝搬                                                                                                                              |
| `src/app/api/billing/prices/route.ts`                        | Modify | 新レスポンス形状（player/creator）を返す                                                                                                                              |
| `src/services/stripe-webhook.ts`                             | Modify | 有料判定を `mappedTier !== 'free'` に一般化                                                                                                                           |
| `supabase/migrations/20260720000000_billing_tier_rename.sql` | New    | `UPDATE users SET subscription_tier = 'creator' WHERE subscription_tier = 'pro'`                                                                                      |
| `src/lib/pricing-entitlement.ts`                             | Modify | `computeHasPaidEntitlements()` の tier 文字列比較を `'player' \| 'creator' \| 'premium'` に拡張                                                                       |

### Requirements Traceability（Phase 41）

| Requirement | Summary                              | Components                                                             | Interfaces                           | Flows      |
| ----------- | ------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------ | ---------- |
| 33.1–33.4   | tier モデル拡張・価格順序            | `SubscriptionPlans`, `EntitlementShared`                               | —                                    | —          |
| 33.5–33.7   | 既存契約者データ移行                 | migration, `SubscriptionPlans`                                         | —                                    | 移行フロー |
| 33.8–33.13  | 購読開始・契約管理（player/creator） | `CheckoutSessionAPI`, `PortalSessionAPI`                               | `POST /api/billing/checkout-session` | 購読フロー |
| 33.14–33.16 | エンタイトルメント適用               | `EntitlementShared`, `QuizAccessGate`, `AiAuthoringGate`, `UseAdsHook` | —                                    | —          |
| 33.17–33.19 | 境界（UI 外・premium 予約）          | —                                                                      | —                                    | —          |

### Migration Strategy（Phase 41）

```mermaid
flowchart TD
    A[デプロイ: コード変更適用] --> B[migration 実行: pro to creator UPDATE]
    B --> C[検証: subscription_tier = pro の件数が0であることを確認]
    C --> D{0件か}
    D -->|Yes| E[完了]
    D -->|No| F[原因調査: 移行漏れ行の個別確認]
```
- ロールバックトリガー: migration 実行後に `subscription_tier = 'pro'` の行が残存する場合、原因調査を行い再実行する（UPDATE 文自体は冪等）。
- 検証チェックポイント: デプロイ後に `SELECT count(*) FROM users WHERE subscription_tier = 'pro'` が 0 件であることを確認する。

### Testing Strategy（Phase 41）

| 種別        | 検証                                                                                                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `computeUserEntitlements()` — tier×status の全組み合わせ（`free`/`player`/`creator`/`premium` × `active`/`trialing`/その他）で `hasPaidEntitlements`/`hasUnlimitedAiQuestions`/`hasCreatorEntitlements` が仕様通りの値を返すこと |
| Unit        | `canAccessProVisibility()` / `canAccessAiAuthoring()` — `player` tier では `false`、`creator`/`premium` では `true` を返すこと                                                                                                   |
| Unit        | `getPriceIdForInterval('player', 'monthly')` / `getPriceIdForInterval('creator', 'yearly')` — 各 tier の正しい Price ID を返すこと                                                                                               |
| Integration | `POST /api/billing/checkout-session` — `creator` 契約中に `plan: 'player'` を指定すると 409（`DowngradeNotAllowedError`）を返すこと                                                                                              |
| Integration | `StripeWebhookAPI` — Price ID が `player` にマッピングされる Subscription イベント受信時、`users.subscription_tier` が `'player'` に更新されること                                                                               |
| Integration | migration — `subscription_tier = 'pro'` の既存行が `UPDATE` 後に `'creator'` へ変わり、他フィールド（`stripe_subscription_id` 等）が変化しないこと                                                                               |

**Effort**: **M**（既存判定ロジックの一般化 + 新規 tier 追加 + データ移行。新規外部依存なし）
**Risk**: **Medium**（`hasPaidEntitlements` 参照箇所の置き換え漏れが機能ゲートの誤動作に直結するため、全参照箇所の洗い出しが必須）

### 二重課金防止（要件34）

#### Boundary Commitments（要件34 差分）

**This Spec Owns（追加）**
- 購読開始時の外部決済サービス側ライブ状態確認（DBキャッシュのみに依存しない事前チェック）。
- Webhook 受信時の重複サブスクリプション検知・自動解約・返金・監査記録。

**Out of Boundary（追加）**
- 重複解約・返金発生時のユーザー向け通知（メール等、要件34.8）。
- Webhook イベント自体の配信重複対策（既存の `stripe_processed_events` 冪等処理を流用するのみ）。

#### Architecture（要件34）

```mermaid
sequenceDiagram
    participant User
    participant CheckoutAPI as CheckoutSessionAPI
    participant Stripe
    participant Webhook as StripeWebhookAPI
    participant Guard as DuplicateSubscriptionGuard
    participant DB as SupabaseUsers

    User->>CheckoutAPI: POST checkout-session plan interval
    CheckoutAPI->>Stripe: subscriptions.list customer status active
    Stripe-->>CheckoutAPI: 既存有効サブスクリプション一覧
    alt 既存の有効サブスクリプションあり
        CheckoutAPI-->>User: 409 already-subscribed
    else なし
        CheckoutAPI->>Stripe: checkout.sessions.create
        Stripe-->>User: redirect Checkout
    end

    Stripe->>Webhook: customer.subscription.created
    Webhook->>Guard: checkForDuplicates customerId newSubscriptionId
    Guard->>Stripe: subscriptions.list customer status active
    Stripe-->>Guard: 有効サブスクリプション一覧
    alt 2件以上の有効サブスクリプション
        Guard->>Stripe: 最古以外を subscriptions.cancel
        Guard->>Stripe: 解約分の最新請求書を refunds.create
        Guard->>DB: insert billing_duplicate_subscription_incidents
        Guard-->>Webhook: 最古のサブスクリプションIDのみ返す
    else 1件のみ
        Guard-->>Webhook: そのまま返す
    end
    Webhook->>DB: applySubscriptionFromStripe 正のサブスクリプションのみ反映
```

**Key Decisions**:
- 購読開始時のチェックは Stripe の `subscriptions.list`（`status: 'active'`, `customer: id`）をライブ参照する。DB の `subscription_tier` はキャッシュとして扱い、購読開始の可否判定には使わない（要件34.1）。
- Webhook 側の `DuplicateSubscriptionGuard` は「作成日時が最も古いサブスクリプションを正とする」ルールを一貫して適用する。これにより「後から完了した方を自動キャンセル」という運用方針を、同一プランの二重契約・Player/Creator 同時契約の両方に単一ルールで対応できる（要件34.4）。
- 返金は解約対象サブスクリプションの直近の支払い済み Invoice に紐づく PaymentIntent に対して全額 `refunds.create` を実行する（要件34.5）。

#### File Structure Plan（要件34）

| ファイル                                                             | 操作   | 責務                                                                                                                                                                                                                               |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/duplicate-subscription-guard.ts`                       | New    | Stripe 顧客の有効サブスクリプション一覧を取得し、2件以上ある場合に最古以外を解約・返金し、監査レコードを挿入する。正となるサブスクリプションIDを返す                                                                               |
| `src/services/subscription.ts`                                       | Modify | `createCheckoutSession()` で `getOrCreateStripeCustomer()` 後に `stripe.subscriptions.list({ customer, status: 'active' })` を呼び、1件以上あれば `AlreadySubscribedError` をスローする（DB チェックに加えてライブチェックを追加） |
| `src/services/stripe-webhook.ts`                                     | Modify | `handleStripeSubscriptionEvent()` の冒頭で `duplicate-subscription-guard.ts` の `resolveActiveSubscription()` を呼び出し、返された正のサブスクリプションのみを `applySubscriptionFromStripe()` に渡す                              |
| `supabase/migrations/20260721000000_billing_duplicate_incidents.sql` | New    | `billing_duplicate_subscription_incidents` テーブル作成（監査記録用、クライアントアクセス不可）                                                                                                                                    |

#### Data Models（要件34）

```sql
CREATE TABLE billing_duplicate_subscription_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    kept_subscription_id TEXT NOT NULL,
    canceled_subscription_id TEXT NOT NULL,
    refunded_amount INTEGER,
    refund_currency TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE billing_duplicate_subscription_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_duplicate_subscription_incidents_policy
    ON billing_duplicate_subscription_incidents FOR ALL USING (FALSE);
```
- クライアントからの読み書きは Rules で完全遮断し、Admin クライアント経由の書き込みのみを許可する（既存 `admin_logs` と同一パターン）。

#### Components and Interfaces（要件34）

| Component                                       | Domain/Layer | Intent                                             | Req Coverage | Key Dependencies (P0/P1)         | Contracts      |
| ----------------------------------------------- | ------------ | -------------------------------------------------- | ------------ | -------------------------------- | -------------- |
| `DuplicateSubscriptionGuard`                    | service      | 重複サブスクリプションの検知・解約・返金・監査記録 | 34.3–34.7    | Stripe (P0), Supabase Admin (P0) | Service, Batch |
| `CheckoutSessionAPI`（Phase 41 分から追加改修） | API Route    | Stripe ライブ状態を踏まえた重複購読の事前拒否      | 34.1–34.2    | Stripe (P0)                      | API            |

##### DuplicateSubscriptionGuard Service Interface
```typescript
export interface DuplicateSubscriptionResolution {
  keptSubscriptionId: string;
  canceledSubscriptionIds: string[];
}

export async function resolveActiveSubscription(
  customerId: string,
  userId: string
): Promise<DuplicateSubscriptionResolution>;
```
- Preconditions: `customerId` は Stripe 上に存在する Customer の ID。
- Postconditions: 呼び出し後、当該 Customer は Stripe 上で有効なサブスクリプションを最大1件のみ保有する状態になる。重複が解約された場合はその件数分の返金と監査レコード挿入が完了している。
- Invariants: `keptSubscriptionId` は常に `created` タイムスタンプが最も古いサブスクリプション。

**Implementation Notes**
- Integration: `resolveActiveSubscription()` は `handleStripeSubscriptionEvent()` の冒頭、`applySubscriptionFromStripe()` 呼び出し前に実行し、戻り値の `keptSubscriptionId` が現在処理中の `subscription.id` と異なる場合は当該 Webhook イベントの適用をスキップする（既に解約されたサブスクリプションの状態を `users` に反映しないため）。
- Validation: 返金 API 呼び出し失敗時は例外をログに記録し、監査レコードの `refunded_amount` を `NULL` のまま挿入する（解約自体は実行済みとし、返金は運用側の手動フォローに委ねる）。
- Risks: Stripe API のレート制限・一時障害時に `subscriptions.list` が失敗すると重複検知自体がスキップされる — Webhook はリトライ対象の 500 を返し、Stripe の自動リトライに委ねる。

#### Testing Strategy（要件34）

| 種別        | 検証                                                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `resolveActiveSubscription()` — 2件の有効サブスクリプション（作成日時が異なる）を渡した Stripe mock に対し、新しい方が解約・返金され、古い方の ID が返ること                    |
| Unit        | `resolveActiveSubscription()` — 有効サブスクリプションが1件のみの場合、解約・返金 API が一切呼ばれず、その1件の ID がそのまま返ること                                           |
| Integration | `createCheckoutSession()` — DB 上は `free` だが Stripe 上に既に有効なサブスクリプションが存在するケース（DBキャッシュ遅延を模擬）で `AlreadySubscribedError` がスローされること |
| Integration | `handleStripeSubscriptionEvent()` — 重複解約が発生したイベントで `users.subscription_tier` が正のサブスクリプションの tier のみに更新されること                                 |
| Integration | `billing_duplicate_subscription_incidents` — 重複検知時に1レコード挿入され、`kept_subscription_id` / `canceled_subscription_id` が正しく記録されること                          |

**Effort**: **M**（新規サービス1つ、既存 Checkout/Webhook への統合、監査テーブル追加）
**Risk**: **High**（実際の返金処理を伴うため、Stripe API 呼び出し順序・冪等性の誤りが実際の金銭的損失に直結する。テストは Stripe mock による網羅的なシナリオ検証を必須とする）

### Player・Creator 間のプラン変更（要件35）

#### Boundary Commitments（要件35）

**This Spec Owns**
- 既存サブスクリプションのプラン変更 API（`POST /api/billing/change-plan`）。
- Stripe `subscriptions.update()` による同一サブスクリプション内でのプラン切替と比例配分（proration）。

**Out of Boundary**
- プラン変更 CTA・確認ダイアログの UI（`quizetika-billing-subscription-ui` 要件12 が担当）。
- `free` への新規購読・解約フロー（既存の Checkout/Portal がそのまま担当、変更なし）。

**Allowed Dependencies**
- 既存の `EntitlementShared`・`SubscriptionPlans`（tier→Price ID マッピング）をそのまま再利用する。

**Revalidation Triggers**
- プラン変更 API のリクエスト/レスポンス契約が変更された場合、`quizetika-billing-subscription-ui` 要件12 は再統合が必要。

#### Architecture（要件35）

```mermaid
sequenceDiagram
    participant User
    participant UI as BillingUI
    participant ChangePlanAPI
    participant Stripe
    participant Webhook as StripeWebhookAPI
    participant DB as SupabaseUsers

    User->>UI: プラン変更 CTA 実行
    UI->>ChangePlanAPI: POST change-plan targetPlan Bearer
    ChangePlanAPI->>DB: 現在の subscription_tier stripe_subscription_id 取得
    ChangePlanAPI->>Stripe: subscriptions.retrieve 現行サブスクリプション
    ChangePlanAPI->>Stripe: subscriptions.update items price targetPriceId proration_behavior create_prorations
    Stripe-->>ChangePlanAPI: 更新後サブスクリプション
    ChangePlanAPI-->>UI: 200 成功
    Stripe->>Webhook: customer.subscription.updated
    Webhook->>DB: applySubscriptionFromStripe 新tier反映
    UI->>UI: refreshUser で最新プロフィール再取得
```

**Key Decisions**:
- Stripe の同一サブスクリプション `items` を新しい Price ID で `update` する方式を採用し、新規サブスクリプションは作成しない（要件35.1, 35.2）。これにより要件34の重複購読検知の対象外となる（新規サブスクリプション作成を伴わないため）。
- `proration_behavior: 'create_prorations'` を指定し、Stripe 標準の日割り課金・クレジットに従う（要件35.6、ユーザーヒアリングで確定）。
- API 応答は Stripe 側の同期完了を待たず 200 を返し、実際の tier 反映は既存の Webhook（`customer.subscription.updated`）経由で非同期に行う（Phase 13 以来のパターンを踏襲）。UI 側は `refreshUser` で反映を確認する。

#### File Structure Plan（要件35）

| ファイル                                   | 操作   | 責務                                                                                                                                                                          |
| ------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/services/subscription.ts`             | Modify | `changeSubscriptionPlan(uid, targetPlan)` を追加。現行サブスクリプションを取得し `stripe.subscriptions.update()` で Price を切替。同一プラン指定時は `SamePlanError` をスロー |
| `src/app/api/billing/change-plan/route.ts` | New    | `POST /api/billing/change-plan`。Bearer 認証、`targetPlan: 'player' \| 'creator'` を受け取り `changeSubscriptionPlan()` を呼び出す                                            |

#### Components and Interfaces（要件35）

| Component       | Domain/Layer | Intent                            | Req Coverage | Key Dependencies (P0/P1)              | Contracts |
| --------------- | ------------ | --------------------------------- | ------------ | ------------------------------------- | --------- |
| `ChangePlanAPI` | API Route    | Player/Creator 間のプラン変更受付 | 35.1–35.5    | `SubscriptionPlans` (P0), Stripe (P0) | API       |

##### ChangePlanAPI API Contract
| Method | Endpoint                 | Request                                 | Response                                             | Errors                                                                    |
| ------ | ------------------------ | --------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| POST   | /api/billing/change-plan | `{ targetPlan: 'player' \| 'creator' }` | `{ tier: 'player' \| 'creator'; status: 'updated' }` | 400（不正な targetPlan）, 401, 403（有料契約なし）, 409（同一プラン指定） |

**Implementation Notes**
- Integration: `changeSubscriptionPlan()` は `stripe.subscriptions.retrieve()` で現行 `items[0].id` を取得し、`stripe.subscriptions.update(subscriptionId, { items: [{ id: currentItemId, price: targetPriceId }], proration_behavior: 'create_prorations' })` を実行する。
- Validation: `targetPlan` が現在の `subscription_tier` と同一の場合は Stripe 呼び出し前に `SamePlanError`（409）をスローする（要件35.5）。
- Risks: `customer.subscription.updated` の Webhook 反映が遅延する間、UI 上の契約状態が一時的に旧プランのまま表示される — 既存の「反映待ち」UX パターン（Phase 2 由来）を UI 側で踏襲する。

#### Testing Strategy（要件35）

| 種別        | 検証                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `changeSubscriptionPlan()` — `player`→`creator` 指定で Stripe `subscriptions.update` が正しい Price ID・`proration_behavior` で呼ばれること |
| Unit        | `changeSubscriptionPlan()` — 現在の tier と同一の `targetPlan` を指定した場合、Stripe API を呼ばず `SamePlanError` をスローすること         |
| Integration | `POST /api/billing/change-plan` — 有料契約なしユーザーからの呼び出しが 403 を返すこと                                                       |
| Integration | Webhook — `customer.subscription.updated`（Price 変更）受信時に `users.subscription_tier` が新プランへ更新されること                        |

**Effort**: **S**（既存 Stripe クライアント・Webhook 処理の再利用、新規エンドポイント1つ）
**Risk**: **Medium**（Stripe `items` 更新のパラメータ誤りは課金額誤りに直結するため、比例配分パラメータのテストを重点的に行う）

**Document Status（Phase 41 設計）**: 本節に反映。二重課金防止（要件34）およびプラン変更（要件35）を含む。

## Phase 42: 支払い失敗時の状態遷移と失効検知の安全網（2026-07-16）

### Overview（本フェーズ）
現行実装（`buildSnapshotFromSubscription`）は、Stripe から届いた契約イベントの `status` が `active`/`trialing` 以外（`past_due` 等）のとき、契約 tier を即座に `free` へ書き換えている。この結果、支払いが一時的に失敗しただけで DB 上の tier が失われ、Stripe 側で契約が実際には存続しているにもかかわらず UI・サーバー双方が「無契約」として扱う。本フェーズでは、tier とステータスを独立させ、tier は Stripe の実際の契約内容を反映し続け、エンタイトルメントの可否は既存の `computeUserEntitlements`（ステータスベースのゲート、Phase 13/41）にのみ委ねるよう是正する。あわせて、Webhook 通知が何らかの理由で届かなかった場合に備え、Stripe 側の実契約状態とローカル DB の定期突合・是正を行う安全網（1日1回のバッチ処理）を追加する。

### Boundary Commitments（Phase 42）

**This Spec Owns**
- `StripeWebhookAPI`（`buildSnapshotFromSubscription`）における tier とステータスの分離：契約 tier は Price ID から解決される実際の tier を保持し、`free` への書き換えは契約が真に終了した場合（`customer.subscription.deleted` 経由の `clearPaidEntitlements`）に限定する。
- 定期整合性チェック（Stripe 実契約状態とローカル DB の突合・是正・監査記録）とその起動契約（1日1回、日本時間午前4時台）。

**Out of Boundary**
- 支払い失敗中であることをユーザーへ知らせる画面表示・バナー・メール通知（`quizetika-billing-subscription-ui` および運用対応が担当）。
- 定期処理の起動基盤そのもの（スケジューラのプロバイダ選定・設定ファイルは本設計で確定するが、起動契機の運用監視ダッシュボード等は対象外）。
- 支払い失敗が一定期間継続した場合の督促・強制解約ポリシーの新設（Stripe 標準の解約タイミングに従う）。

**Allowed Dependencies**
- 既存 Stripe クライアント（`getStripeClient()`）、`priceIdToTier()`（`subscription-plans.ts`）、`applySubscriptionFromStripe()` / `clearPaidEntitlements()`（`entitlement.ts`）を再利用する。
- ホスティング基盤（Vercel）が提供する Cron 機能を、定期処理の起動契機として利用する。

**Revalidation Triggers**
- `buildSnapshotFromSubscription()` の tier 決定ロジック変更により、契約 tier とエンタイトルメント（`hasPaidEntitlements` 等）が乖離しうる状態（`past_due` 中は tier が `player`/`creator` のまま維持される）が新たに発生する。tier の生値のみを参照して契約中バッジ等を表示している下流 UI（`quizetika-billing-subscription-ui`）は、`hasPaidEntitlements` / `subscriptionStatus` を併用した表示ロジックへの見直しが必要になる可能性がある。
- 定期整合性チェックのリクエスト/レスポンス契約・起動スケジュールの変更。

### Architecture Pattern（Phase 42）

**既存アーキテクチャ分析**: Phase 13 で確立した「Server-authoritative entitlements」パターンを維持する。変更点は (1) Webhook 内の tier 決定ロジックの是正、(2) 定期実行される新規バッチエンドポイントの追加、の2点のみで、Checkout/Portal の既存フローには影響しない。

```mermaid
graph TB
    Cron[Vercel Cron] --> SyncAPI[SyncSubscriptionsCronAPI]
    SyncAPI --> Recon[SubscriptionReconciliationService]
    Recon --> DB[SupabaseUsers]
    Recon --> Stripe[Stripe API]
    Recon --> Audit[BillingReconciliationCorrections]
    Stripe --> Webhook[StripeWebhookAPI]
    Webhook --> Ent[EntitlementShared]
    Webhook --> DB
```

**Key Decisions**:
- `buildSnapshotFromSubscription()` から「非アクティブ状態なら tier を `free` に強制する」分岐を削除し、常に `priceIdToTier()` が解決した tier をそのまま `subscriptionTier` として返す。ステータスは Stripe から届いた値をそのまま記録する。エンタイトルメントの可否判定は既存の `computeUserEntitlements()`（`PAID_ACTIVE_STATUSES = ['active', 'trialing']` によるゲート）にすべて委ねる。これにより Phase 13 以来重複していた「tier 側でも有効性を判定する」ロジックを排除する（要件36.1, 36.2, 36.5）。
- 契約が真に終了する経路（`customer.subscription.deleted`）は既存の `handleStripeSubscriptionEvent` の `canceled` 分岐・`clearPaidEntitlements()` をそのまま維持し、本フェーズでは変更しない（要件36.4）。
- 支払い成功後の復帰は、Stripe が発行する後続の `customer.subscription.updated`（`status: active` 等）が既存の Webhook 経路でそのまま処理されることで実現する。新規の専用ハンドラは設けない（要件36.3）。
- 定期整合性チェックは、既存の手動スクリプト（`scripts/sync-subscriptions.ts`）と同一の判定ロジック（Stripe 上の有効サブスクリプション一覧取得 → 最古の1件を正とする）を `SubscriptionReconciliationService` としてアプリケーションコードへ昇格し、Vercel Cron から日次で自動起動する（要件36.6–36.9）。既存スクリプトは手動の緊急対応用途として残置する。
- Vercel Cron はスケジュールを UTC で解釈するため、日本時間午前4時台の起動は `vercel.json` 上で UTC 19:00（前日）として設定する。

### Technology Stack（Phase 42 追加分）

| Layer                    | Choice / Version                                              | Role in Feature              | Notes                                          |
| ------------------------ | ------------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| Infrastructure / Runtime | Vercel Cron（`vercel.json`）                                  | 定期整合性チェックの日次起動 | 新規依存追加なし（ホスティング基盤の標準機能） |
| Backend                  | 既存 `stripe` パッケージ（Phase 13）                          | 実契約状態の取得             | 新規依存追加なし                               |
| Data                     | Supabase Postgres（既存 `users` テーブル + 新規監査テーブル） | 是正結果の反映・監査記録     | 新規テーブル1件追加                            |

### System Flows（Phase 42）

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant API as SyncSubscriptionsCronAPI
    participant Recon as SubscriptionReconciliationService
    participant DB as SupabaseUsers
    participant Stripe

    Cron->>API: GET 04:00 JST 日次
    API->>API: Authorization Bearer CRON_SECRET 検証
    alt 検証失敗
        API-->>Cron: 401
    else 検証成功
        API->>Recon: reconcileSubscriptions
        loop stripe_customer_id が設定された全ユーザー（ページング）
            Recon->>Stripe: subscriptions.list customer status all
            alt Stripe 呼び出し失敗
                Recon->>Recon: エラーを記録しこのユーザーをスキップ
            else 成功
                Recon->>Recon: ローカル状態と実契約状態を比較
                alt 乖離あり
                    Recon->>DB: applySubscriptionFromStripe または clearPaidEntitlements
                    Recon->>DB: 是正監査レコード挿入
                else 一致
                    Recon->>Recon: 対象外
                end
            end
        end
        Recon-->>API: 処理件数 是正件数 スキップ件数
        API-->>Cron: 200 サマリ
    end
```
- 個々のユーザーに対する Stripe API 呼び出しが失敗した場合は、そのユーザーのみをスキップして次のユーザーの処理を継続する（1件のスキップが安全網全体を止めない）。ユーザー一覧の取得自体が失敗するなど処理全体に影響する致命的エラーの場合のみ、バッチ全体を中断しエラーを記録する。次回の日次実行時には対象を絞らず全件を再評価するため、スキップされたユーザーも翌日以降に再評価される（要件36.10）。

### Data Models（Phase 42）

```sql
CREATE TABLE billing_reconciliation_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    previous_tier TEXT NOT NULL,
    previous_status TEXT,
    corrected_tier TEXT NOT NULL,
    corrected_status TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE billing_reconciliation_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY billing_reconciliation_corrections_policy
    ON billing_reconciliation_corrections FOR ALL USING (FALSE);
```
- クライアントからの読み書きは Rules で完全遮断し、Admin クライアント経由の書き込みのみを許可する（`billing_duplicate_subscription_incidents` と同一パターン、要件36.9）。

### Components and Interfaces（Phase 42）

| Component                                   | Domain/Layer | Intent                                                | Req Coverage            | Key Dependencies (P0/P1)                 | Contracts  |
| ------------------------------------------- | ------------ | ----------------------------------------------------- | ----------------------- | ---------------------------------------- | ---------- |
| `StripeWebhookAPI`（改修）                  | API Route    | tier とステータスを分離して同期する                   | 36.1–36.5               | `SubscriptionPlans` (P0)                 | API, Event |
| `SubscriptionReconciliationService`（新規） | service      | Stripe 実契約状態とローカル状態の突合・是正・監査記録 | 36.6, 36.8, 36.9, 36.10 | Stripe (P0), Supabase Admin (P0)         | Batch      |
| `SyncSubscriptionsCronAPI`（新規）          | API Route    | 定期整合性チェックの起動エンドポイント                | 36.6, 36.7              | `SubscriptionReconciliationService` (P0) | API, Batch |

#### StripeWebhookAPI（改修差分）

| Field        | Detail                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| Intent       | tier を Stripe の実契約に一致させ続け、有効性判定をステータスのみに委ねる |
| Requirements | 36.1, 36.2, 36.4, 36.5                                                    |

**Contracts**: Service [ ] / API [x] / Event [x] / Batch [ ] / State [ ]

**Implementation Notes**
- Integration: `buildSnapshotFromSubscription()` の `subscriptionTier: hasPaid ? mappedTier : 'free'` を `subscriptionTier: mappedTier` に変更し、`hasPaid` 変数とその算出を削除する。`subscriptionStatus` は現行どおり Stripe の `status` をそのまま格納する。
- Validation: `computeUserEntitlements()`（`entitlement-shared.ts`）が `subscriptionStatus` を用いた有効性判定を単独で担っていることを既存ユニットテストで再確認し、tier 生値を直接エンタイトルメント判定に使っている呼び出し箇所が存在しないことを確認する。
- Risks: `subscription_tier` の生値のみを参照している下流表示コード（バッジ等）がある場合、`past_due` 中も「契約中」表記のまま残る見た目上の副作用が生じる。表示側の対応は `quizetika-billing-subscription-ui` の担当範囲とし、本設計では Revalidation Trigger として明示するに留める。

#### SubscriptionReconciliationService

| Field        | Detail                                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Intent       | `stripe_customer_id` を持つ全ユーザーについて Stripe 上の実契約状態とローカル DB を突合し、乖離があれば是正する |
| Requirements | 36.6, 36.8, 36.9, 36.10                                                                                         |

**Dependencies**
- Outbound: Stripe API（`subscriptions.list`） — P0 / `applySubscriptionFromStripe()`, `clearPaidEntitlements()`（`entitlement.ts`） — P0 / Supabase Admin（`users`, `billing_reconciliation_corrections`） — P0

**Contracts**: Service [x] / API [ ] / Event [ ] / Batch [x] / State [ ]

##### Service Interface
```typescript
export interface ReconciliationSummary {
  evaluatedCount: number;
  correctedCount: number;
  skippedCount: number;
}

export async function reconcileSubscriptions(): Promise<ReconciliationSummary>;
```
- Preconditions: なし（内部で `stripe_customer_id IS NOT NULL` のユーザーをページング取得する）。
- Postconditions: 乖離が検出された全ユーザーの `subscription_tier` / `subscription_status` / `current_period_end` が Stripe 側の実状態に一致し、是正1件につき `billing_reconciliation_corrections` に1レコードが挿入されている。
- Invariants: 個別ユーザーの処理失敗は他ユーザーの処理継続を妨げない。

**Implementation Notes**
- Integration: 判定ロジックは `scripts/sync-subscriptions.ts` と同一（Stripe の `active`/`trialing`/`past_due` を有効とみなし、複数ある場合は最古の1件を正とする、`priceIdToTier()` で tier を解決）。既存スクリプトはコードを重複させず、本サービスを呼び出す形に揃えることが望ましいが、手動運用ツールとしての独立実行性を優先し、本フェーズでは既存スクリプトの改修は必須としない。
- Validation: ローカル DB の `subscription_tier` / `subscription_status` が Stripe 側の解決結果と完全一致する場合は是正・監査記録のいずれも行わない（無駄な書き込みを避ける）。
- Risks: 対象ユーザー数が将来大きく増加した場合、単一 Cron 実行内で全件を処理しきれない可能性がある（Vercel Function の実行時間上限）。現時点のユーザー規模では単一実行で十分だが、規模拡大時はページ単位での分割実行（複数回の Cron 起動 or キュー化）への切替を検討する（Open Question として残す）。

#### SyncSubscriptionsCronAPI

| Field        | Detail                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Intent       | Vercel Cron からの日次起動を受け付け、認可検証後に整合性チェックを実行する |
| Requirements | 36.6, 36.7                                                                 |

**Contracts**: Service [ ] / API [x] / Event [ ] / Batch [x] / State [ ]

##### API Contract
| Method | Endpoint                     | Request | Response                                                                   | Errors                           |
| ------ | ---------------------------- | ------- | -------------------------------------------------------------------------- | -------------------------------- |
| GET    | /api/cron/sync-subscriptions | なし    | `{ evaluatedCount: number; correctedCount: number; skippedCount: number }` | 401（`CRON_SECRET` 不一致）, 500 |

**Implementation Notes**
- Integration: リクエストの `Authorization` ヘッダーが `Bearer ${process.env.CRON_SECRET}` と一致することを検証してから `reconcileSubscriptions()` を呼び出す（Vercel が `CRON_SECRET` 環境変数設定時に自動付与するヘッダーと同一パターン）。`runtime = 'nodejs'`（Stripe SDK 利用のため Edge 不可、`StripeWebhookAPI` と同一制約）。
- Validation: `CRON_SECRET` 環境変数が未設定の場合は常に 401 を返し、認可検証をバイパスしない。

### File Structure Plan（Phase 42）

| ファイル                                                                    | 操作   | 責務                                                                                                           |
| --------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| `src/services/stripe-webhook.ts`                                            | Modify | `buildSnapshotFromSubscription()` の tier 決定ロジックを是正（`hasPaid` 分岐を削除し常に `mappedTier` を採用） |
| `src/services/subscription-reconciliation.ts`                               | New    | `reconcileSubscriptions()`：Stripe 実契約状態とローカル DB の突合・是正・監査記録                              |
| `src/app/api/cron/sync-subscriptions/route.ts`                              | New    | `GET /api/cron/sync-subscriptions`。`CRON_SECRET` 検証後に `reconcileSubscriptions()` を呼び出す               |
| `vercel.json`                                                               | New    | `crons` 設定（`/api/cron/sync-subscriptions` を UTC 19:00＝日本時間4時台に日次起動）                           |
| `supabase/migrations/20260723000000_billing_reconciliation_corrections.sql` | New    | `billing_reconciliation_corrections` テーブル作成（監査記録用、クライアントアクセス不可）                      |

### Requirements Traceability（Phase 42）

| Requirement | Summary                                            | Components                                                                | Interfaces                         | Flows                |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------- | -------------------- |
| 36.1–36.2   | 支払い失敗時の tier 維持・エンタイトルメント非付与 | `StripeWebhookAPI`, `EntitlementShared`（既存）                           | —                                  | Webhook フロー       |
| 36.3        | 支払い成功時の復帰                                 | `StripeWebhookAPI`（既存経路）                                            | —                                  | Webhook フロー       |
| 36.4        | 失効時の free 復帰                                 | `StripeWebhookAPI`（既存 `clearPaidEntitlements` 経路、変更なし）         | —                                  | Webhook フロー       |
| 36.5        | tier とステータスの独立参照                        | `EntitlementShared`（既存）                                               | —                                  | —                    |
| 36.6–36.7   | 定期整合性チェックの起動                           | `SyncSubscriptionsCronAPI`                                                | `GET /api/cron/sync-subscriptions` | 整合性チェックフロー |
| 36.8        | 乖離検出時の是正                                   | `SubscriptionReconciliationService`                                       | —                                  | 整合性チェックフロー |
| 36.9        | 是正の監査記録                                     | `SubscriptionReconciliationService`, `billing_reconciliation_corrections` | —                                  | 整合性チェックフロー |
| 36.10       | 実行時エラーの安全な扱い                           | `SubscriptionReconciliationService`                                       | —                                  | 整合性チェックフロー |
| 36.11–36.13 | 境界（UI 通知・実行基盤選定・督促ポリシー除外）    | —                                                                         | —                                  | Out of boundary      |

### Testing Strategy（Phase 42）

| 種別        | 検証                                                                                                                                                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `buildSnapshotFromSubscription()` — `status: 'past_due'` かつ `creator` にマッピングされる Price ID を渡した場合、`subscriptionTier` が `'creator'` のまま、`subscriptionStatus` が `'past_due'` になること（`'free'` へ書き換えられないこと） |
| Unit        | `computeUserEntitlements()` — `subscriptionTier: 'creator'` かつ `subscriptionStatus: 'past_due'` の組み合わせで `hasPaidEntitlements` / `hasCreatorEntitlements` が `false` を返すこと（既存ロジックの回帰確認）                              |
| Unit        | `reconcileSubscriptions()` — ローカル DB が `creator`/`active` だが Stripe 上に有効なサブスクリプションが存在しないユーザーに対し、`free` へ是正し監査レコードを1件挿入すること                                                                |
| Unit        | `reconcileSubscriptions()` — 対象ユーザーの一部で Stripe API 呼び出しが失敗した場合、そのユーザーをスキップして残りのユーザーの処理を継続すること                                                                                              |
| Integration | `GET /api/cron/sync-subscriptions` — `Authorization` ヘッダーが不正または欠落している場合に 401 を返すこと                                                                                                                                     |
| Integration | `GET /api/cron/sync-subscriptions` — 正しい `CRON_SECRET` を伴うリクエストで整合性チェックが実行され、是正件数を含むサマリが返ること                                                                                                           |
| Integration | Webhook — `customer.subscription.updated`（`past_due`）受信後、`users.subscription_tier` が変更前の値のまま、`users.subscription_status` のみ `'past_due'` に更新されること                                                                    |

**Effort**: **S**（既存ロジックの簡素化1箇所、既存監査テーブルパターンの再利用、新規 Cron エンドポイント1つ）
**Risk**: **Medium**（tier 決定ロジックの変更が既存の下流表示コードの前提を崩す可能性があるため、`subscription_tier` の生値を直接参照している箇所の洗い出しが必須。是正バッチは実際の契約状態を書き換えるため、誤判定は課金・エンタイトルメントの誤動作に直結する）

**Document Status（Phase 42 設計）**: 本節に反映。支払い失敗時のステータス反映是正（要件36.1–36.5）および失効検知の安全網（要件36.6–36.10）を含む。


