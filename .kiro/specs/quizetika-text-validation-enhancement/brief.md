# Brief: quizetika-text-validation-enhancement

## Problem
クイズの記述式（短答）において、従来の「文字数指定」は他の入力モードと排他となっており、例えば「3文字の数字」や「4文字のカタカナ」のような複合的な制限が不可能でした。また、全角・半角の英数字や半角カタカナの表記揺れによる解答不一致の誤判定が発生し、プレイヤー体験を損ねていました。

## Current State
- `textInputMode` は `'text' | 'numeric' | 'char-count'` のいずれかであり、文字数指定モード（`char-count`）のときは文字種制限がフリーでした。
- 英数字は自動半角変換処理が部分的に実装されていますが、判定時のみなど限定的であり、カタカナの半角→全角変換はありません。
- 作問エディタは従来の3モードの切り替えトグルになっています。

## Desired Outcome
- `textInputMode` を文字種指定として再定義（`free`, `kanji`, `katakana`, `alphabet`, `numeric`）。
- 文字数指定（`textInputCharCount`）は全項目でオプションとして併用可能にし、空欄の場合は指定なし（制限なし）とする。
- アルファベット・数字は作問入力時および解答判定時の両方で自動半角変換を行う。
- 半角カタカナは全角カタカナに自動変換する。
- 実際のプレイ画面・テストプレイ画面・復習画面等すべての入力欄でこの仕様が正確に機能し、プレースホルダーや制限が動的に切り替わる。

## Approach
`src/services/text-answer-utils.ts` に変換・検証ロジックを統合し、エディタ (`quiz-editor.tsx`)、保存前バリデータ (`quiz-validation.ts`)、プレイ画面の解答判定 (`usePlayState.ts`, 各プレイUI) から呼び出すアプローチ。

## Scope
- **In**:
  - `Question` の `textInputMode` / `textInputCharCount` 拡張
  - `text-answer-utils.ts` の正規化（全角英数字→半角、半角カナ→全角カナ）と文字種判定ロジック
  - エディタ UI (`TextInputEditor`) での文字種選択（トグル/セレクト）およびオプションとしての文字数入力欄の表示と自動変換
  - 作問バリデーション（`quiz-validation.ts`）への反映
  - クイズ解答画面での解答正規化（半角・全角変換）の適用と、入力欄の属性（`inputMode`, `maxLength`）の制御
- **Out**:
  - 記述式以外のクイズタイプの入力検証変更

## Boundary Candidates
- 共通サービス (`text-answer-utils.ts`) の正規化・検証ロジック
- 作問エディタUI・バリデーション (`TextInputEditor`, `quiz-editor.tsx`, `quiz-validation.ts`)
- 解答UIおよびプレイステート (`usePlayState.ts`, `quiz-play-client.tsx`, `test-play-client.tsx`, `review-client.tsx`)

## Out of Boundary
- 選択式、連想、並べ替え、水平思考などの別問題形式への影響

## Upstream / Downstream
- **Upstream**: `quizetika-ui-editor` (作問UI), `quizetika-play-flow-ui` (解答UI)
- **Downstream**: なし

## Existing Spec Touchpoints
- **Extends**: `quizetika-ui-editor` および `quizetika-play-flow-ui` の一部挙動を更新
- **Adjacent**: なし

## Constraints
- 既存のクイズデータにおける `'char-count'` のものは、`textInputMode = 'free'` かつ `textInputCharCount = X` にマッピングし、後方互換性を完全に保つ。
