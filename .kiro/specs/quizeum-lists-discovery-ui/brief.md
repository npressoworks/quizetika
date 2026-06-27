# Brief: quizeum-lists-discovery-ui

## Problem
ユーザーはクイズリスト・問題リストをブックマークやプロフィール以外からも発見・管理したいが、現状は `/list/[id]` の個別詳細とプロフィール内タブのみで、**グローバルなリスト探索画面がない**。また自分の非公開リストを一覧で確認する導線も弱い。

## Current State
- リスト CRUD・詳細・プレイ: `/list/create`, `/list/[id]`, `/list/[id]/edit` は実装済み
- `getLatestQuizLists(limit)` で公開リスト取得、`getQuizListsByAuthor(authorId, includeUnpublished)` で作者別取得
- Sidebar / BottomNav にリスト項目なし
- プロフィールの「作成したリスト」タブは作者本人/他人の公開リスト表示に限定

## Desired Outcome
- Sidebar（および設計で決まるモバイル導線）から「リスト」で `/lists` に遷移できる
- `/lists` でキーワード検索ができる
- 「公開リスト」「非公開リスト（自分のみ）」をタブまたはトグルで切り替えられる
- 各カードから `/list/[id]` 詳細へ遷移できる

## Approach
既存 `quiz-list.ts` を拡張した `searchLists`（Core）を呼び出す専用クライアントページを新設。公開タブは `isPublished === true` のフィード＋タイトル/説明のクライアントまたは Firestore 前方一致検索。非公開タブはログインユーザー本人の `isPublished === false` のみ。UI はブックマークページ (`bookmarks-client`) のタブ＋検索バーパターンを踏襲。

## Scope
- **In**: `/lists` ルート、`ListsClient`、検索入力（デバウンス）、公開/非公開タブ、リスト種別バッジ、空状態、ローディング/エラー、E2E
- **Out**: リストの新規作成フロー（既存 `/list/create` へリンクのみ）、ソート・ページングの高度化（初版は limit 固定で可）、他人の非公開リスト閲覧

## Boundary Candidates
- リスト一覧 UI と検索状態管理
- Core `searchLists` API との契約（引数: `visibility`, `keyword`, `authorId?`, `limit`）

## Out of Boundary
- リスト編集・並び替え（`quizeum-creator-dash-ui`）
- ブックマーク一覧（既存 `/bookmarks`）
- カスタムクイズ（`quizeum-my-quiz-ui`）

## Upstream / Downstream
- **Upstream**: `quizeum-core`（`searchLists`）、`useAuth`、既存 `QuizList` 型
- **Downstream**: `quizeum-sidebar-layout`（ナビリンク）、`docs/screen_transition.md`

## Existing Spec Touchpoints
- **Extends**: なし（新規スペック）
- **Adjacent**: `quizeum-creator-dash-ui`（リスト作成）、`quizeum-play-flow-ui`（リストプレイ詳細）、`quizeum-sidebar-layout`（ナビ）

## Constraints
- 非公開タブは未ログイン時はログイン誘導または非表示
- Vanilla CSS / CSS Modules
- 日本語 UI
