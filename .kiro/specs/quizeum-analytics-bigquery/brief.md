# Brief: quizetika-analytics-bigquery

## Problem
将来的に企業やAI向けにクイズ統計、ユーザーの解答データ、およびユーザーの統計データを提供したいが、現状のデータモデルでは問題ごとの解答詳細や解答時間などが細かく保持されておらず、また統計データを分析しやすい形で BigQuery 等のデータウェアハウスに連携・同期する仕組みが存在しない。

## Current State
- 解答結果は `attempts` コレクションに保存されているが、問題ごとのデータは `questionAnswers`（問題IDと回答テキストのマップ）のみで、詳細な解答時間や正誤、選択肢の変更、ヒントの使用回数などのログがない。
- データの BigQuery 連携経路が確立されておらず、手動のエクスポートまたは個別のバッチ処理が必要な状態。

## Desired Outcome
- `attempts` コレクションが拡張され、各問題ごとの詳細データ（解答時間、正誤、ヒント使用数、選択順、回答変更有無、記述回答内容など）が配列として含まれるようになる。
- Firebase Extension (`firestore-bigquery-export`) が設定され、`attempts` コレクションの更新が自動的かつリアルタイムに BigQuery にストリーミングされる。
- 既存の `attempts` データについても BigQuery へ移行・インポートできる手順とツールが整備される。
- BigQuery 上で `questionAnswerDetails` の `REPEATED STRUCT` 構造をアンネストして分析できるビューやスキーマ設計が定義される。

## Approach
- Firestore の `attempts` の中に `questionAnswerDetails` 配列を追加し、1つの attempt ドキュメントにすべての詳細情報を内包する「ARRAY/STRUCT 包含スキーマ設計」を採用。
- `QuestionAnswerDetail` のデータ構造は、Quizetika に存在するすべての問題形式（真偽値、多肢選択、記述、早押し、並べ替え、連想、水平思考）に対応する以下の汎用設計とします：
  ```typescript
  export interface QuestionAnswerDetail {
    questionId: string;
    questionType: 'true-false' | 'multiple-choice' | 'text-input' | 'quick-press' | 'sorting' | 'association' | 'lateral-thinking';
    isCorrect: boolean;
    elapsedSeconds: number; // この問題の解答にかかった時間（秒、ミリ秒精度含む）
    hintsUsedCount: number; // 使用したヒント数

    // 1. 選択式・真偽値クイズ用 (multiple-choice, true-false)
    selectedChoiceId?: string | null;      // 選択した選択肢ID
    choicesOrder?: string[] | null;        // 提示された選択肢IDのシャッフル順
    choicesInteractionsCount?: number;     // 決定までに選択肢をクリック・変更した回数

    // 2. 記述式・短答・早押しクイズ用 (text-input, quick-press, association)
    userAnswer?: string | null;            // 入力された回答文字列（記述・短答・連想用）
    quickPressSeconds?: number | null;     // 早押しボタンを押すまでの経過時間

    // 3. 並び替えクイズ用 (sorting)
    initialItemOrder?: string[] | null;    // 提示時の初期アイテム順
    finalItemOrder?: string[] | null;      // ユーザーが決定した最終アイテム順

    // 4. 水平思考クイズ用 (lateral-thinking)
    aiTurnCount?: number | null;           // 質問ターン数
    truthSummary?: string | null;          // 真相解答の最終テキスト
    lateralPlayEndedStatus?: 'passed' | 'gave_up' | null; // 合格/リタイアのステータス
  }
  ```
- Firebase Extension (`firestore-bigquery-export`) を用いて、追加コードなしで Firestore から BigQuery へのリアルタイムデータレプリケーションを構築する。
- 過去データについては一括インポート用 CLI スクリプトの実行ガイドを構築する。

## Scope
- **In**:
  - `quizetika-analytics-bigquery` スペック内の要件定義、および BigQuery 側のスキーマ設計（スキーマ定義ファイルの作成）
  - Firebase Extension の初期設定ガイド、パラメータ設定の定義
  - BigQuery に同期された raw データを分析用にフラット化するためのビュー（View）作成用 SQL スクリプトの作成
  - 既存 Firestore データの一括エクスポート/インポート手順マニュアルとスクリプトガイド
- **Out**:
  - Next.js アプリケーションコード内での BigQuery 直接書き込み SDK コードの実装
  - BIツール（Looker Studio等）の構築や、企業向けのデータ販売用 API の作成

## Boundary Candidates
- [BigQuery Schema] `attempts` テーブルおよびアンネストされた解答ビューの SQL スクリプト
- [Extension Guide] Firebase Extension (`firestore-bigquery-export`) の設定内容

## Out of Boundary
- PostHog を用いたユーザーのプロダクト行動イベントの BigQuery 連携

## Upstream / Downstream
- **Upstream**: `quizetika-core` (Firestore スキーマ定義・保存トランザクション)
- **Downstream**: 将来的な企業向けデータエクスポート API、 Looker Studio ダッシュボード

## Existing Spec Touchpoints
- **Extends**: `quizetika-core`
- **Adjacent**: なし

## Constraints
- Firebase Extension は `attempts` コレクション（および将来的に `quizzes`, `users`）をソースとする。
- BigQuery 側の課金およびアクセス制御設計は GCP のベストプラクティスに従う。
