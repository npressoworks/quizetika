# Brief: quizeum-account-deletion-cleansing

## Problem
ユーザーが退会を希望した際、現在のシステムでは `delete_status` を `'delete_pending'` に変更するのみで、実際のコンテンツ（クイズ、問題）の匿名化やリーダーボードからの削除、Supabase Auth 側からのアカウント物理削除といったデータクレンジング処理が行われていません。また、単純に `users` レコードを物理削除すると、外部キー制約の `ON DELETE CASCADE` によりユーザーの作成したすべてのクイズが消えてしまいます。

## Current State
- 退会API `/api/user/delete-account` は、Stripeの解約と `delete_status = 'delete_pending'` の更新のみを行う。
- `quizzes.author_id` は `users(id) ON DELETE CASCADE` となっており、物理削除はクイズの消失を招く。
- `users.delete_status` は CHECK 制約により `'active'` または `'delete_pending'` のみ許容している。

## Desired Outcome
ユーザー退会時に、以下の処理が同一 of API フロー内で同期的に実行されること：
1. 退会ユーザーが作成したクイズおよび問題が、「退会済ユーザー」作成のコンテンツとして残存する。
2. 退会ユーザーの個人情報（表示名、メールアドレス、アバター、自己紹介、SNSリンク等）が安全に匿名化される。
3. リーダーボード（`leaderboard_entries`）から該当ユーザーのスコア情報が削除される。
4. フォロー関係、ブックマーク、通知などの不要データが物理削除される。
5. Supabase Auth からアカウントが完全に削除され、二度とログインできない状態になる。

## Approach
- **同期APIクレンジング (Approach A)**:
  - `POST /api/user/delete-account` エンドポイントを拡張。
  - サブスク解約後、トランザクションまたは順次実行によって、関連テーブルの削除および更新（匿名化）を実行する。
  - `users.delete_status` のチェック制約をマイグレーションで変更し、最終状態を表す `'deleted'` ステータスを追加。
  - 最後に Supabase Admin Client を用いて `supabase.auth.admin.deleteUser(uid)` を呼び出し、認証側を物理削除する。

## Scope
- **In**:
  - `users` テーブル of `delete_status` 制約拡張（`'deleted'` の追加マイグレーション作成）。
  - `/api/user/delete-account` の拡張（クレンジング処理の統合）。
  - `leaderboard_entries` から該当ユーザーのレコード削除。
  - `quizzes` および `questions` のキャッシュ項目（`author_name` を `'退会済ユーザー'` に、`author_avatar` を `null` に）の更新。
  - `follows`（フォロワー/フォロー中双方）、`bookmarks`、`notifications` の該当ユーザー関連レコードの削除。
  - `users` レコードの匿名化（`display_name` の書き換え、ユニーク制約回避用の `email` 更新、アバターや自己紹介のクリア、プラン等のフリープラン化）。
  - Supabase Auth 上のユーザーアカウント物理削除。
- **Out**:
  - 退会以外の管理者によるユーザーBAN処理の変更。
  - ユーザーが作成したクイズ自体や、他のユーザーが残したプレイ履歴（attempts）の削除（これらはシステム維持のため残存させる）。

## Boundary Candidates
- **DeleteAccountAPI**: `src/app/api/user/delete-account/route.ts` の拡張。
- **UserService**: `src/services/user.ts` でのデータクレンジング処理（匿名化、関連データ削除）の実装。

## Out of Boundary
- 本仕様では、バッチや非同期キュー（Cloud Tasks / Queue）を用いた遅延クレンジング処理は作成しません（API内同期処理に制限します）。

## Upstream / Downstream
- **Upstream**:
  - `quizeum-user-settings-ui` (退会ボタンのUI)
  - `supabase-core-data` (データベース基本構成)
- **Downstream**:
  - なし

## Existing Spec Touchpoints
- **Extends**: なし（新規のクレンジング仕様として切り出し）
- **Adjacent**: `quizeum-user-settings-ui`

## Constraints
- Supabase Auth の削除には `service_role` 権限（Admin Client）が必要。
- 退会ユーザーの `email` の一意性を保つため、更新後の値には `deleted_{uid}@example.com` の形式を使用する。
