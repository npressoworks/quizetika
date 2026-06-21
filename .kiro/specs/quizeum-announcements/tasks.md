# Implementation Plan: quizeum-announcements

## 1. Foundation: データベース基盤とサービス層の構築

- [x] 1.1 型定義の追加と Firestore サービス層の構築
  - `src/types/index.ts` に `Announcement` 型（ID, タイトル, 本文, カテゴリ, ステータス, 日付, 作成者）を追加する。
  - `src/services/announcement.ts` を新規作成し、`getAnnouncements`, `adminGetAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` などの Firestore CRUD関数を実装する。
  - **Observable completion**: TypeScriptのビルドが通り、新設した各関数の型エラーがないこと。
  - _Requirements: 1.2, 1.3, 1.5, 2.2_
  - _Boundary: Core Model & Service_

- [x] 1.2 Firestore セキュリティルールの更新
  - `firestore.rules` に `announcements` コレクションのアクセスルール（管理者は全操作許可、一般ユーザーは `status == 'published'` の読み取りのみ許可、一般ユーザーの書き込みは拒否）を追加する。
  - **Observable completion**: `firestore.rules` が有効化され、管理者以外からの書き込みがルールで遮断されること。
  - _Requirements: 3.2, 3.3_
  - _Boundary: Security Rules_

## 2. Core: 管理者・一般ユーザーUIの実装

- [x] 2.1 (P) 管理者向けお知らせ管理UIの実装
  - `src/app/admin/announcements/page.tsx` および `client.tsx` を新規作成する。
  - お知らせの一覧表示、新規作成、編集、削除を行うCRUD画面を構築する。
  - 本文入力中のMarkdownプレビュー表示機能を追加する（`parseMarkdownToHtml` を使用）。
  - **Observable completion**: 管理者アカウントでログイン時、`/admin/announcements` にてお知らせの作成、編集、削除、プレビューの一連の操作がブラウザ上でエラーなく行えること。
  - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - _Boundary: Admin Announcements UI_

- [x] 2.2 (P) 通知画面ガードの緩和とタブ化対応
  - `src/middleware.ts` を修正し、`authRequiredPaths` から `/notifications` を除外して未ログインでもアクセスできるようにする。
  - `src/app/notifications/page.tsx` を修正し、Shadcn `Tabs` コンポーネントを配置して「通知」と「運営からのお知らせ」を切り替えられるようにする。
  - 未ログインユーザーがアクセスした際、「通知」タブではログイン誘導UI（ログインボタン等）を表示し、「運営からのお知らせ」タブは制限なしで表示されるようにする。
  - **Observable completion**: 未ログイン状態で `/notifications` にアクセスした際、ログイン画面に強制リダイレクトされず、お知らせがそのまま閲覧できること。
  - _Requirements: 2.1, 2.3, 2.4, 3.1_
  - _Boundary: RouteGuard & Notifications Page_
  - _Depends: 1.2_

- [x] 2.3 (P) 一般ユーザー向けお知らせ一覧タブの構築
  - `src/app/notifications/announcements-tab.tsx` を新規作成する。
  - 公開状態のお知らせを公開日時の降順で一覧表示し、本文を `parseMarkdownToHtml` を用いてマークダウン表示する。
  - **Observable completion**: お知らせ一覧に投稿されたお知らせがマークダウン形式で正しくレンダリングされて表示されること。
  - _Requirements: 2.2, 2.5_
  - _Boundary: Announcements Tab UI_
  - _Depends: 1.1_

## 3. Integration & Validation: 結合と自動テスト

- [x] 3.1 管理ポータルからの遷移追加と全体の結合
  - `src/app/admin/page.tsx` を修正し、「運営からのお知らせ管理」へのリンクカードを追加する。
  - ページ間遷移、未ログイン時のAPI制限（403応答）が正常に機能することを確認する。
  - **Observable completion**: 管理者ポータルからお知らせ管理画面に遷移でき、一般ユーザー向けの表示とも矛盾なくデータが同期すること。
  - _Requirements: 1.1, 3.1_
  - _Boundary: Admin Portal & Routing_
  - _Depends: 2.1, 2.2_

- [x] 3.2 E2Eテストの実装
  - 管理者お知らせ作成・編集・削除、未ログインユーザーでのお知らせタブ表示・ログイン誘導の Playwright E2Eテストを `e2e/announcements.spec.ts` などの新規ファイルで追加する。
  - **Observable completion**: `npm run test:e2e` を実行し、追加したお知らせ関連のE2Eテストがすべてパスすること。
  - _Requirements: 1.2, 1.3, 1.5, 2.2, 2.3, 2.4, 3.2, 3.3_
  - _Boundary: E2E Testing_
  - _Depends: 3.1_

