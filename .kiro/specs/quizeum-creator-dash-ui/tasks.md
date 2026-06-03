# Implementation Plan: quizeum-creator-dash-ui

## Tasks

### 1. クイズ作成・編集画面のUI実装
- [x] 1.1 クイズ基本メタデータ入力とタグ名寄せUIの実装 (P)
  - `src/app/quiz/create/page.tsx` および `create.module.css` を作成し、タイトル、難易度（1-10）、ジャンルセレクトボックスなどのメタデータ入力を実装する。
  - タグ入力時にリアルタイムで正規化（名寄せ）を行い、類似 canonical タグを検知した際に「推奨: 類似するタグ #React が既に存在します...」と親切なサジェスト警告をインライン表示するUIを構築する。
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: QuizEditor-Metadata_
- [x] 1.2 動的設問エディタと下書き保存機能の実装
  - 設問の動的な追加・削除、設問タイプ（選択式 / 短答文字入力式）の切り替えUIを構築する。
  - Zodバリデーションに抵触しない状態での「下書き保存」による Firestore 保存機能を実装する。
  - _Requirements: 1.4, 1.6_
  - _Boundary: QuizEditor-Questions_
- [x] 1.3 公開バリデーションとエラーインライン表示の実装
  - 「公開」申請時、Zodを用いて「各設問の入力」「正解が1つ以上設定されていること」を厳格に検証し、バリデーションエラーがある場合に画面上部にエラー一覧をスクロール表示する。
  - _Requirements: 1.5_
  - _Boundary: QuizEditor-Validation_

### 2. 作家ダッシュボードのUI実装
- [x] 2.1 累計アナリティクスグラフおよび個別設問解答割合グラフの実装 (P)
  - `src/app/creator/dashboard/page.tsx` および `dashboard.module.css` に、プレイ数等の累計アナリティクス用ライングラフ・バーグラフを実装する。
  - クイズ個別詳細パネル内に、各設問の解答選択肢別割合を表示するパイチャート風CSSコンポーネントを構築する。
  - _Requirements: 2.1, 2.2_
  - _Boundary: CreatorDashboard-Charts_
- [x] 2.2 クローズド間違い指摘のキュー管理と修正動線の実装
  - プレイヤーから送信された指摘レポートの一覧を表示し、「修正する」クリック時に該当クイズのエディタ画面に問題がプリロードされて遷移する動線を実装する。
  - _Requirements: 2.3, 2.4_
  - _Boundary: CreatorDashboard-Feedback_
- [x] 2.3 クイズ一括エクスポート機能の実装
  - 自身が作成したすべてのクイズ（下書き・公開中）を1つの JSON ファイルとしてクライアントサイドで構築し、ブラウザ経由でダウンロードするダウンロード処理を実装する。※インポート用UIは配置しない。
  - _Requirements: 2.5_
  - _Boundary: CreatorDashboard-Export_

### 3. クイズリスト詳細画面のUI実装
- [x] 3.1 クイズリスト基本情報と収録クイズ表示の実装 (P)
  - `src/app/list/[id]/page.tsx` および `list.module.css` を作成し、リストタイトル、作成者アバター、カバー画像、および収録クイズ of カード一覧を表示する。
  - _Requirements: 3.1_
  - _Boundary: QuizListDetail_
- [x] 3.2 リスト連続プレイおよび編集動線の実装
  - 「リストプレイ開始」クリック時に `attempts.listId` にリストIDを設定し、`mode = 'list'` として記録しながら順番にプレイを連続トラッキングするUI接続を実装する。
  - ログイン中の作成者本人である場合に「リストを編集する」ボタンを表示するガードを構築する。
  - _Requirements: 3.2, 3.3_
  - _Boundary: QuizListDetail-Actions_
 
### 4. リスト作成・編集画面のUI実装
- [x] 4.1 リストメタデータフォームとクイズ検索アタッチUIの実装 (P)
  - `src/app/list/create/page.tsx` および `edit.module.css` を作成し、タイトル、説明、公開/非公開トグルなどのフォームを実装する。
  - 自作クイズやお気に入りから検索し、リストにアタッチ/デタッチするUIを構築する。
  - _Requirements: 4.1_
  - _Boundary: QuizListEditor_
- [x] 4.2 HTML5 Drag and Dropによる並び替えとパッケージエクスポートの実装
  - アタッチしたクイズを HTML5 D&D API を用いてビジュアルに並べ替えるドラッグハンドルUIを実装する。
  - リスト情報および自作収録クイズをパッケージングした JSON のダウンロードエクスポート処理を実装する。※インポート用UIは設置しない。
  - _Requirements: 4.2, 4.3_
  - _Boundary: QuizListEditor-DragAndDrop_

---

### 5. Phase 6 拡張 — クイズエディタのジャンルマスタ連携（2026-06）

> **前提**: `quizeum-core` Phase 6 完了（`listActiveGenres`）。`useActiveGenres` は `quizeum-play-flow-ui` 実装済みフックを再利用可。

- [x] 5.1 (P) `GenreEditorSelect` コンポーネント
  - `useActiveGenres` で取得した `displayName` / `id` を `<select>` に描画する。
  - loading / error / 空一覧 / 再試行 UI を提供し、ハードコード option へフォールバックしない。
  - 制御値が active 一覧に無いときは orphan 用の追加 `<option>` を 1 件表示する（レガシー下書き対応）。
  - `data-testid="genre-editor-select"` を付与する。
  - **完了状態**: マスタ由来の option のみが正本であること。
  - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - _Boundary: GenreEditorSelect_
  - _Depends: quizeum-core Phase 6_

- [x] 5.2 `QuizEditor` への統合と承認後リフレッシュ
  - `quiz-editor.tsx` の固定 6 件 option を `GenreEditorSelect` に置換する。
  - `window` の `focus` イベントで `useActiveGenres().refetch()` を呼び、ジャンル新設可決後に選択肢が更新されること。
  - 「新しいジャンルを申請する」リンクを維持する。
  - **完了状態**: 作成・編集画面で新設ジャンルが refetch 後に選択可能であること。
  - _Requirements: 5.3, 5.4, 5.7, 1.2_
  - _Depends: 5.1_

- [x] 5.3 Phase 6 統合検証
  - `GenreEditorSelect` の RTL テスト（loading / options / orphan / error）。
  - 既存 Zod・公開フローの回帰がないこと（`npm test` / `npm run build`）。
  - **完了状態**: 関連 Jest がグリーンであること。
  - _Requirements: 5.1, 5.4, 5.6_
  - _Depends: 5.2_

- [ ]* 5.4 Phase 6 E2E スモーク（任意）
  - エディタでジャンル select が動的であること、申請画面リンクが有効であることを E2E または手動チェックリストで記録する。
  - _Depends: 5.3_
  - _Requirements: 5.1, 5.3_

## Implementation Notes

- Phase 6 は **読み取り専用**（`metadata_genres` 書き込みは governance / core）。
- `useActiveGenres` を `src/hooks/` に既に置いている場合は import 共有のみで新規フック不要。
- play-flow のホームジャンル ID とエディタの `genre` 保存値は同一キー（英小文字 doc ID）を用いる。
- Phase 6 実装（2026-06-03）: `GenreEditorSelect` + `useActiveGenres`、focus 時 refetch。Jest 300 件・build PASS。
