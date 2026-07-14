# Roadmap

本ファイルはアクティブな最新フェーズのみを保持します。Wave 0-4 および Phase 5〜Phase 35（完了済み・歴史的フェーズ）は `.kiro/steering/roadmap-archive.md` に移動しました。

> 正確な最新状態は本ファイルの記述ではなく `/kiro-spec-status <feature>` または各 `.kiro/specs/*/spec.json` を直接参照すること。

## 既知のギャップ（2026-07-09 確認）
- `quizeum-play-flow-ui` のスペック内履歴（`research.md`/`requirements.md`）には Phase 37（クイズ詳細プレイモード簡素化）・Phase 38（自己順位リーダーボード表示）のディスカバリー記録が存在するが、本ロードマップにはまだ Phase 37/38 のセクションが追記されていない。次回このスペックを touch する際に本ファイルへの追記を検討すること。

---

## Phase 36: Firebase残存痕跡の払拭 — 識別子命名 & 旧Storageデータ実移行（2026-07-06 ディスカバリー）

### Overview（本フェーズ）
`supabase-cleanup`（Phase 35）完了後も、Firebase SDK 依存としては検出されない2種類の残存が判明した。(1) `auth-context.tsx` を起点に `firebaseUser` / `firebaseUid` という Firebase 由来の識別子名がコード・Stripe メタデータキーとして約15ファイルに残存している（実体は Supabase Auth／DB だが命名のみ旧世代）。(2) `supabase-storage-migration` を含む全 Supabase 移行スペックで「既存 Firebase Storage 上のデータの物理マイグレーション」が明示的に Out of Scope とされたまま誰も着手しておらず、`next.config.ts` の `firebasestorage.googleapis.com` remotePatterns 許可設定と `storage.ts`/`storage-path.ts` の旧URLサイレントスキップ・ロジックがこれを恒久的に温存している。

### Approach Decision（本フェーズ）
- **Chosen**: 混在分解 — (1) 命名リネームは既存スペック `supabase-cleanup` の拡張として扱う、(2) 旧Storage実データ移行は新規スペック `supabase-storage-legacy-migration` として切り出す
- **Why**: 命名リネームは `supabase-cleanup` が既に所有する「残存Firebase参照の是正」という責務範囲に自然に収まる機械的な変更。一方、実データ移行はどの既存スペックにも属さず、Firebase Storage への読み取りアクセスやDB一括更新・ドライラン設計など独立した責任境界を要するため、新規スペックとして切り出す方が既存スペックのボリュームを膨張させずに済む。
- **Rejected alternatives**:
  - 両方を `supabase-cleanup` の追加タスクとして扱う: 実データ移行はスクリプト実行・本番データ変更を伴う性質上、コード削除のみを責務とする `supabase-cleanup` の Boundary Context（「既存データの物理マイグレーションはOut of scope」と明記済み）と矛盾する。
  - 両方をまとめて1つの新規スペックにする: 命名リネームは低リスクな機械的変更であり、実データ移行（本番データ操作・ロールバック設計）と同じレビュー重量を課す必要がない。

### Scope（本フェーズ）
- **In**:
  - `firebaseUser` / `firebaseUid` 識別子のリネーム（`auth-context.tsx`, 各 admin/community/search クライアントコンポーネント, `entitlement.ts`, `subscription.ts`, `stripe-webhook.ts`, `types/subscription.ts` 等）。Stripe Customer メタデータキー `firebaseUid` の扱い（後方互換のためキー名維持 or 新キーへの移行）は設計時に確定する
  - Firebase Storage 上に実体が残る画像データ（アバター・クイズカバー・ジャンルアイコン等）の Supabase Storage への移行、DB上URL参照の一括更新
  - `next.config.ts` の `firebasestorage.googleapis.com` remotePatterns 削除、`storage.ts`/`storage-path.ts` の旧URLフォールバックロジック削除
- **Out**:
  - `quiz-editor.tsx` の `CANONICAL_TAGS` 配列にある `'Firebase'`（技術タグとしての正当な文字列であり、リネーム対象外）
  - Firebase プロジェクト自体の解約操作（実データ移行完了後の運用判断として別途）
  - 新規 Storage 機能追加やアップロード経路の変更

### Constraints（本フェーズ）
- 命名リネームは動作を変更しない純粋なリファクタリングとして実施し、`AuthContext` を消費する既存UIスペック（auth-profile / play-flow / admin-users / moderation-governance / creator-dash 等）に機能的な影響を与えない
- 実データ移行は本番データに対する一括更新のため、ドライラン・対象件数事前確認・ロールバック手順を必須とする
- 実データ移行スクリプトは Firebase Admin SDK 等を恒久的な `dependencies` として再追加しない（ワンショットツールとして分離）

### Boundary Strategy（本フェーズ）
- **supabase-cleanup（拡張）**: 識別子命名リネームの一式を所有
- **supabase-storage-legacy-migration（新規）**: 対象データ棚卸し、移行スクリプト、DB URL一括更新、コード側フォールバック撤去を所有
- **Shared seam**: `AuthContext` の公開インターフェース変更はリネーム後も型のみの変更に留め、UIスペック側の呼び出し箇所は機械的な追随で完結させる

