# Implementation Plan: quizeum-ai-quiz-authoring

## 1. Foundation: 環境設定および認証・カウンタ基盤の構築

- [x] 1.1 依存パッケージのセットアップ
  - `package.json` に Vercel AI SDK（`ai` パッケージ）および `@ai-sdk/google` プロバイダを追加する
  - 依存ライブラリのインストールを実行し、Next.js プロジェクト内でエラーなくインポート・ビルドできることを確認する
  - *done基準*: `ai` と `@ai-sdk/google` が追加され、プロジェクトが正常にビルド・起動すること。
  - _Requirements: 2.2_
  - _Boundary: Infrastructure_

- [x] 1.2 Firestore カウンタとセキュリティルールの構築
  - 日次チャットメッセージ数およびツール実行数を制限するため、Firestore パス `users/{uid}/dailyAiAuthoringCounts/chat` のデータモデルを追加定義する
  - `firestore.rules` を更新し、クライアントから `dailyAiAuthoringCounts/chat` への直接書き込みを拒否し、読み取りは認証済み本人からのみ許可するルールを定義する
  - *done基準*: Firestore セキュリティルールが更新され、テストエミュレータ等でクライアントからの偽装書込が拒否されること。
  - _Requirements: 5.1, 5.2, 5.3_
  - _Boundary: Database_

- [x] 1.3 利用制限状況取得 API の実装
  - エディタ初期表示時に本日利用できる残りのチャット回数（作問/サムネイル/チャットカウンタ）を安全に読み取る `GET /api/quiz/ai-authoring-usage` を実装する
  - *done基準*: エンドポイントへ GET リクエストを送信した際、認可されたユーザーに対して現在の制限数と使用数が JSON で正しく返却されること。
  - _Requirements: 1.4, 5.1, 5.4_
  - _Boundary: API Layer_

## 2. Core: 対話型 AI エージェント API とチャット UI の実装

