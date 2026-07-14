# Research & Design Decisions: quizetika-ai-quiz-authoring

## Summary
- **Feature**: `quizetika-ai-quiz-authoring`
- **Discovery Scope**: Extension（既存 Gemini 一括作問・Pro エンタイトルメント・クイズエディタのチャットエージェント化）
- **Key Findings**:
  - 静的な一括作問パネルから、右下の対話型チャットアシスタント（スライドインパネル）に移行し、ユーザーとAIとの共同作業を実現。
  - Vercel AI SDK (`ai` パッケージ) を導入し、クライアント (`useChat`) とサーバー (`streamText` + `@ai-sdk/google`) での対話と Tool Use をスマートに管理可能。
  - ツール群（追加、編集、削除、一括生成、サムネイル生成、包括的チェック）を定義し、APIからのツールコールをクライアントで検知して React ステートを即時更新。
  - 事実確認（ファクトチェック）は Gemini の Google Search Grounding または Custom Search 経由で Google 検索を行い、取得したソース URL をチャット上に表示可能。
  - ファクトチェックは誤字脱字・日本語表現の校正も含む「包括的チェック」へ拡張し、指定問題 (`checkQuestion`) または全問題の一括チェック (`checkAllQuestions`) をサポート。
  - 簡易的な正規表現と状態マシンを組み合わせた独自マークダウンパース処理を実装。コードブロックをプレースホルダーへ一時退避させるアプローチにより、他の置換規則との競合を完全に保護。
  - メッセージ履歴を表示する DOM コンテナに対して useEffect で監視を行い、コードブロック（pre タグ）内にコピーボタンを動的に追加。ホバーで表示され、成功時にレ点へとアニメーション変化するプレミアムUXを実現。

## Research Log

### Vercel AI SDK を用いた Tool Use とエディタ連携
- **Context**: 自然言語によるエディタ操作とストリーミング対話。
- **Sources Consulted**: [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs), `src/components/quiz/quiz-editor.tsx`。
- **Findings**:
  - `useChat` フックの `onToolCall` を使うことで、サーバーから送られてきたツールコール（`updateQuestion` など）をフロントエンドで検知・実行できる。
  - サーバーの API ルートで `streamText` の `maxSteps` を 2 以上に設定することで、AI が内部で `googleSearch` や `checkQuestion` を実行して結果を得たのち、次のステップとして `updateQuestion` を自動で呼び出すマルチステップ制御が可能。
- **Implications**: エディタのステート更新はクライアント側で実行するツールとし、情報取得（検索）や検証ロジックはサーバー側（AI）で自律実行するハイブリッド設計を採用。

### 包括的チェック（事実確認・誤字脱字・表現校正）の設計
- **Context**: クイズ内容の信頼性と品質向上。
- **Findings**:
  - クイズ問題は、正しい事実関係だけでなく、誤字脱字や日本語としての自然さ、設定された出題形式（例：記述式なのに選択肢フィールドが存在するなど）との適合性が品質に直結する。
  - AI が全問題を一括スキャンする `checkAllQuestions` ツールを用意し、問題リスト全体を検証した結果をチャットパネルにリストアップさせ、修正可能な問題に対して `updateQuestion` を呼び出す。
- **Implications**: AI エージェントのプロンプトで「誤字脱字」「不自然な表現」「形式不適合」を検証項目として明確にし、Google検索を利用する事実確認と合わせて一度のチェックで包括的に網羅する。

### Google 検索 Grounding の仕組み
- **Context**: 事実確認での Google 検索の利用。
- **Sources Consulted**: Gemini API Grounding with Google Search。
- **Findings**:
  - Gemini API は Google 検索結果に基づくグラウンディング出力をビルトインで提供している。Vercel AI SDK のプロバイダでも `googleSearch` ツールとしてモデルに渡す、あるいは検索グラウンディングを有効化することで、AI が自律的に最新情報を検索し、回答のソース URL を明示できる。
  - プロジェクト側の追加の API キー管理コストやレート制限を回避するため、Gemini 自体の検索連携機能を最優先で採用。

### メッセージにおけるマークダウンパースとコピーの実現
- **Context**: AIの応答テキスト内のリストやコードの読みやすさ向上と、コードの再利用性。
- **Findings**:
  - AIエージェントはプログラムコードや箇条書きを含むマークダウンを頻繁に生成するため、エディタ解説で使われている簡易 HTML パース（`parseMarkdownToHtml`）では表示が崩れる。
  - コードブロック内の改行や特殊文字が他の HTML 置換（特に `\n -> <br />`）と競合しないよう、パースの初期段階でプレースホルダーへ退避させる設計が最も安全。
  - DOM 挿入後の `useEffect` 内で `pre` タグを取得し、`button` 要素を動的にアタッチして `navigator.clipboard.writeText` を実行する仕組みにより、仮想 DOM を乱さずコピーボタンを組み込める。

## Architecture Pattern Evaluation

