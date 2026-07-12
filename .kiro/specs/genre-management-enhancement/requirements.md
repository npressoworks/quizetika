# Requirements Document

## Project Description (Input)
ジャンル管理機能の強化: (1) 初期ジャンル一括投入UIを /admin/moderation から /admin/genres (ジャンル直接管理メニュー)へ移動する。(2) ジャンル削除機能を追加する。削除実行時、対象ジャンルに紐づく既存クイズの再割当て先ジャンルを管理者が指定できるようにし、指定先へ既存クイズのgenreIdを一括更新してから対象ジャンルを削除する。

## Introduction
現在、初期ジャンルの一括投入機能はモデレーション審査画面 (`/admin/moderation`) に配置されており、ジャンル直接管理画面 (`/admin/genres`) にはジャンルの新規追加・一覧表示のみが存在する。本仕様では、一括投入機能をジャンル管理の文脈に合わせて `/admin/genres` へ移動し、あわせてジャンル削除機能を新設する。削除機能は、削除対象ジャンルを参照している既存クイズを別のジャンルへ再割当てしてから安全に削除できるようにする。

## Boundary Context (Optional)
- **In scope**: 初期ジャンル一括投入UIの `/admin/genres` への移動、ジャンル削除UI・API、削除対象ジャンルに紐づく既存クイズの再割当て先ジャンル指定と一括更新、削除実行時の確認・エラーハンドリング。
- **Out of scope**: ジャンルのマージ（統合）機能自体の変更（既存の `community/merge` 機能とは独立）、ジャンルアイコン画像のストレージ上のファイル削除（本仕様では対象ジャンルのメタデータ削除のみを扱い、Storage 上の孤立画像クリーンアップは別対応とする）、承認待ちのジャンル新設申請 (`genre_requests`) との整合処理。
- **Adjacent expectations**: 削除対象ジャンルをフォローしているユーザーの `user_genre_follows` レコードは、既存のデータベース制約（`ON DELETE CASCADE`）により自動的に削除されることを前提とし、本仕様側での明示的な処理は不要とする。

## Requirements

### Requirement 1: 初期ジャンル一括投入UIの移動
**Objective:** 管理者として、ジャンルに関する操作をひとつの画面にまとめたいので、初期ジャンル一括投入機能をジャンル直接管理画面に統合したい

#### Acceptance Criteria
1. The Admin Genres Screen shall 初期ジャンル一括投入のUIセクション（投入ボタンおよび説明文）を表示する。
2. The Admin Moderation Screen shall 初期ジャンル一括投入のUIセクションを表示しない。
3. When 管理者が Admin Genres Screen 上で一括投入ボタンをクリックしたとき, the Admin Genres Screen shall 事前定義された初期ジャンルの一括投入処理を実行する。
4. While 一括投入処理の実行中である間, the Admin Genres Screen shall ボタンを非活性化しローディング状態を表示する。
5. When 一括投入処理が正常に完了したとき, the Admin Genres Screen shall 追加件数および更新件数を含む成功メッセージを表示し、ジャンル一覧を最新の状態に更新する。
6. If 一括投入処理が失敗したとき, then the Admin Genres Screen shall エラーメッセージを表示する。
7. If 認証されたユーザーが管理者権限を持たないとき, then the Admin Genres Screen shall 一括投入UIセクションへのアクセスを許可しない。

### Requirement 2: ジャンル削除の開始と影響確認
**Objective:** 管理者として、不要になったジャンルを一覧から削除したいので、削除操作を安全に開始できるようにしたい

#### Acceptance Criteria
1. The Admin Genres Screen shall 登録済みジャンル一覧の各行に削除操作を開始するための操作要素を表示する。
2. When 管理者が特定のジャンルに対する削除操作を開始したとき, the Admin Genres Screen shall そのジャンルを参照している既存クイズの件数を取得し表示する。
3. If 削除対象ジャンルを参照している既存クイズが1件以上存在するとき, then the Admin Genres Screen shall 既存クイズの再割当て先ジャンルを選択する入力要素を表示し、再割当て先の選択を削除実行の必須条件とする。
4. The Admin Genres Screen shall 再割当て先ジャンルの選択肢から削除対象ジャンル自身を除外する。
5. If 削除対象ジャンルを参照している既存クイズが存在しないとき, then the Admin Genres Screen shall 再割当て先の選択を要求せずに削除操作の続行を許可する。
6. When 管理者が削除操作の開始後に削除を確定する前に操作をキャンセルしたとき, the Admin Genres Screen shall ジャンルおよび既存クイズを変更せずに削除フローを終了する。

### Requirement 3: ジャンル削除の実行と既存クイズの再割当て
**Objective:** 管理者として、ジャンル削除時に既存クイズが宙に浮かないようにしたいので、削除と同時に既存クイズを指定したジャンルへ再割当てしたい

#### Acceptance Criteria
1. When 管理者が再割当て先ジャンルを指定した上で削除を確定したとき, the Genre Management Service shall 削除対象ジャンルを参照している全ての既存クイズのジャンル参照を指定された再割当て先ジャンルへ一括更新した後、削除対象ジャンルのレコードを削除する。
2. When 削除対象ジャンルを参照している既存クイズが存在しない状態で管理者が削除を確定したとき, the Genre Management Service shall 既存クイズの更新を行わずに削除対象ジャンルのレコードを削除する。
3. If 既存クイズの再割当て処理の途中でエラーが発生したとき, then the Genre Management Service shall 削除対象ジャンルのレコードを削除せず、既存クイズのジャンル参照も変更前の状態のまま維持する。
4. When 削除処理（既存クイズの再割当ておよびジャンルレコードの削除）が正常に完了したとき, the Admin Genres Screen shall 削除件数を含む成功メッセージを表示し、ジャンル一覧を最新の状態に更新する。
5. If 削除処理が失敗したとき, then the Admin Genres Screen shall エラーメッセージを表示し、削除対象ジャンルを一覧に残す。
6. If 認証されたユーザーが管理者権限を持たないとき, then the Genre Management Service shall ジャンル削除リクエストを拒否する。
7. If 指定された再割当て先ジャンルIDがジャンルマスタに存在しないとき, then the Genre Management Service shall 削除リクエストを拒否しエラーを返す。
8. If 削除対象ジャンルを参照している既存クイズが1件以上存在するにもかかわらず再割当て先ジャンルが指定されていないとき, then the Genre Management Service shall 削除リクエストを拒否しエラーを返す。

<!-- Additional requirements follow the same pattern -->
