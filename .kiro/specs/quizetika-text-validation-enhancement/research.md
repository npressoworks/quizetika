# Research & Design Decisions: quizetika-text-validation-enhancement

## Summary
- **Feature**: quizetika-text-validation-enhancement
- **Discovery Scope**: Extension
- **Key Findings**:
  - データベースの `questions.text_input_mode` は `TEXT` 型であり、チェック制約がないため、アプリケーション層の `TextInputMode` 拡張による影響はなく、スキーママイグレーションは不要。
  - 既存データの後方互換マッピングは、`resolveTextInputMode` の中で `'text'` と `'char-count'` を `'free'` に変換し、`textInputCharCount` はそのまま保持することで安全に実現可能。
  - 自動半角変換（英数字）と全角変換（半角カナ）は、外部ライブラリを追加せず、自前の変換関数を `text-answer-utils.ts` 内に定義することで、セキュリティと保守性の高い共通ロジックを実装できる。

## Research Log

### データベース制約の検証
- **Context**: データベース（Supabase/PostgreSQL）側で `text_input_mode` の値に対してチェック制約（CHECK constraint）やENUM定義が存在する場合、新規文字種の追加にあたってマイグレーションスクリプトの追加が必要となるため調査。
- **Sources Consulted**: `supabase/migrations/20260702000000_init.sql`
- **Findings**:
  - `questions` テーブルの定義は `text_input_mode TEXT` であり、チェック制約等の制限は存在しない。
- **Implications**: DBマイグレーションは不要で、型定義とUI/ロジックの修正のみで実装可能。

### 文字種の判定および自動変換ロジック
- **Context**: カタカナやアルファベット、数字をどのように正確に検出し、自動変換するか。
- **Sources Consulted**: TypeScript正規表現仕様、日本語文字コード範囲。
- **Findings**:
  - 全角英数字から半角への変換は、文字コード差分（`- 0xfee0`）を用いた一括置換で安全に行える。
  - 半角カタカナから全角へのマッピングテーブルと濁点・半濁点の結合処理を行うことで、1パスの走査で全角化が可能。
  - 漢字の判定正規表現は `^[一-龠々〇ヶ]+$` とし、主要な漢字と繰り返し記号をカバーする。
- **Implications**: `text-answer-utils.ts` にポータブルなユーティリティ関数としてこれらの処理を統合できる。

## Design Decisions

### Decision: 記述式入力モード（TextInputMode）の再定義とマッピング
- **Context**: 文字数指定が排他モードから全項目へのオプションへと変更されるため、`TextInputMode` の定義をリファクタリングする必要がある。
- **Alternatives Considered**:
  1. `textInputMode` と `textInputCharType` の二つのフィールドに分離する。
  2. `textInputMode` の役割を文字種定義に変更し、`textInputCharCount`（文字数）は独立したオプションとして扱う。
- **Selected Approach**: オプション 2。`textInputMode` の型を `'free' | 'kanji' | 'katakana' | 'alphabet' | 'numeric'` とする。
- **Rationale**: 既存の `textInputCharCount` フィールドがそのまま流用でき、かつデータモデルの変更が最小限で済むため。
- **Trade-offs**: 既存の `'char-count'` というモード名が消えるため、既存クイズを読み込む際に後方互換マッピング（`textInputMode: 'free'`, `textInputCharCount: X`）を行う必要がある。
- **Follow-up**: クイズ一覧ロード時および問題ロード時の変換マッピング関数の適用。

## Risks & Mitigations
- **既存クイズのロード失敗／表示ズレ**: データベース内の古いクイズデータが破壊されないよう、読み込み側の UI / Service 共通で `resolveTextInputMode` を使用し、安全に型をアップキャストする。
- **正解候補入力時と回答判定時の変換の不一致**: 変換および判定処理をすべて `text-answer-utils.ts` 内の単一の関数 `isTextInputAnswerCorrect` に集約し、二重管理を防ぐ。
