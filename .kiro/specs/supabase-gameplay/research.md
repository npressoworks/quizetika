# Research & Design Decisions - supabase-gameplay

## Summary
- **Feature**: supabase-gameplay
- **Discovery Scope**: Complex Integration（トランザクション多用の既存 Firestore ロジックを PostgreSQL RPC へ移植する Firestore → Supabase 移行）
- **Key Findings**:
  - `attempts` テーブルは `completed_at TIMESTAMPTZ NOT NULL DEFAULT now()` として既に作成済みだが、ウミガメのスープ（水平思考クイズ）の「進行中セッション」（`completedAt` 未設定）を表現できない。`completed_at` を NULL 許容に変更する ALTER が必須。
  - `leaderboard_entries` テーブルは `UNIQUE(quiz_id, user_id, type)` を持つ既に適切な正規化形（`quizzes.leaderboardFirstPlay/leaderboardReplay` 配列の正規化先として設計済み）だが、これを実際に読み書きする RPC は一切存在しない。
  - `quiz_reviews` テーブル（`rating INTEGER 1-5 + comment TEXT`）は、実際の Firestore `review.ts` の挙動（良問/悪問の二値投票 + 任意の一言理由）と一致していない。ユーザーとの確認の結果、**現行の二値投票の挙動を維持**する方針とし、`quiz_reviews` を `type`/`reason` カラムへ設計し直す。
  - `reactions`（いいね/感謝）および `difficulty_votes`（クイズ難易度への星投票）に対応する Postgres テーブルは存在しない。新規設計が必要。
  - AI対話（ask-ai）の1日あたりターン数制限カウンタ（`dailyAiTurnCounts`）に対応する Postgres テーブルも存在せず、現行 Firestore 実装には「事前読み取り→トランザクション内更新」という非アトミックな構造による lost-update レースが確認された。RPC化によりこれを是正できる。
  - `verify-truth`/`ask-ai`/`give-up-lateral`/`quick-press-stream`/`user/play-history`/`user/played-quiz-ids` の全 API Route は既に Supabase Auth（`verifySupabaseAccessToken`）で認証されており、データ層（Firestore 読み書き）のみが移行対象である。

## Research Log

### アテンプト保存とリーダーボード更新ロジック
- **Context**: `saveAttempt`（`src/services/attempt.ts`）が単一の `runTransaction` 内で行う、対不正検証・アテンプト保存・`playCount` 更新・リーダーボード更新の一連の処理を PostgreSQL RPC に変換する必要がある。
- **Sources Consulted**: `src/services/attempt.ts`, `src/lib/leaderboard-update.ts`, `src/lib/leaderboard-ranking.ts`, `tests/services/attempt-leaderboard.test.ts`
- **Findings**:
  - ランキング規則: スコア降順、同点時は所要時間（`elapsedSeconds`）昇順。
  - 初回/リプレイ判定: そのユーザー・クイズに対する「完了済み（`completedAt` が null でない）」アテンプトが過去に **0件** なら初回、1件以上あればリプレイ。判定はモード非依存（`exam` でのプレイもカウント対象になり得る）。
  - リーダーボード対象外条件: `mode` が `test-play`/`exam`/`flashcard`、`userId` がゲスト、クイズ作成者自身のプレイ。
  - 上位保持数: 各ボード（初回/リプレイ）ごとに **上位5件のみ**。ユーザーの新記録が既存の自己ベストより厳密に優れている場合のみ差し替え、そうでなければ既存の自己ベストを保持したまま再ソート・上位5件切り詰め。
  - `leaderboard_entries` の `UNIQUE(quiz_id, user_id, type)` 制約は、上記「ユーザーごとの自己ベストを1行保持」という要件と正確に一致しており、`INSERT ... ON CONFLICT ... DO UPDATE WHERE 新記録が厳密に優れている場合のみ` という単一SQL文で表現可能。上位5件への切り詰めは書き込み時ではなく読み取り時（`ORDER BY score DESC, elapsed_seconds ASC LIMIT 5`）に行うことで、全ユーザーの記録を失わずに保持できる（Firestore の配列上限5件という制約からの改善）。
