# Implementation Plan: quizeum-creator-dash-ui

## Tasks

### 1. クイズ作成・編集画面のUI実装
- [ ] 1.1 クイズ基本メタデータ入力とタグ名寄せUIの実装 (P)
  - `src/app/quiz/create/page.tsx` および `create.module.css` を作成し、タイトル、難易度（1-10）、ジャンルセレクトボックスなどのメタデータ入力を実装する。
  - タグ入力時にリアルタイムで正規化（名寄せ）を行い、類似 canonical タグを検知した際に「推奨: 類似するタグ #React が既に存在します...」と親切なサジェスト警告をインライン表示するUIを構築する。
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: QuizEditor-Metadata_
- [ ] 1.2 動的設問エディタと下書き保存機能の実装
  - 設問の動的な追加・削除、設問タイプ（選択式 / 短答文字入力式）の切り替えUIを構築する。
  - Zodバリデーションに抵触しない状態での「下書き保存」による Firestore 保存機能を実装する。
  - _Requirements: 1.4, 1.6_
  - _Boundary: QuizEditor-Questions_
- [ ] 1.3 公開バリデーションとエラーインライン表示の実装
  - 「公開」申請時、Zodを用いて「各設問の入力」「正解が1つ以上設定されていること」を厳格に検証し、バリデーションエラーがある場合に画面上部にエラー一覧をスクロール表示する。
  - _Requirements: 1.5_
  - _Boundary: QuizEditor-Validation_

### 2. 作家ダッシュボードのUI実装
- [ ] 2.1 累計アナリティクスグラフおよび個別設問解答割合グラフの実装 (P)
  - `src/app/creator/dashboard/page.tsx` および `dashboard.module.css` に、プレイ数等の累計アナリティクス用ライングラフ・バーグラフを実装する。
  - クイズ個別詳細パネル内に、各設問の解答選択肢別割合を表示するパイチャート風CSSコンポーネントを構築する。
  - _Requirements: 2.1, 2.2_
  - _Boundary: CreatorDashboard-Charts_
- [ ] 2.2 クローズド間違い指摘のキュー管理と修正動線の実装
  - プレイヤーから送信された指摘レポートの一覧を表示し、「修正する」クリック時に該当クイズのエディタ画面に問題がプリロードされて遷移する動線を実装する。
  - _Requirements: 2.3, 2.4_
  - _Boundary: CreatorDashboard-Feedback_
- [ ] 2.3 クイズ一括エクスポート機能の実装
  - 自身が作成したすべてのクイズ（下書き・公開中）を1つの JSON ファイルとしてクライアントサイドで構築し、ブラウザ経由でダウンロードするダウンロード処理を実装する。※インポート用UIは配置しない。
  - _Requirements: 2.5_
  - _Boundary: CreatorDashboard-Export_

### 3. クイズリスト詳細画面のUI実装
- [ ] 3.1 クイズリスト基本情報と収録クイズ表示の実装 (P)
  - `src/app/list/[id]/page.tsx` および `list.module.css` を作成し、リストタイトル、作成者アバター、カバー画像、および収録クイズのカード一覧を表示する。
  - _Requirements: 3.1_
  - _Boundary: QuizListDetail_
- [ ] 3.2 リスト連続プレイおよび編集動線の実装
  - 「リストプレイ開始」クリック時に `attempts.listId` にリストIDを設定し、`mode = 'list'` として記録しながら順番にプレイを連続トラッキングするUI接続を実装する。
  - ログイン中の作成者本人である場合に「リストを編集する」ボタンを表示するガードを構築する。
  - _Requirements: 3.2, 3.3_
  - _Boundary: QuizListDetail-Actions_

### 4. リスト作成・編集画面のUI実装
- [ ] 4.1 リストメタデータフォームとクイズ検索アタッチUIの実装 (P)
  - `src/app/list/create/page.tsx` および `edit.module.css` を作成し、タイトル、説明、公開/非公開トグルなどのフォームを実装する。
  - 自作クイズやお気に入りから検索し、リストにアタッチ/デタッチするUIを構築する。
  - _Requirements: 4.1_
  - _Boundary: QuizListEditor_
- [ ] 4.2 HTML5 Drag and Dropによる並び替えとパッケージエクスポートの実装
  - アタッチしたクイズを HTML5 D&D API を用いてビジュアルに並べ替えるドラッグハンドルUIを実装する。
  - リスト情報および自作収録クイズをパッケージングした JSON のダウンロードエクスポート処理を実装する。※インポート用UIは設置しない。
  - _Requirements: 4.2, 4.3_
  - _Boundary: QuizListEditor-DragAndDrop_
