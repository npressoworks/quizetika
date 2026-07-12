# BigQuery Export パイプライン 運用README

Supabase(PostgreSQL)上の分析対象データ変更を、Transactional Outbox + Edge Function経由でBigQuery
(`quizetika_analytics`データセット)へ自動同期するパイプラインの運用手順書です。

対象specは `.kiro/specs/supabase-bigquery-export`（要件は `requirements.md`、設計は `design.md` を参照）。

## パイプライン概要

1. `attempts` / `quizzes` / `questions` / `quiz_questions` / `quiz_tags` / `difficulty_votes` / `quiz_reviews`
   への書き込み(INSERT/UPDATE/DELETE)を、許可カラム列挙方式(ホワイトリスト)のキャプチャトリガーが検知し、
   PIIカラム(`author_name`/`author_avatar`等)を除外したイベント行を `analytics_outbox` テーブルへ記録する。
   `users` テーブルにはトリガーを設置していない(構造的に同期対象外)。
2. `analytics_outbox` へのINSERTを配送トリガーが検知し、Vaultに保持したWebhookシークレット/URLを使って
   `net.http_post` でEdge Function `bigquery-export` を起床させる(ペイロードは空、起床通知のみ)。
3. Edge Functionが `pending` 行をバッチ取得し、Googleサービスアカウント認証でBigQuery
   `tabledata.insertAll` へ送信し、成功行を `sent` に消込む。
4. pg_cronが再送ジョブ(毎分、`pending`が2分以上滞留していれば再通知)とパージジョブ(毎日、`sent`かつ
   30日超の行を削除。`failed`は削除しない)を実行する。

関連マイグレーション:
- `supabase/migrations/20260713000000_bigquery_export_outbox.sql` — pg_net/pg_cron有効化、`analytics_outbox`テーブル
- `supabase/migrations/20260714000000_bigquery_export_capture_core.sql` — `attempts`/`quizzes`/`questions`のキャプチャトリガー
- `supabase/migrations/20260715000000_bigquery_export_capture_quality.sql` — `quiz_questions`/`quiz_tags`/`difficulty_votes`/`quiz_reviews`のキャプチャトリガー
- `supabase/migrations/20260716000000_bigquery_export_delivery.sql` — 配送トリガー(Vaultベースのシークレット/URL、`net.http_post`)、pg_cron再送/パージジョブ
- `supabase/migrations/20260717000000_bigquery_export_outbox_claim_rpc.sql` — `claim_pending_analytics_events`/`increment_analytics_outbox_retry` RPC

Edge Function本体: `supabase/functions/bigquery-export/{index.ts, google-auth.ts, bigquery.ts, outbox.ts, types.ts, deno.json}`

## セットアップ手順(新規環境・本番デプロイ)

### 1. GCPサービスアカウントの作成(最小権限)

BigQueryの対象データセットに対して `roles/bigquery.dataEditor` のみを付与したサービスアカウントを作成する。
実際の本番デプロイではプロジェクト `quizetika` に対して以下を実行済み(SA:
`bigquery-export-sa@quizetika.iam.gserviceaccount.com`)。新規環境でも同じ手順を踏む。

> **プロジェクト移行の経緯**: 当初は `quizeum-77bc6` プロジェクトで検証していたが、2026-07-11に新規GCP
> プロジェクト `quizetika` へ切り替えた。`quizeum-77bc6` 側に作成したサービスアカウント・データセット・
> テーブル・ビューはそのまま残存している(削除は別途判断が必要)。以降このREADMEおよびコード中の
> `<GCP_PROJECT_ID>` は特記なき限り `quizetika` を指す。

```powershell
gcloud iam service-accounts create bigquery-export-sa `
  --project=<GCP_PROJECT_ID> `
  --display-name="BigQuery Export Pipeline"

gcloud projects add-iam-policy-binding <GCP_PROJECT_ID> `
  --member="serviceAccount:bigquery-export-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com" `
  --role="roles/bigquery.dataEditor"

gcloud iam service-accounts keys create bigquery-export-sa-key.json `
  --iam-account="bigquery-export-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com"
