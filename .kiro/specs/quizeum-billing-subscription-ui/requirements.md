# 要件定義書: quizeum-billing-subscription-ui

## はじめに
本ドキュメントは、クイズ投稿SNS「quizeum」における有料プラン（初版は **Pro** のみ）の表示、購読開始、契約管理、および関連ナビゲーション導線のフロントエンド UI 要件を定義します。

**Phase 1（2026-06）**: `quizeum-core` Phase 14 で提供される購読開始 API・契約管理 API および `subscriptionTier` ベースのエンタイトルメントに接続し、ログインユーザーが `/pricing` から Pro プランを購読・管理できる画面を実装します。Free tier は全ユーザーの暗黙デフォルトのため、料金画面には比較行として表示しません。プレイ画面の残り質問数表示・AI 制限到達ダイアログからの誘導は `quizeum-play-flow-ui` が担当します。

## 境界コンテキスト
- **対象範囲（In scope）**:
  - `/pricing` 料金プラン画面（Pro プランカード、月額／年額の選択、特典一覧、価格表示）。
  - 未ログイン・無料 tier・有料契約中の各状態に応じた CTA（購読開始、ログイン誘導、契約管理）の表示と操作。
  - 購読開始 API・契約管理 API を呼び出し、外部決済画面へリダイレクトするクライアント操作（初版はリダイレクト Checkout、カード入力は外部画面）。
  - Checkout 完了後（`?checkout=success`）およびキャンセル後（`?checkout=canceled`）の画面内フィードバック。
  - サイドバー等グローバルナビから `/pricing` への導線（最小 1 か所）。
  - 契約状態（Pro 契約中バッジ等）の `/pricing` 上での視覚的表示。
  - 既存ネオンデザインシステムと整合した Vanilla CSS / CSS Modules による UI。
- **対象外（Out of scope）**:
  - Free プランの比較表行・カード表示（デフォルト暗黙のため非表示）。
  - Premium tier の販売 UI（将来拡張のための表示枠のみ設計で検討可、初版は Pro のみ）。
  - §2.5 将来構想の他 Pro 特典（模擬試験詳細分析、弱点克服無制限、広告非表示、プライベートクイズ等）— 初版は **ウミガメ AI 質問の日次20回制限解除** のみを特典として明示。
  - アプリ内カード入力による決済（Stripe Elements 等）。
  - 購読開始 API・契約管理 API・Webhook・Firestore エンタイトルメント同期・セキュリティルール（`quizeum-core`）。
  - プレイ画面の残り質問数インジケーター、AI 制限到達ダイアログ、`/pricing` へのプレイ内誘導リンク（`quizeum-play-flow-ui`）。
  - 外部決済サービス Dashboard での Product/Price 作成・税設定、返金・チャージバック個別 UI、管理者による手動 tier 付与 UI。
- **隣接システムへの期待**:
  - 購読開始は認証済み Bearer トークン付きで購読開始 API を呼び出し、`priceInterval`（`monthly` | `yearly`）を指定してセッション URL を受け取る。未認証は 401、既存有料契約は 409、BAN ユーザーは 403。
  - 契約管理は認証済み Bearer トークン付きで契約管理 API を呼び出し、有効な有料契約者のみ Portal セッション URL を受け取る。無料 tier は 404。
  - Checkout 成功後の契約 tier 更新は Webhook 経由で非同期に反映される。画面は `refreshUser` 等で最新プロフィールを再取得し、反映遅延時は再読み込みまたは短い案内を表示してよい。
  - ユーザープロフィールの `subscriptionTier` 未設定は `free` として解釈する（`quizeum-core` と一致）。
  - ログイン誘導は `/login?redirect=/pricing` パターンで戻り先を保持する（`quizeum-auth-profile-ui` と整合）。

## 要件

### 要件 1: 料金プラン画面の基本構成 (`/pricing`)
**目的:** ログイン済みまたは未ログインのユーザーとして、Pro プランの内容・価格・特典を一箇所で確認したい。それにより購読判断を下せる。

#### 受け入れ基準
1. The [Quizeum System] shall [`/pricing` に料金プラン画面を提供し、初版では Pro プランのみを有料オプションとして表示する]。
2. The [Quizeum System] shall [Free tier を料金比較表やプランカードとして表示しない（全ユーザーが暗黙の無料 tier であるため）]。
3. When [ユーザーが `/pricing` を表示したとき], the [Quizeum System] shall [Pro プランの名称、月額価格、年額価格、および初版特典一覧（ウミガメ AI 質問の日次20回制限解除）を読みやすい形式で表示する]。
4. The [Quizeum System] shall [料金プラン画面をログイン状態に関わらず閲覧可能とする（購読操作は要件 2・3 に従う）]。
5. Where [将来 Premium tier が追加される場合], the [Quizeum System] shall [既存 Pro 表示を変更せず、追加プランカードを並列表示できる拡張余地を要件上認める（初版実装は Pro のみ）]。