- **Implications**: 共有ロジックとして `record_leaderboard_entry` という内部 PL/pgSQL 関数を1つ定義し、`handle_save_attempt` と `handle_complete_lateral_attempt` の両方から呼び出す（水平思考クイズの合格時も通常クイズと全く同じリーダーボード規則が適用されるため）。

### 対不正検証ロジックの正規化テーブルへの追従
- **Context**: `saveAttempt` は現在 `quiz.questions`（Firestore 内の非正規化配列）を読み取って「合計問題数」「有効な問題ID集合」を検証しているが、`supabase-core-data` によって `quizzes.questions`/`question_ids` 列は既に削除され、`quiz_questions` 中間テーブルに置き換わっている。
- **Sources Consulted**: `supabase-core-data/design.md`, 現行 `supabase/migrations/20260703000000_core_data_normalization.sql`
- **Findings**: 問題数・問題ID集合は `SELECT question_id FROM quiz_questions WHERE quiz_id = p_quiz_id` で取得可能。
- **Implications**: `handle_save_attempt` RPC 内の検証ロジックは `quiz_questions` を JOIN して再実装する。

### AI対話ターン制限カウンタのアトミック化
- **Context**: `/api/attempt/ask-ai` は1日あたりのAI質問回数（クイズ単位30回・全体150回）を制限しているが、カウンタの事前読み取りがトランザクション外で行われており、同時リクエストで更新が失われ得る（lost update）。
- **Sources Consulted**: `src/app/api/attempt/ask-ai/route.ts`, `src/services/ask-ai-utils.ts`
- **Findings**: 日付境界は JST（UTC+9固定）で計算される。カウンタは「クイズ単位」と「全体」の2種類。
- **Implications**: 新設 `ai_turn_counts_per_quiz` / `ai_turn_counts_global` テーブルへの `INSERT ... ON CONFLICT DO UPDATE` を RPC 内で行い、日付が変わっていればカウントを1にリセット、同日なら加算する形でアトミックに実装し、既存のレース条件を是正する。日付判定は `(now() AT TIME ZONE 'Asia/Tokyo')::date` を使用する。

### レビュー機能の要件とDDLの乖離（ユーザー確認済み）
- **Context**: `requirements.md` 3.1「コメントと評価を登録」という記述が、現行 Firestore の二値投票（`positive`/`negative` + 任意理由）と既存 Postgres DDL（`rating` 1-5 + `comment`）のどちらを指すか、記述だけでは一意に決まらなかった。
- **Sources Consulted**: `src/services/review.ts`（`submitReview`/`retractReview`）、`src/services/review-utils.ts`、既存 `quiz_reviews` DDL、ユーザーへの直接確認。
- **Findings**: ユーザーは「現行の良問/悪問 二値投票を維持」を選択。合わせて、要件3.2「不適切なレビューへの指摘報告」は、レビューコメント自体への通報ではなく、既存の `feedback_reports`（問題への誤字/事実誤認/別解の指摘）を指すことも確認済み。
- **Implications**: `quiz_reviews` を `id TEXT`（文字列連結）から複合主キー `(reviewer_id, quiz_id)` に正規化し、`rating`/`comment` 列を `type`（`positive`/`negative`）/`reason` 列に置き換える。`feedback_reports` には重複防止のための部分ユニークインデックスを新設する（現行 Firestore にはこの防止機構がなく、正規化に伴う改善点）。`isReviewMasked`/`tempPositiveCount`/`tempNegativeCount`/`activeResetRequestId`/`reviewResetRequests`（レビュー再評価申請）は `requirements.md` に記載がなく、本スペックの対象外として明示的に除外する。

