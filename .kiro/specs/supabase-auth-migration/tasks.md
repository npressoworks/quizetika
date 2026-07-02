# Implementation Plan - supabase-auth-migration

- [x] 1. Core Auth Library & Verification (P)
- [x] 1.1 認証ラッパーモジュールの作成 (P)
  - `src/lib/supabase/auth.ts` を新規作成し、Google/Twitter/Microsoft/メール各認証メソッドおよびサインアウト処理を実装する。
  - 成果物確認: `src/lib/supabase/auth.ts` がエラーなく作成され、認証操作用のクライアント呼び出しインターフェースが正しく定義されていること。
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: src/lib/supabase/auth.ts_

- [x] 1.2 サーバーサイドトークン検証モジュールの作成 (P)
  - `src/lib/supabase/auth-verify.ts` を新規作成し、Authorization Bearer ヘッダーから抽出した Supabase JWT を検証してユーザー ID を返却する `verifySupabaseAccessToken` を実装する。
  - 成果物確認: `verifySupabaseAccessToken` が定義され、不正なトークンに対して `null` を返却するハンドリングが含まれていること。
  - _Requirements: 4.1, 4.2_
  - _Boundary: src/lib/supabase/auth-verify.ts_

- [x] 1.3 トークン検証機能のユニットテスト実装
  - `tests/lib/supabase/auth-verify.test.ts` (または同等パス) を作成し、JWT 署名検証、有効期限切れ、および正当なセッションに対するモック検証テストを記述する。
  - 成果物確認: テストコマンドを実行して、トークン検証モジュールのテストが全て PASS すること。
  - _Requirements: 4.1, 4.2_
  - _Boundary: src/lib/supabase/auth-verify.ts_
  - _Depends: 1.2_

- [x] 2. Auth Context & Profile Sync
- [x] 2.1 認証コンテキストの移行と Cookie 同期
  - `src/context/auth-context.tsx` を改修し、`supabase.auth.onAuthStateChange` のイベント検知を導入。セッション取得に合わせて Firestore の `User` 情報をフェッチし、既存 Cookie 同期ヘルパーを呼び出して Cookie 同期を継続する。
  - 新規サインアップ時において DB 上にプロフィールが存在しない場合は、初期ユーザープロフィールを自動作成する。
  - 成果物確認: `AuthProvider` を適用した状態で、アプリ起動時およびセッション変化時に型エラーがなく動作し、正しい Cookie が同期されること。
  - _Requirements: 2.1, 2.2, 2.3_
  - _Boundary: src/context/auth-context.tsx_
  - _Depends: 1.1_

- [x] 3. Middleware Integration (P)
- [x] 3.1 ミドルウェアセッション更新とルートガードの統合 (P)
  - `src/middleware.ts` を改修し、`src/lib/supabase/middleware.ts` から `updateSession(request)` を呼び出す記述を先頭に挿入する。セッション更新完了後、Cookie に基づく既存の BAN 判定、未認証ガード、管理画面権限ガードが機能するように統合する。
  - 成果物確認: ミドルウェア内の処理フローでセッション更新が最初に走り、未認証・BANユーザー・一般ユーザーによる保護ページへのアクセス拒否・リダイレクトが正しく制御されること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: src/middleware.ts_

- [x] 4. UI & API Route Migration
- [x] 4.1 ログイン画面 UI の改修
  - `src/app/login/page.tsx` を改修し、Firebase Auth への直接呼び出し箇所を `src/lib/supabase/auth.ts` の認証メソッド呼び出しに置き換える。
  - 成果物確認: ログイン画面がビルドエラーなく描画され、各プロバイダログインボタン押下時に Supabase Auth OAuth フローが開始されること。
  - _Requirements: 1.1, 1.2_
  - _Boundary: src/app/login/page.tsx_
  - _Depends: 1.1_

- [x] 4.2 API Routes のトークン検証置換
  - 各 API Routes (例: `src/app/api/*`) にて利用されている `verifyFirebaseIdToken` を、`verifySupabaseAccessToken` に置き換える。それに伴う API テストの検証モックも Firebase から Supabase 用のモックに修正する。
  - 成果物確認: 各種 API Routes にアクセスした際、トークン検証エラー時には 401 応答を返し、正常なトークンに対して処理が正当に通過すること。
  - _Requirements: 4.1, 4.2_
  - _Boundary: src/app/api/_
  - _Depends: 1.2_

- [ ] 5. Cleanup & Verification
- [ ] 5.1 未使用の Firebase Auth 関連ファイルの削除
  - `src/lib/firebase/auth.ts`、`src/lib/firebase/auth-verify.ts`、および不要となった Cookie 管理ファイルを削除する。
  - 成果物確認: 不要ファイルが物理的に削除され、該当ファイルをインポートしていた箇所から型エラーやインポートエラーが残っていないこと。
  - _Requirements: 1.1, 4.1_
  - _Boundary: src/lib/firebase/_

- [ ] 5.2 統合テストおよび Next.js ビルド検証
  - ローカル Supabase 環境を使用して、ログイン、ログアウト、セッション自動更新、および API 通信の統合検証テストを実行する。
  - 全体のテストスイートおよび Next.js ビルドを実行し、型解決エラーや例外が発生しないことを確認する。
  - 成果物確認: `npm run build` がエラーなく完了し、既存および新規のテストスイートがすべて通過すること。
  - _Requirements: 1.1, 2.1, 3.1, 4.1_
  - _Depends: 1.3, 2.1, 3.1, 4.1, 4.2, 5.1_
