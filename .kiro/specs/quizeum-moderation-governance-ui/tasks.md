# Implementation Plan: quizeum-moderation-governance-ui

## Tasks

### 1. ロール・権限ルートガードの実装
- [ ] 1.1 ミドルウェアによるモデレーションルート保護の実装 (P)
  - `src/middleware.ts` を作成または更新し、`/admin/*` および `/community/*` へのアクセスを、ログインユーザーの `moderationTier` や管理者ロールに基づいて厳格に保護・リダイレクトする処理を実装する。
  - _Requirements: 1.1, 2.1_
  - _Boundary: RouteGuard_

### 2. 管理者モデレーション画面のUI実装
- [ ] 2.1 審査待ちモデレーションキューおよび通報詳細表示の実装 (P)
  - `src/app/admin/moderation/page.tsx` および `moderation.module.css` を作成し、通報数が5に達したコンテンツ（クイズ、リスト、プロフィール）の審査待ちキューリストを実装する。
  - 各コンテンツカード内に、通報理由（ハラスメント、スパム等）およびプレイヤーのコメント詳細を表示する。
  - _Requirements: 1.2, 1.3_
  - _Boundary: AdminModeration-Queue_
- [ ] 2.2 公開復帰・削除アクションおよび特別検証プレビューの実装
  - 「公開に復帰（通報却下）」または「永久非公開化 / 削除」アクションを実行するボタンを設置する。
  - 対象コンテンツ（特にクイズ）をクリックした際に、特別な審査用ヘッダーオーバーレイ付きの「特別検証閲覧ビュー」へ遷移・確認する動線を構築する。
  - _Requirements: 1.4, 1.5_
  - _Boundary: AdminModeration-Action_

### 3. タグ/ジャンルマージリクエスト画面のUI実装
- [ ] 3.1 マージ提案起案フォームおよび保留中マージ一覧表示の実装 (P)
  - `src/app/community/merge/page.tsx` および `merge.module.css` に、モデレータが起案する「提案起案」フォームを実装する。
  - 「投票一覧」タブを作成し、現在保留中のマージ提案を一覧カード表示する。
  - ソースタグ/ジャンルをクリックした際、別ウィンドウまたは分割ビューで該当一覧画面を開く確認遷移を実装する。
  - _Requirements: 2.2, 2.3, 2.4_
  - _Boundary: CommunityMerge_
- [ ] 3.2 モデレータ加重投票およびリアルタイムプログレスバーの実装
  - 保留提案カードに対し「賛成 👍」「反対 👎」を投票するUIを実装し、シニアモデレータの場合には「重み: x2」として計算・アトミック送信する処理を構築する。
  - `weightedVotesFor` と `weightedVotesAgainst` の数値を基に、賛成率（％）を算出して視覚的に伸び縮みするプログレスバーを表示する。
  - _Requirements: 2.5, 2.6, 2.7_
  - _Boundary: CommunityMerge-Vote_

### 4. ジャンル新設申請・投票画面のUI実装
- [ ] 4.1 新ジャンル申請フォームと画像アップロードの実装 (P)
  - `src/app/community/genres/page.tsx` および `genres.module.css` を作成し、認証ユーザーが新規ジャンル（英語ID、日本語名）を申請するフォームを実装する。
  - アイコン画像（PNG/SVG）を Firebase Storage にアタッチアップロードして登録する処理を構築する。
  - _Requirements: 3.1_
  - _Boundary: CommunityGenres-Request_
- [ ] 4.2 モデレータ投票および履歴閲覧タブの実装
  - 保留中ジャンル申請へのモデレータ投票UIを構築し、可決された際のシステム自動反映を通知するアラートメッセージを表示する。
  - 承認/否決が決定した過去の申請を表示する「履歴タブ」を構築する。
  - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - _Boundary: CommunityGenres-Vote_