- [ ] 2.1 (P) AI チャットエージェント API エンドポイントの実装
  - `POST /api/quiz/ai-chat-authoring` エンドポイントを新設し、Vercel AI SDK の `streamText` および Gemini モデルを用いて対話型ストリーミング対話 API を実装する
  - 現在のエディタのクイズ状態（タイトル、説明、ジャンル、タグ、現在の問題リスト）をリクエストボディ経由でシステムプロンプトのコンテキストに組み込む
  - AI エージェントの Zod スキーマでクイズ状態を操作するツール（`generateBulkQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `generateThumbnail`）を定義する
  - API 呼び出しの冒頭で認証検証および日次カウンタの検証（上限100回）を行い、超過時は `429 limit-exceeded` を返却する
  - *done基準*: エンドポイントへの POST リクエストに対して、AI の応答テキストおよびツール呼び出しのメタデータがストリーミングで正常に返されること。
  - _Requirements: 2.1, 2.3, 3.6, 5.1, 5.5, 6.1, 6.3_
  - _Boundary: API Layer_

- [ ] 2.2 (P) 包括的チェックツールおよび Google 検索連携の実装
  - 指定された問題をチェックする `checkQuestion` と、全問題をチェックする `checkAllQuestions` ツールをサーバー側ツールとして実装する
  - チェック処理の中で Google 検索を実行するための `googleSearch` ツール（Gemini Search Grounding または同等）を連携定義する
  - 検索ソースから得られた情報ソース（URL）を応答に含め、誤字脱字、表現の不自然さ、形式不適合を検証した結果に基づいて AI が自動的に `updateQuestion` を呼び出すマルチステップ（`maxSteps`）の対話フローを実装する
  - *done基準*: ツール実行時にAIが検索を行い、校正結果とソース URL が出力され、必要に応じて `updateQuestion` が自動的に連動トリガーされること。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Depends: 2.1_
  - _Boundary: API Layer, Google Search_

- [ ] 2.3 (P) 対話型 AI チャット UI コンポーネントの構築
  - エディタの画面右下に配置されるフローティングチャット起動ボタン（`AiChatAssistantButton`）と、右スライドイン式のチャットパネル（`AiChatAssistantPanel`）を Vanilla CSS/CSS Modules で作成する
  - チャットパネル内にメッセージ履歴、ツール実行ログ、入力送信フォーム、および AI の応答待ちローディングアニメーションを実装する
  - *done基準*: チャットボタンのクリックでチャットパネルがアニメーション開閉し、ストリーミングでテキストメッセージとツール実行状態が正しくレンダリングされること。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 5.4, 6.2_
  - _Boundary: UI Layer_

- [ ] 2.4 (P) クライアント側 Hook と Tool Call ハンドラーの実装
  - Vercel AI SDK の `useChat` をラップする `useAiChatAssistant` フックを実装する
  - API から返されるツールコール（`createQuestion`, `updateQuestion`, `deleteQuestion`, `generateBulkQuestions`, `generateThumbnail`）をクライアントで検知（`onToolCall`）し、エディタの状態（`setQuestions`, `setTitle`, `setThumbnailUrl` 等）へ即時反映するハンドラーを定義する
  - 作問開始の初期化時に、AI アシスタントからの初期ウェルカムメッセージを表示する `triggerAuthoringWelcome` 関数を実装する
  - *done基準*: AI からツールコールを受信した際、クライアント側で Zod スキーマ検証が行われ、エディタ側の State（問題リストやサムネイル URL）が自動的に書き換えられること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - _Depends: 2.1_
  - _Boundary: UI Layer_

## 3. Integration: エディタ連携とハイブリッド起動の実装

- [ ] 3.1 クイズエディタへのチャットボットとハイブリッドボタンの統合
  - クイズエディタ（`quiz-editor.tsx`）に `AiChatAssistantButton` および `AiChatAssistantPanel` を配置し、`useAiChatAssistant` フックと結合する
  - クイズエディタの操作エリア（またはメインエリアの上部）に「AIで作問開始」ボタンおよび「全問包括チェック」ボタンを配置する
  - 「AIで作問開始」押下時: チャットパネルを開き、`triggerAuthoringWelcome` を呼び出してウェルカムメッセージを表示し、手動入力を促す
  - 「全問包括チェック」押下時: チャットパネルを開き、`append` を用いて全問チェックを指示するプロンプトを自動送信して即座にチェック処理を実行させる
  - *done基準*: 各ボタンを押した際に指定通りのメッセージがチャットに乗り、作問側では初期メッセージの提示、チェック側では自動送信による即時チェックが開始されること。
  - _Requirements: 1.6, 1.7, 2.4, 3.7_
  - _Depends: 2.3, 2.4_
  - _Boundary: UI Layer_

## 4. Validation: テストの作成と検証

- [ ] 4.1 単体および結合テストの作成と実行
  - `ai-authoring-utils` および API ルートのテストスイートを作成する
  - 認証エラー（401）、Pro権限エラー（403）、レート制限（429）、不正スキーマ（422）などのレスポンスが適切に返却されることをテストする
  - *done基準*: テストランナーを実行して、記述したすべての API 認可・制限テストおよびマッピングテストがパスすること。
  - _Requirements: 3.6, 5.1, 5.3, 6.3_
  - _Depends: 3.1_
  - _Boundary: Testing_

- [ ] 4.2 E2E テストの作成と実行
  - `e2e/ai-chat-assistant.spec.ts` を作成する
  - クイックボタン押下によるチャット連動、チャット開閉、問題の追加・編集・削除のツール実行、全問チェックの自動実行、エラー表示などのユーザーシナリオを実装する
  - *done基準*: Playwright を用いてチャットアシスタントの統合 E2E テストを実行し、すべてのシナリオが完全にパスすること。
  - _Requirements: 1.1, 1.6, 1.7, 3.1, 3.3, 3.4, 4.1, 4.3_
  - _Depends: 4.1_
  - _Boundary: Testing_
