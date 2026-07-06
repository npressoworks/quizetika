# Requirements Document

## Project Description (Input)
運用担当・開発者にとって、Firebase → Supabase 移行（Phase 35）が完了した現在も、既存ユーザーのアバター画像・クイズカバー画像・ジャンルアイコン等、実体が Firebase Storage に残ったままの画像ファイルが存在する。このため Firebase プロジェクトを完全に停止・解約できず、二重のインフラコストと運用リスク（Firebase 側の障害・認証情報失効が既存画像の表示断につながる）を抱え続けている。

`supabase-storage-migration` を含む全 Supabase 移行スペック（`.kiro/steering/roadmap.md` Phase 35）は「既存 Firestore / Firebase Storage 上のデータの物理マイグレーション」を明示的に Out of Scope としており、これまで誰も着手していない。`src/services/storage.ts` の `deleteImage()` は Supabase 公開URLパターンに一致しない画像（旧 Firebase URL）を検出すると何もせず処理を終了し、`src/lib/storage-path.ts` の `parseSupabasePublicUrl()` も旧 Firebase Storage URL に対して `null` を返すのみで解決手段を持たない。`next.config.ts` の `images.remotePatterns` には `firebasestorage.googleapis.com` が許可ホストとして残存しており、旧URL画像を表示し続けるための恒久的な迂回策になっている。対象データ量・対象テーブル/カラム（`users` のアバター、`quizzes` のカバー画像、`metadata_genres` のアイコン等）の棚卸しも未実施である。

本スペックでは、既存の全画像データを Supabase Storage へ実体コピーし、DB上のURL参照をすべて Supabase 公開URLに更新することで、`next.config.ts` の `firebasestorage.googleapis.com` 許可設定と `storage.ts`/`storage-path.ts` の旧URLフォールバック・迂回ロジックを削除できる状態にする。これにより Firebase Storage バケットへの実データ依存を完全になくし、Firebase プロジェクトの解約判断が技術的に可能な状態にすることを目指す。

## Boundary Context

- **In scope**:
  - `firebasestorage.googleapis.com` を含むURLが残存するテーブル/カラムの棚卸しと検出
  - Firebase Storage から Supabase Storage への画像ファイル実体の複製
  - 複製確認後のDB上URL参照の一括更新（旧URL → 新 Supabase 公開URL）
  - 移行前のドライラン（対象件数・対象レコードのプレビュー、実際の変更なし）
  - 個別レコード単位での失敗許容と結果レポート
  - 再実行時に既移行済みレコードを重複処理しない冪等な動作
  - 移行完了後の `next.config.ts` の `firebasestorage.googleapis.com` 許可設定、および `src/services/storage.ts`・`src/lib/storage-path.ts` の旧URL向けフォールバック・迂回ロジックの削除
  - 移行完了検証（残存する `firebasestorage.googleapis.com` 参照がゼロであることの確認）とビルド・テストゲート
- **Out of scope**:
  - 新規アップロード機能や既存アップロードフローの変更
  - Supabase Storage のバケット構成・ポリシー自体の変更
  - Firestore（ドキュメントDB側）データの物理マイグレーション（対象は画像ファイルのみ）
  - 開発者が管理する静的アセット（例: SNSロゴ等、ユーザー生成データではないもの）の移行
  - Firebase プロジェクトそのものの解約操作（本スペックはコード・データ移行のみを担当し、実際の解約は運用判断として別途行う）
- **Adjacent expectations**:
  - 本スペックは `supabase-storage-migration`（Supabase Storage のバケット構成・アップロード経路が確立済みであること）および `supabase-cleanup`（コードベースからの Firebase SDK パッケージ削除が完了済みであること）の完了を前提とする。
  - 移行が完了し検証が通るまでの間、既存の画像表示（旧 Firebase Storage URL 経由）は中断されず継続して機能する状態を維持する。

## Requirements

### Requirement 1: 前提条件検証（読み取り可能性のサンプル検証）

**Objective:** 移行担当者として、移行作業を開始する前に、棚卸しで検出された対象データの一部が実際に読み取り可能であることを確認したい。それにより、Firebase Storage 側の状態変化（プロジェクト削除、アクセス制限強化等）により全件が失敗するような状況を早期に検知し、中途半端な作業を防ぎたい。

#### Acceptance Criteria

1. When Migration Process が対象データの棚卸し（Requirement 2）の後に開始される時, the Migration Process shall 検出されたレコードの一部をサンプルとして抽出し、実際に読み取り可能であるかを検証する。
2. If サンプル検証において読み取り可能なレコードが一件も存在しない場合, then Migration Process shall ファイル移行処理を一切実行せず、検証結果をエラーとして報告する。
3. The Migration Process shall 前提条件検証の結果を記録として残す。

### Requirement 2: 対象データの棚卸し

**Objective:** 開発者として、Firebase Storage の旧URLを保持している全レコードを正確に把握したい。それにより、移行漏れによる画像表示断を防ぎたい。

#### Acceptance Criteria

1. The Migration Process shall ユーザーのアバター画像、クイズのカバー画像、問題の画像、ジャンルアイコン、ジャンル新設申請アイコンを含む、画像URLを保持する全レコードを対象に `firebasestorage.googleapis.com` を含むURLを検出する。
2. When 棚卸しが完了した時, the Migration Process shall 対象領域別のレコード件数を人間可読な形式で報告する。

