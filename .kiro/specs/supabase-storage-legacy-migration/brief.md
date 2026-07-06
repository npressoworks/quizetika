# Brief: supabase-storage-legacy-migration

## Problem
運用担当・開発者にとって、Firebase → Supabase 移行（Phase 35）が完了した現在も、既存ユーザーのアバター画像・クイズカバー画像・ジャンルアイコン等、実体が Firebase Storage に残ったままの画像ファイルが存在する。このため Firebase プロジェクトを完全に停止・解約できず、二重のインフラコストと運用リスク（Firebase 側の障害・認証情報失効が既存画像の表示断につながる）を抱え続けている。

## Current State
- `supabase-storage-migration` を含む全 Supabase 移行スペック（`.kiro/steering/roadmap.md` Phase 35）は「既存 Firestore / Firebase Storage 上のデータの物理マイグレーション」を明示的に Out of Scope としており、これまで誰も着手していない。
- [src/services/storage.ts](src/services/storage.ts) の `deleteImage()` は Supabase 公開URLパターンに一致しない画像（旧 Firebase URL）を検出すると何もせず処理を終了する（サイレントスキップ）。
- [src/lib/storage-path.ts](src/lib/storage-path.ts) の `parseSupabasePublicUrl()` は旧 Firebase Storage URL に対して `null` を返す設計で、旧URLの解決手段が存在しない。
- [next.config.ts](next.config.ts) の `images.remotePatterns` に `firebasestorage.googleapis.com` が許可ホストとして残存しており、旧URL画像を表示し続けるための恒久的な迂回策になっている。
- 対象データ量・対象テーブル/カラム（`users` のアバター、`quizzes` のカバー画像、`metadata_genres` のアイコン等）の棚卸しは未実施。

## Desired Outcome
- 既存の全画像データが Supabase Storage へ実体コピーされ、DB上のURL参照がすべて Supabase 公開URLに更新されている。
- `next.config.ts` から `firebasestorage.googleapis.com` の許可設定を削除できる。
- `storage.ts` / `storage-path.ts` の旧 Firebase URL 向けフォールバック・迂回ロジックを削除できる。
- Firebase Storage バケットへの実データ依存が完全になくなり、Firebase プロジェクトの解約判断が技術的に可能な状態になる。

## Approach
バッチマイグレーションスクリプトによる一括移行を想定する。対象テーブルの `firebasestorage.googleapis.com` を含むURLカラムを洗い出し → Firebase Storage から対象オブジェクトを取得 → Supabase Storage の対応バケットへアップロード → DB の該当カラムを新しい Supabase 公開URLへ更新、という順序で処理する。本番データに対する一括更新のため、対象件数の事前カウント・ドライラン（更新前のプレビュー出力）・失敗時のロールバック手順を必須とする。

Firebase SDK パッケージは `supabase-cleanup` によりプロジェクトから削除済みのため、本移行スクリプトは Firebase Admin SDK を一時的にスクリプト専用の依存として再導入するか、Firebase Storage REST API を直接叩く形で実装する必要がある（恒久的な `dependencies` への追加は行わない）。

## Scope
- **In**:
  - `firebasestorage.googleapis.com` を含むURLが残存するテーブル/カラムの棚卸し（`users`, `quizzes`, `metadata_genres` 等）
  - Firebase Storage → Supabase Storage への実ファイルコピー・移行スクリプトの実装（ドライラン機構含む）
  - 移行後のDBカラム一括更新（旧URL → 新 Supabase 公開URL）
  - `next.config.ts` の `firebasestorage.googleapis.com` remotePatterns エントリ削除
  - `src/services/storage.ts` / `src/lib/storage-path.ts` の旧 Firebase URL フォールバックロジック削除
  - 移行完了検証（残存する `firebasestorage.googleapis.com` 参照がDB上にゼロであることの確認）
- **Out**:
  - 新規アップロード機能・Supabase Storage バケット構成自体の変更
  - Firebase プロジェクトそのものの解約操作（本スペックはコード・データ移行のみを担当し、実際の解約は運用判断として別途行う）
  - Firestore データ（ドキュメントDB側）の物理マイグレーション（対象は Storage の画像ファイルのみ）

## Boundary Candidates
- データ棚卸し・対象カラム特定
- 移行スクリプト（ファイルコピー + DB更新）
- コード側フォールバックロジックの撤去（`next.config.ts` / `storage.ts` / `storage-path.ts`）

## Out of Boundary
- Firebase プロジェクトのコンソール上での解約操作
- 新規の Storage 機能追加やバケットポリシー変更

## Upstream / Downstream
- **Upstream**: `supabase-storage-migration`（バケット構成・アップロード経路が前提）、`supabase-cleanup`（コードベースからの Firebase SDK 削除が完了済みであることが前提）
- **Downstream**: 本スペック完了後、Firebase プロジェクトの正式解約判断が技術的に可能になる

## Existing Spec Touchpoints
- **Extends**: なし（新規スペック）
- **Adjacent**: `supabase-storage-migration`, `supabase-cleanup`

## Constraints
- Firebase Storage への読み取りアクセスには、既に無効化されていない有効なサービスアカウント認証情報が必要（現状の有効性は未確認 — discovery/requirements段階で確認が必要）
- 本番データに対する一括更新のため、ドライラン・件数事前確認・ロールバック手順が必須
- 移行スクリプトはワンショット実行を想定し、恒久的な npm 依存として `firebase`/`firebase-admin` を再追加しない