## 4. Phase 2 (Extension): 省略・展開表示と不具合カテゴリの追加

- [x] 4.1 型定義とサービス層のカテゴリ追加
  - `src/types/index.ts` の `Announcement['category']` 型定義に `'bug'` を追加する。
  - 関連サービス `src/services/announcement.ts` 等で型定義にエラーがないことを確認する。
  - **Observable completion**: TypeScript のコンパイルが通り、型変更によるエラーが発生しないこと。
  - _Requirements: 1.6_
  - _Boundary: Core Model & Service_

- [x] 4.2 (P) 管理画面への不具合カテゴリの追加
  - `src/app/admin/announcements/client.tsx` を修正し、カテゴリ選択肢に「不具合」を追加する。
  - **Observable completion**: 管理者画面のお知らせ作成・編集フォームの「種類」セレクトボックスで「不具合」が選択可能であり、Firestore に `category: 'bug'` として保存されること。
  - _Requirements: 1.6_
  - _Boundary: Admin Announcements UI_
  - _Depends: 4.1_

- [x] 4.3 (P) お知らせ一覧での省略・トグル展開表示とバッジ表示の実装
  - `src/app/notifications/announcements-tab.tsx` を修正し、各お知らせカードに展開・折りたたみのトグル状態（`isExpanded`）を追加し、クリック時に切り替えられるようにする。
  - 初期状態（省略表示）では、本文のプレーンテキスト（Markdown記法を除去した文字列など）の先頭100文字を抽出し、「...」を付加して簡易表示する。
  - 展開表示時には、マークダウンをHTMLにパースして全文表示する。
  - カテゴリ「不具合」用のアイコン（例：`Bug` または `AlertCircle`）とローズ系（例えば `destructive` やカスタム赤色）のバッジを追加する。
  - **Observable completion**: `/notifications` の「運営からのお知らせ」タブで、お知らせが初期状態で省略表示され、クリックすると全文展開され、再度クリックすると省略されること。また、「不具合」のお知らせには対応するアイコンとバッジが表示されること。
  - _Requirements: 2.5, 2.6, 2.7, 2.8_
  - _Boundary: Announcements Tab UI_
  - _Depends: 4.1_

- [x] 4.4 (P) テストの修正・追加
  - `tests/components/announcements-tab.test.tsx` や管理画面テスト、E2Eテストに「不具合」カテゴリの表示テストおよび省略・展開表示のインタラクションテストを追加・修正する。
  - **Observable completion**: `npm run test` および `npm run test:e2e` がすべて正常にパスすること。
  - _Requirements: 1.6, 2.5, 2.6, 2.7, 2.8_
  - _Boundary: Testing_
  - _Depends: 4.2, 4.3_

## 5. Phase 3 (Extension): ページング、未読・既読管理、および重要カテゴリ

- [x] 5.1 型定義とサービス層の機能拡張（お知らせ重要カテゴリ・ページング・未読カウント）
  - `src/types/index.ts` の `Announcement['category']` に `'important'` を追加する。
  - `src/services/announcement.ts` の `getAnnouncements` を修正し、`limitCount` と Firestore の `QueryDocumentSnapshot` カーソルを受け取り、`PaginatedAnnouncements` 構造（`items` と `lastVisible`）を返すようにする。
  - `src/services/announcement.ts` に `getUnreadAnnouncementsCount` を追加し、Firestoreの集計クエリ（`count()`）を用いて、指定のタイムスタンプ以降に公開されたお知らせの件数を取得する。
  - **Observable completion**: TypeScript のコンパイルが通り、サービス層の型シグネチャのエラーがなく、カーソルを使用したテスト用のFirestoreクエリがエラーなく動作すること。
  - _Requirements: 1.6, 4.1, 4.4_
  - _Boundary: Core Model & Service_

