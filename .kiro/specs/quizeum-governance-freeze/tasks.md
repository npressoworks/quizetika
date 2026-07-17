# Implementation Plan

- [ ] 1. Foundation: 凍結フラグ基盤
- [x] 1.1 凍結フラグモジュールの作成と単体テスト
  - コード内定数を返す純粋関数 `isGovernanceFrozen()` を新規モジュールとして作成（Edge互換・外部依存ゼロ）
  - 凍結解除時に変更する箇所が定数1行であることをコメントで明示
  - 単体テストでフラグ関数の契約（定数を返す）が固定され、`jest.mock` で差し替え可能であることを確認
  - 完了条件: `tests/lib/governance-freeze.test.ts` がパスし、モジュールが middleware/クライアント双方から import 可能
  - _Requirements: 1.1, 1.2, 6.5_

- [ ] 2. DB: 凍結ゲートと管理者専用RPCのマイグレーション
- [x] 2.1 共有実行関数の抽出と既存RPC 4種の凍結ゲート
  - 新規マイグレーション（`20260724000000_governance_freeze.sql`）に、投票可決分岐のマージ実行/ジャンル登録ロジックを移設した共有関数 `execute_merge` / `register_genre` を定義
  - 既存RPC 4種（マージ起案/投票、ジャンル申請/投票）を先頭で無条件に `governance-frozen` 例外を送出する形で再定義（投票集計・可決処理が発生しない）
  - マイグレーションはDDL（CREATE OR REPLACE FUNCTION）のみで構成し、既存データへのDMLを含まない
  - 完了条件: ローカルSupabaseへ適用後、認証済み非管理者による4RPC呼び出しが全て `governance-frozen` で失敗する
  - _Requirements: 1.4, 5.1, 5.2_

- [ ] 2.2 管理者専用RPC 3種の新設
  - 同一マイグレーションファイル内に `handle_admin_execute_merge`（same-id/circular検証、監査行挿入、即時実行）、`handle_admin_resolve_merge_request`、`handle_admin_resolve_genre_request`（FOR UPDATEでpending検証、approve/reject）を `is_admin()` ガード付きで定義
  - 例外メッセージ契約（`forbidden` / `same-id` / `circular-merge` / `request-not-found` / `already-resolved` / 23505）を design.md 通りに実装
  - 完了条件: 管理者ロールで即時マージ・保留案件のapprove/rejectが成功し、非管理者では `forbidden` で失敗する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 4.3_

- [ ] 2.3 凍結解除用の復元マイグレーション雛形の作成
  - 既存RPC 4種を `is_moderator_or_admin()` ガード付き（genres申請は `is_not_banned()` のみ）+共有実行関数呼び出しの形で再定義する復元SQLを、migrations ディレクトリ外の雛形ファイルとして作成（適用はしない）
  - 完了条件: 雛形SQLがリポジトリにコミットされ、design.md の Migration Strategy と整合する
  - _Requirements: 1.3_

- [ ] 2.4 マイグレーションの統合検証
  - ローカルSupabaseで、管理者の即時マージ実行結果が凍結前の投票可決経路と同一の結果整合（canonical書換・quiz_tags付替・quizzes.genre更新）となることを検証
  - 保留提案/申請のapprove/reject後のstatus遷移と、二重処理が `already-resolved` で拒否されることを検証
  - 非管理者の直接RPC呼び出しで対象テーブルが不変であることを検証
  - 完了条件: 検証スクリプトまたは統合テストが RESULT: PASS 相当で完走する
  - _Requirements: 3.2, 3.4, 4.2, 5.1, 5.2, 5.3_

- [ ] 3. サービス層: RPCラッパー
- [ ] 3.1 (P) 管理者ガバナンス操作サービスの作成
  - `adminExecuteMerge` / `adminResolveMergeRequest` / `adminResolveGenreRequest` の型付きラッパーを新規サービスとして作成（tagMerge.tsのエラーマッピング様式を踏襲）
  - 例外メッセージ契約を日本語エラーメッセージへ変換
  - 完了条件: `tests/services/governanceAdmin.test.ts` で RPC名・引数・全例外系のマッピングが検証されパスする
  - _Requirements: 3.1, 3.3, 3.4, 4.2, 5.3_
  - _Boundary: GovernanceAdminService_
  - _Depends: 2.2_

- [ ] 3.2 (P) 既存マージサービスへの凍結例外マッピング追加
  - `tagMerge.ts` の4関数に `governance-frozen` 例外→凍結中メッセージの変換を追加（シグネチャ変更なし）
  - 完了条件: `tests/services/tagMerge.test.ts` に凍結例外ケースが追加されパスする
  - _Requirements: 5.3_
  - _Boundary: TagMergeService_

- [ ] 4. ガードと導線
- [ ] 4.1 (P) middlewareの凍結時admin限定ガード
  - 凍結時、`/community/merge` と `/community/genres` を「uid あり かつ `quizetika_role=admin`」以外は `/not-found` へ307リダイレクト（未認証も login ではなく not-found）
  - 非凍結時は現行ガード（merge: moderator以上 / genres: 認証済み）を維持
  - 完了条件: 凍結フラグON時にモデレーターTier Cookieでのアクセスが not-found へ、admin role Cookieでは通過する
  - _Requirements: 1.3, 2.1, 2.2_
  - _Boundary: RouteGuard_
  - _Depends: 1.1_

- [ ] 4.2 (P) クイズエディタのジャンル申請導線の凍結時非表示
  - 凍結時かつ非管理者のとき `/community/genres` へのリンクを非表示
  - 完了条件: フラグON+非管理者でリンクが描画されず、管理者では表示される
  - _Requirements: 2.3_
  - _Boundary: EditorGenreLink_
  - _Depends: 1.1_