```

生成された鍵JSONファイルはリポジトリにコミットしない。`GCP_SERVICE_ACCOUNT_JSON` secretの値として使うのみで、
使用後は安全な場所に保管するか破棄する。

### 2. BigQuery DDLの適用(データセット・テーブル・ビュー)

`scripts/bigquery/setup.sql`(データセット`quizetika_analytics` + `raw_events`テーブル)を先に適用し、
その後 `scripts/bigquery/views.sql`(分析ビュー10本)を適用する。

```powershell
bq query --project_id=<GCP_PROJECT_ID> --use_legacy_sql=false < scripts/bigquery/setup.sql
bq query --project_id=<GCP_PROJECT_ID> --use_legacy_sql=false < scripts/bigquery/views.sql
```

**Windows `bq` CLIの表示バグに注意**: 日本語コメントを含むSQLファイルをパイプ実行すると、Windows版`bq` CLIは
`UnicodeEncodeError`(cp932)を標準出力に表示することがあるが、これは表示のみの問題でBigQueryジョブ自体は
成功している場合が多い。CLIの終了コード/標準出力だけで成否判定せず、必ず以下で実体を確認すること。

```powershell
bq show <GCP_PROJECT_ID>:quizetika_analytics.raw_events
bq ls -j -a --project_id=<GCP_PROJECT_ID>
```

### 3. シークレットの設定(Edge Function側 + DB Vault側の両方が必要)

Edge Function側のsecrets(`.env.local.example`の該当4項目を参照):

```powershell
supabase secrets set `
  GCP_SERVICE_ACCOUNT_JSON="$(Get-Content bigquery-export-sa-key.json -Raw)" `
  BQ_PROJECT_ID="<GCP_PROJECT_ID>" `
  BQ_DATASET_ID="quizetika_analytics" `
  ANALYTICS_WEBHOOK_SECRET="<十分に長いランダム値>" `
  --project-ref <SUPABASE_PROJECT_REF>
```

**⚠️ Windows PowerShellでの既知の罠(実際に本番デプロイで発生)**: `KEY="$(Get-Content ...)"`のようにJSON文字列を
コマンドライン引数としてインラインで渡すと、PowerShell→`npx`→Node.jsの引数受け渡しの過程で**JSON内の二重引用符が
サイレントに失われ**、`GCP_SERVICE_ACCOUNT_JSON`が壊れたJSON(例: `{id: xxx}`のように引用符抜け)として設定されて
しまうことがある。これはEdge Function側では`JSON.parse()`失敗として現れ、配送トリガーのリクエストは200 OKで
届くにもかかわらずEdge Functionが`{"error":"internal error"}`(HTTP 500)を返し続けるという分かりにくい障害になる
(`net._http_response`のstatus_codeで気づける)。

**対策**: JSON形式の値(特に`GCP_SERVICE_ACCOUNT_JSON`)は、インライン引数ではなく`--env-file`オプションで
設定すること。

```powershell
# .envファイルに1行で書き出す(JSON内の改行は\nエスケープ済みのため元々単一行のはず)
$saKeyJson = Get-Content bigquery-export-sa-key.json -Raw
$envContent = "GCP_SERVICE_ACCOUNT_JSON=$saKeyJson"
[System.IO.File]::WriteAllText("prod-secrets.env", $envContent, [System.Text.Encoding]::UTF8)

supabase secrets set --project-ref <SUPABASE_PROJECT_REF> --env-file prod-secrets.env
```

設定後は必ず動作確認(下記「動作確認」)まで行い、`net._http_response`に200が記録されることを確認すること。

**重要(見落としやすい手動ステップ)**: マイグレーション`20260716000000_bigquery_export_delivery.sql`は
Vaultに `analytics_webhook_secret` / `analytics_webhook_url` を**ローカル開発用プレースホルダ値**
(`local-dev-placeholder-CHANGE-ME` / `http://host.docker.internal:54321/...`)で自動作成するのみで、
本番の実値には**どのマイグレーションも自動更新しない**。Edge Functionをデプロイした後、必ず手動で以下を
実行し、上記の`ANALYTICS_WEBHOOK_SECRET`と完全に一致する値・実際にデプロイされたFunction URLへ更新すること。
これを忘れると配送トリガーが401を受け続け「なぜ動かないのか」の典型的な原因になる。

```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'analytics_webhook_secret'),
  '<supabase secrets setで設定したANALYTICS_WEBHOOK_SECRETと同じ値>'
);

SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'analytics_webhook_url'),
  'https://<project-ref>.supabase.co/functions/v1/bigquery-export'
);
```