- [x] 5.2 サービス層の機能拡張（通知ページング・未読カウント・一括既読）
  - `src/services/notification.ts` の `getNotifications` を修正し、Firestore の `QueryDocumentSnapshot` カーソルを受け取り、`PaginatedNotifications` 構造（`items` と `lastVisible`）を返すようにする。
  - `src/services/notification.ts` に `getUnreadNotificationsCount` を追加し、Firestoreの集計クエリ（`count()`）を用いて該当ユーザーの `isRead == false` の通知件数を取得する。
  - `src/services/notification.ts` に `markAllNotificationsAsRead` を追加し、該当ユーザーの `isRead == false` のドキュメントを一括で `isRead = true` に更新する。
  - **Observable completion**: 通知サービスに追加された関数について型エラーが発生しないこと。また、通知一括既読実行後に該当ユーザーの未読通知数が0に更新されること。
  - _Requirements: 4.1, 4.4, 4.6_
  - _Boundary: Core Model & Service_

- [ ] 5.3 (P) 管理画面への「重要」カテゴリの追加
  - `src/app/admin/announcements/client.tsx` を修正し、カテゴリのセレクトボックスに「重要」の選択肢を追加する。
  - 管理者お知らせ一覧画面で、カテゴリが「重要」のバッジが正しく表示されるように変換ロジックを修正する。
  - **Observable completion**: 管理画面でお知らせの種類に「重要」を選択して保存可能であり、一覧表示で「重要」バッジが表示されること。
  - _Requirements: 1.6_
  - _Boundary: Admin Announcements UI_
  - _Depends: 5.1_

- [ ] 5.4 (P) お知らせ一覧でのページング・一括既読と「重要」の赤色強調表示
  - `src/app/notifications/announcements-tab.tsx` を修正し、10件ずつのページング取得を実装する（「もっと見る」ボタンでカーソルを渡して追加取得）。次のページが存在しない場合はボタンを非表示または無効化する。
  - ローカルストレージを使用した一括既読機能（「すべて既読にする」ボタン）を実装し、最新の公開日時タイムスタンプをローカルストレージに保存する。
  - お知らせのカテゴリが「重要」である場合、カードの枠線を赤くし、赤い「重要」バッジを表示して強調する。
  - **Observable completion**: 「運営からのお知らせ」タブで最新10件が表示され、「もっと見る」ボタンで追加取得ができ、一括既読ボタンをクリックするとお知らせの未読カウント（親コンポーネントに通知）が0になること。また、「重要」カテゴリのお知らせが赤く強調表示されること。
  - _Requirements: 2.8, 2.9, 4.1, 4.2, 4.3, 4.7_
  - _Boundary: Announcements Tab UI_
  - _Depends: 5.1_

- [ ] 5.5 (P) 通知メニューのタブ順変更・初期タブおよび通知ページング・未読数バッジと一括既読の統合
  - `src/app/notifications/notifications-client.tsx` を修正し、タブの並び順を左に「通知」、右に「運営からのお知らせ」にし、初期アクティブタブを「通知」に設定する。
  - 各タブの横に未読数（通知は `getUnreadNotificationsCount`、お知らせは `getUnreadAnnouncementsCount`）を表示する。未ログイン時は通知の未読数を表示しない。
  - 個人宛て通知の10件ずつのページング取得（「もっと見る」ボタン）を実装する。
  - 通知の「すべて既読にする」ボタンが押された際、`markAllNotificationsAsRead` を呼び出して表示リストをすべて既読に更新し、未読バッジ数を0にする。
  - **Observable completion**: `/notifications` ページを開いたときにデフォルトで「通知」タブが表示され、各タブの横に件数がバッジ表示され、通知のページングと一括既読が機能すること。
  - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - _Boundary: Notifications Client UI_
  - _Depends: 5.2, 5.4_

- [ ] 5.6 単体テストと結合テストの修正・追加
  - ページング、未読数表示、一括既読、重要カテゴリ追加に伴う機能拡張に対して、テストファイルを追加または修正し、検証を行う。
  - **Observable completion**: `npm run test` がすべて正常にパスすること。
  - _Requirements: 1.6, 2.1, 2.9, 4.1, 4.4, 4.6, 4.7_
  - _Boundary: Testing_
  - _Depends: 5.3, 5.4, 5.5_

- [ ] 5.7 E2Eテストによる動作検証
  - Playwright E2Eテストファイルに、ページングの挙動（「もっと見る」ボタン）、一括既読ボタン押下時の挙動、重要お知らせの赤色強調表示、未読カウントバッジの表示をアサーションするテストケースを追加する。
  - **Observable completion**: `npm run test:e2e` を実行し、すべて正常にパスすること。
  - _Requirements: 1.6, 2.1, 2.9, 4.1, 4.2, 4.4, 4.6, 4.7_
  - _Boundary: E2E Testing_
  - _Depends: 5.6_

