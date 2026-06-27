# Brief: quizetika-ai-quiz-authoring

## Problem
クリエイター（特に Pro プラン契約者）がクイズを手作業で10問組み上げるには時間がかかり、作問の離脱要因になる。現状エディタでは静的な一括作問AIパネルのみが存在し、個別の問題の修正や削除、ファクトチェックを手動で行う必要があり、作問プロセスにおけるAIとの対話的なコラボレーション（「この問題を少し難しくして」「この記述が正しいかファクトチェックして」など）ができない。Pro プランの価値として「対話型AIエージェントによる作問の劇的な効率化」を明確に提供したい。

## Current State
- Gemini を用いた一括作問機能（`POST /api/quiz/ai-generate-questions`）が実装済み。静的なテキストエリアとボタンによる一括生成・末尾追加を行う。
- サムネイル生成機能（`POST /api/quiz/ai-generate-thumbnail`）が実装済み。
- クイズエディタ（`quiz-editor.tsx`）は 8 形式・8 問題タイプを管理。
- チャットボットによるエディタのインタラクティブな編集・削除・ファクトチェックは未実装。

## Desired Outcome
- エディタの画面右下にチャットアイコンを表示し、押すと右側にチャットボットがスライドイン表示される。
- チャットボットは Vercel AI SDK を使用した対話型インターフェースで、AIエージェントとして動作する。
- AIエージェントは、エディタの現在のクイズのメタデータや問題リストを文脈として理解し、ユーザーの自然言語による指示に基づいて問題を「作成」「編集」「削除」「ファクトチェック」する。
- 問題の「作成」「編集」「削除」「ファクトチェック」は、AIエージェントの Tool Use ツールとして定義される。
- ファクトチェック指示の際、AIエージェントはGoogle検索ツールを実行し、検索結果のソースに基づいて事実関係を検証し、修正案を提示する。
- プレミアムなダークモードやネオンカラー、Glassmorphism等のモダンなデザインテーマを踏襲した美しいUIを提供する。

## Approach
Vercel AI SDKを用いたサーバー・クライアント間通信と、Gemini モデルの Tool Use 機能による対話型エージェント設計。

1. **フロントエンド (UI)**:
   * 右下のフローティングチャットボタンから開閉する右スライド式チャットパネル（幅: 380px〜420px程度、エディタと併存）。
   * `useChat`（Vercel AI SDK）を用いたストリーミング表示と、サーバーから返されるツールコールのフロントエンド適用。
   * AIエージェントがエディタの状態を書き換える際、フロントエンドでツール実行をインターセプトして `questions` 等のステートを更新する。

2. **バックエンド (API)**:
   * 新しいチャット用エンドポイント `POST /api/quiz/ai-chat-authoring` を新設。
   * Vercel AI SDK（`ai` パッケージ）と `@ai-sdk/google` を使用し、ユーザーのメッセージ履歴とエディタの現在の状態を Gemini（`gemini-2.5-flash` など）に渡す。
   * エージェント用システムプロンプトと、以下の作問操作ツール群の定義：
     * `generateBulkQuestions`: 複数問（10問）の一括生成。
     * `createQuestion`: 単一問題の作成・追加。
     * `updateQuestion`: 指定問題（ID）の編集。
     * `deleteQuestion`: 指定問題（ID）の削除。
     * `googleSearch`: Google検索による情報の取得（Google Search Grounding または API 使用）。
     * `factCheckQuestion`: 問題のファクトチェック（内部で `googleSearch` を呼び出して事実検証を行う）。

## Scope
- **In**:
  - 右下フローティングチャットボタンおよびスライドインチャットパネル UI。
  - チャット対話 API エンドポイント（Vercel AI SDK, Gemini連携）。
  - エディタ状態の AI 操作ツール群（一括生成、単一追加、編集、削除、ファクトチェック）。
  - Google検索連携によるファクトチェック（検索結果ソースを提示し、必要なら問題を自動編集または提案）。
  - Pro / Premium 限定アクセス制御、日次利用制限（チャットのやり取り・ツール実行に対する制限）。
- **Out**:
  - クイズ一覧やダッシュボードなど、作問エディタ画面以外でのチャットボット表示。
  - チャット対話の Firestore 永続化（ブラウザをリロードするとチャット履歴はリセットされるが、エディタ側のクイズデータは維持される）。
  - 無料お試し利用枠。

## Boundary Candidates
- **API / Vercel AI SDK / Google Search / Gemini** → `quizetika-core` (または API Routes)
- **チャット UI・開閉状態・履歴表示・ローディング** → `quizetika-ai-quiz-authoring` の新規チャットコンポーネント
- **エディタとの状態結合（Tool コールの適用）** → `quiz-editor.tsx` 側への Tool Handler の統合

## Out of Boundary
- プレイ中の水平思考チャットボット（仕様が異なるため独立して維持）。
- クイズ公開時の Firestore 自動保存（ユーザーが明示的に保存ボタンを押すまで保存しない）。

## Upstream / Downstream
- **Upstream**: `quizetika-core` (Firestore, Auth, Entitlements), Vercel AI SDK (`ai`, `@ai-sdk/google`), `GEMINI_API_KEY`
- **Downstream**: 作問のユーザー体験向上、Pro プランの魅力向上

## Existing Spec Touchpoints
- **Extends**: `quizetika-ai-quiz-authoring` (本スペック自体をチャットボット型にアップデート)。
- **Adjacent**: `quizetika-ui-editor` (エディタレイアウトとの干渉を避けるレスポンシブデザイン)。

## Constraints
- Vanilla CSS / CSS Modules を使用し、既存のネオン＋ダークテーマに完璧にフィットさせる。
- Pro 判定および日次チャット/ツール利用回数制限をサーバー側で厳格に実施する。
- 日本語でのスムーズな対話と、正確な日本語クイズスキーマへの準拠。
