# Gap Analysis - supabase-storage-legacy-migration

## Summary
- **Feature**: `supabase-storage-legacy-migration`
- **Discovery Scope**: 既存の Supabase Storage 移行パターン（`storage.ts`/`storage-admin.ts`）とDBスキーマの棚卸し、および Firebase Storage への読み取りアクセス方式の実現可能性調査
- **Key Findings**:
  - Supabase 側のアップロード先バケットは `supabase/migrations/20260702000000_init.sql` により **`quizzes`, `users`, `genres`, `sns-logos` の4つのみ**確定している。`sns-logos` は開発者管理の静的アセット（アイコン等）であり、ユーザー生成データではないため本スペックの対象外。
  - 対象データが格納される実際のカラムは、当初 brief.md が想定した3種類（アバター・カバー・アイコン）より広く、以下7カラムが該当する: `users.avatar_url`, `quizzes.thumbnail_url`, `quizzes.author_avatar`（非正規化コピー）, `questions.image_url`, `questions.author_avatar`（非正規化コピー）, `metadata_genres.icon_image_url`, `genre_requests.icon_image_url`。
  - **重大な発見**: Firebase Storage の「ダウンロードURL」（`https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media&token=...` 形式）は、Firebase Storage Security Rules で明示的に非公開化されていない限り、URLに埋め込まれた `token` パラメータのみで**認証不要の匿名アクセスが可能**な設計になっている。現在アプリのブラウザ側で `<img>` タグに直接埋め込まれて表示され続けている実績があるため、DBに保存されている旧URLの多くはこの形式であり、**Firebase Admin SDK や サービスアカウント認証情報なしで単純な HTTP GET により内容を取得できる可能性が高い**。ただし実際のURL形式（ダウンロードURL形式か、素の Cloud Storage パスか）は本番データを見なければ確定できない（Research Needed）。
  - `.env.local` を確認したところ、`FIREBASE_SERVICE_ACCOUNT_JSON`（長さ2344文字、JSON形式のサービスアカウントキーとして妥当な長さ）と `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`（33文字）が依然として設定されており、フォールバック手段としての Firebase Admin SDK 認証情報は少なくともローカル開発環境には残存している（値の中身は未確認のため、有効性＝失効していないかは実行時検証が必要）。
  - **環境上の制約**: 本開発環境の `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` は `http://127.0.0.1:54321`（ローカル Supabase）を指しており、本番 Supabase データベースへの接続情報はこの環境には存在しない。したがって、実際に移行対象となる本番データの件数・URL形式は、この開発環境からは直接確認できない。実装・テストはローカルのモック/シードデータで行い、本番環境への実行は運用担当者が本番環境変数を用いて別途実施する前提となる。
  - 既存の `storage-admin.ts`（`createAdminClient()` + Service Role Key によるサーバー専用アップロード）が「Bufferを受け取ってSupabase Storageにアップロードし公開URLを返す」という、本機能が必要とする処理の後半部分と全く同じパターンを既に確立している。

## Requirement-to-Asset Map

| Req | 対応する既存アセット | ギャップ種別 | 詳細 |
|-----|----------------------|--------------|------|
| 1. 前提条件検証 | `.env.local` の `FIREBASE_SERVICE_ACCOUNT_JSON` 等 | **Unknown** | 値は存在するが有効性（失効していないか）は未検証。実行時に実際に接続を試みるロジックが必要（Missing） |
| 2. 対象データの棚卸し | `src/lib/supabase/database.types.ts` の7カラム | Known（棚卸し先は特定済み） | 対象カラム一覧は確定。棚卸しクエリ自体は未実装（Missing） |
| 3. ドライラン | 既存に同等機能なし | **Missing** | `supabase-cleanup` の `MigrationCompletionGate` に類似する「実行前プレビュー」パターンはあるが、DB書き込みのドライランは新規実装が必要 |
| 4. ファイル移行 | `storage-admin.ts` のアップロード処理（後半部分のみ再利用可） | **Missing（前半: Firebase側の読み取り）** | Supabase側へのアップロードは既存パターンを流用可能。Firebase Storageからの取得方法が未確定（Unknown、Research Needed） |
| 5. DB参照の更新 | Supabase Admin Client（`createAdminClient()`） | Known | 個別テーブルへの `UPDATE` 自体は既存パターンの延長。複製成功後にのみ更新する順序制御が新規要素 |
| 6. 個別失敗の分離 | 既存に同等機能なし | **Missing** | 新規実装が必要（既存の一括処理は基本的に成功/失敗の二値） |
| 7. 冪等性 | `parseSupabasePublicUrl()`（Supabase URL判定） | Known | 既存関数をそのまま「移行済み判定」に流用可能 |
| 8. フォールバックロジック撤去 | `next.config.ts`, `storage.ts`, `storage-path.ts` | Known | 対象行は特定済み（`supabase-cleanup` の Phase 36 調査と同一箇所） |
| 9. 最終検証 | `supabase-cleanup` の `MigrationCompletionGate` パターン | Known（パターン流用可） | 同種の「宣言 vs 実態」検証ゲートとして設計可能 |

