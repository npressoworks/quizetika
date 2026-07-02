# Research Log - supabase-auth-migration

## 1. 調査対象とアプローチ
Firebase Auth から Supabase Auth への移行にあたり、既存の認証状態管理（Context）、ミドルウェア（Route Guard）、API のトークン検証、およびログインUIの依存状況を調査し、移行パターンを確立します。

## 2. 既存実装の分析結果
- **クライアント認証状態 (`auth-context.tsx`)**:
  - `onAuthStateChanged` を使用して認証イベントを検知。
  - 認証ユーザーの `uid` をキーに Firestore からプロフィール詳細（`User` 型）を `getUser` で取得。
  - プロフィール内の `moderationTier` や `role` を Cookie に手動同期（`syncMiddlewareAuthCookies`）。
  - BANユーザーは検知時に強制ログアウトおよび `quizetika_banned=true` クッキーをセット。
- **ミドルウェア (`middleware.ts`)**:
  - `quizetika_uid`, `quizetika_tier`, `quizetika_role` などの Cookie から値を取り出し、ルートガード判定を実施。
- **API検証 (`auth-verify.ts`)**:
  - API Routes 側で `Authorization: Bearer <ID_TOKEN>` を抽出し、Firebase Identity Toolkit に基づく署名検証を実施。

## 3. 技術的決定事項と移行設計
1. **Cookie 管理とミドルウェアの役割**:
   - Supabase Auth の Cookie 連携は `@supabase/ssr` が自動で管理する（`sb-access-token` や `sb-refresh-token` などの Cookie）。
   - ミドルウェアの先頭で `@supabase/ssr` の `updateSession` パターンを組み込み、リクエスト Cookie の更新とレスポンスへの反映を自動化する。
   - 一方で、現行のロール・ティアに基づくミドルウェアのルートガードロジックの互換性を保つため、`auth-context.tsx` はログイン時に Firestore の `User` 情報から `quizetika_role` や `quizetika_tier` を Cookie に書き込む既存の `syncMiddlewareAuthCookies` フローを維持する。
2. **API トークン検証の変更**:
   - Firebase IDトークンの検証（`auth-verify.ts`）から、Supabase Server クライアントを使用した `supabase.auth.getUser(token)` に変更する。
   - `verifyFirebaseIdToken` を `verifySupabaseAccessToken` に置換する。

## 4. リスクと対策
- **セッション更新の競合**: Next.js のミドルウェアで Cookie 更新を行うため、`supabase-foundation` で作成した `middleware.ts` の `updateSession` ヘルパーが確実に呼び出されるようにする。
- **既存の認証テストへの影響**: API Routes のモックや Jest テストで Firebase トークン検証がモックされているため、移行に伴いこれらを Supabase 向けのモックに変更する必要がある。
