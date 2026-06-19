# Firestore to BigQuery 既存データ移行ガイド

本ドキュメントは、Firestore の `attempts` コレクションに存在する既存の解答履歴データを、Firebase Extension (`firestore-bigquery-export`) を介して BigQuery に一括インポートするための手順書です。

## 前提条件

1. **Google Cloud SDK (gcloud)** がローカルまたは移行実行環境にインストールされており、認証が完了していること。
2. 対象プロジェクトの書き込み権限（BigQueryのデータ編集者、Firestoreの閲覧者権限など）を有していること。
3. Node.js 18以上がインストールされていること。

## 実行手順

### 1. プロジェクトの設定と認証
インポートスクリプトを実行する環境で、対象の Firebase / Google Cloud プロジェクトを設定し、アプリケーションのデフォルト認証情報を設定します。

```bash
# Google Cloud 認証
gcloud auth login

# プロジェクトIDの設定
gcloud config set project your-project-id

# アプリケーションデフォルト資格情報（ADC）の設定
gcloud auth application-default login
```

### 2. インポートスクリプトの実行

Firebase Extensions 公式のインポートツール `fs-bq-import-collection` を使用して、既存データを一括エクスポートします。

```bash
npx @firebaseextensions/fs-bq-import-collection \
  --project your-project-id \
  --source-collection-path attempts \
  --dataset attempts_dataset \
  --table-name attempts_raw \
  --batch-size 300
```

#### パラメータ解説：
- `--project`: 移行対象の Firebase / Google Cloud プロジェクトID。
- `--source-collection-path`: ソースとなる Firestore コレクション名（`attempts`）。
- `--dataset`: 同期先 BigQuery データセット名。Extension の設定と一致させてください。
- `--table-name`: 同期先 BigQuery テーブル名。Extension の設定と一致させてください（通常は `attempts_raw`）。
- `--batch-size`: 1回のリクエストで読み書きするバッチサイズ。メモリ制限やAPIレートリミットを回避するため、300〜500程度を推奨します。

### 3. 進捗と完了の確認

インポートスクリプトを実行すると、コンソールに進捗状況（インポートされたドキュメント数）が表示されます。
`Source collection has ... documents. Import complete!` と表示されれば完了です。

BigQuery コンソールを開き、`attempts_dataset.attempts_raw` テーブルにデータが正しく追加されていること、および `attempts_raw_latest` ビューでデータが反映されていることを確認します。

## 注意事項

- **移行中の書き込み競合**:
  スクリプト実行中に発生した新規プレイデータも、Extensionのリアルタイム同期機能によって同時に BigQuery に挿入されます。インポートツールはドキュメントIDに基づきべき等に動作するため、データが重複することはありません。
- **データ転送量とコスト**:
  Firestore の読み取り回数（全件読み取り）および BigQuery への書き込み回数が発生します。本番環境で大量のデータが存在する場合は、実行前に無料枠やコスト（特にFirestore Read）を確認してください。
- **スキーマ反映遅延**:
  移行した過去データに `questionAnswerDetails` フィールドが存在しない（本機能リリース前のデータ）場合、BigQuery 上で対応するカラムは `NULL` になります。
