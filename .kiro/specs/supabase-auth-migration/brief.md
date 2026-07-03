# Brief: supabase-auth-migration

## Problem
認証システムが Firebase Auth に完全依存しており（Google, Twitter/X, Microsoft, Email/Password の4プロバイダ）、Supabase Auth への移行が必要。認証コンテキスト、ミドルウェア、BAN検知、ログインUI、サーバーサイドトークン検証の全てが Firebase に結合している。

## Current State
- `src/lib/firebase/auth.ts`: Firebase Auth のプロバイダ・メソッド re-export（Google, Twitter, Microsoft, Email/Password）
- `src/lib/firebase/auth-verify.ts`: サーバーサイド ID トークン検証（Identity Toolkit API 直接呼び出し）
- `src/context/auth-context.tsx`: `onAuthStateChanged` によるユーザー状態監視、Firestore ユーザー取得、BAN 検知、Cookie 同期
- `src/middleware.ts`: Cookie ベースのルートガード（admin, moderator, BAN 判定）
- `src/app/login/page.tsx`: Firebase Auth のソーシャルログイン + Email/Password UI
- `src/lib/middleware-auth-cookies.ts`: ミドルウェア用 Cookie 同期ヘルパー

## Desired Outcome
- Supabase Auth が全認証フローを担当（Google, Twitter/X, Microsoft, Email/Password）
- `auth-context.tsx` が Supabase の `onAuthStateChange` を使用
- ミドルウェアが Supabase SSR の `updateSession` パターンでセッション管理
- サーバーサイドのトークン検証が `supabase.auth.getUser()` に統一
- BAN ユーザーのアクセス遮断が RLS + ミドルウェアで維持
- ログインページが Supabase Auth の OAuth フローを使用

## Approach
`@supabase/ssr` の Cookie ベース認証パターンを採用。Firebase Auth の `onAuthStateChanged` → Supabase の `onAuthStateChange` に1:1置換。サーバーサイドは `createServerClient` + `getUser()` でトークン検証。ミドルウェアは Supabase 公式の `updateSession` パターンに準拠。

## Scope
- **In**:
  - `src/lib/supabase/middleware.ts` の `updateSession` 実装
  - `src/context/auth-context.tsx` の全面書き換え（`onAuthStateChange` + Supabase ユーザー取得）
  - `src/middleware.ts` のミドルウェア書き換え（Supabase セッション更新 + BAN検知）
  - `src/app/login/page.tsx` のログインUI更新（Supabase OAuth + Email/Password）
  - `src/lib/firebase/auth.ts` → `src/lib/supabase/auth.ts` への移行
  - `src/lib/firebase/auth-verify.ts` の削除と `getUser()` ベース検証への置換
  - `src/lib/middleware-auth-cookies.ts` の Supabase Cookie 管理への置換
  - 全 API Routes の `verifyFirebaseIdToken` → `supabase.auth.getUser()` 置換
  - Supabase ダッシュボードでの OAuth プロバイダ設定手順のドキュメント
- **Out**:
  - サービス層のデータベースクエリ変更（`supabase-core-data` が担当）
  - Firebase Auth からのユーザーデータエクスポート・インポート

## Boundary Candidates
- 認証フロー全体（ログイン、ログアウト、セッション管理）
- サーバーサイドトークン検証
- ミドルウェアのアクセス制御

## Out of Boundary
- Firestore のデータ操作コード
- UI コンポーネントの見た目変更
- ストレージ操作

## Upstream / Downstream
- **Upstream**: `supabase-foundation`（クライアント初期化・RLS ポリシー）
- **Downstream**: `supabase-core-data`, `supabase-gameplay`, `supabase-governance`, `supabase-cleanup`

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-auth-profile-ui`（認証UI の Firebase 依存部分）

## Constraints
- Supabase Auth は Cookie ベース（`@supabase/ssr`）で、Firebase Auth の IndexedDB/LocalStorage ベースとは異なる
- Microsoft OAuth は Supabase の Azure プロバイダ設定を使用（`GOTRUE_EXTERNAL_AZURE_ENABLED`）
- BAN 判定: `users` テーブルの `is_banned` カラム + RLS ポリシーで遮断
