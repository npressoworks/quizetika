# Requirements Document

## Project Description (Input)

**誰が困っているか**: このBigQuery連携パイプラインの運用・保守を担う開発者自身。将来的にクイズデータ・プレイ行動データをAI開発企業等への学習データとして販売することを見据えており、その商品価値を最大化できるデータ蓄積基盤が必要だが、パイプラインが機能停止したまま放置されている。

**現状**: 従来はFirestore + Firebase Extension「firestore-bigquery-export」により、`attempts`コレクションへの書き込みをトリガーにBigQueryへリアルタイムストリーミング転送していた（旧spec: `.kiro/specs/quizeum-analytics-bigquery`）。しかしFirebase→Supabaseへの段階移行（Phase 35〜36、`.kiro/specs/supabase-*`）が完了し、`attempts`を含む全コアデータの書き込み先がSupabase（PostgreSQL）に切り替わったため、Firestore書き込みをトリガーとする旧Extensionは発火しなくなり事実上機能停止している。`extensions/firestore-bigquery-export.env`や`scripts/bq-import-guide.md`も旧Firestore前提のまま孤立して残存している。

**何を変えるべきか**: Supabase Database Webhooks（テーブル変更イベント検知）+ サーバーレス関数（Supabase Edge Functions想定）を用いて、SupabaseのPostgreSQLデータの変更をトリガーにBigQueryへデータをストリーミング転送する新しいパイプラインを設計・実装する。AI学習データとしての販売を見据え、対象データの範囲・構造を「学習データセットとしての価値」の観点で定義し直す。あわせて、旧Extension設定ファイル・旧インポート手順書・旧spec（`quizeum-analytics-bigquery`）の要否についても本specの中で整理する。

## Introduction

本スペックは、Firebase→Supabase移行の完了に伴い機能停止したBigQuery連携パイプラインを、AI学習データとしての外部提供（販売）を見据えたデータ蓄積基盤として再構築するものです。

学習データとしての商品価値は次の3層で構成されると定義します。

1. **知識コンテンツ層**: クイズ本体（設問文、選択肢、正解、解説、ヒント、ジャンル・タグ・難易度）。Q&A形式の知識データセットとしての価値。
2. **人間行動層**: 問題単位の解答行動（正誤、解答時間、ヒント使用、回答変更、自由記述回答）、およびウミガメのスープ（水平思考クイズ）における人間とAIの対話履歴。人間の推論過程・誤答パターン・対話データとしての価値。
3. **品質シグナル層**: 難易度投票、クイズレビュー評価、集計統計（正答率等）。データの品質ラベル・人間の選好データとしての価値。

これら3層を、個人を特定できる情報を含まない形で、プレイ時点のクイズ内容と解答行動を正しく対応付けられる構造でBigQueryへ自動同期します。あわせて、同期の信頼性（再送・重複排除・削除反映）、外部提供時のデータガバナンス境界、旧Firestoreベース資産の整理についても定義します。

## Boundary Context

- **In scope**:
  - 知識コンテンツ層: `quizzes`および`questions`（設問文・選択肢・正解・解説・ヒント・ジャンル・タグ・難易度・出典URL等）の変更を検知したBigQueryへの自動同期。
  - 人間行動層: `attempts`（スコア、経過時間、問題単位の解答詳細`question_answer_details`、ウミガメのスープのAI対話履歴`ai_questions_history`・真相解答試行`ai_truth_attempts`を含む）の変更を検知したBigQueryへの自動同期。
  - 品質シグナル層: `difficulty_votes`（難易度投票）および`quiz_reviews`（レビュー評価・コメント）の変更を検知したBigQueryへの自動同期。
  - プレイ時点整合性: クイズ内容が後から編集されても、各プレイ結果をそのプレイ時点のクイズ内容と対応付けて分析できる情報の保持。
  - 同期の信頼性確保（一時的な送信失敗時の再送、重複排除のための識別情報保持、ソースレコード削除の反映）。
  - 外部提供を見据えたデータガバナンス境界の定義（個人情報の除外、自由記述テキストの取り扱い、削除要求の反映可能性）。
  - 旧Firestoreベースのパイプライン資産（旧Firebase Extension設定、旧データインポート手順書、旧spec `quizeum-analytics-bigquery`）の位置づけの整理。