### リアクション（いいね）の重複防止と対象カウンタ
- **Context**: `sendReaction` は `${senderId}_${quizId}_${type}` を文書IDとする「作成のみ可能・解除不可」の疑似トグルであり、`users.totalReactionsCount`（受信者側）のみを更新する。
- **Sources Consulted**: `src/services/reaction.ts`
- **Findings**: `quizzes` テーブルに「いいね数」に相当する列は存在しない（`users.total_reactions_count` は既に存在）。
- **Implications**: `reactions` テーブルの主キーを `(sender_id, quiz_id, type)` の複合主キーとし、文字列連結IDを廃止する。解除機能は現行に存在しないため、本移行では新規追加しない（スコープ外の機能追加を避ける）。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| クライアント側逐次更新 | 複数テーブルへの update を非トランザクションに逐次実行 | 実装が単純 | 対不正検証・カウンタ整合性が保証されない | 不採用 |
| PostgreSQL RPC（SECURITY DEFINER） | サーバー側で単一トランザクションとして実行 | 完全なアトミック性、`supabase-core-data`/`supabase-foundation` と一貫した既存パターン | RPC数が多くなる（本スペックだけで7種類） | 採用 |

## Design Decisions

### Decision: レビュー機能は二値投票モデルを維持する
- **Context**: 要件文言と既存DDLの乖離（詳細は上記 Research Log）。
- **Alternatives Considered**:
  1. 現行の二値投票（positive/negative + reason）を維持
  2. 既存DDL通りの5段階評価+コメントへ製品仕様を変更
- **Selected Approach**: オプション1。ユーザーに確認の上で決定。
- **Rationale**: 本スペックはバックエンド移行スペックであり、UI/UXや製品仕様の変更を伴う判断はスコープ外とすべきであるため、既存の実際の挙動を正とする。
- **Trade-offs**: 既存 `quiz_reviews` DDL の `rating`/`comment` 列は破棄し、新しい列構成へ ALTER する必要がある（実データはまだ存在しないため実害はない）。

### Decision: リーダーボードは「全ユーザーの自己ベストを保持し、読み取り時に上位5件に絞る」方式へ変更する
- **Context**: Firestore は `quizzes` ドキュメント内の配列に上位5件のみを保持していたが、`leaderboard_entries` は行志向で全ユーザーを保持できる。
- **Alternatives Considered**:
  1. Firestore と同様に上位5件のみを書き込み時に確定して保持する
  2. 全記録を保持し、読み取りクエリで上位5件に絞る
- **Selected Approach**: オプション2。
- **Rationale**: 書き込みロジックがシンプルになり（`ON CONFLICT DO UPDATE` の1文で完結）、将来的に「自分の順位」等の追加機能にも対応しやすい。
- **Trade-offs**: `leaderboard_entries` の行数はクイズのプレイ人数に比例して増加するが、`UNIQUE(quiz_id, user_id, type)` によりユーザーあたり最大2行（初回/リプレイ）に抑えられ、実用上問題にならない。

### Decision: リアクション（いいね）を真のトグル（追加/解除）として再設計する
- **Context**: `requirements.md` 2.2/2.3 は「いいねを有効にした時...総いいね数をインクリメント」「いいねを解除した時...総いいね数をデクリメント」と明記しているが、現行 Firestore の `sendReaction` は作成のみ可能（解除不可）の疑似トグルであり、更新対象も `users.totalReactionsCount`（受信者）であって「クイズの総いいね数」ではない。
- **Alternatives Considered**:
  1. 現行の作成のみ可能な挙動をそのまま移植する（要件2.3を満たせない）
  2. 要件どおり追加/解除可能な真のトグルとし、`quizzes` に新設する `likes_count` 列を対象にする
