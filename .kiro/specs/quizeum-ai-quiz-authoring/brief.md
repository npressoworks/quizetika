# Brief: quizeum-ai-quiz-authoring

## Problem
クリエイター（特に Pro プラン契約者）がクイズを手作業で10問組み上げるには時間がかかり、作問の離脱要因になる。現状エディタに AI 支援はなく、サムネイルも picsum プレースホルダのみで本番品質のカバー画像を用意しづらい。Pro プランの価値として「作問効率化」を明確に提供したい。

## Current State
- Gemini はプレイ時の水平思考のみ（`POST /api/attempt/ask-ai`, `verify-truth`）。作問 API は未実装。
- Pro エンタイトルメントは `resolveUserEntitlements` / Stripe 連携で実装済み。プレイ AI は Pro で無制限、無料は 30/クイズ・150/日。
- クイズエディタ（`quiz-editor.tsx`）は 8 形式・8 問題タイプを手入力。`triggerThumbnail` は picsum ダミー URL。
- `quizeum-ui-editor` は UI 移行完了。AI 生成 API は明示的に Out of scope。

## Desired Outcome
- Pro（有効契約）ユーザがエディタでプロンプトを入力し「生成」すると、選択中の出題形式に合わせた **10問** が一括生成され、問題カードに即反映される。
- 同ユーザがタイトル・説明文を基にサムネイルを AI 生成し、`thumbnailUrl` に Storage URL が設定される。
- Pro ユーザでも作問生成は **1日100回**、サムネ生成は **1日20回**（JST リセット）。上限時は明確なメッセージと `/pricing` 誘導は不要（既に Pro）— 翌日まで待つ旨を表示。
- 無料・未ログインユーザは機能非表示または Pro 購読 CTA。

## Approach
**単一 Gemini 呼び出し + 構造化 JSON + サーバー検証**（アプローチ A — **ユーザー確認済み 2026-06-10**）。

テキスト作問: 1 リクエストで 10 問分の JSON を `responseSchema` で取得し、Core の `mapAiJsonToQuestions` で既存 `Question` 型へマッピング → `quiz-validation` で検証後に API レスポンス。サムネ: Gemini 画像生成 → バイナリを `uploadImage` + `getQuizCoverPath` で Storage 化。

**反映モード（確認済み）**: 生成結果は既存問題リストの末尾へ **追加**（既存問題は削除・上書きしない）。新規 `id` を付与し、エディタは `setQuestions([...questions, ...generated])` 相当で反映する。

## Scope
- **In**:
  - API 2 本（作問一括・サムネ生成）と日次カウンタ
  - エディタ AI パネル・サムネ生成 UI
  - 形式: MC, true-false, text-input, quick-press, sorting, association, mixed（タイプ混在）
  - Pro ゲート・レート制限・E2E
- **Out**:
  - lateral-thinking（ウミガメ）の AI 一括作問（初版）
  - 問題単位画像 AI 生成
  - 無料お試し回数
  - 生成内容の自動 Firestore 保存
  - プレイ AI 制限の変更

## Boundary Candidates
- **API / レート制限 / Gemini / Storage** → `quizeum-core`
- **エディタ UX・プロンプト入力・結果反映・ローディング** → `quizeum-ai-quiz-authoring` コンポーネント + `quizeum-ui-editor` レイアウト統合
- **料金ページ特典文言** → Direct implementation（`pricing-display.ts`）

## Out of Boundary
- プレイ画面の AI チャット・真相判定
- クイズ公開バリデーション lib の根本変更（既存ルールを再利用）
- Stripe / サブスクリプション契約ロジック自体
- リストエディタへの AI 機能

## Upstream / Downstream
- **Upstream**: `quizeum-core`（エンタイトルメント、Question 型、`quiz-validation`、Storage）、`quizeum-ui-editor`（エディタシェル）、`GEMINI_API_KEY`
- **Downstream**: 料金ページの Pro 特典一覧、クリエイター向けドキュメント、将来的な lateral-thinking AI 作問拡張

## Existing Spec Touchpoints
- **Extends**: `quizeum-core`（新 API・カウンタ）、`quizeum-ui-editor`（パネル統合・picsum スタブ削除）
- **Adjacent**: `quizeum-billing-subscription-ui`（Pro CTA）、`quizeum-play-flow-ui`（プレイ AI — カウンタ分離で重複回避）

## Constraints
- サーバー側 Pro 判定必須（`hasPaidEntitlements`）
- 日次カウンタは `dailyAiAuthoringCounts`（プレイ用 `dailyAiTurnCounts` と分離）
- JST 日付境界は `ask-ai` と同型
- 固定 10 問生成
- Tailwind + shadcn UI パターンに準拠
