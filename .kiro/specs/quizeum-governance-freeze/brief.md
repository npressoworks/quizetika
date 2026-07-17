# Brief: quizeum-governance-freeze

## Problem
コミュニティ主導のガバナンス（タグ/ジャンルのマージ提案・加重投票、ジャンル新設申請・投票）が一般開放されているが、運営判断としてこれを一時凍結したい。現状ではモデレーター以上のユーザーが `/community/merge` で提案・投票でき、可決時には RPC がマージを自動実行するため、システム管理者の管理外でメタデータが変更されうる。また、プロフィール上のモデレーションティアバッジ（モデレーター/シニアモデレーター等）とレピュテーションスコア表示が、凍結中のガバナンス制度を機能中であるかのように見せてしまう。

## Current State
- `/community/merge`: moderator 以上が閲覧・提案・加重投票可能（middleware.ts + ページ内ガード）。可決時は `handle_vote_merge_request` RPC がクイズ側一括書き換えまで同期実行。
- `/community/genres`: 認証済みユーザーが申請、moderator 以上が投票。可決時は `handle_vote_genre_request` RPC がジャンルマスタへ自動登録。
- RPC（`handle_create_merge_request` / `handle_vote_merge_request` / `handle_submit_genre_request` / `handle_vote_genre_request`）は supabase-governance スペックが所有し、moderationTier ベースの認可で一般モデレーターにも開放されている。
- プロフィール（`src/app/profile/[uid]/profile-client.tsx`）にティアバッジ（`resolveModerationTierDisplay`）とレピュテーションスコアを表示。
- クイズエディタ（`quiz-metadata-section.tsx`）から `/community/genres` への導線リンクあり。
- システム管理者の判定は `role === 'admin'`（moderationTier とは別軸、middleware.ts で Cookie ベース判定済み）。

## Desired Outcome
- 凍結フラグが ON の間、システム管理者（`role === 'admin'`）以外はマージ提案・投票・ジャンル申請・投票を一切実行できない（UI 非表示かつサーバーサイド RPC でも拒否）。
- `/community/merge` と `/community/genres` は管理者専用ページとして存続し、管理者は投票を待たず単独判断で即時マージ・ジャンル登録を実行できる。モデレーター以下のアクセスは 404。
- プロフィールのティアバッジとレピュテーションスコア表示が非表示になる（「獲得した称号バッジ」は表示継続）。
- 凍結解除時はフラグを戻すだけで元のコミュニティ主導運用に復帰できる（コード撤去・git 復元は不要）。

## Approach
設定フラグによる凍結。アプリ側は単一の設定定数（または環境変数）で UI 表示・導線・ページガードを一元制御し、DB 側はマイグレーションで RPC に管理者限定チェック（凍結時）を追加する。UI だけの非表示では API 直叩きで迂回できるため、RPC レベルの認可強化を必須とする。管理者による即時実行（投票プロセスのバイパス）の実現方式（既存 RPC の分岐 or 管理者専用 RPC）は設計フェーズで確定する。

## Scope
- **In**:
  - 凍結フラグの導入（アプリ側設定 + DB 側での凍結状態の扱い。両者の整合方式は設計で確定）
  - `/community/merge` `/community/genres` の admin 専用化（middleware.ts のガード変更 + ページ内ガード変更）
  - 管理者の単独判断による即時マージ実行・即時ジャンル登録（投票 UI の置き換え）
  - RPC 4種（merge 起案/投票、genre 申請/投票)の凍結時 admin 限定化（マイグレーション）
  - プロフィールのティアバッジ・レピュテーションスコア表示の非表示化
  - クイズエディタ等からの `/community/genres` 導線の非表示化（非管理者向け）
  - 凍結告知は不要（非管理者にはページ自体が 404）
- **Out**:
  - 「獲得した称号バッジ」セクションの変更（表示継続）
  - レピュテーションスコアの蓄積ロジック自体の停止（表示のみ非表示、内部データは維持）
  - moderationTier 制度・データモデル自体の廃止や変更
  - 管理者向けモデレーション審査キュー（`/admin/moderation`）や NG ワード管理等、既存 admin 機能の変更
  - ジャンルの直接管理 API（`/api/admin/genres`、既に admin 限定）の変更

## Boundary Candidates
- 凍結フラグ定義（`src/lib/` 配下の設定モジュール）
- ルートガード（`src/middleware.ts`）
- コミュニティページ（`src/app/community/merge/page.tsx`, `src/app/community/genres/page.tsx`）
- RPC マイグレーション（`supabase/migrations/`）
- プロフィール表示（`src/app/profile/[uid]/profile-client.tsx`）
- エディタ導線（`src/components/quiz/editor/quiz-metadata-section.tsx`）

## Out of Boundary
- モデレーション通報・審査フロー（quizeum-moderation-governance-ui / supabase-governance の既存責務のまま）
- レピュテーション計算ロジック（`services/reputation.ts`）
- サブスクリプション・エンタイトルメント関連

## Upstream / Downstream
- **Upstream**: supabase-governance（RPC・RLS の現行実装）、quizeum-moderation-governance-ui（コミュニティ UI の現行実装）、quizeum-auth-profile-ui（プロフィールのバッジ表示）
- **Downstream**: 将来の「ガバナンス凍結解除」作業（フラグを戻す + 本スペックで導入した admin 限定チェックの解除）

## Existing Spec Touchpoints
- **Extends**: なし（凍結モードという横断的ポリシーを新規境界として所有。既存スペックのドキュメントは変更しない）
- **Adjacent**: quizeum-moderation-governance-ui（`/community/*` ページの原実装）、supabase-governance（RPC 原実装）、quizeum-auth-profile-ui（プロフィール表示）。凍結解除時にこれらの原仕様へ復帰する前提を崩さないこと。

## Constraints
- サーバーサイド強制が必須: UI 非表示のみでは Supabase クライアントから RPC を直接呼べるため、凍結の実効性は RPC/RLS レベルで担保する。
- 可逆性: 凍結解除がフラグ操作（+ 必要なら1マイグレーション）で完結すること。コミュニティ投票のコード・データ（`merge_requests`、投票履歴等）は削除しない。
- 保留中（pending）のマージ提案・ジャンル申請が存在する場合の扱い（凍結時に据え置き or 管理者が処理）を設計で明示する。
- 管理者判定は既存の `role === 'admin'` 軸を使用し、moderationTier の `admin` 値との整合は既存の `resolveModerationTierDisplay` 相当の判定に合わせる。