### 要件 2: 未認証ユーザーおよび無料 tier ユーザーの購読開始
**目的:** 無料 tier のユーザーとして、Pro プランへの購読を開始したい。それによりウミガメ AI 質問の日次制限を解除できる。

#### 受け入れ基準
1. When [未認証ユーザーが購読開始操作を試みたとき], the [Quizeum System] shall [購読フローを開始せず、`/login` へ遷移し、認証後に `/pricing` へ戻れるよう戻り先を保持する]。
2. When [認証済みかつ無料 tier（`subscriptionTier` が未設定または `free`）のユーザーが月額または年額を選択し購読開始を実行したとき], the [Quizeum System] shall [購読開始 API を呼び出し、返却された外部決済画面の URL へリダイレクトする]。
3. While [購読開始 API の呼び出しが進行中であるとき], the [Quizeum System] shall [購読ボタンを無効化し、処理中であることが分かるローディング表示を行う]。
4. If [購読開始 API が既存有料契約（409）を返したとき], the [Quizeum System] shall [重複購読を開始せず、既に契約中である旨のメッセージと契約管理への導線（要件 3）を表示する]。
5. If [購読開始 API が未認証（401）を返したとき], the [Quizeum System] shall [ログイン画面へ誘導する]。
6. If [購読開始 API が BAN（403）またはその他の失敗を返したとき], the [Quizeum System] shall [日本語のエラーメッセージを表示し、ユーザーが次に取るべき行動が分かるようにする]。
7. The [Quizeum System] shall [購読開始時にクライアント側で契約 tier や `isPremium` を自己申告せず、サーバー側の購読開始 API のみを信頼する]。

### 要件 3: 有料契約中ユーザーの契約管理
**目的:** Pro 契約中のユーザーとして、プラン変更・解約・請求履歴を自己管理したい。それにより契約を継続・変更・終了できる。

#### 受け入れ基準
1. When [認証済みかつ有効な Pro 契約（`subscriptionTier` が `pro` かつ契約が有効）のユーザーが `/pricing` を表示したとき], the [Quizeum System] shall [購読開始 CTA の代わりに契約中状態（例: 「Pro 契約中」バッジ）と契約管理 CTA を表示する]。
2. When [有料契約中ユーザーが契約管理 CTA を実行したとき], the [Quizeum System] shall [契約管理 API を呼び出し、返却された外部契約管理画面の URL へリダイレクトする]。
3. While [契約管理 API の呼び出しが進行中であるとき], the [Quizeum System] shall [契約管理ボタンを無効化し、処理中であることが分かるローディング表示を行う]。
4. If [契約管理 API が無料 tier（404）を返したとき], the [Quizeum System] shall [契約管理を開始せず、購読開始 CTA を表示する]。
5. If [契約管理 API が未認証（401）を返したとき], the [Quizeum System] shall [ログイン画面へ誘導する]。
6. If [契約管理 API がその他の失敗を返したとき], the [Quizeum System] shall [日本語のエラーメッセージを表示する]。

### 要件 4: Checkout 完了・キャンセル後の画面フィードバック
**目的:** 購読フロー完了後のユーザーとして、結果が成功かキャンセルかをすぐに理解したい。それにより次の行動（プレイ再開・再試行）を迷わず取れる。

#### 受け入れ基準
1. When [外部決済画面から `/pricing?checkout=success` へリダイレクトされたとき], the [Quizeum System] shall [購読完了を祝福する成功メッセージ（例: Pro プランへの加入完了）を画面内に表示する]。
2. When [外部決済画面から `/pricing?checkout=canceled` へリダイレクトされたとき], the [Quizeum System] shall [購読が完了しなかった旨の中立メッセージを表示し、再度購読開始できる CTA を維持する]。
3. When [Checkout 成功リダイレクト後にユーザーが `/pricing` を表示したとき], the [Quizeum System] shall [最新のユーザープロフィールを再取得し、契約状態の表示（要件 3）を可能な限り最新に反映する]。
4. If [Checkout 成功直後に Webhook 反映が未完了で契約状態がまだ無料 tier と表示されるとき], the [Quizeum System] shall [反映待ちである旨の短い案内を表示し、再読み込みまたはしばらく待つようユーザーに伝えてよい]。
5. The [Quizeum System] shall [成功・キャンセルフィードバック表示後、クエリパラメータをクリーンな URL に置き換え、同一メッセージの再表示を防いでもよい]。

### 要件 5: グローバルナビゲーションからの導線
**目的:** アプリ利用中のユーザーとして、いつでも料金プラン画面へ到達したい。それにより購読検討や契約管理を開始できる。

