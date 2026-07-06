# Requirements Document

## Project Description (Input)
運用担当・開発者にとって、Firebase → Supabase 移行（Phase 35）が完了した現在も、既存ユーザーのアバター画像・クイズカバー画像・ジャンルアイコン等、実体が Firebase Storage に残ったままの画像ファイルが存在する。このため Firebase プロジェクトを完全に停止・解約できず、二重のインフラコストと運用リスク（Firebase 側の障害・認証情報失効が既存画像の表示断につながる）を抱え続けている。

`supabase-storage-migration` を含む全 Supabase 移行スペック（`.kiro/steering/roadmap.md` Phase 35）は「既存 Firestore / Firebase Storage 上のデータの物理マイグレーション」を明示的に Out of Scope としており、これまで誰も着手していない。`src/services/storage.ts` の `deleteImage()` は Supabase 公開URLパターンに一致しない画像（旧 Firebase URL）を検出すると何もせず処理を終了し、`src/lib/storage-path.ts` の `parseSupabasePublicUrl()` も旧 Firebase Storage URL に対して `null` を返すのみで解決手段を持たない。`next.config.ts` の `images.remotePatterns` には `firebasestorage.googleapis.com` が許可ホストとして残存しており、旧URL画像を表示し続けるための恒久的な迂回策になっている。対象データ量・対象テーブル/カラム（`users` のアバター、`quizzes` のカバー画像、`metadata_genres` のアイコン等）の棚卸しも未実施である。

本スペックでは、既存の全画像データを Supabase Storage へ実体コピーし、DB上のURL参照をすべて Supabase 公開URLに更新することで、`next.config.ts` の `firebasestorage.googleapis.com` 許可設定と `storage.ts`/`storage-path.ts` の旧URLフォールバック・迂回ロジックを削除できる状態にする。これにより Firebase Storage バケットへの実データ依存を完全になくし、Firebase プロジェクトの解約判断が技術的に可能な状態にすることを目指す。

## Requirements
<!-- Will be generated in /kiro-spec-requirements phase -->