## Existing Spec Updates（Phase 36・依存順）
- [x][impl] supabase-cleanup -- `firebaseUser`/`firebaseUid` 識別子のリネーム（`auth-context.tsx` 起点）。`authUser` へのリネームおよび Stripe メタデータキー `userId`（`firebaseUid` は後方互換フォールバックとして意図的に残存）まで実装完了。`npm run verify:firebase-removed` Stage A/B・`npm run build`・`npm run test`（228スイート/1311テスト）全て成功。`spec.json.phase` を `implementation-complete` に更新済み。Dependencies: none

## Specs (dependency order)
- [x][impl] supabase-storage-legacy-migration -- Firebase Storage 上の既存画像データを Supabase Storage へ実移行し、DB URL参照を更新、`next.config.ts`/`storage.ts`/`storage-path.ts` の旧URL迂回ロジックを撤去する。Dependencies: supabase-storage-migration, supabase-cleanup

### 進捗更新（2026-07-09・Phase 36 完了）

ローカル Supabase（`http://127.0.0.1:54321`）に対し `npm run migrate:legacy-storage`（ドライラン）を実行し、移行対象 of 残存 Firebase Storage URL が `0件` であることを確認。続けて `npm run verify:legacy-storage-migration -- final` を実行し、残存ゼロ・ビルド・テスト成功を経て `next.config.ts`/`storage.ts`/`storage-path.ts` のフォールバックコードを自動撤去（`RESULT: PASS`）。撤去後の状態で `npm run build`・`npm run test` を再実行しリグレッションなしを確認。`supabase-cleanup` の識別子リネーム（Task 6.1/6.2/6.3）も `npm run verify:firebase-removed` で再検証済み。両スペックとも `spec.json.phase` を `implementation-complete` に更新。Firebase残存痕跡の払拭（Phase 36）は本更新をもって完結。

なお `src/components/quiz/quiz-editor.tsx` の `CANONICAL_TAGS`（Out of Scope として保持予定だった `'Firebase'` タグ）は、本フェーズ着手前の別コミットで既に配列ごと削除されていたことが判明した（`src/` 全体を検索しても現存しない）。本フェーズが変更した範囲には含まれず、既存の無関係なドリフトとして記録のみ行う。

---

## Phase 37: ユーザー退会時のデータクレンジングと匿名化（2026-07-14 ディスカバリー）

### Overview（本フェーズ）
ユーザー退会時、現在のシステムでは `delete_status` を `'delete_pending'` に更新して Stripe サブスクを解約するのみで、コンテンツ（クイズ、問題）の匿名化やリーダーボードからの削除、Supabase Auth 側からのアカウント物理削除といったデータクレンジング処理が行われていない。単純に `users` レコードを物理削除すると、外部キー制約の `ON DELETE CASCADE` によりクイズも消失してしまう。本フェーズでは、クイズや問題を「退会済ユーザー」のものとして残したまま、個人情報の匿名化とリーダーボード等からの削除、および Auth アカウントの物理削除を同一の API フロー内で同期的に実行する仕組みを導入する。

### Approach Decision（本フェーズ）
- **Chosen**: API内同期クレンジング（Approach A）
- **Why**: 外部の非同期キューやデータベーストリガー等の複雑な仕組みを導入せず、API Route (`/api/user/delete-account`) のフロー内にクレンジング処理（関連データの削除、クイズ/問題の著者名匿名化、`users` の匿名化、Auth からの削除）を統合することで、アーキテクチャがシンプルになり、テストやエラーハンドリングが容易になる。
- **Rejected alternatives**:
  - PostgreSQL トリガーと Supabase Edge Functions による非同期クレンジング: 応答速度は向上するが、管理するコンポーネントが増え、テスト容易性が低下する。現状のデータ規模では同期処理で十分に対応可能。

### Scope（本フェーズ）
- **In**:
  - `users.delete_status` チェック制約の拡張（`'deleted'` の許容）。
  - 退会 API `/api/user/delete-account` の拡張によるクレンジング処理の同期実行。
  - `leaderboard_entries` から該当ユーザーのレコード削除。
  - `quizzes` および `questions` のキャッシュ項目（`author_name` / `author_avatar`）の匿名化更新。
  - `follows`、`bookmarks`、`notifications` の該当ユーザー関連レコードの削除。
  - `users` レコードの個人情報のクリアおよび `delete_status = 'deleted'` への更新。
  - Supabase Auth 上のユーザーアカウント物理削除。
- **Out**:
  - 管理者によるユーザーBAN処理の変更。
  - ユーザーが作成したクイズ自体や、他のユーザーが残したプレイ履歴（attempts）の削除。

### Constraints（本フェーズ）
- Supabase Auth の削除には `service_role` 権限（Admin Client）が必要。
- 退会ユーザーの `email` の一意性を保つため、更新後の値には `deleted_{uid}@example.com` の形式を使用する。

### Boundary Strategy（本フェーズ）
- **quizeum-account-deletion-cleansing（新規）**: クレンジングマイグレーション、API拡張、データ匿名化・削除ロジック、Auth削除処理の一切を所有。

## Specs (dependency order)
- [ ] quizeum-account-deletion-cleansing -- 退会ユーザーのクイズや問題を残したまま、個人情報の匿名化、リーダーボード削除、不要データ削除、および Auth 物理削除を同期的に行う。Dependencies: supabase-cleanup


