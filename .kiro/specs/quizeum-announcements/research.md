# Research & Design Decisions: quizeum-announcements

## Summary
- **Feature**: `quizeum-announcements`
- **Discovery Scope**: Extension
- **Key Findings**:
  - `parseMarkdownToHtml` がすでに `src/lib/security/sanitize.ts` に存在しており、これをそのまま流用できる。
  - `/notifications` ページは現在 `middleware.ts` の `authRequiredPaths` に含まれており、未ログイン時はログイン画面に強制リダイレクトされるため、ここを緩和する必要がある。
  - 管理者チェックには、`src/lib/middleware-auth-cookies.ts` の `isAdminUser` や Cookie に設定された `quizeum_role=admin` が使用可能。

## Research Log
### Markdown Render Integration
- **Context**: お知らせ本文のマークダウン対応。
- **Sources Consulted**: `src/lib/security/sanitize.ts`
- **Findings**:
  - `parseMarkdownToHtml(markdown: string): string` が定義されており、DOMPurifyを用いたサニタイズも含んでいる。
- **Implications**: 新たに外部マークダウンパーサー（marked等）を追加する必要はなく、この既存関数を使って安全にお知らせ本文をレンダリング可能。

### Route Guard for Announcements
- **Context**: 未ログインでお知らせを閲覧可能にする。
- **Sources Consulted**: `src/middleware.ts`, `src/app/notifications/notifications-client.tsx`
- **Findings**:
  - `/notifications` へのリクエストはミドルウェアで一律に遮断されている。
  - `NotificationsClient` 内でも `!currentUser` 判定で自動リダイレクトされている。
- **Implications**:
  - ミドルウェアの `authRequiredPaths` から `/notifications` を除外する。
  - `NotificationsClient` ではなく、親の `/notifications` ページでログイン状態に応じて「通知」タブの内容表示を切り替えるように設計する。

## Design Decisions
### Decision: Notification Page Tab Integration
- **Context**: 運営からのお知らせの表示場所。
- **Alternatives Considered**:
  1. 専用ページ `/announcements` を作成する。
  2. `/notifications` の中に「運営からのお知らせ」タブを設ける。
- **Selected Approach**: 2（通知画面のタブ統合）。
- **Rationale**: ユーザーからの明示的な要求「通知メニューに運営からのお知らせタブを表示」に完全に合致する。また、ユーザーは自分への「通知」と運営からの「お知らせ」を一箇所で切り替えて閲覧できるため利便性が高い。
- **Trade-offs**: `/notifications` ページに未ログインアクセスを許可する必要があるため、ミドルウェアの緩和とクライアント側での条件分岐（ログイン誘導）が必要になる。

### Decision: Firestore Collection Schema for Announcements
- **Context**: お知らせの永続化スキーマ。
- **Selected Approach**:
  - 新規コレクション `announcements` を作成。
  - フィールド構成：
    - `id`: string (docId)
    - `title`: string
    - `content`: string (Markdown形式のソース)
    - `category`: 'info' | 'maintenance' | 'update'
    - `status`: 'draft' | 'published'
    - `publishedAt`: Timestamp | null
    - `createdAt`: Timestamp
    - `updatedAt`: Timestamp
    - `authorId`: string
- **Rationale**: 管理者が下書き（`draft`）を保存し、確認後に公開（`published`）に切り替えるワークフローを実現するため。

## Risks & Mitigations
- 非管理者の不正書き込みリスク — Firestoreのセキュリティルール（`firestore.rules`）および API Route で `isAdminUser` 判定を用いて厳格に防御する。
- 未ログインユーザーの通知閲覧漏洩 — クライアントサイドでのガードだけでなく、Firestoreルール `match /notifications/{id}` は `resource.data.userId == request.auth.uid` のため、Firestore層でも保護されていることを確認済み。