- **Out of scope**:
  - `users`テーブル（表示名・メールアドレス・プロフィール画像・レピュテーション等の個人情報）のBigQueryへの同期。
  - Supabase移行完了後にすでに蓄積された既存データの一括バックフィル（今後の新規変更分のみを対象とし、過去データの移行は別タスクとする）。
  - BigQuery上のデータを直接参照するアプリケーション画面・ダッシュボードの実装（アプリ画面は引き続きSupabaseを直接参照）。
  - クイズプレイ画面以外のユーザー行動トラッキング（PostHog等の管轄）。
  - 実際のデータ販売に関する法務・契約・利用規約の改定作業そのもの（本specはデータ構造面で外部提供に耐える状態を作ることに責任を持ち、提供可否の法的判断は所有しない）。
- **Adjacent expectations**:
  - `supabase-gameplay` / `supabase-core-data` は、`attempts`・`quizzes`・`questions`等のスキーマおよび書き込み経路が安定して提供されることを期待する。
  - 本パイプラインは、`attempts`への`difficulty_vote`等の事後更新や、クイズの公開後編集が今後も発生することを前提とする。
  - 旧spec `quizeum-analytics-bigquery` が定義したクライアント側の解答詳細トラッキング実装（`QuestionAnswerDetail`等のデータモデル）は、本specの対象外としてそのまま活用され、再設計は行わない。
  - 外部提供時にユーザー同意（利用規約）が必要となる場合、その規約整備は別途プロダクト側で行われることを期待する。

## Requirements

### Requirement 1: 分析対象データ変更のBigQueryへの自動同期

**Objective:** As a パイプライン運用者, I want Supabase上の分析対象データの変更が自動的にBigQueryへ反映される, so that 手動エクスポートなしに常に最新の学習データ候補が蓄積される

#### Acceptance Criteria

1. When `attempts`テーブルにレコードが挿入または更新されたとき, the BigQuery Sync Pipeline shall 対応するデータをBigQueryへ自動的に送信する。
2. When `quizzes`または`questions`テーブル（およびその問題構成）のレコードが作成または更新されたとき, the BigQuery Sync Pipeline shall 対応するクイズ内容データをBigQueryへ自動的に送信する。
3. When `difficulty_votes`または`quiz_reviews`テーブルのレコードが作成または更新されたとき, the BigQuery Sync Pipeline shall 対応する品質シグナルデータをBigQueryへ自動的に送信する。
4. The BigQuery Sync Pipeline shall 手動操作を必要とせず、対象テーブルの変更イベント発生を起点として自動的にBigQueryへのデータ反映を行う。

### Requirement 2: AI学習データセットとしてのデータ構成

**Objective:** As a 将来のデータ提供（販売）担当者, I want クイズ知識・人間の解答行動・品質シグナルが学習データとして利用しやすい構成で蓄積される, so that 外部のAI開発用途に対して価値あるデータセットを構成できる

#### Acceptance Criteria

1. The BigQuery Sync Pipeline shall クイズ内容として設問文・選択肢・正解・解説・ヒント・問題形式・ジャンル・タグ・難易度・出典URLを同期対象に含める。
2. The BigQuery Sync Pipeline shall プレイ結果として問題単位の解答詳細（正誤、解答秒数、ヒント使用数、回答変更有無、選択肢提示順、自由記述回答等）を同期対象に含める。
3. The BigQuery Sync Pipeline shall ウミガメのスープ（水平思考クイズ）における人間の質問とAIの応答の対話履歴、および真相解答の試行内容を同期対象に含める。
4. The BigQuery Sync Pipeline shall 品質シグナルとして難易度投票の値、レビュー評価値、およびレビューコメントを同期対象に含める。
5. The BigQuery Sync Pipeline shall 各レコードに発生時刻（プレイ完了時刻・作成時刻・更新時刻等）を保持し、時系列での抽出を可能にする。
6. Where 解答詳細が設問への参照を持つ場合, the BigQuery Sync Pipeline shall 解答詳細レコードと対応する設問内容レコードを結合して分析できる識別子を保持する。