| Option                               | Description                                                                 | Strengths                                                      | Risks / Limitations                                                  | Notes                                     |
| ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| A. Vercel AI SDK エージェント (採用) | チャットパネルから API を呼び出し、サーバー・クライアント間で Tool Use 制御 | 自然言語による対話作問、直感的UX、ファクトチェックのソース明示 | クライアント側ステート書き換えの同期検証が複雑                       | `onToolCall` にて厳密にスキーマ検証を行う |
| B. 静的フォーム一括チェック          | チャットではなくボタン押下によるバッチ検証                                  | 実装がシンプル                                                 | 対話的な修正（「やっぱり元に戻して」「〜の部分だけ直して」等）が困難 | 要件でチャットボットに決定                |
| C. クライアント側での検索            | クライアント側から検索APIを呼んでAIに投げる                                 | サーバー側コストの削減                                         | APIキーがブラウザ上に露出するセキュリティリスク                      | セキュリティ上却下                        |

## Design Decisions

### Decision: チャット用日次上限 doc の追加
- **Context**: API コスト抑制と悪用防止。
- **Selected Approach**: `users/{uid}/dailyAiAuthoringCounts/chat` ドキュメントを新設し、メッセージ送信とツール実行の合計回数を 100回/日 に制限する。
- **Rationale**: 従来の「作問100回」「サムネ20回」の枠組みをチャット対話型に移行するため、チャット利用回数（1往復+ツール）を 1 単位としてカウントするシンプルな制限に統合・整理。

### Decision: 包括的チェックと一括チェックのマルチステップ実行
- **Context**: 全問題一括チェックの利便性向上。
- **Selected Approach**:
  - `checkQuestion` と `checkAllQuestions` ツールはサーバー側で実行。
  - AI が内部で `googleSearch` 等をマルチステップで呼び出して事実検証を行い、最終的に `updateQuestion` ツールを呼び出してエディタを書き換える。
- **Rationale**: ユーザーが一回「全問チェックして」と頼むだけで、AI が自律的に複数の問題の誤りを調査し、適切な修正案をエディタに適用できる。

### Decision: プレースホルダー保護型簡易マークダウンパーサーの採用
- **Context**: サードパーティライブラリ（`react-markdown` 等）の追加を避け、既存 `sanitize.ts` の枠組みでリスト・コードをパースしたい。
- **Selected Approach**:
  - コードブロック（` ``` `）とインラインコード（` ` `）を一時的に `__CODE_BLOCK_N__` などのプレースホルダーに逃がしてから他のパースを実行し、最後にサニタイズした上で書き戻す。
- **Rationale**: 外部依存関係を追加せずに軽量かつ確実にパース競合を防ぐことができ、バンドルサイズおよびライブラリ選定コストを最小化できるため。

### Decision: useEffect によるコピーボタンの動的インジェクション
- **Context**: `dangerouslySetInnerHTML` で埋め込んだコードブロックに React からインタラクティブなボタンを配置したい。
- **Selected Approach**:
  - チャットメッセージ更新をトリガーとする `useEffect` 内で、DOM 要素（`pre`）を巡回し、コピーボタン要素を動的に `appendChild` する。
- **Rationale**: React のライフサイクルと DOM 操作を分離し、最もシンプルなバニラ JS で安全にコピー機能を拡張できるため。

## Synthesis Outcomes
- **Generalization**: AI チャットにおけるエラーレスポンス形式および認証制限チェックロジックを既存のプレイ AI (`ask-ai`) と同じ認可・免除ヘルパー (`assertAiAuthoringAccess`) を再利用して統一。
- **Build vs. Adopt**: Vercel AI SDK の `useChat` と Gemini のツールコールのライフサイクル（`onToolCall`）を採用し、エディタへの適用ロジックのみを独自ビルド。

## Risks & Mitigations
- **エディタ側ステートとの競合**: ユーザーが手動編集している最中に AI がツールで `questions` を上書きする競合リスク。
  - *対策*: AI チャットの送信時に、その瞬間のエディタ状態を常にサーバーに送り、AI が最新のインデックスとIDに基づいて `updateQuestion` を指示する。ツール適用時にも ID の有無をクライアント側で厳密に確認する。

---

## Gap Analysis: AI Chat Assistant User Approval Flow

### 1. 現状調査 (Current State)
* **ツールコールの実行方式**: `src/hooks/useAiChatAssistant.ts` の `useChat` に定義された `onToolCall` ハンドラーは、AIから `createQuestion` などのツール呼び出しを受け取った際、即座に `setQuestions` を実行してエディタ状態を書き換え、`addToolResult`（即時解決）を行っている。
* **UI表示**: `src/components/quiz/editor/ai-chat-assistant-panel.tsx` は、ツールコールの実行ステータス（実行中/完了）をログとして表示するのみで、変更内容の確認や承認を行うUIは存在しない。
* **APIルート設計**: `src/app/api/quiz/ai-chat-authoring/route.ts` では、AIが複数のツールを自律的に呼び出せるよう `maxSteps` や `stepCountIs` が設定されており、AIはツール結果を受け取った後に次の回答ストリームを再開する仕組みになっている。