- [ ] 5. 管理者向けコミュニティ画面
- [ ] 5.1 (P) マージ画面の凍結時ガード・バナー・保留提案の承認/却下
  - ページ内ガードを凍結時 `isAdminUser` 判定へ切替（非管理者は not-found へ）
  - 凍結中バナーを表示し、投票UI（賛成/反対・重み・賛成率バー）を「承認（即時実行）/却下」ボタンへ置換
  - 非凍結時の投票UIコードパスは温存しフラグ分岐で切替
  - 完了条件: フラグON+管理者で保留提案の承認→即時マージ完了、却下→rejected 遷移が画面上で確認できる
  - _Requirements: 1.3, 2.1, 2.2, 2.4, 3.4_
  - _Boundary: CommunityMergePage_
  - _Depends: 3.1_

- [ ] 5.2 マージ画面の即時実行フォーム
  - 起案フォームを `adminExecuteMerge` 呼び出しの即時実行フォームへ切替
  - `same-id` / `circular-merge` 等の実行不能エラーを理由付きメッセージで表示
  - 5.1 と同一ファイルのため (P) なし・5.1 の直後に実施
  - 完了条件: フラグON+管理者で新規マージ内容の入力→即時実行が完了し、実行不能内容ではエラーメッセージが表示される
  - _Requirements: 3.1, 3.3_
  - _Boundary: CommunityMergePage_

- [ ] 5.3 (P) ジャンル画面の凍結時管理者モード
  - ページ内ガードを凍結時 `isAdminUser` 判定へ切替、凍結中バナーを表示
  - 申請フォームを既存 `POST /api/admin/genres` 呼び出しの即時登録フォームへ切替（アイコンの一時アップロード→本配置フローを踏襲）、API の 409/400 はエラーメッセージ表示
  - 投票UIを保留申請の「承認（即時登録）/却下」へ置換
  - 非凍結時の申請/投票UIコードパスは温存しフラグ分岐で切替
  - 完了条件: フラグON+管理者で新規ジャンル即時登録と保留申請のapprove/rejectが画面上で完了する
  - _Requirements: 1.3, 2.1, 2.2, 2.4, 4.1, 4.2, 4.3_
  - _Boundary: CommunityGenresPage_
  - _Depends: 3.1_

- [ ] 6. 公開表示の凍結
- [ ] 6.1 (P) プロフィールのティアバッジ・スコア非表示
  - 凍結時、ティアバッジとレピュテーションスコア行を非レンダリング。「獲得した称号バッジ」セクションは変更しない
  - 完了条件: `tests/components/profile-client.test.tsx` でフラグON時にバッジ・スコアが非表示かつ称号バッジが表示されることが検証されパスする
  - _Requirements: 6.1, 6.2, 6.4_
  - _Boundary: ProfileClient_
  - _Depends: 1.1_

- [ ] 6.2 (P) リーダーボードのスコアタブ凍結時除去
  - 凍結時「スコア」タブをタブ定義ごと除去し、初期タブとサーバー側初期データ取得をプレイ数基準へ切替。プレイ数・作成数タブは無変更
  - 本タスクは凍結時挙動の新規テスト追加のみを所有（既存テストの追随修正は 7.2 が所有）
  - 完了条件: フラグON時にスコアタブが存在せず初期表示がプレイ数ランキングになることがテストで検証される
  - _Requirements: 6.3_
  - _Boundary: LeaderboardPage_
  - _Depends: 1.1_

- [ ] 7. 統合検証
- [ ] 7.1 E2Eテスト: 凍結時の主要フロー
  - E2E前提フィクスチャの整備: モデレーター（非admin, tier=moderator）テストアカウントと、pending状態の `merge_requests` / `genre_requests` のシードを global-setup またはテスト内セットアップに追加
  - モデレーターで `/community/merge` アクセス→404、管理者でアクセス→凍結バナー+承認/却下UI表示+即時マージ完走、一般ユーザーのプロフィール閲覧→ティアバッジ・スコア非表示かつ称号バッジ表示、をPlaywrightで検証
  - 完了条件: 追加E2Eがローカルで全てパスする
  - _Requirements: 2.1, 2.2, 2.4, 3.1, 6.1, 6.2, 6.4_
  - _Depends: 4.1, 5.1, 5.2, 5.3, 6.1_

- [ ] 7.2 全体リグレッションと既存テスト追随
  - スコアタブ除去等の影響を受ける既存テスト（leaderboard系・tagMerge系）を追随修正。本タスクは既存テストの期待値追随のみを所有（6.2 が追加した新規テストには触れない）
  - レピュテーション蓄積ロジック（reputation.ts）に変更がないこと、既存reputation系テストが無修正でパスすることを確認
  - 完了条件: `npm run build` と `npm run test`（全スイート）が成功する
  - _Requirements: 1.2, 1.5_

## Implementation Notes
- 2.1: `20260708000000_grant_public_schema_privileges.sql` のデフォルト権限（ROUTINES に GRANT ALL）により、認可チェックを持たない SECURITY DEFINER 関数は REVOKE（PUBLIC/anon/authenticated）を明示しないと PostgREST 経由で誰でも直接実行可能になる。新設関数には `record_leaderboard_entry`（20260703000200 L138）の REVOKE パターンを踏襲すること（2.2 の管理者 RPC は is_admin() ガードを持つため対象外だが、共有関数を増やす場合は必須）
