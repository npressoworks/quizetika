# 要件定義書: quizetika-billing-subscription-ui

## はじめに
本ドキュメントは、クイズ投稿SNS「quizetika」における有料プラン（初版は **Pro** のみ）の表示、購読開始、契約管理、および関連ナビゲーション導線のフロントエンド UI 要件を定義します。

**Phase 1（2026-06）**: `quizetika-core` Phase 14 で提供される購読開始 API・契約管理 API および `subscriptionTier` ベースのエンタイトルメントに接続し、ログインユーザーが `/pricing` から Pro プランを購読・管理できる画面を実装します。プレイ画面の残り質問数表示・AI 制限到達ダイアログからの誘導は `quizetika-play-flow-ui` が担当します。

**Phase 2（2026-06-08）**: Pro プランの月額・年額表示を、決済サービス（Stripe）で設定された有効価格から動的に取得して表示します。取得失敗時は代替の固定金額を表示せず、「価格を読み込めません」と明示します。Free プランの ¥0 表示は固定値のままです。

**Phase 3（2026-07-13）**: `quizetika-core` Phase 41 の tier 多層化に合わせ、`/pricing` 画面を固定 2 枚カード（Free / Pro）から、将来の追加プランにも耐えるプラン一覧表示へ改定します。既存の「Pro」表記は「Creator」に改名し、Free と Creator の中間価格帯・特典を持つ新プラン「Player」を追加表示します。購読開始時はプラン（Player または Creator）と課金間隔（月額／年額）の両方を選択できるようにします。

**Phase 4（2026-07-13）**: 契約中の Player・Creator ユーザーが解約・再契約を経ずにプラン間を直接切り替えられるようにします（要件12）。アップグレード（Player→Creator）は即時実行、ダウングレード（Creator→Player）は失われる特典を明示した確認ダイアログを経て実行します。実際のサブスクリプション更新は `quizetika-core` 要件35 が担当します。

## 境界コンテキスト
- **対象範囲（In scope）**:
  - `/pricing` 料金プラン画面（Pro プランカード、月額／年額の選択、特典一覧、価格表示）。
  - Pro プラン月額・年額の動的価格表示、読み込み中・取得失敗時のユーザー向け表示。
  - 未ログイン・無料 tier・有料契約中の各状態に応じた CTA（購読開始、ログイン誘導、契約管理）の表示と操作。
  - 購読開始 API・契約管理 API を呼び出し、外部決済画面へリダイレクトするクライアント操作（初版はリダイレクト Checkout、カード入力は外部画面）。
  - Checkout 完了後（`?checkout=success`）およびキャンセル後（`?checkout=canceled`）の画面内フィードバック。
  - サイドバー等グローバルナビから `/pricing` への導線（最小 1 か所）。
  - 契約状態（Pro 契約中バッジ等）の `/pricing` 上での視覚的表示。
  - 既存ネオンデザインシステムと整合した Vanilla CSS / CSS Modules による UI。
  - **Phase 3**: Player プランのカード表示・月額年額の動的価格表示・購読開始。Free / Player / Creator の3プランを並列表示できる、プラン数増加に耐えるカードレイアウト。購読開始時のプラン選択（Player / Creator）と課金間隔選択の両立。契約状態表示・バッジ・CTA 文言の「Creator」への改名。
- **対象外（Out of scope）**:
  - Premium tier の販売 UI（将来拡張のための表示枠のみ設計で検討可、初版は Free / Player / Creator のみ）。
  - §2.5 将来構想の他 Creator 特典（模擬試験詳細分析、弱点克服無制限等）— Creator の特典表示はウミガメ AI 質問の日次制限解除・広告非表示・クイズ限定公開・AI 作問アシスタントに限定する。
  - **Phase 3**: Player プランの特典表示は「ウミガメ AI 質問の日次制限解除」「広告非表示」の2点に限定し、クイズ限定公開および AI 作問アシスタントは Player の特典として表示しない（Creator 限定であることを明示）。
  - アプリ内カード入力による決済（Stripe Elements 等）。
  - 購読開始 API・契約管理 API・Webhook・Firestore エンタイトルメント同期・セキュリティルール（`quizetika-core`）。
  - 決済サービスから価格を取得・整形するサーバー側処理の実装詳細（`quizetika-core` が担当。本スペックは取得結果の画面表示と購読 UI 連携を担当）。
  - プレイ画面の残り質問数インジケーター、AI 制限到達ダイアログ、`/pricing` へのプレイ内誘導リンク（`quizetika-play-flow-ui`）。
  - 外部決済サービス Dashboard での Product/Price 作成・税設定、返金・チャージバック個別 UI、管理者による手動 tier 付与 UI。