## Firebase Storage 読み取り方式の実現可能性調査

Firebase Storage のダウンロードURLは一般的に次のいずれかの形式を取る:
1. `https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media&token={uuid}` — **トークン埋め込み型**。Security Rules に関わらず、このURLを知っている者は誰でも匿名で内容を取得できる（現在ブラウザの `<img src>` から直接読み込めているのはこの形式のため）。
2. `gs://{bucket}/{path}` 形式のバケット内部パス（表示用ではなく内部参照用）。DBに保存されているのがこちらであれば、匿名アクセス不可で Admin SDK 認証が必須。

現状 `src/services/storage.ts`・`src/lib/storage-path.ts` のコメントは「旧 Firebase Storage URL」とのみ記載しており、実際の格納形式（上記1か2か）を明言していない。本番DBを確認できない本環境では確定できないため、**設計フェーズで実データサンプルを確認するか、フォールバック方式を両対応させる設計とする必要がある**（Research Needed）。

## Implementation Approach Options

### Option A: 匿名HTTP GET優先 + Firebase Admin SDKフォールバック（推奨）
移行スクリプトはまず対象URLに対して素の `fetch()` を試み、成功（200 OK かつ画像コンテンツ）すればそのまま Supabase Storage へアップロードする。匿名アクセスが失敗した場合（403/401等）にのみ、`.env.local` の `FIREBASE_SERVICE_ACCOUNT_JSON` を用いて Firebase Admin SDK（スクリプト専用の一時的な devDependency として再導入）で認証取得を試みる。
- ✅ 大多数のケースで Firebase Admin SDK の再導入自体が不要になる可能性が高く、`firebase`/`firebase-admin` の恒久的な依存関係復活を避けられる（`supabase-cleanup` の成果を汚さない）
- ✅ 認証情報が万一失効していても、ダウンロードURL自体が生きていれば移行を継続できる
- ❌ 実データがトークン埋め込み型でなかった場合、フォールバック実装（Admin SDK再導入）の設計・実装コストがそのまま必要になる
- ❌ 匿名アクセスと認証アクセスの2経路を持つため、エラーハンドリング・テストケースがやや複雑になる

### Option B: Firebase Admin SDKのみで統一
最初から `firebase-admin` をスクリプト専用の一時的な devDependency として再導入し、Admin SDK 経由でのみ Firebase Storage オブジェクトを取得する。
- ✅ 実装がシンプルで、URL形式に依存しない確実な取得方法
- ❌ サービスアカウント認証情報の有効性に完全依存する。失効していれば全件が失敗する
- ❌ `supabase-cleanup` が完全除去した `firebase-admin` を（一時的とはいえ）再度 `package.json` に加える必要があり、`MigrationCompletionGate` の意図（Firebase依存ゼロの維持）との緊張関係が生じる

### Option C: 事前のURL形式確認のみ行い、実装方式は設計フェーズで確定
本番データのサンプルURLを1件確認するまでは実装方式を決定せず、まず「対象データの棚卸し」（Requirement 2）のみを軽量に実装して実行し、実際のURL形式を確認してから Option A/B を選択する。
- ✅ 誤った前提での実装コストを避けられる
- ❌ 棚卸しフェーズと移行フェーズが分断され、フィードバックループが長くなる

## Effort & Risk

