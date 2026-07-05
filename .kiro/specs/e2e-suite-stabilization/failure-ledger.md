# Failure Ledger - e2e-suite-stabilization

| id | specFile | testTitle | domain | category | rootCauseGroup | rootCauseSummary | sourceRefs | fixRef | regressionTestRef | flaky | status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| additional-features.spec.ts::F-105: 称号バッジ自動付与機能が正常に動作すること | additional-features.spec.ts | F-105: 称号バッジ自動付与機能が正常に動作すること | additional-features |  |  |  |  |  |  | false | open |
| additional-features.spec.ts::プロフィール編集画面: フォローしているジャンルが管理できること | additional-features.spec.ts | プロフィール編集画面: フォローしているジャンルが管理できること | additional-features |  |  |  |  |  |  | false | open |
| additional-features.spec.ts::複合テスト: 検索 → フィルタ → 詳細 → プレイ の完全フロー | additional-features.spec.ts | 複合テスト: 検索 → フィルタ → 詳細 → プレイ の完全フロー | additional-features |  |  |  |  |  |  | false | open |
| additional-features.spec.ts::複合テスト: クイズ作成 → 統計確認 → 修正 のフロー | additional-features.spec.ts | 複合テスト: クイズ作成 → 統計確認 → 修正 のフロー | additional-features |  |  |  |  |  |  | false | open |
| admin-portal.spec.ts::非管理者ユーザーでのアクセス制限確認 | admin-portal.spec.ts | 非管理者ユーザーでのアクセス制限確認 | admin-portal |  |  |  |  |  |  | false | open |
| admin-users.spec.ts::非管理者ユーザーでのアクセス制限確認 | admin-users.spec.ts | 非管理者ユーザーでのアクセス制限確認 | admin-users |  |  |  |  |  |  | false | open |
| ads.spec.ts::無料ユーザー：検索画面において10件のクイズカードごとに1件のインライン広告（PRバッジ付き）が表示されること | ads.spec.ts | 無料ユーザー：検索画面において10件のクイズカードごとに1件のインライン広告（PRバッジ付き）が表示されること | ads |  |  |  |  |  |  | false | open |
| ads.spec.ts::無料ユーザー：クイズ完了時に動画広告モーダルが1/3確率（強制フラグ使用）で表示され、5秒経過後にスキップして結果画面へ遷移できること | ads.spec.ts | 無料ユーザー：クイズ完了時に動画広告モーダルが1/3確率（強制フラグ使用）で表示され、5秒経過後にスキップして結果画面へ遷移できること | ads |  |  |  |  |  |  | false | open |
| ads.spec.ts::有料ユーザー（Proプラン）：クイズ完了時に動画広告モーダルが表示されず、直接結果画面へ遷移すること | ads.spec.ts | 有料ユーザー（Proプラン）：クイズ完了時に動画広告モーダルが表示されず、直接結果画面へ遷移すること | ads |  |  |  |  |  |  | true | open |
| ai-quiz-authoring.spec.ts::無料ユーザは Upsell が表示される | ai-quiz-authoring.spec.ts | 無料ユーザは Upsell が表示される | ai-quiz-authoring |  |  |  |  |  |  | false | open |
| ai-quiz-authoring.spec.ts::Pro fixture: パネル表示・API mock で問題 +10 | ai-quiz-authoring.spec.ts | Pro fixture: パネル表示・API mock で問題 +10 | ai-quiz-authoring |  |  |  |  |  |  | false | open |
| auth-profile.spec.ts::好きなジャンルの設定と表示の検証 (Phase 28) | auth-profile.spec.ts | 好きなジャンルの設定と表示の検証 (Phase 28) | auth-profile |  |  |  |  |  |  | false | open |
| auth-streaming-skeleton.spec.ts::つながり一覧で connections-skeleton が消えコンテンツが表示されること | auth-streaming-skeleton.spec.ts | つながり一覧で connections-skeleton が消えコンテンツが表示されること | auth-streaming-skeleton |  |  |  |  |  |  | true | open |
| creator-dashboard.spec.ts::F-901: クリエイターダッシュボードが正常に表示されること | creator-dashboard.spec.ts | F-901: クリエイターダッシュボードが正常に表示されること | creator-dashboard |  |  |  |  |  |  | true | open |
| creator-dashboard.spec.ts::複合テスト: ダッシュボード → クイズ作成 → 統計確認 の完全フロー | creator-dashboard.spec.ts | 複合テスト: ダッシュボード → クイズ作成 → 統計確認 の完全フロー | creator-dashboard |  |  |  |  |  |  | false | open |
| creator-streaming-skeleton.spec.ts::作家ダッシュボードで各スケルトンが消えコンテンツが表示されること | creator-streaming-skeleton.spec.ts | 作家ダッシュボードで各スケルトンが消えコンテンツが表示されること | creator-streaming-skeleton |  |  |  |  |  |  | false | open |
| creator-streaming-skeleton.spec.ts::クイズ作成画面で quiz-editor-skeleton が消えエディタが表示されること | creator-streaming-skeleton.spec.ts | クイズ作成画面で quiz-editor-skeleton が消えエディタが表示されること | creator-streaming-skeleton |  |  |  |  |  |  | true | open |
| genre-icons.spec.ts::コミュニティジャンル申請での手動アップロード & 申請 & 投票可決フロー | genre-icons.spec.ts | コミュニティジャンル申請での手動アップロード & 申請 & 投票可決フロー | genre-icons |  |  |  |  |  |  | false | open |
| home-sidebar.spec.ts::お問い合わせリンクをクリックして別タブでフォームが開くこと | home-sidebar.spec.ts | お問い合わせリンクをクリックして別タブでフォームが開くこと | home-sidebar |  |  |  |  |  |  | false | open |
| infinite-scroll.spec.ts::検索画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入 | infinite-scroll.spec.ts | 検索画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入 | infinite-scroll |  |  |  |  |  |  | false | open |
| infinite-scroll.spec.ts::プロフィール画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入 | infinite-scroll.spec.ts | プロフィール画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入 | infinite-scroll |  |  |  |  |  |  | false | open |
| layout.spec.ts::Phase 27: Admin menu is visible and active on /admin for Admin User | layout.spec.ts | Phase 27: Admin menu is visible and active on /admin for Admin User | layout |  |  |  |  |  |  | true | open |
| layout.spec.ts::Phase 27: Admin popup links are visible for Admin User | layout.spec.ts | Phase 27: Admin popup links are visible for Admin User | layout |  |  |  |  |  |  | true | open |
| layout.spec.ts::Phase 28: PC sidebar collapse toggle, avatar popup, and profile nav link | layout.spec.ts | Phase 28: PC sidebar collapse toggle, avatar popup, and profile nav link | layout |  |  |  |  |  |  | true | open |
| leaderboard.spec.ts::F-802: クイズプレイ後にハイスコアが記録されること | leaderboard.spec.ts | F-802: クイズプレイ後にハイスコアが記録されること | leaderboard |  |  |  |  |  |  | false | open |
| leaderboard.spec.ts::クイズ詳細画面: 初回プレイランキングが表示されること | leaderboard.spec.ts | クイズ詳細画面: 初回プレイランキングが表示されること | leaderboard |  |  |  |  |  |  | false | open |
| leaderboard.spec.ts::クイズ詳細画面: リプレイランキングが表示されること | leaderboard.spec.ts | クイズ詳細画面: リプレイランキングが表示されること | leaderboard |  |  |  |  |  |  | false | open |
| leaderboard.spec.ts::F-803: 短答式問題が正常に機能すること | leaderboard.spec.ts | F-803: 短答式問題が正常に機能すること | leaderboard |  |  |  |  |  |  | false | open |
| leaderboard.spec.ts::F-804: 画像アタッチ（問題画像）が正常に機能すること | leaderboard.spec.ts | F-804: 画像アタッチ（問題画像）が正常に機能すること | leaderboard |  |  |  |  |  |  | false | open |
| leaderboard.spec.ts::複合テスト: プレイ → ハイスコア記録 → ランキング確認 の完全フロー | leaderboard.spec.ts | 複合テスト: プレイ → ハイスコア記録 → ランキング確認 の完全フロー | leaderboard |  |  |  |  |  |  | true | open |
| learning-support.spec.ts::クイズ詳細画面でプレイモード選択UIが正しく表示されること（通常・模擬試験・フラッシュカード） | learning-support.spec.ts | クイズ詳細画面でプレイモード選択UIが正しく表示されること（通常・模擬試験・フラッシュカード） | learning-support |  |  |  |  |  |  | true | open |
| learning-support.spec.ts::フラッシュカードモードで「答えを見る」ボタンが機能すること | learning-support.spec.ts | フラッシュカードモードで「答えを見る」ボタンが機能すること | learning-support |  |  |  |  |  |  | true | open |
| learning-support.spec.ts::プロフィール画面で弱点克服セクション（間違い問題の復習）へのリンクが確認できること | learning-support.spec.ts | プロフィール画面で弱点克服セクション（間違い問題の復習）へのリンクが確認できること | learning-support |  |  |  |  |  |  | false | open |
| moderation-feedback.spec.ts::NGワードを含むクイズタイトルの保存がブロックされること | moderation-feedback.spec.ts | NGワードを含むクイズタイトルの保存がブロックされること | moderation-feedback |  |  |  |  |  |  | false | open |
| moderation-feedback.spec.ts::クイズ結果画面から指摘レポートを送信できること | moderation-feedback.spec.ts | クイズ結果画面から指摘レポートを送信できること | moderation-feedback |  |  |  |  |  |  | false | open |
| moderation-feedback.spec.ts::ジャンル新設申請機能のアクセス制限とUI非表示の確認（一般：非表示・404、管理者：表示） | moderation-feedback.spec.ts | ジャンル新設申請機能のアクセス制限とUI非表示の確認（一般：非表示・404、管理者：表示） | moderation-feedback |  |  |  |  |  |  | false | open |
| moderation-feedback.spec.ts::管理者モデレーション画面にアクセスできること (管理者権限を持つユーザーのみ) | moderation-feedback.spec.ts | 管理者モデレーション画面にアクセスできること (管理者権限を持つユーザーのみ) | moderation-feedback |  |  |  |  |  |  | false | open |
| my-quiz.spec.ts::ログイン後にカスタムクイズページが表示される | my-quiz.spec.ts | ログイン後にカスタムクイズページが表示される | my-quiz |  |  |  |  |  |  | false | open |
| quiz-cover-upload.spec.ts::ユーザーはローカル画像を選択し、1.91:1 (OGP規格) でトリミングしてカバー画像として設定できること | quiz-cover-upload.spec.ts | ユーザーはローカル画像を選択し、1.91:1 (OGP規格) でトリミングしてカバー画像として設定できること | quiz-cover-upload |  |  |  |  |  |  | false | open |
| quiz-cover-upload.spec.ts::ユーザーが容量10MB以上の画像を選択した場合にバリデーションエラーが表示されること | quiz-cover-upload.spec.ts | ユーザーが容量10MB以上の画像を選択した場合にバリデーションエラーが表示されること | quiz-cover-upload |  |  |  |  |  |  | false | open |
| quiz-creation.spec.ts::ユーザーはクイズの新規作成、問題エディタでの問題設定、下書き保存、および公開申請を行えること | quiz-creation.spec.ts | ユーザーはクイズの新規作成、問題エディタでの問題設定、下書き保存、および公開申請を行えること | quiz-creation |  |  |  |  |  |  | false | open |
| quiz-editor-feedback.spec.ts::編集画面に指摘内容が正しく表示され、解決・却下・モーダル連携が行えること | quiz-editor-feedback.spec.ts | 編集画面に指摘内容が正しく表示され、解決・却下・モーダル連携が行えること | quiz-editor-feedback |  |  |  |  |  |  | false | open |
| quiz-play.spec.ts::ユーザーは公開されたクイズを検索・プレイし、全問正解後に結果画面で良問評価、難易度投票、感謝リアクションを行えること | quiz-play.spec.ts | ユーザーは公開されたクイズを検索・プレイし、全問正解後に結果画面で良問評価、難易度投票、感謝リアクションを行えること | quiz-play |  |  |  |  |  |  | false | open |
| quiz-search.spec.ts::クイックサーチチップでタグチップが追加されカードに ★ 難易度が表示されること | quiz-search.spec.ts | クイックサーチチップでタグチップが追加されカードに ★ 難易度が表示されること | quiz-search |  |  |  |  |  |  | false | open |
| quiz-search.spec.ts::フォローしたユーザーのタイムラインがログイン後に表示できること | quiz-search.spec.ts | フォローしたユーザーのタイムラインがログイン後に表示できること | quiz-search |  |  |  |  |  |  | false | open |
| quiz-search.spec.ts::スクロール末端で追加読み込みが発火し sticky 検索バーが表示されること | quiz-search.spec.ts | スクロール末端で追加読み込みが発火し sticky 検索バーが表示されること | quiz-search |  |  |  |  |  |  | false | open |
| seo-sharing.spec.ts::動的SEOメタデータ: クイズタイトルがページタイトルに反映されていること | seo-sharing.spec.ts | 動的SEOメタデータ: クイズタイトルがページタイトルに反映されていること | seo-sharing |  |  |  |  |  |  | true | open |
| seo-sharing.spec.ts::複合テスト: クイズ作成 → OGPメタデータ検証 → SNS共有確認 の完全フロー | seo-sharing.spec.ts | 複合テスト: クイズ作成 → OGPメタデータ検証 → SNS共有確認 の完全フロー | seo-sharing |  |  |  |  |  |  | false | open |
| social-features.spec.ts::F-403-2: トップページ一覧からクイズを直接ブックマークでき、星アイコンのカラーが即時反映されること | social-features.spec.ts | F-403-2: トップページ一覧からクイズを直接ブックマークでき、星アイコンのカラーが即時反映されること | social-features |  |  |  |  |  |  | false | open |
| social-features.spec.ts::F-404: 通知機能が正常に動作すること | social-features.spec.ts | F-404: 通知機能が正常に動作すること | social-features |  |  |  |  |  |  | false | open |
| social-features.spec.ts::F-405: 作家リアクション（いいね・感謝）機能が正常に動作すること | social-features.spec.ts | F-405: 作家リアクション（いいね・感謝）機能が正常に動作すること | social-features |  |  |  |  |  |  | false | open |
| social-features.spec.ts::複合テスト: フォロー → プレイ → リアクション の完全フロー | social-features.spec.ts | 複合テスト: フォロー → プレイ → リアクション の完全フロー | social-features |  |  |  |  |  |  | false | open |
| streaming-skeleton.spec.ts::クイズ結果画面で結果スケルトンが消えエラーまたはサマリーが表示されること | streaming-skeleton.spec.ts | クイズ結果画面で結果スケルトンが消えエラーまたはサマリーが表示されること | streaming-skeleton |  |  |  |  |  |  | true | open |
| streaming-skeleton.spec.ts::弱点克服画面で review-skeleton が消えジャンル選択が表示されること | streaming-skeleton.spec.ts | 弱点克服画面で review-skeleton が消えジャンル選択が表示されること | streaming-skeleton |  |  |  |  |  |  | false | open |
| streaming-skeleton.spec.ts::ブックマーク画面で bookmarks-skeleton が消え3タブが表示されること | streaming-skeleton.spec.ts | ブックマーク画面で bookmarks-skeleton が消え3タブが表示されること | streaming-skeleton |  |  |  |  |  |  | false | open |
| streaming-skeleton.spec.ts::未認証時に /bookmarks および /notifications へのアクセスがログインへリダイレクトされること | streaming-skeleton.spec.ts | 未認証時に /bookmarks および /notifications へのアクセスがログインへリダイレクトされること | streaming-skeleton |  |  |  |  |  |  | false | open |