- **隣接システムへの期待**:
  - 購読開始は認証済み Bearer トークン付きで購読開始 API を呼び出し、`priceInterval`（`monthly` | `yearly`）を指定してセッション URL を受け取る。未認証は 401、既存有料契約は 409、BAN ユーザーは 403。
  - 契約管理は認証済み Bearer トークン付きで契約管理 API を呼び出し、有効な有料契約者のみ Portal セッション URL を受け取る。無料 tier は 404。
  - Pro プランの月額・年額表示金額は、決済サービスで設定された有効価格をシステムが取得し、料金画面に反映する。取得経路はサーバー側が提供し、画面はその結果のみを表示根拠とする。
  - Checkout 成功後の契約 tier 更新は Webhook 経由で非同期に反映される。画面は `refreshUser` 等で最新プロフィールを再取得し、反映遅延時は再読み込みまたは短い案内を表示してよい。
  - ユーザープロフィールの `subscriptionTier` 未設定は `free` として解釈する（`quizetika-core` と一致）。
  - ログイン誘導は `/login?redirect=/pricing` パターンで戻り先を保持する（`quizetika-auth-profile-ui` と整合）。
  - **Phase 3**: 購読開始 API は `priceInterval` に加え、購読対象プラン（`player` | `creator`）の指定を受け付けるようコアが拡張される。画面はユーザーが選択したプランと間隔の両方を購読開始 API に渡す。契約管理 API の応答には引き続きプラン種別を含み、画面は `player` / `creator` を区別した契約状態表示を行う。
  - **Phase 3（二重課金防止）**: `quizetika-core` は購読開始 API 内で外部決済サービス側のライブ状態を確認し、既に有効な契約（同一プランまたは別プラン）が存在する場合は 409 を返す。画面は既存の 409 ハンドリング（要件2 AC5）をそのまま用いてよく、二重課金防止のための追加 UI 分岐は必要としない。購読開始ボタンは API 呼び出し中disabledのまま維持し（要件2 AC3）、同一タブでの多重クリックを防ぐ。

## 要件

### 要件 1: 料金プラン画面の基本構成 (`/pricing`)
**目的:** ログイン済みまたは未ログインのユーザーとして、Pro プランの内容・価格・特典を一箇所で確認したい。それにより購読判断を下せる。