### Requirement 3: ドライラン

**Objective:** 運用担当者として、本番データを実際に変更する前に何件・どのレコードが対象になるかを事前に確認したい。それにより、意図しない一括変更のリスクを避けたい。

#### Acceptance Criteria

1. If 実移行モードが明示的に指定されていない場合, then Migration Process shall デフォルトでドライランモードとして動作する。
2. While Migration Process がドライランモードで実行される間, the Migration Process shall 対象レコードの一覧と移行後に想定される新URLを出力し、DBおよびStorageへの書き込みを一切行わない。
3. The Migration Process shall ドライラン結果に、移行対象の総件数と対象領域別の内訳を含める。

### Requirement 4: ファイル移行

**Objective:** 開発者として、Firebase Storage 上の画像ファイルの実体を Supabase Storage へ複製したい。それにより、Firebase Storage への依存なしに画像を配信できるようにしたい。

#### Acceptance Criteria

1. When 実移行モードで対象レコードを処理する時, the Migration Process shall 該当する Firebase Storage 上のファイルを取得し、対応する Supabase Storage の保存領域へ複製する。
2. When ファイル複製が行われた時, the Migration Process shall 複製後のファイルが Supabase Storage 上で公開アクセス可能であることを確認する。
3. The Migration Process shall 複製後のファイルに対しても、既存の Supabase Storage アップロード時と同一の画像形式制限（PNG/JPEG/GIFのみ、SVG不可）を満たしていることを確認する。
4. If Firebase Storage 上の対象ファイルが既に存在しない場合（削除済み等）, then Migration Process shall 当該レコードをエラーとして記録し、他のレコードの処理を継続する。

### Requirement 5: DB参照の更新

**Objective:** 開発者として、ファイル複製と公開アクセス確認が完了したレコードについてのみDB上のURLを更新したい。それにより、複製前に旧URLが失われて画像が表示できなくなる事態を防ぎたい。

#### Acceptance Criteria

1. When 対象レコードのファイル複製および公開アクセス確認（Requirement 4.2）が完了した時, the Migration Process shall 当該レコードのURL参照を新しい Supabase 公開URLへ更新する。
2. If ファイル複製または公開アクセス確認が失敗した場合, then Migration Process shall 当該レコードのURL参照を変更せず、既存の旧URLを維持する。
3. While いずれかのレコードのURL参照が未更新である間, the Migration Process shall 当該レコードの旧 Firebase Storage URL による画像表示が引き続き機能する状態を維持する。

### Requirement 6: 個別失敗の分離とレポート

**Objective:** 運用担当者として、一部のレコードで移行が失敗しても全体の移行処理が停止しないようにしたい。それにより、大部分のデータを早期に移行しつつ、失敗分を個別に対処したい。

#### Acceptance Criteria

1. If 個別レコードの処理中にエラーが発生した場合, then Migration Process shall 当該エラーを記録し、後続レコードの処理を継続する。
2. When 移行処理が完了した時, the Migration Process shall 成功件数、失敗件数、および失敗理由の一覧を含む結果レポートを出力する。

### Requirement 7: 再実行時の冪等性

**Objective:** 運用担当者として、移行処理を中断した後に再実行しても、既に移行済みのレコードを重複処理しないようにしたい。それにより、安全に何度でも再実行できるようにしたい。

#### Acceptance Criteria

1. When Migration Process が実行される時, the Migration Process shall URL参照が既に Supabase 公開URL形式であるレコードを移行対象から除外する。
2. While 同一データに対して Migration Process が複数回実行される間, the Migration Process shall ファイルの二重複製またはURL参照の重複更新を発生させない。

### Requirement 8: コード側フォールバックロジックの撤去

**Objective:** 開発者として、全データの移行完了が確認された後に、旧URL向けの迂回コードを削除したい。それにより、コードベースを Supabase 単独構成に統一したい。

#### Acceptance Criteria

1. When 移行完了検証（Requirement 9）が Pass した時, the Migration Process shall `next.config.ts` の `firebasestorage.googleapis.com` 許可設定エントリを削除する。
2. When 移行完了検証が Pass した時, the Migration Process shall `src/services/storage.ts` および `src/lib/storage-path.ts` に存在する旧 Firebase URL 向けフォールバック・迂回ロジックを削除する。
3. If 移行完了検証が Pass していない場合, then Migration Process shall フォールバックロジックの削除を実行しない。

### Requirement 9: 最終検証

**Objective:** 移行担当チームとして、移行完了後に Firebase Storage 由来のURLがDB上に一件も残っていないことを確認したい。それにより、Firebase プロジェクトの解約判断が技術的に可能な状態であることを保証したい。

#### Acceptance Criteria

1. When 全レコードの移行処理が完了した時, the Migration Process shall 対象領域全体に対して `firebasestorage.googleapis.com` を含むURLが残存していないことを再検証する。
2. If 残存URLが検出された場合, then Migration Process shall 移行完了として報告せず、残存レコードの一覧を出力する。
3. When 最終検証がPassした時, the Migration Process shall `npm run build` および `npm run test` が成功することを確認する。
4. If `npm run build` または `npm run test` のいずれかが失敗する場合, then Migration Process shall 移行完了として報告しない。
