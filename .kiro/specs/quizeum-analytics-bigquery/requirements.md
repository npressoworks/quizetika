# Requirements Document

## Introduction
本スペックは、将来的な企業およびAI向けクイズ統計・回答・ユーザーデータの提供を見据え、クイズプレイ時のすべての問題形式に対応した詳細な回答データ（解答時間、正誤、ヒント使用履歴、選択順、回答変更有無、記述回答内容など）を蓄積し、データ分析基盤（BigQuery）へリアルタイムに同期・出力する機能を定義します。

## Boundary Context
- **In scope**:
  - クイズプレイ時の各問題単位での詳細解答情報（解答秒数、正誤、ヒント使用数、選択肢の変更有無、選択肢シャッフル順、入力回答内容など）の測定と一時保存、および試行（Attempt）完了時の Firestore への一括書き込み。
  - すべての問題形式（真偽値、多肢選択、記述、早押し、並べ替え、連想、水平思考）に対する詳細解答オブジェクト `QuestionAnswerDetail` のデータモデル定義。
  - オフラインプレイ時における解答詳細情報の `localStorage` への保存と、オンライン復帰時の同期機能。
  - `attempts` コレクションに保存されたプレイ結果データの BigQuery へのストリーミング同期（Firebase Extension の機能動作の定義）。
  - BigQuery 上で `questionAnswerDetails` 配列をアンネストして分析するための SQL ビュー of スキーマ定義。
  - 既存のクイズプレイ履歴（`attempts`）データを BigQuery へ移行・インポートする CLI ツールの実行手順。
- **Out of scope**:
  - クイズプレイ画面以外のユーザー行動（ホバー、クリック、ページ遷移など）のトラッキングおよび BigQuery 同期（PostHog 等のプロダクト分析ツールの管轄）。
  - BigQuery テーブルの直接読み取りを行う Next.js アプリケーション画面の実装（アプリ画面上では引き続き Firestore を参照）。
  - クイズ解答詳細の他ユーザーへの公開（非公開の統計・履歴データとして扱う）。
- **Adjacent expectations**:
  - `quizetika-core` は、拡張された `Attempt` 型の Firestore への永続化、セキュリティルール、および保存トランザクションを正常に処理できることを期待します。
  - `quizetika-ui-quiz-lifecycle` は、クイズプレイ画面において各問題の表示タイミング、決定アクション、ヒント表示アクションをフックし、`QuestionAnswerDetail` オブジェクトを構築できることを期待します。
  - Firebase Extension (`firestore-bigquery-export`) は、Firestore の書き込みイベントを検知し、指定された BigQuery データセットへ自動的にデータをストリーミングすることを期待します。

## Requirements

### Requirement 1: 問題解答詳細データのトラッキングと蓄積
**Objective:** As a クイズプレイエンジン, I want プレイ中の各問題に対する詳細な解答データを収集し、Attempt 完了時に保存する, so that 統計データとして詳細なプレイ結果を分析できるようにする

#### Acceptance Criteria
1. When クイズのプレイ画面で新しい問題が表示されたとき, the Play Service shall 各問題の解答開始時間（ミリ秒単位）の測定を開始する。
2. When ユーザーが回答を決定した（または制限時間切れ／スキップが発生した）とき, the Play Service shall 解答開始から決定までの経過秒数（ミリ秒精度を含む秒数）を `elapsedSeconds` として記録する。
3. When ユーザーが問題プレイ中にヒントを表示させたとき, the Play Service shall 当該問題の `hintsUsedCount` を 1 加算する。
4. When ユーザーが選択肢をクリックして最初に選んだものから別の選択肢へ回答を変更したとき, the Play Service shall 当該問題の `answerChanged` を true に設定する（決定までのクリック数が2回以上の場合）。
5. When ユーザーが解答を完了し、クイズ全体の試行結果を保存するとき, the Play Service shall すべての問題に対する `QuestionAnswerDetail` の配列を `questionAnswerDetails` フィールドとして `attempts` ドキュメントに保存する。

### Requirement 2: すべての問題形式に対する詳細情報の収集
**Objective:** As a クイズプレイエンジン, I want クイズの問題形式に応じた専用の解答ログを構築する, so that 形式に特化したプレイ行動分析を行えるようにする

#### Acceptance Criteria
1. Where 問題形式が `true-false` または `multiple-choice` のとき, the Play Service shall 選択された選択肢ID (`selectedChoiceId`)、提示された選択肢のシャッフル順 (`choicesOrder`)、および決定までのクリック回数 (`choicesInteractionsCount`) を記録する。
2. Where 問題形式が `text-input`、`quick-press`、または `association` のとき, the Play Service shall ユーザーが入力した回答文字列 (`userAnswer`) を記録する。
3. Where 問題形式が `quick-press` のとき, the Play Service shall 問題読み上げ（またはストリーミング）開始から早押しボタンが押されるまでの経過秒数 (`quickPressSeconds`) を記録する。
4. Where 問題形式が `sorting` のとき, the Play Service shall 提示された初期の並び順 (`initialItemOrder`) と、ユーザーが決定した最終の並び順 (`finalItemOrder`) のID配列を記録する。
5. Where 問題形式が `lateral-thinking` のとき, the Play Service shall AIとの対話質問回数 (`aiTurnCount`)、最終提出された真相解答テキスト (`truthSummary`)、およびクリアまたはギブアップのステータス (`lateralPlayEndedStatus`) を記録する。

### Requirement 3: オフラインプレイ時のデータ永続化とオンライン同期
**Objective:** As a ユーザー, I want オフライン状態でプレイした詳細な解答履歴がオンライン復帰時に失われずに保存される, so that 通信環境に関わらず詳細なプレイ結果が分析対象として残るようにする

#### Acceptance Criteria
1. While ネットワークがオフラインのとき、かつクイズプレイが完了したとき, the Play Service shall 拡張された `QuestionAnswerDetail[]` 配列を含むプレイ結果データをローカルの `localStorage` （またはオフラインセッションバッファ）に一時保存する。
2. When ネットワークがオンラインに復旧したとき, the Play Service shall ローカルに保留されている詳細解答履歴付きの attempt データを Firestore の `attempts` コレクションへ自動的に同期送信する。
3. If 同期送信中にエラーが発生したとき, the Play Service shall 同期をロールバックし、次回オンライン復旧時または手動同期時に再送信できるようにローカルデータを保持する。

### Requirement 4: BigQuery への自動データ同期と分析スキーマ
**Objective:** As a データアナリスト・AI企業, I want Firestore に保存されたクイズプレイ結果が BigQuery にリアルタイムで同期され、アンネストしてクエリできる, so that 面倒な手動エクスポートなしで常に最新の統計データを分析できる

#### Acceptance Criteria
1. When Firestore の `attempts` コレクションに新しいドキュメントが追加または更新されたとき, the BigQuery Sync Service shall BigQuery の `attempts_raw` テーブルへ即座にレコードをストリーミング挿入する。
2. The BigQuery Schema shall `questionAnswerDetails` を `RECORD` 型の `REPEATED` （配列構造）として定義する。
3. The BigQuery View shall `attempts_raw` から `questionAnswerDetails` を `LEFT JOIN UNNEST` でフラットな行に展開し、問題ごとの正誤・解答時間・回答内容を直接クエリできる分析用ビューを提供する。