### 4. マイグレーション適用とEdge Functionデプロイ

```powershell
supabase db push
supabase functions deploy bigquery-export --project-ref <SUPABASE_PROJECT_REF>
```

デプロイ後、テストプレイ等で対象テーブルに書き込みを行い、`analytics_outbox`の該当行が`sent`に遷移し、
BigQuery `raw_events`にイベントが到達することを確認する(下記「動作確認」参照)。

### トラブルシューティング: ローカル開発でのポートフォワーディング制約

一部のサンドボックス/ローカル開発環境では、ホストからDockerコンテナへのポートフォワーディング(54321等)が
機能しないことがある。この場合、ホストから直接 `curl http://localhost:54321/...` を叩いても
(このEdge Functionに限らず既存のあらゆるサービスも含めて)失敗する既知の環境制約であり、コードの不具合では
ない。回避策として、Dockerネットワーク内から確認する。

```powershell
docker exec <kong container名> curl -s -X POST http://bigquery-export:8000/... # 例
# または一時的なcurlコンテナをsupabase_network_<project>ネットワークに接続して実行する
```

**この制約は本番のSupabaseホスト型プロジェクトには一切存在しない**(ローカルDocker特有の問題であり、
デプロイ手順そのものには影響しない)。

## 動作確認(デプロイ後の一気通貫チェック)

1. テストプレイ等で対象テーブル(例: `attempts`)へ書き込みを行う。
2. `analytics_outbox` の該当`event_id`行が数秒以内に `status = 'sent'` へ遷移することを確認する。
3. BigQuery `quizetika_analytics.raw_events` に同じ `event_id` の行が到達していることを確認する。
   ```sql
   SELECT * FROM `<GCP_PROJECT_ID>.quizetika_analytics.raw_events` WHERE event_id = '<確認したいevent_id>';
   ```

## 監視クエリ

`analytics_outbox`に対して以下2本のクエリを定期的(または障害調査時)に実行する。

### 1. `failed`行の検出(即対応が必要)

retry上限(10回)を超えて恒久的に送信失敗した行。BigQueryに永久に反映されないため、原因調査(GCP認証エラー・
BigQueryスキーマ不整合等は`last_error`列を参照)と、解消後の手動リセット(`status`を`pending`へ戻す)が必要。

```sql
SELECT event_id, table_name, event_type, occurred_at, retry_count, last_error
FROM analytics_outbox
WHERE status = 'failed'
ORDER BY occurred_at DESC;
```

### 2. `pending`滞留の検出(配送系の障害兆候)

本来は数秒〜長くても再送ジョブの周期(毎分)以内に`sent`へ遷移するはずの行が10分以上`pending`のまま
残っている場合、Edge Functionのダウン、Vaultシークレット/URLの設定ミス(上記セットアップ手順3参照)、
GCP認証エラーなど配送パイプライン全体の障害を示唆する。

```sql
SELECT event_id, table_name, event_type, occurred_at, retry_count
FROM analytics_outbox
WHERE status = 'pending'
  AND occurred_at < now() - interval '10 minutes'
ORDER BY occurred_at;
```

## シークレットローテーション手順

### (a) `ANALYTICS_WEBHOOK_SECRET`(共有Webhookシークレット)

Edge Function側(`supabase secrets`)とDB側(Vault `analytics_webhook_secret`)の**両方**を同じ値に
更新する必要がある。理想は同時に近いタイミングで実施すること。

```powershell
supabase secrets set ANALYTICS_WEBHOOK_SECRET="<新しいランダム値>" --project-ref <SUPABASE_PROJECT_REF>
```

```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'analytics_webhook_secret'),
  '<supabase secrets setと同じ新しい値>'
);
```

**両者が一時的に不一致になった場合の挙動(フェイルセーフ、データ損失なし)**: 配送トリガー/再送ジョブが
送るリクエストがEdge Function側で401を返されるだけで、`analytics_outbox`の該当行は`pending`のまま安全に
保持される。両シークレットが再び一致すれば、次の再送ジョブ(最大1分後)またはcronパージジョブとは別系統の
起床通知で自動的に回収され、データが失われることはない。

### (b) `GCP_SERVICE_ACCOUNT_JSON`(GCPサービスアカウント鍵)

