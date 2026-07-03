# Brief: supabase-cleanup

## Problem
全ドメインの Supabase 移行が完了した後、Firebase 関連のコード・パッケージ・設定ファイルが残存しており、これらを完全に削除してプロジェクトをクリーンな状態にする必要がある。また、テストインフラを Supabase ローカル環境に統一し、ステアリングドキュメントを更新する。

## Current State
- Firebase パッケージ: `firebase` (12.13.0), `firebase-admin` が `package.json` に存在
- Firebase 初期化: `src/lib/firebase/` ディレクトリ（5ファイル）が残存
- Firebase 設定: `.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules`
- Firebase 環境変数: `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_*` 系が `.env.local` に存在
- テストモック: `tests/__mocks__/firebase/` が Firebase SDK をモック化
- E2E テスト: Firebase Emulator に接続する設定
- ステアリング: `tech.md`, `structure.md`, `security.md` が Firebase ベースの記述

## Desired Outcome
- `firebase`, `firebase-admin` パッケージが `package.json` から削除
- `src/lib/firebase/` ディレクトリが完全削除
- 全 Firebase 設定ファイル（`.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules`）が削除
- Firebase 関連の環境変数が除去（`.env.local.example` も更新）
- テストモックが Supabase 用に更新
- E2E テストが Supabase ローカル環境に接続
- ステアリングドキュメントが Supabase ベースに更新
- `package-lock.json` が再生成されクリーンな状態

## Approach
全依存スペックの完了を確認後、Firebase 関連ファイルの削除 → パッケージアンインストール → テストインフラ更新 → ステアリング更新の順で実施。最後にビルド（`npm run build`）とテスト（`npm run test`）で破綻がないことを検証。

## Scope
- **In**:
  - `npm uninstall firebase firebase-admin` の実行
  - `src/lib/firebase/` ディレクトリの完全削除
  - `.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules` の削除
  - `firebase-debug.log`, `firestore-debug.log` の削除
  - `.env.local.example` から Firebase 変数の除去、Supabase 変数の追加
  - `tests/__mocks__/firebase/` の削除と Supabase テストヘルパーの新設
  - E2E テスト設定（`playwright.config.ts`）の Supabase ローカル対応
  - `.kiro/steering/tech.md` の更新（Firebase → Supabase の技術スタック記述）
  - `.kiro/steering/structure.md` の更新（ディレクトリ構造の変更反映）
  - `.kiro/steering/security.md` の更新（RLS ベースのセキュリティ記述）
  - グローバル grep で残存する Firebase 参照の検出と修正
  - `npm run build` + `npm run test` による最終検証
- **Out**:
  - サービス層のコード修正（既に前段スペックで完了済み）
  - 新規機能の追加

## Boundary Candidates
- Firebase パッケージ・ファイルの削除
- テストインフラの更新
- ステアリングドキュメントの更新

## Out of Boundary
- サービス層のビジネスロジック変更
- UI の変更
- 新規機能の追加

## Upstream / Downstream
- **Upstream**: `supabase-auth-migration`, `supabase-core-data`, `supabase-gameplay`, `supabase-storage-migration`, `supabase-governance`（全スペックの完了が前提）
- **Downstream**: なし（最終スペック）

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: 全既存スペック（Firebase 依存の痕跡を最終確認）

## Constraints
- 全前段スペックが完了していることが前提条件
- ビルド成功 + テスト全パスが完了判定基準
- ステアリング更新は既存の Phase 1-34 の情報を壊さないよう注意