| 対象 | Effort | Risk | 根拠 |
|---|---|---|---|
| Requirement 1（前提条件検証） | S | Medium | ロジック自体は単純だが、実際の認証情報有効性は本環境から検証不可 |
| Requirement 2（棚卸し） | S | Low | 対象カラムは特定済み。単純なSQL/クエリの組み合わせ |
| Requirement 3（ドライラン） | S〜M | Low | `supabase-cleanup` の類似パターンを踏襲可能 |
| Requirement 4（ファイル移行） | M〜L | **High** | Firebase側読み取り方式が未確定（Option A/B/Cの選択に依存）。実データ未確認のため見積り幅が大きい |
| Requirement 5（DB参照更新） | S | Low | 既存の Admin Client パターンの延長 |
| Requirement 6-7（失敗分離・冪等性） | S〜M | Low | 新規実装だが技術的には定型的なエラーハンドリング |
| Requirement 8（フォールバック撤去） | S | Low | 対象箇所は `supabase-cleanup` の調査で特定済み |
| Requirement 9（最終検証） | S | Low | `MigrationCompletionGate` パターンを流用可能 |

## Recommendations for Design Phase

- **推奨アプローチ**: Option A（匿名HTTP GET優先 + Admin SDKフォールバック）。ただし設計確定前に、可能であれば運用担当者に本番DBの対象カラムのサンプル値を1〜2件確認してもらい、実際のURL形式（トークン埋め込み型か否か）を把握することを強く推奨する。
- **Key Decisions（設計フェーズで確定すべき事項）**:
  1. Firebase Storage 読み取り方式（Option A/B/C のいずれか）の最終決定
  2. Admin SDKフォールバックを実装する場合の一時的な依存関係管理方法（`devDependencies` への一時追加、スクリプト実行後の削除手順）
  3. 移行スクリプトの実行単位（全テーブル一括 or テーブル単位で個別実行可能にするか）
  4. ドライラン結果と実移行の出力フォーマット（人間可読ログのみか、機械可読なレポートファイルも出力するか）
- **Research Needed（設計フェーズへ持ち越し）**:
  - 本番DBの対象7カラムに実際に格納されているURL形式のサンプル確認（可能であれば運用担当者経由）
  - `FIREBASE_SERVICE_ACCOUNT_JSON` の実際の有効性（失効の有無）の実行時検証方法
  - Supabase Storage の各バケット（`quizzes`/`users`/`genres`）の現行アクセスポリシー（`public: false` だが `getPublicUrl()` が機能している実態）が、移行後に複製したオブジェクトにも同様に適用されることの確認

## Design Decisions（設計フェーズ）

### Decision: Firebase Storage からの読み取りは匿名HTTP GETのみとし、Firebase Admin SDKフォールバックは実装しない
- **Context**: Option A（匿名優先+Admin SDKフォールバック）とOption B（Admin SDKのみ）の中間で、フォールバックそのものの要否をユーザーに確認した。
- **User Decision**: 匿名HTTP GETのみを採用する。フォールバックが必要になった場合は、実際の失敗データ（Requirement 6 の失敗レポート）を見てから別途フォローアップとして判断する。
- **Rationale**: `firebase-admin` の恒久的・一時的いずれの再導入も行わないことで、`supabase-cleanup` が達成した「コードベースに Firebase 依存ゼロ」という状態を一切損なわない。実装も大幅に単純化される。現行アプリが既にこれらのURLを認証なしで `<img src>` から表示できている実績から、匿名アクセスで大部分（理論上は全件）のデータを取得できる可能性が高い。
- **Impact on Requirements**: Requirement 1 の文言を「認証情報の有効性検証」から「読み取り可能性のサンプル検証」に修正した（`requirements.md` 更新済み）。認証情報の概念自体が設計から消えるため、Requirement 1.4（環境変数からの認証情報読み取り）は削除した。
- **Trade-off**: 匿名アクセスが失敗するレコードは Requirement 6 の失敗分離ロジックにより個別記録されるのみで、このスペックの範囲では救済されない。将来的に失敗率が高いことが判明した場合は、Admin SDKフォールボックを追加する新規スペックまたは本スペックの拡張が必要になる可能性がある（Revalidation Trigger として design.md に記録）。