無停止ローテーションのため、新しい鍵を先に発行して切り替え、旧鍵は動作確認後に削除する。

```powershell
# 1. 新しい鍵を発行(既存のSAに対して追加のキーを作成)
gcloud iam service-accounts keys create bigquery-export-sa-key-new.json `
  --iam-account="bigquery-export-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com"

# 2. Edge Function側のsecretを新しい鍵に更新
supabase secrets set `
  GCP_SERVICE_ACCOUNT_JSON="$(Get-Content bigquery-export-sa-key-new.json -Raw)" `
  --project-ref <SUPABASE_PROJECT_REF>

# 3. 動作確認(上記「動作確認」の手順でoutbox sent遷移とBQ到達を確認)後、旧鍵を削除
gcloud iam service-accounts keys delete <OLD_KEY_ID> `
  --iam-account="bigquery-export-sa@<GCP_PROJECT_ID>.iam.gserviceaccount.com"
```

旧鍵の`KEY_ID`は `gcloud iam service-accounts keys list --iam-account=...` で確認できる。

## 自由記述テキストのPIIリスクに関する留意事項(Requirement 4.5)

このパイプラインはPIIカラム(`author_name`/`author_avatar`等)を許可カラム列挙方式のホワイトリストで
構造的に除外しているが、以下の**自由記述(フリーテキスト)フィールド**はホワイトリストの対象内であり、
そのままBigQueryへ同期される。

- `attempts.question_answer_details[].userAnswer` — 記述式問題への回答テキスト
- `attempts.question_answer_details[].truthSummary` およびウミガメのスープのAI対話履歴
  (`ai_questions_history` / `ai_truth_attempts`)内の質問文・応答文
- `quiz_reviews.reason` — レビューコメント

これらのフィールドに、ユーザーが**自らの意思で偶発的に個人情報を入力してしまう**可能性は構造的に排除できない
(例: 記述式回答の入力欄に誤って自分の氏名やメールアドレスを入力してしまう等)。本パイプラインは自由記述の
内容を解析・フィルタリングしておらず、そのようなPII混入を機械的に検知することは技術的に信頼性高くは不可能
と判断している。

**このデータをAI学習データとして外部提供(販売)する場合、事前に自由記述フィールドをレビュー・必要に応じて
redact(削除・マスキング)することは、パイプライン運用者/データ提供担当者の必須のプロセス上・法務上の
責任であり、本パイプライン自体はこれを自動化しない。**

## 旧Firestoreパイプラインの退役経緯(Requirement 6.1, 6.2)

従来のBigQuery連携は、Firestoreの`attempts`コレクションへの書き込みをトリガーとするFirebase Extension
「`firestore-bigquery-export`」によるリアルタイムストリーミング転送だった(設定: 旧
`extensions/firestore-bigquery-export.env`、旧手順書: `scripts/bq-import-guide.md`、旧spec:
`.kiro/specs/quizeum-analytics-bigquery`)。

その後のFirebase→Supabase移行(Phase 35〜36、`.kiro/specs/supabase-*`各spec)が完了し、`attempts`を含む
全コアデータの書き込み先がSupabase(PostgreSQL)に切り替わった結果、Firestoreへの書き込みが発生しなくなり、
Firestore書き込みをトリガーとする旧Extensionは発火しなくなった(事実上機能停止)。

本spec(`supabase-bigquery-export`)は、この機能停止を受けて、Supabase PostgreSQLの変更をトリガーとする
新しいDatabaseトリガー + Edge Functionベースのパイプライン(このREADMEが説明しているもの)として代替を
再構築したものである。

**旧資産の処遇**:
- `extensions/firestore-bigquery-export.env` と `scripts/bq-import-guide.md` は、本spec のタスク5.2で
  リポジトリから削除される(内容はgit履歴に残る)。本README執筆時点ではまだ両ファイルは存在する場合がある
  ため、削除が完了しているかは実際のリポジトリの状態を確認すること。
- 旧spec `.kiro/specs/quizeum-analytics-bigquery` は、クライアント側の解答詳細トラッキング実装
  (`QuestionAnswerDetail`等のデータモデル。本specはこれをそのまま再利用し再設計していない)の設計記録
  として引き続き参照価値があるため、ディレクトリ自体は削除せず、タスク5.2で`spec.json`にアーカイブ済みで
  ある旨のメタデータ注記を追加する扱いとする。