#### 受け入れ基準
1. The [Quizetika System] shall [`/pricing` に料金プラン画面を提供し、初版では Pro プランを有料オプションとして表示する]。
2. When [ユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [Pro プランの名称、月額価格、年額価格、および初版特典一覧（ウミガメ AI 質問の日次20回制限解除）を読みやすい形式で表示する]。
3. When [Pro プランの月額・年額価格を表示するとき], the [Quizetika System] shall [決済サービスで設定された有効価格を根拠とした金額を表示し、画面内にハードコードされた固定金額を正本として使用しない]。
4. The [Quizetika System] shall [料金プラン画面をログイン状態に関わらず閲覧可能とする（購読操作は要件 2・3 に従う）]。
5. Where [将来 Premium tier が追加される場合], the [Quizetika System] shall [既存 Pro 表示を変更せず、追加プランカードを並列表示できる拡張余地を要件上認める（初版実装は Pro のみ）]。

### 要件 2: 未認証ユーザーおよび無料 tier ユーザーの購読開始
**目的:** 無料 tier のユーザーとして、Pro プランへの購読を開始したい。それによりウミガメ AI 質問の日次制限を解除できる。

#### 受け入れ基準
1. When [未認証ユーザーが購読開始操作を試みたとき], the [Quizetika System] shall [購読フローを開始せず、`/login` へ遷移し、認証後に `/pricing` へ戻れるよう戻り先を保持する]。
2. When [認証済みかつ無料 tier（`subscriptionTier` が未設定または `free`）のユーザーが月額または年額を選択し購読開始を実行したとき], the [Quizetika System] shall [購読開始 API を呼び出し、返却された外部決済画面の URL へリダイレクトする]。
3. While [購読開始 API の呼び出しが進行中であるとき], the [Quizetika System] shall [購読ボタンを無効化し、処理中であることが分かるローディング表示を行う]。
4. While [Pro プランの月額・年額価格が未取得または取得失敗状態であるとき], the [Quizetika System] shall [購読開始操作を無効化し、外部決済画面へ遷移しない]。
5. If [購読開始 API が既存有料契約（409）を返したとき], the [Quizetika System] shall [重複購読を開始せず、既に契約中である旨のメッセージと契約管理への導線（要件 3）を表示する]。
6. If [購読開始 API が未認証（401）を返したとき], the [Quizetika System] shall [ログイン画面へ誘導する]。
7. If [購読開始 API が BAN（403）またはその他の失敗を返したとき], the [Quizetika System] shall [日本語のエラーメッセージを表示し、ユーザーが次に取るべき行動が分かるようにする]。
8. The [Quizetika System] shall [購読開始時にクライアント側で契約 tier や `isPremium` を自己申告せず、サーバー側の購読開始 API のみを信頼する]。

### 要件 3: 有料契約中ユーザーの契約管理
**目的:** Pro 契約中のユーザーとして、プラン変更・解約・請求履歴を自己管理したい。それにより契約を継続・変更・終了できる。

#### 受け入れ基準
1. When [認証済みかつ有効な Pro 契約（`subscriptionTier` が `pro` かつ契約が有効）のユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [購読開始 CTA の代わりに契約中状態（例: 「Pro 契約中」バッジ）と契約管理 CTA を表示する]。
2. When [有料契約中ユーザーが契約管理 CTA を実行したとき], the [Quizetika System] shall [契約管理 API を呼び出し、返却された外部契約管理画面の URL へリダイレクトする]。
3. While [契約管理 API の呼び出しが進行中であるとき], the [Quizetika System] shall [契約管理ボタンを無効化し、処理中であることが分かるローディング表示を行う]。
4. If [契約管理 API が無料 tier（404）を返したとき], the [Quizetika System] shall [契約管理を開始せず、購読開始 CTA を表示する]。
5. If [契約管理 API が未認証（401）を返したとき], the [Quizetika System] shall [ログイン画面へ誘導する]。
6. If [契約管理 API がその他の失敗を返したとき], the [Quizetika System] shall [日本語のエラーメッセージを表示する]。
7. While [Pro プランの月額・年額価格が未取得または取得失敗状態であるとき], the [Quizetika System] shall [有料契約中ユーザーに対しても契約管理 CTA を利用可能に維持する]。

### 要件 4: Checkout 完了・キャンセル後の画面フィードバック
**目的:** 購読フロー完了後のユーザーとして、結果が成功かキャンセルかをすぐに理解したい。それにより次の行動（プレイ再開・再試行）を迷わず取れる。

#### 受け入れ基準
1. When [外部決済画面から `/pricing?checkout=success` へリダイレクトされたとき], the [Quizetika System] shall [購読完了を祝福する成功メッセージ（例: Pro プランへの加入完了）を画面内に表示する]。
2. When [外部決済画面から `/pricing?checkout=canceled` へリダイレクトされたとき], the [Quizetika System] shall [購読が完了しなかった旨の中立メッセージを表示し、再度購読開始できる CTA を維持する]。
3. When [Checkout 成功リダイレクト後にユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [最新のユーザープロフィールを再取得し、契約状態の表示（要件 3）を可能な限り最新に反映する]。
4. If [Checkout 成功直後に Webhook 反映が未完了で契約状態がまだ無料 tier と表示されるとき], the [Quizetika System] shall [反映待ちである旨の短い案内を表示し、再読み込みまたはしばらく待つようユーザーに伝えてよい]。
5. The [Quizetika System] shall [成功・キャンセルフィードバック表示後、クエリパラメータをクリーンな URL に置き換え、同一メッセージの再表示を防いでもよい]。

### 要件 5: グローバルナビゲーションからの導線
**目的:** アプリ利用中のユーザーとして、いつでも料金プラン画面へ到達したい。それにより購読検討や契約管理を開始できる。

#### 受け入れ基準
1. The [Quizetika System] shall [ログイン状態に関わらず、グローバルナビゲーション（サイドバー等）から `/pricing` へ遷移できる導線を少なくとも 1 か所提供する]。
2. When [ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき], the [Quizetika System] shall [プレイ没入のためグローバルナビを非表示にする既存ルールを維持し、プレイ中の `/pricing` 導線は本要件の対象外とする（`quizetika-play-flow-ui` が制限到達時の誘導を担当）]。
3. While [現在のパスが `/pricing` であるとき], the [Quizetika System] shall [該当ナビ項目をアクティブ状態としてハイライト表示する（導線をサイドバーに追加した場合）]。

### 要件 6: 契約状態の視覚的表示
**目的:** 認証済みユーザーとして、自身が無料 tier か Pro 契約中かを料金画面で一目で把握したい。それにより適切な CTA（購読または管理）を選べる。

#### 受け入れ基準
1. When [認証済みユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [認証コンテキスト上の `subscriptionTier`（未設定は `free`）に基づき、無料 tier または Pro 契約中のいずれかの状態表示を行う]。
2. While [ユーザーの契約 tier が `pro` かつ有効な有料契約である間], the [Quizetika System] shall [Pro 契約中であることを示すバッジまたは同等の視覚的インジケーターを表示する]。
3. The [Quizetika System] shall [契約状態の表示にクライアント側の手動設定やローカルストレージを用いず、サーバー同期済みプロフィール情報のみを根拠とする]。
4. Where [プロフィール画面への契約バッジ表示が追加される場合], the [Quizetika System] shall [`/pricing` と同一の tier 解釈規則を用いる（任意拡張、初版必須ではない）]。

### 要件 7: ローディング・エラー・障害時のユーザー体験
**目的:** 購読・契約管理操作を行うユーザーとして、通信失敗や権限エラー時にも何が起きたか理解したい。それにより再試行やサポート依頼を判断できる。

#### 受け入れ基準
1. If [購読開始または契約管理 API の呼び出しがネットワーク障害等で失敗したとき], the [Quizetika System] shall [汎用的な日本語エラーメッセージを表示し、ユーザーが再試行できる状態に戻す]。
2. If [認証トークンの取得に失敗したとき], the [Quizetika System] shall [購読・契約管理 API を呼び出さず、ログインを促す]。
3. The [Quizetika System] shall [API エラーレスポンスの技術的詳細（スタックトレース、内部エラーコードの羅列）をエンドユーザー向け画面に表示しない]。
4. While [料金プラン画面の主要データ（認証状態・契約状態）の読み込みが未完了であるとき], the [Quizetika System] shall [レイアウト崩れを抑えたローディングまたはスケルトン表示を行う]。
5. While [Pro プランの月額・年額価格の取得が進行中であるとき], the [Quizetika System] shall [価格表示領域で読み込み中であることが分かる表示を行う]。
6. If [Pro プランの月額・年額価格の取得に失敗したとき], the [Quizetika System] shall [価格欄に「価格を読み込めません」と表示し、代替の固定金額や推定金額を表示しない]。

### 要件 8: デザイン・レスポンシブ・アクセシビリティ
**目的:** 全デバイスのユーザーとして、既存 quizetika のプレミアムな見た目と操作性で料金画面を利用したい。それにより信頼感のある購読体験が得られる。

#### 受け入れ基準
1. The [Quizetika System] shall [料金プラン画面を既存のネオンデザインシステム（カラー、タイポグラフィ、カード、ボタン）と視覚的に整合させる]。
2. The [Quizetika System] shall [Tailwind CSS を使用せず、Vanilla CSS または CSS Modules でスタイルを実装する]。
3. While [画面幅がモバイル・タブレット・デスクトップの各ブレークポイントであるとき], the [Quizetika System] shall [料金プラン画面の主要コンテンツが読みやすく操作可能なレイアウトを維持する]。
4. The [Quizetika System] shall [購読開始・契約管理の主要ボタンに、キーボード操作とスクリーンリーダーで識別可能なラベルを付与する]。

### 要件 9: 境界・隣接スペックとの整合
**目的:** プロダクトオーナーとして、課金 UI がコア・プレイ・認証各層の責務を侵害せず、エンドツーエンドで一貫した体験を提供したい。

#### 受け入れ基準
1. The [Quizetika System] shall [Webhook による契約状態同期、AI 質問制限のサーバー側判定、課金フィールドの改ざん防止を本要件の実装対象に含めない（`quizetika-core` が担当）]。
2. The [Quizetika System] shall [決済サービスからの価格取得・整形・キャッシュ等のサーバー側実装を本要件の実装対象に含めない（`quizetika-core` が担当）]。
3. The [Quizetika System] shall [プレイ画面の残り質問数表示、AI 制限到達ダイアログ、プレイ中の `/pricing` 誘導リンクを本要件の実装対象に含めない（`quizetika-play-flow-ui` が担当）]。
4. The [Quizetika System] shall [初版 Pro 特典の説明をウミガメ AI 質問の日次20回制限解除に限定し、ロードマップ上の他特典を料金画面で約束しない]。
5. The [Quizetika System] shall [Premium tier の販売および Premium 固有特典の UI 表示を初版の実装対象に含めない]。
6. When [E2E テストが未契約ユーザーの購読開始フローを検証するとき], the [Quizetika System] shall [外部決済テストモードへ遷移する直前まで（購読開始 API 呼び出しとリダイレクト URL 取得）を自動検証可能とする]。

### 要件 10: Pro プラン価格の動的表示と表示形式
**目的:** 料金画面を閲覧するユーザーとして、決済サービスで実際に課金される金額と一致する価格を確認したい。それにより誤った金額表示による購読判断のミスを防げる。

#### 受け入れ基準
1. When [Pro プランの月額価格を表示するとき], the [Quizetika System] shall [日本円で読みやすい形式（例: 金額に「/月」を付与）で表示する]。
2. When [Pro プランの年額価格を表示するとき], the [Quizetika System] shall [日本円で読みやすい形式（例: 金額に「/年」を付与）で表示する]。
3. When [月額・年額の両方の価格が正常に取得できたとき], the [Quizetika System] shall [年額選択時に、月額換算と比較してお得であることが分かる補足表示（例: 年額で約2ヶ月分お得）を表示してよい]。
4. The [Quizetika System] shall [Free プランの ¥0 表示を固定値として表示し、決済サービスからの価格取得の対象に含めない]。
5. While [Pro プランの月額・年額価格が未取得または取得失敗状態であるとき], the [Quizetika System] shall [月額／年額の切替操作を無効化するか、切替しても金額が表示されない状態を維持する]。
6. The [Quizetika System] shall [Pro プランの表示用特典文言（例: ウミガメ AI 質問の日次制限解除）を価格取得の成否に関わらず表示する]。

### 要件 11: 複数有料プラン表示への拡張と Creator への改名（Phase 3）
**目的:** ユーザーとして、Free に加えて価格帯の異なる複数の有料プラン（Player・Creator）を比較検討し、自分に合ったプランを選びたい。それにより過不足のない特典を適切な価格で選択できる。

#### 受け入れ基準

**Pro から Creator への改名**
1. The [Quizetika System] shall [`/pricing` 画面、契約状態バッジ、CTA 文言を含む全ての画面内表示において、旧「Pro」表記を「Creator」に置き換える]。
2. The [Quizetika System] shall [Creator プランの特典文言として、ウミガメ AI 質問の日次制限解除、広告非表示、クイズ限定公開、AI 作問アシスタントを表示する]。

**プラン一覧の拡張表示**
3. When [ユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [Free・Player・Creator の3プランをこの順で並列表示する]。
4. The [Quizetika System] shall [プランカードをプラン定義の一覧に基づき描画し、将来プランが追加された場合にレイアウト変更なくカードを追加表示できる構造で実装する]。
5. When [Player プランの月額・年額価格を表示するとき], the [Quizetika System] shall [Creator プランと同様に決済サービスで設定された有効価格を根拠とした金額を表示し、取得失敗時は「価格を読み込めません」と表示する]。
6. The [Quizetika System] shall [Player プランの特典文言をウミガメ AI 質問の日次制限解除および広告非表示の2点に限定して表示し、クイズ限定公開・AI 作問アシスタントを Player の特典として表示しない]。

**購読開始時のプラン選択**
7. When [未契約の認証済みユーザーが `/pricing` で購読開始を行うとき], the [Quizetika System] shall [Player または Creator のいずれのプランを購読するかをユーザーに選択させたうえで、選択されたプランと課金間隔（月額／年額）を購読開始 API に渡す]。
8. When [有効な Player 契約を有するユーザーが `/pricing` で Creator カードを表示したとき], the [Quizetika System] shall [新規購読 CTA の代わりに「Creator に切り替える」プラン変更 CTA を表示する]。
9. When [有効な Creator 契約を有するユーザーが `/pricing` で Player カードを表示したとき], the [Quizetika System] shall [新規購読 CTA の代わりに「Player に切り替える」プラン変更 CTA を表示する]。

**契約状態の視覚的表示（多プラン対応）**
10. When [認証済みユーザーが `/pricing` を表示したとき], the [Quizetika System] shall [ユーザーの契約 tier（`free` / `player` / `creator`）に応じて、該当するプランカードにのみ契約中バッジを表示する]。
11. While [ユーザーの契約 tier が `player` かつ有効な有料契約である間], the [Quizetika System] shall [Player 契約中であることを示すバッジまたは同等の視覚的インジケーターを表示する]。

**境界・隣接**
12. The [Quizetika System] shall [Premium tier の販売および Premium 固有特典の UI 表示を本要件の範囲に含めない]。
13. The [Quizetika System] shall [クイズ限定公開の設定 UI、AI 作問アシスタントのアクセス制御 UI・upsell 文言を本要件の範囲に含めない（`quizetika-creator-dash-ui` / `quizetika-ui-editor` / `quizetika-ai-quiz-authoring` が担当）]。

### 要件 12: Player・Creator 間のプラン変更 UI（Phase 4）
**目的:** Player または Creator を契約中のユーザーとして、解約・再契約の手間なくプランを切り替えたい。それにより特典差分に応じて柔軟にアップグレード・ダウングレードできる。

#### 受け入れ基準

**アップグレード（Player → Creator）**
1. When [Player 契約中のユーザーが Creator カードの「Creator に切り替える」CTA を実行したとき], the [Quizetika System] shall [確認ダイアログなしでプラン変更 API を呼び出し、即時切替と日割り課金が発生する旨を実行前にボタン付近の説明文で示す]。
2. While [プラン変更 API の呼び出しが進行中であるとき], the [Quizetika System] shall [プラン変更ボタンを無効化し、処理中であることが分かるローディング表示を行う]。
3. When [プラン変更 API がアップグレード成功を返したとき], the [Quizetika System] shall [最新のユーザープロフィールを再取得し、Creator の契約中バッジと特典表示に切り替える]。

**ダウングレード（Creator → Player）**
4. When [Creator 契約中のユーザーが Player カードの「Player に切り替える」CTA を実行したとき], the [Quizetika System] shall [確認ダイアログを表示し、切替により失われる特典（クイズ限定公開、AI 作問アシスタント）を明示したうえでユーザーの最終確認を求める]。
5. When [確認ダイアログでユーザーがダウングレードを確定したとき], the [Quizetika System] shall [プラン変更 API を呼び出す]。
6. When [確認ダイアログでユーザーがキャンセルを選択したとき], the [Quizetika System] shall [プラン変更 API を呼び出さず、契約状態を変更しない]。
7. When [プラン変更 API がダウングレード成功を返したとき], the [Quizetika System] shall [最新のユーザープロフィールを再取得し、Player の契約中バッジと特典表示に切り替える]。

**エラー処理**
8. If [プラン変更 API が同一プランへの変更要求として拒否した場合], the [Quizetika System] shall [既に当該プランを契約中である旨のメッセージを表示する]。
9. If [プラン変更 API が未認証（401）または有料契約なし（403 等）を返した場合], the [Quizetika System] shall [それぞれログイン画面への誘導、または新規購読 CTA を表示する]。
10. If [プラン変更 API がその他の失敗を返した場合], the [Quizetika System] shall [日本語のエラーメッセージを表示し、契約状態表示を変更前のまま維持する]。

**境界・隣接**
11. The [Quizetika System] shall [プラン変更処理そのもの（外部決済サービス上のサブスクリプション更新、比例配分計算）を本要件の範囲に含めない（`quizetika-core` 要件35 が担当）]。
12. The [Quizetika System] shall [`free` への解約（Customer Portal 経由）の UI フローを本要件の範囲に含めない（既存の契約管理 CTA が担当）]。