- **Selected Approach**: オプション2。あわせて、要件・現行コードのいずれにも整合しない `type: 'thank'`（感謝リアクション）は本スペックのスコープ外とし、`reactions` テーブルは `type = 'like'` のみを扱う（将来的な拡張のため `type` 列自体は残す）。
- **Rationale**: 要件文言が「解除」と「クイズの総いいね数」を明確に指定しており、曖昧さがないため、ユーザーへの再確認は行わず要件を正として採用した。`supabase-core-data` の `handle_bookmark_toggle` と同型のトグルRPCパターンが流用できる。
- **Trade-offs**: 既存の「感謝（thank）」リアクション機能は本移行の対象外となり、必要であれば別スペックで再検討する。

### Decision: AI対話の日次ターン制限カウンタを2つの新規テーブルに正規化する
- **Context**: Firestore の `users/{uid}/dailyAiTurnCounts/{quizId}` サブコレクション（クイズ単位）と `.../_global`（全体）という2種類のカウンタをどう正規化するか。
- **Alternatives Considered**:
  1. 1つのテーブルに `quiz_id NULL` を「全体」として格納する
  2. クイズ単位・全体用に2つのテーブルへ分離する
- **Selected Approach**: オプション2（`ai_turn_counts_per_quiz`, `ai_turn_counts_global`）。
- **Rationale**: NULL 許容列によるユニーク制約の複雑化（NULL は互いに重複と見なされない）を避け、各テーブルの主キーを単純な複合/単一主キーとして表現できる。
- **Trade-offs**: テーブル数は増えるが、スキーマ・RPC・RLSポリシーがそれぞれ単純になる。

## Risks & Mitigations
- **`quizzes` テーブルへの列追加（`difficulty_votes_sum`/`difficulty_votes_count`）は `supabase-core-data` が所有するテーブルへの越境変更に見える** — `play_count`/`bookmarks_count` 等、既存の他ゲームプレイ系カウンタ列も同テーブルに存在し、それらは `supabase-core-data` の設計時点で意図的にゲームプレイ側の所有として明記されているため、本スペックでの追加は許容される拡張として扱う。ただし本スペックが `quizzes` テーブルへ ALTER を行う唯一の非コアデータスペックとなるため、`supabase-governance` 側との列名衝突がないか着手時に再確認する。
- **`isReviewMasked`/レビュー再評価申請フローが要件外として除外される** — 将来 `supabase-governance` 側でこの機能を担当する場合、`quiz_reviews` の列構成（本スペックで `type`/`reason` へ変更）との整合を別途設計する必要がある。
- **`attempts.completed_at` を NULL 許容に変更する ALTER は、既存の `attempts_all` RLS ポリシーや `idx_attempts_user_history` インデックスの意味に影響しない**ことを移行時に確認する（インデックスは NULL を許容しても機能するが、`ORDER BY completed_at DESC` で NULL 行が先頭/末尾どちらに来るか明示する必要がある）。

## Design Validation Log（2026-07-03）
`/kiro:validate-design` によるレビューで以下3件の指摘を受け、`design.md` に反映済み。
- クライアント供給の `receiver_id`／`display_name` を信用せず、RPC内で `quizzes.author_id`／`users.display_name` から導出するよう `handle_toggle_reaction`／`handle_save_attempt`／`handle_complete_lateral_attempt` を修正。内部専用の `record_leaderboard_entry` は `PUBLIC`/`anon`/`authenticated` から `REVOKE EXECUTE` し、直接呼び出しを禁止。
- `handle_record_ai_turn` に `p_per_quiz_limit`/`p_global_limit` を追加し、カウンタ加算直後に上限超過なら例外を送出してロールバックさせることで、事前チェックとRPC呼び出しの間のレースを閉じた。
- `difficulty_votes` のRLSを `FOR ALL` から `INSERT`/`UPDATE`/`DELETE` に分割し、匿名行（`user_id IS NULL`）を誰でも更新・削除できてしまう穴を修正。

## References
- [Supabase RPC (Postgres Functions)](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL INSERT ... ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html#SQL-ON-CONFLICT)
- [PostgreSQL Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
