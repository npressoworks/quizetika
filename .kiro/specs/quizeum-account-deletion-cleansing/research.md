# Research & Design Decisions: quizeum-account-deletion-cleansing

## Summary
- **Feature**: `quizeum-account-deletion-cleansing`
- **Discovery Scope**: Extension
- **Key Findings**:
  1. **クイズデータの CASCADE 消失回避**: `quizzes.author_id` および `questions.author_id` が `users(id) ON DELETE CASCADE` となっているため、`users` レコードの物理削除はクイズデータの消失を招く。したがって、`users` レコードは残したまま匿名化する必要がある。
  2. **delete_status 制約の拡張**: 既存の `users.delete_status` は `'active'` と `'delete_pending'` しか許容しておらず、退会完了状態を記録できないため、チェック制約を `'deleted'` も許容するように変更する SQL マイグレーションが必要。
  3. **キャッシュデータの匿名化**: クイズ (`quizzes`) と問題 (`questions`) テーブルには `author_name` および `author_avatar` がキャッシュされているため、これらもクレンジング時に `'退会済ユーザー'` および `null` に更新する必要がある。

## Research Log

### データベース外部キー制約の調査
- **Context**: ユーザー物理削除時の他テーブルへの影響を確認するため。
- **Sources Consulted**: `supabase/migrations/20260702000000_init.sql`
- **Findings**:
  - `quizzes.author_id REFERENCES users(id) ON DELETE CASCADE`
  - `attempts.user_id REFERENCES users(id) ON DELETE CASCADE`
  - `follows.follower_id / following_id REFERENCES users(id) ON DELETE CASCADE`
  - `bookmarks.user_id REFERENCES users(id) ON DELETE CASCADE`
  - `notifications.user_id REFERENCES users(id) ON DELETE CASCADE`
  - `leaderboard_entries.user_id REFERENCES users(id) ON DELETE CASCADE`
- **Implications**: `users` の行を物理削除すると、クイズ、問題、プレイ履歴、リーダーボード等が一斉に CASCADE 削除される。クイズを残すためには `users` の行を物理削除してはならない。

### Supabase Auth の物理削除と users テーブルの関係性
- **Context**: Supabase Auth からアカウントを削除した際、パブリックの `users` テーブルに影響があるか。
- **Sources Consulted**: `20260702000000_init.sql` 内の `users` テーブル定義
- **Findings**:
  - `users.id` は `id UUID PRIMARY KEY` と定義されており、`auth.users(id)` に対する `FOREIGN KEY` (外部キー) 制約は設定されていない（コメントによる紐付けのみ）。
- **Implications**: `auth.users` から行を物理削除（`supabase.auth.admin.deleteUser`）しても、パブリックの `users` テーブルのレコードは自動的に CASCADE 削除されない。これにより、認証側を消してログインを防ぎつつ、パブリックDB側に匿名化したプロフィール行を残す設計が可能。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| API内同期実行 (Chosen) | 退会API内で一括してDB更新・削除・Auth削除を順次実行する | 実装が最もシンプルでテスト・エラーハンドリングが容易 | クレンジング対象の関連データが極端に多い場合にタイムアウトのリスクがあるが、現規模では問題なし | 既存の構成に最もフィットする |
| PostgreSQL トリガー | トリガー経由で非同期でクレンジング関数を走らせる | APIは即時完了するためレスポンスが高速 | トリガーおよびストアドファンクションの管理コストが増え、テストが難しくなる | 非推奨 |

## Design Decisions

### Decision: users テーブルの物理削除の回避と匿名化プロフィールの残存
- **Context**: 退会ユーザーの作成したクイズを「退会済ユーザー」のものとしてプラットフォーム上に維持するため。
- **Alternatives Considered**:
  1. クイズの `author_id` を特定のダミーユーザー ID に付け替える → `quizzes.author_id` は `NOT NULL` だが、付け替えるための固定ID管理が必要になり、関連する `questions` や他のリレーションもすべて付け替えるため処理が複雑化する。
  2. 退会ユーザーの `users` 行を残し、匿名化する → クイズや問題の `author_id` をそのまま維持でき、`users` の `display_name` 等を書き換えるだけで済むため非常にシンプル。
- **Selected Approach**: 2 (退会ユーザーの `users` 行を残し、匿名化する)
- **Rationale**: 外部キー制約の CASCADE をトリガーせず、最小限のDB更新でクイズの残存と表示の匿名化を安全に実現できるため。
- **Trade-offs**: データベース上に退会済ユーザーのID（UUID）のレコードが残り続けるが、個人を特定できるデータはすべてダミー値に書き換えられるため、GDPR/プライバシー要件は満たされる。

### Decision: ユニーク制約 email のダミー値更新
- **Context**: `users.email` には `UNIQUE` 制約があるため、退会時に単純に `'退会済ユーザー'` 等の固定値や空文字に書き換えると、2人目以降の退会時に制約違反が発生する。また、元のメールアドレスのままだと個人情報が残ってしまう。
- **Selected Approach**: `deleted_${uid}@example.com` のように、ユーザー固有の UUID をメールアドレスに埋め込んだ一意な値に更新する。
- **Rationale**: UNIQUE制約を回避しつつ、元のメールアドレス（個人情報）を完全に消去でき、かつそのメールアドレスで別のユーザーが再登録できるようになるため。

## Risks & Mitigations
- **APIタイムアウトのリスク** — 削除・更新するデータ量が多い場合、APIがタイムアウトする可能性がある。 → 対策として、極端に多くのデータを生成するフォロー情報や通知など、不必要なソーシャルリレーションは退会クレンジング時に物理削除し、クイズやプロフィール匿名化といったコア処理のみに更新対象を絞る。
- **Auth削除とDBクレンジングの不整合** — DBクレンジングが成功し、Auth削除だけが失敗した場合、またはその逆。 → 対策として、DBの更新および削除を完了させた後、最後のステップとして `supabase.auth.admin.deleteUser` を実行する。DB処理でエラーが発生した場合はAuth削除を実行せずロールバック・中断する。

## References
- [Supabase Auth Admin Delete API](https://supabase.com/docs/reference/javascript/admin-deleteuser) — service_roleでのAuthユーザー物理削除リファレンス