### 2. 要件と既存コードのギャップ (Gaps)
* **G-1: ツールコールの保留機構の欠如**: AIからのツール実行の要求を一時的に保留し、ユーザーのアクションを待つ非同期待機プロセスが存在しない。
* **G-2: 承認待ち状態の管理**: 保留されたツールコール（`toolCallId`、`toolName`、引数データ、Promiseの `resolve` 関数）を安全に保持・破棄する React 状態管理（Ref または State）がない。
* **G-3: プレビューおよび承認UIの欠如**: チャットバブル内で各ツールが提案したデータ（新規問題の内容、更新の前後差分、削除対象ID、生成サムネイルなど）をレンダリングし、「適用（承認）」「却下（キャンセル）」ボタンを押せるコンポーネントがない。
* **G-4: 二重送信の防止制御**: 承認待ちの間にユーザーが新しいメッセージを送信したり、他のツールを重複して起動したりするのを防ぐ UI ガードがない。
* **G-5: 承認前のバリデーション連携**: 提案された問題が適用可能な状態であるか（バリデーション違反がないか）を事前に検証する機能がない。

### 3. 実装アプローチの選択肢 (Implementation Approaches)

#### Option A: useChat の `onToolCall` で Promise を返し、Ref に resolve を保持する設計 (推奨)
* **概要**: AIからツールが呼ばれた際、`onToolCall` 内で `new Promise` を作成してリターンする。この Promise の `resolve` 関数とツール情報をフック内の Ref（または State）に保存し、UI側でユーザーが「承認」または「却下」ボタンをクリックしたときにこの `resolve` を呼び出してツール結果を確定させる。エディタへの適用（`setQuestions` 等）は「承認」が押されたタイミングで実行する。
* **Pros**:
  * AI SDK の標準的なツール解決ライフサイクル（完了するまでAIが回答を待つ）と完全に一致する。
  * AIはユーザーが承認・却下した結果（成功/失敗）を正しく認識した上で、その後のチャット応答文（例:「承知しました。処理をキャンセルしました」等）を生成できる。
* **Cons**:
  * 非同期の Promise 解決フローを破綻させずに管理するロジック（Ref 内のクリーンアップ等）が必要。

#### Option B: UI主導の仮解決アプローチ (非推奨)
* **概要**: AIからのツールコールは `onToolCall` で即座に成功を返して解決し、UI上だけで「未適用」状態として管理する。ユーザーが「承認」を押したときにエディタに反映する。
* **Pros**:
  * `onToolCall` を保留状態にする必要がなく、フックのロジックがシンプルになる。
* **Cons**:
  * ユーザーが却下した場合でもAI側には「成功」として伝わるため、AIは「適用しました！」と応答するにもかかわらずエディタには反映されていないという、AIの認識と実際のエディタ状態の致命的な乖離が発生する。

### 4. 開発見積もりとリスク (Complexity & Risk)
* **開発規模 (Effort)**: M (3〜5日)
* **リスク (Risk)**: Medium

# Design Synthesis: Phase 2 Creator/Premium への利用資格改名（2026-07-13）

## Summary
- **Discovery Type**: Light（既存アクセス制御の判定条件切り替えのみ、新規機能なし）
- **背景**: `quizetika-core` Phase 41 で `pro` tier が `creator` にリネームされ、`player` tier が新設される。本機能は `player` を対象外とし、`creator`/`premium` のみ利用可能とする。

## Design Decisions

### Decision: `hasPaidEntitlements` から `hasCreatorEntitlements` への参照切り替え
- **Context**: 現行 `canAccessAiAuthoring()` は `entitlements.hasPaidEntitlements || entitlements.hasUnlimitedAiQuestions` で判定しており、これは「有料 tier かどうか」の二値のみを見ているため `player` tier も条件を満たしてしまう。
- **Selected Approach**: `quizetika-core` が新設する `hasCreatorEntitlements`（`creator`/`premium` のみ true）を判定条件として採用する。
- **Rationale**: 本機能側にモデレーター免除ロジックを重複実装せず、`quizetika-core` の capability モデルを単一の正本として参照する（Boundary の整合維持）。

## Risks & Mitigations（Phase 2）
- **`quizetika-core` の `hasCreatorEntitlements` 実装未完了時の並行実装リスク** — 依存順（core → ai-quiz-authoring）をタスク生成時に明示し、core 側のフィールド追加が先行することを前提とする。

## Document Status（Phase 2 Design）
- **入力**: `quizetika-core` design.md Phase 41 節（`hasCreatorEntitlements` 契約）
- **出力**: `design.md` Phase 2 節、本節
  * *リスク要因*: Vercel AI SDK の `useChat` におけるツールコール解決の最大タイムアウト時間や、保留中にチャットがリセットされた場合のクリーンアップ処理の検証が必要。また、複数の一括生成（`generateBulkQuestions`）と単一処理のプレビュー表示出し分けを綺麗に行う必要がある。
