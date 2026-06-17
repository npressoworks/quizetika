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

- [x] 2.1 (P) AI チャットエージェント API エンドポイントの実装
  - `POST /api/quiz/ai-chat-authoring` エンドポイントを新設し、Vercel AI SDK の `streamText` および Gemini モデルを用いて対話型ストリーミング対話 API を実装する
  - 現在のエディタのクイズ状態（タイトル、説明、ジャンル、タグ、現在の問題リスト）をリクエストボディ経由でシステムプロンプトのコンテキストに組み込む
  - AI エージェントの Zod スキーマでクイズ状態を操作するツール（`generateBulkQuestions`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `generateThumbnail`）を定義する
  - API 呼び出しの冒頭で認証検証および日次カウンタの検証（上限100回）を行い、超過時は `429 limit-exceeded` を返却する
  - *done基準*: エンドポイントへの POST リクエストに対して、AI の応答テキストおよびツール呼び出しのメタデータがストリーミングで正常に返されること。
  - _Requirements: 2.1, 2.3, 3.6, 5.1, 5.5, 6.1, 6.3_
  - _Boundary: API Layer_

- [x] 2.2 (P) 包括的チェックツールおよび Google 検索連携の実装
  - 指定された問題をチェックする `checkQuestion` と、全問題をチェックする `checkAllQuestions` ツールをサーバー側ツールとして実装する
  - チェック処理の中で Google 検索を実行するための `googleSearch` ツール（Gemini Search Grounding または同等）を連携定義する
  - 検索ソースから得られた情報ソース（URL）を応答に含め、誤字脱字、表現の不自然さ、形式不適合を検証した結果に基づいて AI が自動的に `updateQuestion` を呼び出すマルチステップ（`maxSteps`）の対話フローを実装する
  - *done基準*: ツール実行時にAIが検索を行い、校正結果とソース URL が出力され、必要に応じて `updateQuestion` が自動的に連動トリガーされること。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Depends: 2.1_
  - _Boundary: API Layer, Google Search_

- [x] 2.3 (P) 対話型 AI チャット UI コンポーネント of 構築 (マークダウン＆コピー対応)
  - `AiChatAssistantPanel` を修正し、メッセージの描画を `MarkdownContent` コンポーネント経由のHTMLレンダリングに変更する
  - メッセージ履歴コンテナに `useEffect` 処理を組み込み、`<pre>` コードブロックを検出して「コピーボタン（`.codeCopyButton`）」を動的挿入、クリック時のクリップボードコピーおよびUIフィードバック（2秒間レ点遷移）を実装する
  - `ai-chat-assistant.module.css` に、マークダウンの各要素（pre, code, ul, ol, li, a）およびコピーボタンのホバースタイル等を定義する
  - *done基準*: チャット内のマークダウンテキストが正しく装飾表示され、リンクが新タブで安全に開かれ、コードブロックホバー時にコピーボタンが表示されてコピーが機能すること。
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 2.5, 2.7, 5.4, 6.2_
  - _Depends: 2.5_
  - _Boundary: UI Layer_

- [x] 2.4 (P) クライアント側 Hook と Tool Call ハンドラーの実装
  - Vercel AI SDK の `useChat` をラップする `useAiChatAssistant` フックを実装する
  - API から返されるツールコール（`createQuestion`, `updateQuestion`, `deleteQuestion`, `generateBulkQuestions`, `generateThumbnail`）をクライアントで検知（`onToolCall`）し、エディタの状態（`setQuestions`, `setTitle`, `setThumbnailUrl` 等）へ即時反映するハンドラーを定義する
  - 作問開始の初期化時に、AI アシスタントからの初期ウェルカムメッセージを表示する `triggerAuthoringWelcome` 関数を実装する
  - *done基準*: AI からツールコールを受信した際、クライアント側で Zod スキーマ検証が行われ、エディタ側の State（問題リストやサムネイル URL）が自動的に書き換えられること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  - _Depends: 2.1_
  - _Boundary: UI Layer_

- [x] 2.5 (P) 簡易マークダウンパース機能の拡張
  - `src/lib/security/sanitize.ts` の `parseMarkdownToHtml` を拡張し、コードブロック、インラインコード、箇条書き/番号付きリストのパース、および安全な新タブリンクのパースを実装する
  - パース前にコードブロック・インラインコードをプレースホルダーへ退避させることで、パース競合およびエスケープ破壊を完全に防止する設計を実装する
  - `DOMPurify` の許可タグに `pre`, `code`, `ul`, `ol`, `li` を追加する
  - *done基準*: マークダウンで書かれたリストやプログラムコードが安全な HTML に変換され、悪意あるスクリプトが強力に排除（サニタイズ）されること。
  - _Requirements: 2.5, 2.6_
  - _Boundary: Library_

## 3. Integration: エディタ連携とハイブリッド起動の実装