### Requirement 3: プレイ時点整合性（クイズ内容と解答行動の対応付け）

**Objective:** As a 将来のデータ提供（販売）担当者, I want クイズが後から編集されても各プレイ結果をプレイ時点のクイズ内容と対応付けられる, so that 「出題内容と解答行動の組」として整合性のある学習データを提供できる

#### Acceptance Criteria

1. When クイズ内容（設問文・選択肢・正解等）が更新されたとき, the BigQuery Sync Pipeline shall 更新前の内容を上書き消去せず、変更履歴として時系列に蓄積する。
2. The BigQuery Sync Pipeline shall 各プレイ結果レコードを、そのプレイ完了時点で有効だったクイズ内容の版と対応付けて抽出できる情報（識別子と時刻）を保持する。

### Requirement 4: プライバシー境界とデータガバナンス

**Objective:** As a 将来のデータ提供（販売）担当者, I want 個人を特定できる情報が同期データに含まれない, so that プライバシーリスクを抑えて外部提供に耐えるデータセットを維持できる

#### Acceptance Criteria

1. The BigQuery Sync Pipeline shall `users`テーブル（表示名、メールアドレス、プロフィール画像、レピュテーション等）を同期対象に含めない。
2. Where 同期対象テーブルに投稿者の表示名・アバター画像等の個人情報カラム（`author_name`、`author_avatar`等）が含まれる場合, the BigQuery Sync Pipeline shall 当該カラムを同期データから除外する。
3. Where 同期対象データがユーザーへの参照（user_id、author_id、reviewer_id等）を保持する場合, the BigQuery Sync Pipeline shall それらを内部識別子（UUID）としてのみ保持し、表示名やメールアドレス等の直接的な個人情報に解決される形では送信しない。
4. If 同期対象外と定義されたテーブルのデータ変更がイベントとして検知されたとき, the BigQuery Sync Pipeline shall そのイベントをBigQueryへの送信対象から除外する。
5. The Project Documentation shall 自由記述テキスト（記述式回答、AI対話の質問文、レビューコメント等）にユーザーが偶発的に個人情報を入力し得ることを、外部提供時の留意事項として明記する。

### Requirement 5: 同期の信頼性とデータ欠損防止

**Objective:** As a パイプライン運用者, I want 同期処理が失敗してもデータが失われない, so that BigQuery側のデータが常に信頼できる状態を保てる

#### Acceptance Criteria

1. If BigQueryへのデータ送信が一時的に失敗したとき, the BigQuery Sync Pipeline shall 対象データを破棄せず自動的に再送を試みる。
2. If 再送を繰り返してもBigQueryへの送信が成功しないとき, the BigQuery Sync Pipeline shall その失敗を運用者が検知できる状態にする。
3. Where 同一の変更イベントに対して重複してBigQueryへの送信が発生した場合, the BigQuery Sync Pipeline shall 分析時にレコードを一意に識別し重複を排除できる情報を保持する。
4. If ソーステーブル上のレコードが削除されたとき（ユーザーアカウント削除に伴う連鎖削除を含む）, the BigQuery Sync Pipeline shall 対応するBigQuery側のレコードが削除済みであると判別できる状態にし、削除済みデータを外部提供用データセットから除外できるようにする。

### Requirement 6: 旧Firestoreベースパイプライン資産の整理

**Objective:** As a このリポジトリの開発者・保守担当者, I want 旧Firestoreベースの連携資産の現状が明確になっている, so that どちらの資産が現行運用かを迷わず判断できる

#### Acceptance Criteria

1. When 新しいBigQuery Sync Pipelineが稼働可能になったとき, the Project Documentation shall 旧Firebase Extension（`firestore-bigquery-export`）の設定が現行運用ではないことを明示する。
2. When 新しいBigQuery Sync Pipelineが稼働可能になったとき, the Project Documentation shall 旧データインポート手順書および旧spec（`quizeum-analytics-bigquery`）それぞれの位置づけ（更新・アーカイブ・削除のいずれか）を明確にする。