### Decision: 移行先パスは非タイムスタンプの決定的パスとする
- **Context**: 既存のライブアップロード用ヘルパー（`getUserAvatarPath` 等）は `Date.now()` によるタイムスタンプ付きパスを生成し、キャッシュバスティングを意図している。移行スクリプトでも同じ命名規則を流用すべきか検討した。
- **Selected Approach**: 移行専用のパス生成規則として `{bucket}/legacy-migrated/{table}-{recordId}-{column}.{ext}` という、レコードごとに一意かつ再実行しても同一になる決定的パスを新設する。既存のライブアップロードヘルパーとは意図的に分離する。
- **Rationale**: 決定的パスにすることで、Supabase Storage への `upload` を `upsert: true` で行えば、中断後の再実行時に同一ファイルへ冪等に上書きでき、孤立した重複オブジェクトが生成されない（Requirement 7 冪等性の実現方法）。既存のタイムスタンプ付きヘルパーはライブアップロード（同一ユーザーが何度もアバターを変更する等）向けに最適化されており、移行という「各レコードにつき一度だけ、確定的に対応するファイルが必要」というユースケースとは目的が異なるため使い分ける。
- **Trade-offs**: 新しいパス生成規則を1つ追加することになるが、既存ヘルパーを移行専用に拡張して意味を汚すよりも責務が明確になる（Simplification）。

### Decision: `storage.ts`/`storage-path.ts` の「非Supabase URLガード」はロジックとして削除せず、コメントのみ更新する
- **Context**: 当初 brief.md は「旧 Firebase URL 向けフォールバック・迂回ロジックの削除」を Scope In としていたが、実装を確認したところ `deleteImage()` の「Supabase 公開URLパターンに一致しない場合は何もしない」ガードは、Firebase URL専用ではなく、Dicebear のデフォルトアバター（`https://api.dicebear.com/...`、`auth-context.tsx` 参照）等の**あらゆる非Supabase URL**を安全に無視するための汎用ガードであることが判明した。
- **Selected Approach**: `next.config.ts` の `firebasestorage.googleapis.com` remotePatterns エントリは実データが完全移行されれば不要になるため完全に削除する。一方 `src/services/storage.ts`（`deleteImage()`）と `src/lib/storage-path.ts`（`parseSupabasePublicUrl()`）の「非Supabase URLは無視する」というロジック自体は削除せず維持し、コメント中の「旧 Firebase Storage URL」という限定的な表現のみを「Supabase 以外の外部URL（Dicebearデフォルトアバター等）」という一般化した表現に更新する。
- **Rationale**: ロジックを削除すると、Dicebear デフォルトアバターの削除保護が失われ、`deleteImage()` が存在しない外部URLに対して削除APIを呼び誤動作するリグレッションを生む。design.md ではこの区別（`next.config.ts` は完全削除、`storage.ts`/`storage-path.ts` はコメント更新のみ）を明示する。
- **Generalization**: Requirement 1（前提条件検証）と Requirement 9（最終検証）は、`supabase-cleanup` の `MigrationCompletionGate` と同様「宣言された対象データの状態」と「実際のデータ状態」を突き合わせるという同一の能力の特殊ケースである。両者を単一のゲートコンポーネント（`LegacyMigrationVerificationGate`）として実装し、サンプル読み取り検証モードと残存URL全数検証モードの2つの呼び出しモードを持たせる。

## Risks & Mitigations
- **リスク**: 本番データのURL形式が想定と異なり（トークンなしの内部パス等）、匿名アクセスが全滅する — **軽減策**: Option Cのように、まず少数サンプルで疎通確認してから全件処理に進む2段階実行を設計に組み込む
- **リスク**: `FIREBASE_SERVICE_ACCOUNT_JSON` が実際には失効しており、フォールバックも機能しない — **軽減策**: Requirement 1 の前提条件検証で早期に検出し、影響範囲（失敗する見込み件数）を事前報告してから運用判断を仰ぐ
- **リスク**: 本開発環境から本番データを直接確認・実行できないため、実装のテストがモックデータに依存し、本番特有のデータ不整合（不正なURL、NULL混在等）を見落とす — **軽減策**: 実データに近い多様なフィクスチャ（正常URL、404対象、形式不一致URL、既にSupabase URLのもの）を用いたテストケースを設計に含める