- [x] 3.1 クイズエディタへのチャットボットとハイブリッドボタンの統合
  - クイズエディタ（`quiz-editor.tsx`）に `AiChatAssistantButton` および `AiChatAssistantPanel` を配置し、`useAiChatAssistant` フックと結合する
  - クイズエディタの操作エリア（またはメインエリアの上部）に「AIで作問開始」ボタンおよび「全問包括チェック」ボタンを配置する
  - 「AIで作問開始」押下時: チャットパネルを開き、`triggerAuthoringWelcome` を呼び出してウェルカムメッセージを表示し、手動入力を促す
  - 「全問包括チェック」押下時: チャットパネルを開き、`append` を用いて全問チェックを指示するプロンプトを自動送信して即座にチェック処理を実行させる
  - *done基準*: 各ボタンを押した際に指定通りのメッセージがチャットに乗り、作問側では初期メッセージの提示、チェック側では自動送信による即時チェックが開始されること。
  - _Requirements: 1.6, 1.7, 2.4, 3.7_
  - _Depends: 2.3, 2.4_
  - _Boundary: UI Layer_

## 4. Validation: テストの作成と検証

- [x] 4.1 単体および結合テストの作成と実行
  - `ai-authoring-utils` および API ルートのテストスイートに加え、`parseMarkdownToHtml` のマークダウンパース結果のテストケースを追加・記述する
  - 認証エラー（401）、Pro権限エラー（403）、レート制限（429）、不正スキーマ（422）のテストおよびマークダウンパース結果（リスト・コードブロック・セーフリンク）の検証をテストする
  - *done基準*: テストランナーを実行して、記述したすべての API 認可・制限テスト、およびマークダウンパーステストが正常にパスすること。
  - _Requirements: 2.5, 2.6, 3.6, 5.1, 5.3, 6.3_
  - _Depends: 3.1_
  - _Boundary: Testing_

- [x] 4.2 E2E テストの作成と実行
  - `e2e/ai-chat-assistant.spec.ts` を作成（または更新）する
  - クイックボタン押下によるチャット連動、チャット開閉、問題の追加・編集・削除のツール実行、全問チェックの自動実行、エラー表示に加え、マークダウン表示、コードコピーボタン動作、新タブ安全リンク遷移を検証するシナリオを実装する
  - *done基準*: Playwright を用いてチャットアシスタントの統合 E2E テストを実行し、マークダウン表示やコピー動作を含むすべてのシナリオが完全にパスすること。
  - _Requirements: 1.1, 1.6, 1.7, 2.5, 2.6, 2.7, 3.1, 3.3, 3.4, 4.1, 4.3_
  - _Depends: 4.1_
  - _Boundary: Testing_

## 5. User Approval Flow: ユーザー承認フローの実装

- [ ] 5.1 useAiChatAssistant Hook におけるツール解決の保留と承認/却下 API の実装
  - `onToolCall` 内で Promise をリターンして解決を保留するロジックを実装する
  - 保留中のツール情報と `resolve` 関数を格納・管理する `pendingApprovals` ステートを Hook 内に定義する
  - Hook から `approveToolCall(toolCallId)` と `rejectToolCall(toolCallId)` アクションを公開し、それぞれで Promise の解決、および承認時のみのエディタ状態（questions 等）への反映処理を実装する
  - *done基準*: AIがツールを呼び出した際にエディタのフォーム状態が即時書き換えられず保留され、Hookの承認/却下APIを通じてのみ適用およびAIへの応答完了が実行されること。
  - _Requirements: 3.1, 3.2, 3.3_
  - _Boundary: UI Layer (Hook)_

- [ ] 5.2 AiChatAssistantPanel におけるツール承認/却下 UI とプレビュー機能の実装
  - メッセージ内の `toolInvocations` を走査し、承認待ち状態の各ツールについて「承認（フォームに反映）」および「却下」ボタンを表示する
  - 変更される問題（追加される問題の詳細、変更前後差分、削除される問題インデックスなど）を表示するプレビューUIをチャット内に描画する
  - 承認または却下の処理が完了したツールはボタンを非表示にし、適用済み/却下の確定テキスト表示に切り替える
  - 承認待ちの間は、送信フォームのインプットおよび送信ボタンを `disabled` に制御し、二重送信を防止する
  - *done基準*: 承認待ちツールのプレビューと「承認（フォームに反映）」「却下」ボタンがインライン表示され、適用時にエディタへ適用、却下時に適用なしで進行でき、待機中に入力ロックされること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Depends: 5.1_
  - _Boundary: UI Layer_

- [ ] 5.3 承認フローの単体テストおよび E2E テストの追加・実行
  - `e2e/ai-chat-assistant.spec.ts` に、承認フローおよび二重入力ガードを検証するシナリオを追加する
  - 作問指示を送る -> フォームに即座に反映されず承認プレビューが表示されること -> 承認で反映されること / 却下で反映されないこと -> 待機中に入力フォームが disabled になること、の各アサーションを検証する
  - *done基準*: Playwright を用いて更新した E2E テストを実行し、新設された承認フローおよび入力ロックのテストシナリオが正常にパスすること。
  - _Requirements: 3.1, 3.2, 3.3_
  - _Depends: 5.2_
  - _Boundary: Testing_