#### 受け入れ基準
1. The [Quizeum System] shall [ログイン状態に関わらず、グローバルナビゲーション（サイドバー等）から `/pricing` へ遷移できる導線を少なくとも 1 か所提供する]。
2. When [ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき], the [Quizeum System] shall [プレイ没入のためグローバルナビを非表示にする既存ルールを維持し、プレイ中の `/pricing` 導線は本要件の対象外とする（`quizeum-play-flow-ui` が制限到達時の誘導を担当）]。
3. While [現在のパスが `/pricing` であるとき], the [Quizeum System] shall [該当ナビ項目をアクティブ状態としてハイライト表示する（導線をサイドバーに追加した場合）]。

### 要件 6: 契約状態の視覚的表示
**目的:** 認証済みユーザーとして、自身が無料 tier か Pro 契約中かを料金画面で一目で把握したい。それにより適切な CTA（購読または管理）を選べる。

#### 受け入れ基準
1. When [認証済みユーザーが `/pricing` を表示したとき], the [Quizeum System] shall [認証コンテキスト上の `subscriptionTier`（未設定は `free`）に基づき、無料 tier または Pro 契約中のいずれかの状態表示を行う]。
2. While [ユーザーの契約 tier が `pro` かつ有効な有料契約である間], the [Quizeum System] shall [Pro 契約中であることを示すバッジまたは同等の視覚的インジケーターを表示する]。
3. The [Quizeum System] shall [契約状態の表示にクライアント側の手動設定やローカルストレージを用いず、サーバー同期済みプロフィール情報のみを根拠とする]。
4. Where [プロフィール画面への契約バッジ表示が追加される場合], the [Quizeum System] shall [`/pricing` と同一の tier 解釈規則を用いる（任意拡張、初版必須ではない）]。

### 要件 7: ローディング・エラー・障害時のユーザー体験
**目的:** 購読・契約管理操作を行うユーザーとして、通信失敗や権限エラー時にも何が起きたか理解したい。それにより再試行やサポート依頼を判断できる。

#### 受け入れ基準
1. If [購読開始または契約管理 API の呼び出しがネットワーク障害等で失敗したとき], the [Quizeum System] shall [汎用的な日本語エラーメッセージを表示し、ユーザーが再試行できる状態に戻す]。
2. If [認証トークンの取得に失敗したとき], the [Quizeum System] shall [購読・契約管理 API を呼び出さず、ログインを促す]。
3. The [Quizeum System] shall [API エラーレスポンスの技術的詳細（スタックトレース、内部エラーコードの羅列）をエンドユーザー向け画面に表示しない]。
4. While [料金プラン画面の主要データ（認証状態・契約状態）の読み込みが未完了であるとき], the [Quizeum System] shall [レイアウト崩れを抑えたローディングまたはスケルトン表示を行う]。

### 要件 8: デザイン・レスポンシブ・アクセシビリティ
**目的:** 全デバイスのユーザーとして、既存 quizeum のプレミアムな見た目と操作性で料金画面を利用したい。それにより信頼感のある購読体験が得られる。

#### 受け入れ基準
1. The [Quizeum System] shall [料金プラン画面を既存のネオンデザインシステム（カラー、タイポグラフィ、カード、ボタン）と視覚的に整合させる]。
2. The [Quizeum System] shall [Tailwind CSS を使用せず、Vanilla CSS または CSS Modules でスタイルを実装する]。
3. While [画面幅がモバイル・タブレット・デスクトップの各ブレークポイントであるとき], the [Quizeum System] shall [料金プラン画面の主要コンテンツが読みやすく操作可能なレイアウトを維持する]。
4. The [Quizeum System] shall [購読開始・契約管理の主要ボタンに、キーボード操作とスクリーンリーダーで識別可能なラベルを付与する]。

### 要件 9: 境界・隣接スペックとの整合
**目的:** プロダクトオーナーとして、課金 UI がコア・プレイ・認証各層の責務を侵害せず、エンドツーエンドで一貫した体験を提供したい。

#### 受け入れ基準
1. The [Quizeum System] shall [Webhook による契約状態同期、AI 質問制限のサーバー側判定、課金フィールドの改ざん防止を本要件の実装対象に含めない（`quizeum-core` が担当）]。
2. The [Quizeum System] shall [プレイ画面の残り質問数表示、AI 制限到達ダイアログ、プレイ中の `/pricing` 誘導リンクを本要件の実装対象に含めない（`quizeum-play-flow-ui` が担当）]。
3. The [Quizeum System] shall [初版 Pro 特典の説明をウミガメ AI 質問の日次20回制限解除に限定し、ロードマップ上の他特典を料金画面で約束しない]。
4. The [Quizeum System] shall [Premium tier の販売および Premium 固有特典の UI 表示を初版の実装対象に含めない]。
5. When [E2E テストが未契約ユーザーの購読開始フローを検証するとき], the [Quizeum System] shall [外部決済テストモードへ遷移する直前まで（購読開始 API 呼び出しとリダイレクト URL 取得）を自動検証可能とする]。
