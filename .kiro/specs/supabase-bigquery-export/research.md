# Research & Design Decisions

## Summary
- **Feature**: `supabase-bigquery-export`
- **Discovery Scope**: Complex Integration（新規外部連携パイプライン）
- **Key Findings**:
  - Supabase Database Webhooks（pg_net）は**自動リトライなし・at-most-once配信**のため、Webhook単体では要件3（データ欠損防止）を満たせない。アウトボックステーブル+pg_cron再送との併用が必須。
  - BigQueryへの書き込みは、Deno（Edge Functions）環境ではgRPCベースのStorage Write APIのクライアントが存在せず、REST+Bearerトークンで完結する`tabledata.insertAll`が現実解。`insertId`重複排除はベストエフォートのため、BigQuery側の重複排除ビューを併用する。
  - リポジトリには`supabase/functions/`が存在せず、Edge Function・pg_net・pg_cronはすべてゼロから導入。`quizzes.questions`(JSONB)は正規化で既にDROP済みで、クイズ構成は`questions`+`quiz_questions`中間テーブルが正。

## Research Log

### Supabase Database Webhooksの配信保証
- **Context**: 要件5（同期の信頼性）を満たす配信メカニズムの確認。
- **Sources Consulted**: [Database Webhooks docs](https://supabase.com/docs/guides/database/webhooks), [pg_net docs](https://supabase.com/docs/guides/database/extensions/pg_net), [pg_net retry issue #110](https://github.com/supabase/pg_net/issues/110)
- **Findings**:
  - Webhookはpg_net拡張の薄いラッパー。トリガーから`supabase_functions.http_request(url, method, headers, params, timeout_ms)`を呼ぶ形でマイグレーションSQLとしてコード管理可能（ダッシュボード不要）。
  - ペイロードは`{type, table, schema, record, old_record}`。DELETE時は`record=null`、INSERT時は`old_record=null`。
  - **自動リトライなし**。デフォルトタイムアウト2秒（引数で延長可）。レスポンスは`net._http_response`に6時間のみ保存（unloggedテーブル）。
  - リクエストはトランザクションコミット後に発火。約200req/sが上限目安。
- **Implications**: Webhook直送だけではデータ欠損する。アウトボックス（イベント永続化）を一次記録とし、Webhookは「低レイテンシな配送トリガー」、pg_cronは「再送保証」と役割分担する。

### Edge FunctionsからのGoogle Cloud認証
- **Context**: DenoランタイムからBigQuery APIを呼ぶための認証方式。
- **Sources Consulted**: [Google OAuth2 Service Account](https://developers.google.com/identity/protocols/oauth2/service-account), [Supabase Edge Functions secrets](https://supabase.com/docs/guides/functions/secrets), [Supabase+Google API実装例](https://misoft.pro/blog/supabase/send-email-google-api-oauth2)
- **Findings**:
  - google-auth-library（Node）はDenoで不安定な報告あり。確立パターンはサービスアカウント鍵でRS256署名したJWTを`https://oauth2.googleapis.com/token`へ`jwt-bearer`グラントでPOSTし、アクセストークン（3600秒有効）を取得する手動実装。
  - シークレットは`supabase secrets set`で管理（`Deno.env.get`で取得、再デプロイ不要）。ローカルは`supabase/functions/.env`。
  - Edge Functions制限: wall-clock 150s（Free）/400s（Paid）、CPU 2s、メモリ256MB。`verify_jwt`は`config.toml`の`[functions.<name>]`で関数単位に制御可能。
- **Implications**: 依存ライブラリを避けWeb Crypto APIによるJWT署名を自前実装（小規模・テスト容易）。トークンはモジュールスコープでキャッシュ。Webhook→Edge Function間の認証は共有シークレットヘッダー方式とし`verify_jwt=false`にする（pg_netからSupabase JWTを発行できないため）。

### BigQuery書き込みAPIの選定
- **Context**: 要件1（自動同期）・5.3（重複排除）を満たす書き込み手段。
- **Sources Consulted**: [Streaming data into BigQuery](https://docs.cloud.google.com/bigquery/docs/streaming-data-into-bigquery), [BigQuery quotas](https://docs.cloud.google.com/bigquery/quotas), [JSON data](https://docs.cloud.google.com/bigquery/docs/json-data)
- **Findings**:
  - `tabledata.insertAll`（legacy streaming）は素のREST+Bearerトークンで呼べる。行10MB・リクエスト10MB・推奨500行/回。
  - `insertId`による重複排除は約1分間のベストエフォートで**保証なし**。
  - Storage Write APIはexactly-once・低コストだがgRPC+protobufが基本でDeno対応クライアントが存在しない。
  - JSON型カラムへのストリーミング挿入は可能。
- **Implications**: insertAllを採用。`insertId`にはアウトボックスの`event_id`を使用しつつ、最終的な一意性はBigQuery側で`event_id`をキーに`ROW_NUMBER()`重複排除するビューで担保（要件5.3）。

### 信頼性パターン（アウトボックス+pg_cron）
- **Context**: pg_net非リトライへの対策。
- **Sources Consulted**: [Supabase Cron](https://supabase.com/modules/cron), [Webhook Retries discussion](https://github.com/orgs/supabase/discussions/17664), [Webhook debugging guide](https://supabase.com/docs/guides/troubleshooting/webhook-debugging-guide-M8sk47)
- **Findings**:
  - pg_cronはSupabase公式サポート（Cronモジュール）。
  - 一般パターン: トリガーでアウトボックス行をINSERT→Webhookで即時配送→pg_cronが未送信/失敗行を定期再送→retry上限で`failed`に落とし運用者が検知。
- **Implications**: このパターンをそのまま採用。Edge Functionは成功時にアウトボックス行を`sent`へ更新（service roleで直接UPDATE）。

### コードベース統合ポイント
- **Context**: 既存資産との整合確認。
- **Sources Consulted**: リポジトリ内調査（supabase/config.toml、migrations、src/services、.env.local.example）
- **Findings**:
  - `supabase/functions/`は存在せず、`config.toml`に`[functions.*]`定義なし。Edge Functionはゼロから新規。
  - 有効拡張は`uuid-ossp`のみ。pg_net/pg_cronは新規`CREATE EXTENSION`が必要。
  - マイグレーション命名は`YYYYMMDDHHMMSS_説明.sql`。書き込みの多くは`handle_*` SECURITY DEFINER RPC経由（例: `handle_save_attempt`）だが、トリガーはRPC経由でも通常のクライアント経由でも同様に発火するため書き込み経路の差異は影響しない。
  - `quizzes.questions`(JSONB)/`question_ids`はDROP済み。クイズ構成は`questions`+`quiz_questions`（display_order付き中間テーブル）+`quiz_tags`が正。
  - 個人情報カラム: `quizzes.author_name`/`author_avatar`、`questions.author_name`/`author_avatar`が同期対象テーブルに埋め込まれている（要件4.2の除外対象）。
  - GCP関連の環境変数・シークレット定義はゼロ。`.env.local.example`と`config.toml`への追加が必要。
  - テストはJestのみ（Deno testの前例なし）。
- **Implications**: Edge Functionの純ロジック（ペイロード変換・リクエスト構築）はDenoグローバルに依存しないモジュールに分離し、既存のJest慣習でテスト可能にする。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Webhook直送のみ | テーブルトリガー→pg_net→Edge Function→BigQuery | 最小構成・低レイテンシ | pg_net非リトライで欠損（要件5.1違反） | 棄却 |
| アウトボックス+Webhook+pg_cron再送（採用） | トリガーでアウトボックスに永続化→Webhookで即時配送、cronで再送 | at-least-once保証・低レイテンシ・失敗の可視化 | コンポーネント数増（テーブル+cron） | 要件5を完全に充足 |
| pg_cronポーリングのみ | アウトボックスをcronで定期flush | Webhook不要でシンプル | レイテンシがcron間隔依存・イベント駆動でない | 要件1.4の趣旨（変更イベント起点）に弱い |
| Datastream / Fivetran等マネージドCDC | 論理レプリケーションでBQへ | 運用レス・exactly-once | コスト増・カラム除外等の変換制御が困難・要件4.2のPIIカラム除外がしにくい | 将来大量CDC要件が出たら再検討 |

## Design Decisions

### Decision: アウトボックスパターンをベースにしたハイブリッド配送
- **Context**: pg_netが再送しないため、イベント駆動性（要件1.4）と欠損防止（要件5.1）の両立が必要。
- **Alternatives Considered**: 上記Architecture Pattern Evaluation参照。
- **Selected Approach**: 対象テーブルのAFTERトリガーが`analytics_outbox`行をINSERT（サニタイズ済みペイロード）。outboxへのINSERTをWebhookトリガーがpg_netでEdge Functionへ即時通知。pg_cronが`pending`のまま残った行を定期再送し、retry上限超過で`failed`へ。
- **Rationale**: イベントの一次記録がDB内に永続化されるため、Edge Function・BigQuery・ネットワークのどこで失敗してもデータは失われない。
- **Trade-offs**: outboxテーブルの肥大化（→`sent`行の定期パージをcronに含める）。
- **Follow-up**: cron間隔・retry上限・パージ保持期間の初期値を実装時に決定。

### Decision: BigQuery側は追記専用の単一`raw_events`テーブル+ビュー群
- **Context**: 要件3（プレイ時点整合性・版履歴）と要件2（学習データセット構成）、スキーマ進化の容易さ。
- **Alternatives Considered**:
  1. ソーステーブルごとに型付きテーブルを作りUPSERT — 最新状態は得やすいが版履歴が消え、要件3.1に反する。スキーマ変更のたびにBQ DDLが必要。
  2. 追記専用の単一イベントテーブル（event_id, table_name, event_type, occurred_at, payload JSON）+ 用途別ビュー — 採用。
- **Selected Approach**: `raw_events`（`occurred_at`で日次パーティション、`table_name`でクラスタリング、payloadはJSON型）に全イベントを追記。最新状態ビュー・版整合ビュー・学習データセット用ビューをSQLで提供。
- **Rationale**: 追記専用は変更履歴（3.1）と削除トゥームストーン（5.4）を構造として内包する。Edge Functionは単一テーブルへのinsertAllのみで済み、ソーススキーマ変更時もBQ DDL変更が不要。
- **Trade-offs**: 生クエリはビュー経由必須（生テーブル直クエリは重複・削除を含む）。JSONクエリのコストはビューのマテリアライズ化で将来対応可能。
- **Follow-up**: データ量増加時にマテリアライズドビュー/スケジュールドクエリでのフラット化を検討。

### Decision: PIIカラム除外はDB内トリガー関数で実施（ホワイトリスト方式）
- **Context**: 要件4.2/4.3。`quizzes`/`questions`に`author_name`/`author_avatar`が埋め込まれている。
- **Alternatives Considered**:
  1. Edge Function側でフィルタ — DBの外に出る前に除外されず、outboxにPIIが残る。
  2. トリガー関数内でテーブル別のカラムホワイトリストによりペイロード構築 — 採用。
- **Selected Approach**: 各テーブルのトリガー関数が`to_jsonb(NEW/OLD)`から許可カラムのみを抽出してoutboxに保存。usersテーブルにはトリガー自体を設置しない（要件2.5/4.1/4.4は「トリガー未設置+ホワイトリスト」で構造的に保証）。
- **Rationale**: PIIがDB外（outbox含む配送経路全体）に一切出ない。除外漏れはSQLレビューで検知可能。
- **Trade-offs**: 同期カラム追加時にトリガー関数の更新が必要（明示的な運用とする）。

### Decision: Webhook→Edge Function認証は共有シークレットヘッダー
- **Context**: pg_netからはSupabase発行のJWTを動的に生成できない。
- **Selected Approach**: `config.toml`で`verify_jwt = false`とし、Edge Function内で`X-Analytics-Webhook-Secret`ヘッダーを検証。シークレットはVault（DB側）と`supabase secrets`（Function側）の両方に登録。
- **Rationale**: service_role keyをSQL内に埋め込むより漏洩時の影響範囲が小さい（このFunctionの呼び出し権限のみ）。
- **Trade-offs**: シークレットのローテーション手順が必要（ドキュメント化する）。

### Generalization / Simplification（シンセシス結果）
- **一般化**: 「テーブルごとの同期」を「汎用イベントエンベロープ（table_name+payload）」に一般化。対象テーブル追加はトリガー1本+ホワイトリスト定義の追加のみで、Edge Function・BQスキーマは無変更。
- **簡素化**: テーブル別BQテーブル・型付きスキーマ管理・Storage Write API・専用リトライキューサービスをすべて排除。DB内(outbox+cron)とBQ内(ビュー)のプラットフォーム機能に寄せた。
- **Build vs Adopt**: Google認証はライブラリ採用ではなくWeb Crypto APIでの小規模自前実装（Denoでの実績が安定しているため）。配送・再送はpg_net/pg_cron（プラットフォーム採用）。

## Risks & Mitigations
- pg_netの約200req/s上限 — 現状のプレイ頻度では十分な余裕。将来超過時はoutboxのバッチ配送（cron側でまとめ送り）に切替可能な構造にする。
- `insertId`重複排除がベストエフォート — BQビューで`event_id`ベースの決定的重複排除を必ず通す。
- Edge Functionコールドスタート時のGoogleトークン取得レイテンシ — トークンをモジュールスコープでキャッシュ。失敗時はoutboxが再送するため欠損しない。
- outbox肥大化 — `sent`行の定期パージ（cron）。`failed`行はパージせず運用者が確認。
- レビューコメント等の自由記述にPII混入の可能性 — 構造的除外は不可能なため、要件4.5どおり外部提供時の留意事項としてドキュメント化。

## References
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks) — Webhook作成とペイロード形式
- [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) — 非同期HTTP・タイムアウト・非リトライ仕様
- [Supabase Cron](https://supabase.com/modules/cron) — pg_cron公式サポート
- [Edge Functions Secrets](https://supabase.com/docs/guides/functions/secrets) / [Limits](https://supabase.com/docs/guides/functions/limits) / [Function Configuration](https://supabase.com/docs/guides/functions/function-configuration)
- [Google OAuth2 Service Account flow](https://developers.google.com/identity/protocols/oauth2/service-account) — 手動JWT署名によるトークン取得
- [BigQuery streaming insertAll](https://docs.cloud.google.com/bigquery/docs/streaming-data-into-bigquery) / [Quotas](https://docs.cloud.google.com/bigquery/quotas) / [JSON type](https://docs.cloud.google.com/bigquery/docs/json-data)
