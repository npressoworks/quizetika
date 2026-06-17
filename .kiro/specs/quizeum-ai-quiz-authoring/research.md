# Research & Design Decisions: quizeum-ai-quiz-authoring

## Summary
- **Feature**: `quizeum-ai-quiz-authoring`
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

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. Vercel AI SDK エージェント (採用) | チャットパネルから API を呼び出し、サーバー・クライアント間で Tool Use 制御 | 自然言語による対話作問、直感的UX、ファクトチェックのソース明示 | クライアント側ステート書き換えの同期検証が複雑 | `onToolCall` にて厳密にスキーマ検証を行う |
| B. 静的フォーム一括チェック | チャットではなくボタン押下によるバッチ検証 | 実装がシンプル | 対話的な修正（「やっぱり元に戻して」「〜の部分だけ直して」等）が困難 | 要件でチャットボットに決定 |
| C. クライアント側での検索 | クライアント側から検索APIを呼んでAIに投げる | サーバー側コストの削減 | APIキーがブラウザ上に露出するセキュリティリスク | セキュリティ上却下 |

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
