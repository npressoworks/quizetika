# Implementation Plan: quizetika-creator-dash-ui

## Tasks

### 1. クイズ作成・編集画面のUI実装
- [x] 1.1 クイズ基本メタデータ入力とタグ名寄せUIの実装 (P)
  - `src/app/quiz/create/page.tsx` および `create.module.css` を作成し、タイトル、難易度（1-10）、ジャンルセレクトボックスなどのメタデータ入力を実装する。
  - タグ入力時にリアルタイムで正規化（名寄せ）を行い、類似 canonical タグを検知した際に「推奨: 類似するタグ #React が既に存在します...」と親切なサジェスト警告をインライン表示するUIを構築する。
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: QuizEditor-Metadata_
- [x] 1.2 動的問題エディタと下書き保存機能の実装
  - 問題の動的な追加・削除、問題タイプ（選択式 / 短答文字入力式）の切り替えUIを構築する。
  - Zodバリデーションに抵触しない状態での「下書き保存」による Firestore 保存機能を実装する。
  - _Requirements: 1.4, 1.6_
  - _Boundary: QuizEditor-Questions_
- [x] 1.3 公開バリデーションとエラーインライン表示の実装
  - 「公開」申請時、Zodを用いて「各問題の入力」「正解が1つ以上設定されていること」を厳格に検証し、バリデーションエラーがある場合に画面上部にエラー一覧をスクロール表示する。
  - _Requirements: 1.5_
  - _Boundary: QuizEditor-Validation_

### 2. 作家ダッシュボードのUI実装
- [x] 2.1 累計アナリティクスグラフおよび個別問題解答割合グラフの実装 (P)
  - `src/app/creator/dashboard/page.tsx` および `dashboard.module.css` に、プレイ数等の累計アナリティクス用ライングラフ・バーグラフを実装する。
  - クイズ個別詳細パネル内に、各問題の解答選択肢別割合を表示するパイチャート風CSSコンポーネントを構築する。
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

> **前提**: `quizetika-core` Phase 6 完了（`listActiveGenres`）。`useActiveGenres` は `quizetika-play-flow-ui` 実装済みフックを再利用可。

- [x] 5.1 (P) `GenreEditorSelect` コンポーネント
  - `useActiveGenres` で取得した `displayName` / `id` を `<select>` に描画する。
  - loading / error / 空一覧 / 再試行 UI を提供し、ハードコード option へフォールバックしない。
  - 制御値が active 一覧に無いときは orphan 用の追加 `<option>` を 1 件表示する（レガシー下書き対応）。
  - `data-testid="genre-editor-select"` を付与する。
  - **完了状態**: マスタ由来の option のみが正本であること。
  - _Requirements: 5.1, 5.2, 5.5, 5.6_
  - _Boundary: GenreEditorSelect_
  - _Depends: quizetika-core Phase 6_

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

---

### 6. Phase 8 拡張 — 問題リスト編集と参照リンク作問 UI（2026-06）

> **前提**: `quizetika-core` Phase 8 完了（`createQuizList` + `listType`, `addQuestionToList`, `exportQuestionList`, `searchAuthorQuizzes`, 参照リンク `saveQuiz`）。`quizetika-play-flow-ui` Phase 8 でリスト詳細の `listType` 表示・問題リストプレイは実装済み。

- [x] 6.1 (P) `question-attach-search` 純関数ライブラリ
  - 3ソース由来の `QuestionAttachCandidate` をマージし、`questionId` 重複を除去する。
  - `questionText` / 親タイトルに対するキーワード部分一致フィルタを提供する。
  - Jest で重複除去・キーワードフィルタ・空キーワード時の全件通過を検証する。
  - **完了状態**: 単体テストがグリーンであり、フックから import 可能であること。
  - _Requirements: 6.4_
  - _Boundary: question-attach-search_
  - _Depends: quizetika-core Phase 8_

- [x] 6.2 (P) `useQuestionAttachSearch` フック
  - タブ `own-published` / `bookmarked` / `public-explore` ごとに候補を非同期取得する。
  - `own-published`: `searchAuthorQuizzes` → 公開のみ → `getQuestionsByQuiz`。
  - `bookmarked`: `getBookmarkedQuestions`。
  - `public-explore`: `getLatestQuizzes(N)` → 問題フラット化 → 他者・公開のみ（設計どおり `searchQuizzes` は補助のみ）。
  - キーワード変更を 300ms デバウンス後に `question-attach-search` でフィルタする。
  - **完了状態**: タブ切替とキーワード入力で候補リストが更新されること（モックテスト可）。
  - _Requirements: 6.4_
  - _Depends: 6.1_
  - _Boundary: useQuestionAttachSearch_

- [x] 6.3 (P) `ListTypeSelector` コンポーネント
  - 新規リスト作成時に `quiz` / `question` をラジオ選択する。編集モードでは読み取り専用表示。
  - `data-testid`（`list-type-selector`, `list-type-quiz`, `list-type-question`）を付与する。
  - RTL でタブ切替（選択通知）と disabled 状態を検証する。
  - **完了状態**: 新規作成画面で2種類が選択でき、編集画面では変更不可表示になること。
  - _Requirements: 6.1, 6.2_
  - _Boundary: ListTypeSelector_

- [x] 6.4 `QuizListEditor` の listType 分岐と初回保存フロー
  - 新規作成時 `ListTypeSelector` を統合し、保存時に `createQuizList({ listType, questionIds: [] })` を送信する（問題リストは空で作成）。
  - 編集時は `resolveListType` を表示のみとし、`listType` 変更 UI を出さない。
  - `listType === 'question'` のときクイズアタッチパネルを非表示にし、`listId` 未取得時は `QuestionListAttachPanel` を disabled + 案内文を表示する。
  - `listType === 'quiz'` は従来のクイズアタッチ・並び替え・`exportQuizList` を維持する（6.10）。
  - **完了状態**: 問題リストを新規作成すると `listType: 'question'` で保存され、初回保存後に問題パネルが有効になること。
  - _Requirements: 4.1, 4.2, 4.3, 6.1, 6.2, 6.3, 6.10, 3.5_
  - _Depends: 6.3_
  - _Boundary: QuizListEditor_

- [x] 6.5 (P) `QuestionListAttachPanel`（検索・アタッチ・解除）
  - 3タブ検索 UI と `useQuestionAttachSearch` を接続し、候補から `addQuestionToList` を呼び出す。
  - アタッチ一覧に問題文抜粋・親クイズタイトルを表示する。`removeQuestionFromList` で楽観的または再取得で UI 更新する。
  - 非公開親などコア検証エラー時はインラインエラーを表示し一覧を変更しない（6.6）。
  - 公開探索タブに「直近公開クイズの問題から検索（全件保証なし）」注記を表示する。
  - **完了状態**: 問題リスト編集で3タブから問題を追加・削除できること。
  - _Requirements: 6.4, 6.5, 6.6, 6.7_
  - _Depends: 6.2, 6.4_
  - _Boundary: QuestionListAttachPanel_

- [x] 6.6 問題リストの DnD 並び替えとエクスポート
  - アタッチ済み問題行に HTML5 DnD ハンドルを追加し、完了時に `reorderQuestionList` を呼び出す（既存クイズリスト DnD パターンを踏襲）。
  - 問題リスト保存済みの場合、エクスポートボタンで `exportQuestionList` を呼び出し JSON をダウンロードする。
  - **完了状態**: DnD 後に再読み込みでも順序が保持され、エクスポート JSON にリストメタと問題参照が含まれること。
  - _Requirements: 6.8, 6.9_
  - _Depends: 6.5_
  - _Boundary: QuestionListAttachPanel, QuizListEditor_

- [x] 6.7 (P) 参照リンク作問パネル群
  - `ReferenceQuestionBadge` で「参照リンク」バッジを表示する。
  - `useAuthorQuizReferenceSearch` が `searchAuthorQuizzes` にキーワード・タグを渡す。
  - `AuthorQuizReferencePanel`（折りたたみ）でクイズ展開 → 問題選択 → `onLinkQuestion` を発火（自作のみ、7.5）。
  - **完了状態**: パネルから問題をリンク選択するとコールバックが `linkKind: 'reference'` 付き問題を返すこと。
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - _Depends: quizetika-core Phase 8_
  - _Boundary: AuthorQuizReferencePanel, ReferenceQuestionBadge, useAuthorQuizReferenceSearch_

- [x] 6.8 `QuizEditor` 参照リンク統合と CoW 状態機械
  - `AuthorQuizReferencePanel` を統合し、参照問題を `reference-readonly`（デフォルト readOnly + 削除のみ）で表示する。
  - 「内容を編集（コピーに切り離し）」で `reference-detaching` に遷移し 7.7 通知を表示後、編集可能にする。
  - 保存時 `saveQuiz` に `linkKind` と元 `id` を送信する。Zod 公開検証は `reference-readonly` 行をスキップする。
  - 参照解除はローカル配列からの除去のみ（7.8, 7.10）。
  - **完了状態**: 参照問題がバッジ付きで readOnly 表示され、編集切り離し後に保存できること。永続化ロジックは UI に追加されていないこと。
  - _Requirements: 7.6, 7.7, 7.8, 7.9, 7.10_
  - _Depends: 6.7_
  - _Boundary: QuizEditor_

- [x] 6.9 Phase 8 統合検証
  - 問題リスト作成（listType 選択→初回保存→アタッチ→DnD→エクスポート）、参照リンク追加・CoW 通知、クイズリスト回帰を Jest / コンポーネントテストで検証する。
  - `npm test` / `npm run build` がグリーンであること。
  - **完了状態**: Phase 8 関連テストがグリーンであり、手動スモークで問題リスト編集と参照リンク保存が成功すること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_
  - _Depends: 6.4, 6.6, 6.8_

- [ ]* 6.10 Phase 8 E2E スモーク（任意）
  - `[data-testid="list-type-question"]` で問題リスト作成、参照パネルからリンク追加を Playwright またはチェックリストで記録する。
  - _Depends: 6.9_
  - _Requirements: 6.1, 7.1_

---

### 7. Phase 12 拡張 — 作問エディタ UX 改善（2026-06）

> **前提**: Phase 8 参照パネル・`searchAuthorQuizzes` パイプラインは実装済み。本フェーズは問題文・正解テキスト照合拡張、テキストエリア自動伸長、リンク成功フィードバックを追加する。

- [x] 7.1 (P) 問題検索テキスト抽出ライブラリ
  - 問題タイプごとにキーワード照合対象の正解テキスト（正解選択肢文、正解候補、並び替え要素文、必須正解キーワード）を抽出する純関数を実装する。
  - 問題文および正解テキストに対する部分一致判定関数を提供する。ウミガメのスープの裏設定（`aiContextDetails`）は検索対象に含めない。
  - 各問題タイプの抽出ルールと一致・不一致判定を Jest で検証する。
  - **完了状態**: 単体テストがグリーンであり、`author-quiz-search` から import 可能であること。
  - _Requirements: 7.11_
  - _Boundary: question-search-text_

- [x] 7.2 過去自作クイズ検索の問題文・正解テキスト照合拡張
  - キーワード指定時に自作クイズ全件の問題を並列取得し、クイズメタ（タイトル・説明）またはいずれかの問題が一致すれば検索結果に含めるフィルタを実装する。
  - キーワード未指定時は従来どおりタイトル・説明・タグのみでフィルタする。個別クイズの問題取得失敗時はメタ照合のみで継続する。
  - タイトル不一致・問題文一致でヒットするケース、双方不一致で除外されるケースを Jest で検証する。
  - **完了状態**: 問題文または正解テキストのみで過去クイズが検索結果に現れること。
  - _Requirements: 7.11_
  - _Depends: 7.1_
  - _Boundary: author-quiz-search_

- [x] 7.3 (P) 自動伸長テキストエリアコンポーネント
  - 入力内容の行数に応じて表示高さを自動同期する制御コンポーネントを実装する。初回マウント時および既存下書きロード時にも高さを同期する。
  - 手動リサイズ（`resize: vertical`）を許可し、最小行数から算出した最小高さを維持する。
  - jsdom 環境で複数行 `value` 設定時に高さ同期が動作することをコンポーネントテストで検証する。
  - **完了状態**: コンポーネントが `value` / `onChange` / `className` / `minRows` を受け取り、テストがグリーンであること。
  - _Requirements: 8.1, 8.2, 8.3, 8.5_
  - _Boundary: AutoGrowTextarea_

- [x] 7.4 クイズエディタへの自動伸長テキストエリア適用
  - 説明文、各問題の問題文、ウミガメのスープ問題の真相入力、各問題の解説文の4テキストエリアを自動伸長コンポーネントに置換する。
  - タイトル・タグ・必須正解キーワード等の単一行フィールドは対象外とする。固定 `minHeight` のインライン指定を除去する。
  - **完了状態**: 4フィールドすべてで複数行入力時に高さが自動拡張し、既存下書きを開いた際も初回表示で内容に見合った高さになること。
  - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - _Depends: 7.3_
  - _Boundary: QuizEditor_

- [x] 7.5 (P) 参照リンクパネルの検索表示とリンク成功フィードバック
  - キーワード入力欄のプレースホルダーまたは説明文を、タイトル・説明・問題文・正解テキストが検索対象である旨に更新する。
  - リンク操作成功時に `role="status"` の成功メッセージを表示し、3秒後に自動消去する。問題文抜粋を含める。
  - 既にリンク済みの問題はボタン無効化とハンドラ先頭ガードで重複リンクを防止する（既存動作の維持確認）。
  - リンククリック後に成功メッセージが表示されること、プレースホルダー文言が更新されていることをコンポーネントテストで検証する。
  - **完了状態**: `[data-testid="reference-link-success"]` がリンク成功時に表示され、重複リンクが防止されること。
  - _Requirements: 7.12, 7.13, 7.14_
  - _Boundary: AuthorQuizReferencePanel_

- [x] 7.6 Phase 12 統合検証
  - 問題文・正解テキスト検索、自動伸長4フィールド、リンク成功メッセージの関連 Jest がすべてグリーンであること。
  - `npm test` / `npm run build` がグリーンであること。Phase 8 参照リンク・問題リストの回帰がないこと。
  - **完了状態**: Phase 12 関連テストがグリーンであり、手動スモークで過去クイズ検索・自動伸長・リンク通知が動作すること。
  - _Requirements: 7.11, 7.12, 7.13, 7.14, 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Depends: 7.2, 7.4, 7.5_

- [x] 7.7 Phase 12 E2E スモーク（任意）
  - 作問エディタで過去クイズを問題文で検索しリンク追加、テキストエリアの自動伸長、リンク成功メッセージを Playwright またはチェックリストで記録する。
  - _Depends: 7.6_
  - _Requirements: 7.11, 7.13, 8.2_

---

### 8. Phase 13 拡張 — 難易度5段階化 (2026-06)

- [x] 8.1 作問エディタの難易度入力 UI の更新
  - クイズ作成・編集画面のエディタ（`quiz-editor.tsx` 等）における難易度スライダー入力の `min`, `max`, `step` を 1〜5 に制限する。
  - スライダーやフォーム内の難易度表示が 1〜5 に最適化され、正しく表示されるようにする。
  - **完了状態**: エディタで難易度が 1〜5 の範囲でのみ選択可能であり、保存した際に 1〜5 の整数値として送信されること。
  - _Requirements: 1.1_
  - _Boundary: QuizEditor_

- [x] 8.2 エディタテストコードの修正
  - 作問エディタおよび作家ダッシュボードに関連するテストにおいて、難易度が 6 以上の入力や期待値になっている箇所を 1〜5 の範囲に修正する。
  - **完了状態**: ダッシュボードおよびエディタ関連の Jest テストがすべて正常にパスすること。
  - _Requirements: 1.1_
  - _Boundary: Testing_

- [x] 8.3 Phase 13 作家 UI 統合検証
  - 作問エディタで難易度 1〜5 を設定して下書き保存および公開保存ができ、作家ダッシュボードでも正しく動作することを確認する。
  - **完了状態**: クリエイターダッシュボード関連テストスイートが正常に動作すること。
  - _Depends: 8.1, 8.2_

## Implementation Notes

- Phase 6 は **読み取り専用**（`metadata_genres` 書き込みは governance / core）。
- `useActiveGenres` を `src/hooks/` に既に置いている場合は import 共有のみで新規フック不要。
- play-flow のホームジャンル ID とエディタの `genre` 保存値は同一キー（英小文字 doc ID）を用いる。
- Phase 6 実装（2026-06-03）: `GenreEditorSelect` + `useActiveGenres`、focus 時 refetch。Jest 300 件・build PASS。
- **Phase 8**: 問題リストは **初回保存で `listId` 取得後** にアタッチ可能。公開探索は `getLatestQuizzes` ベース + 問題文フィルタ。参照問題は readOnly デフォルト + 明示的切り離しで CoW（7.7）。リスト詳細表示は play-flow 実装を信頼（3.1–3.4 は 6.9 で回帰確認）。
- Phase 8 実装（2026-06-05）: `ListTypeSelector` / `QuestionListAttachPanel` / 参照パネル群、`QuizListEditor` listType 分岐、問題リスト作成後 `/edit` 遷移。Jest 366 件・build PASS。
- **Phase 12**: 問題照合は `question-search-text.ts` + `filterAuthorQuizzesWithQuestions`。キーワード時のみ全自作クイズの問題を並列取得。`AutoGrowTextarea` は説明・問題文・真相・解説の4フィールドのみ。`aiContextDetails` は検索対象外（`truthKeywords` のみ）。
- Phase 12 実装（2026-06-06）: `question-search-text` / `filterAuthorQuizzesWithQuestions` / `AutoGrowTextarea` / 参照パネル成功メッセージ。Jest 518 件・build PASS。
- **Phase 9 (Streaming)**: ダッシュボードは Server 静的ヘッダー + `CreatorDashboardClient`（認証付きクライアント取得 + 4 種スケルトン）。クイズ／リストエディタは RSC Loader + `EditorFormSkeleton` / `ListEditorSkeleton`。middleware で `/quiz/[id]/edit` を 307 保護。Jest 554 件・`e2e/creator-streaming-skeleton.spec.ts` 5 件 PASS。

### 9. Phase 12 拡張 — クリエイター管理画面の非同期表示最適化（Streaming & Suspense）のUI実装（2026-06-07）

- [x] 9.1 作家ダッシュボードの Server Component 化と Suspense 導入 (P)
  - `src/app/creator/dashboard/page.tsx` を Server Component に移行し、ヘッダー, サイドバー, アクションメニュー等をサーバー側で即時描画・配信する。
  - アナリティクス統計カード, 自作クイズ一覧, 指摘キュー, アナリティクスグラフの領域を個別の `<Suspense fallback={<Skeleton />}>` に分離。
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_
  - _Boundary: CreatorDashboard_
- [x] 9.2 クイズ作成・編集画面の Server Component 化と Suspense 導入 (P)
  - `src/app/quiz/create/page.tsx` および `src/app/quiz/[id]/edit/page.tsx` を Server Component に移行し、入力フォームの静的外枠（保存アクションエリア等）を即時描画・配信する。
  - 編集対象のクイズデータ, ジャンルマスタ, タグリスト等の非同期ロード領域を `<Suspense fallback={<EditorFormSkeleton data-testid="quiz-editor-skeleton" />}>` でラッピングして非同期描画する。
  - _Requirements: 10.12, 10.13, 10.14_
  - _Boundary: QuizEditor_
- [x] 9.3 リスト詳細・編集画面の非同期最適化 (P)
  - リスト作成・編集画面（`/list/create`, `/list/[id]/edit`）を Server Component に移行し、戻るボタンやコンテナ枠を即時表示する。
  - アタッチ対象のロード領域等を `<Suspense fallback={<ListEditorSkeleton data-testid="list-editor-skeleton" />}>` でラッピングして非同期描画する。
  - _Requirements: 10.15, 10.16_
  - _Boundary: QuizListEditor_
- [x] 9.4 認証必須画面における Middleware サーバーサイド認証保護の実装
  - 作家ダッシュボード（`/creator/dashboard`）やクイズ編集画面（`/quiz/[id]/edit`）について、未ログインアクセス時にクライアント側リダイレクトによる白紙表示を防ぐため、`src/middleware.ts` を作成（または更新）し、サーバーサイドで即時リダイレクト（`307`）制御する。
  - _Requirements: 10.1, 10.12_
  - _Boundary: NextMiddleware_
- [x] 9.5 非同期最適化の結合テスト・E2E テストの作成・更新
  - 各ダッシュボード・エディタ関連のテストにおいて、非同期ロード中のスケルトン `data-testid`（`stats-skeleton`, `quiz-list-skeleton`, `feedback-list-skeleton`, `charts-skeleton`）を検証し、ロード後に実データが表示されるシーケンスをテストする。
  - _Requirements: 10.10, 10.11_
  - _Boundary: Testing_

---

### 10. Phase 20: 〇×問題の作問 UI（2026-06-09）

- [x] 10.1 正解トグルコンポーネントの実装
  - 「〇が正解」「✕が正解」を切り替える専用トグル UI を実装し、`data-testid="true-false-correct-toggle"` を付与する
  - トグル変更時にコア lib の固定選択肢生成関数を呼び出し、内部 `choices` を2件・正解1件に更新する
  - **完了状態**: トグル操作で `choices` が「〇」「✕」2件かつ正解が1件に更新されること
  - _Requirements: 11.6, 11.7, 11.8, 11.14_
  - _Depends: quizetika-core 19.1_
  - _Boundary: TrueFalseCorrectToggle_

- [x] 10.2 出題形式カードと複合形式トグルの拡張
  - クイズ全体の出題形式選択に「〇×式」を追加し、選択時は全問題を `true-false` に固定して問題タイプ切り替え UI を非表示にする
  - 複合形式の問題タイプトグルに「〇×」を追加し、`data-testid="question-type-true-false"` を付与する
  - **完了状態**: 〇×式形式選択と複合トグルから `true-false` 問題を作成・切り替えできること
  - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.14_
  - _Depends: 10.1, quizetika-core 19.2_
  - _Boundary: QuizEditor_

- [x] 10.3 形式変換とデフォルト問題追加の整合
  - 他形式から「〇×式」への一括変換時に確認ダイアログを表示し、同意後に各問題へ固定選択肢とデフォルト正解を設定する
  - 新規問題追加・形式変更時に `true-false` 向け初期データ（正解トグル既定値）を適用する
  - 複合形式へ戻した際、既存 `true-false` 問題は維持する
  - **完了状態**: 形式変換・問題追加後も公開検証（2択・正解1件）を満たすエディタ状態になること
  - _Requirements: 11.3, 11.9, 11.10, 11.11_
  - _Depends: 10.2_
  - _Boundary: QuizEditor_

- [x] 10.4 (P) Phase 20 コンポーネントテスト
  - 正解トグル・形式カード・複合トグルのレンダリングと `choices` 更新を検証する
  - 選択肢テキストの自由編集入力欄が `true-false` 問題に表示されないことを検証する
  - **完了状態**: 関連 Jest がグリーンであること
  - _Requirements: 11.7, 11.8, 11.14_
  - _Depends: 10.3_
  - _Boundary: Testing_

- [x] 10.5 Phase 20 統合検証
  - 〇×式クイズの下書き保存がコア検証を通過することを確認する
  - 参照リンク問題表示時の読み取り専用／切り離しポリシーが既存 Phase 8 ルールと整合することを確認する
  - **完了状態**: エディタ関連テスト・ビルドがグリーンで、プレイ専用 UI は play-flow-ui に委譲されていること
  - _Requirements: 11.9, 11.10, 11.12, 11.13_
  - _Depends: 10.4, quizetika-core 19.3_
  - _Boundary: Integration_

## Implementation Notes (Phase 20)

- 選択肢正規化・`Quiz.format` 永続化は `quizetika-core` Phase 19 に依存。本スペックは UI とエディタ state のみ。
- 実装順: `quizetika-core` 19.1 → 本スペック 10.1 以降。

---

### 11. Phase 26: リスト機能 UI の完全廃止（2026-06-10）

- [x] 11.1 作家ダッシュボードからリスト作成導線の除去
  - ダッシュボードアクション・クライアントから「リスト作成」CTA およびリスト詳細・編集へのリンクを削除する
  - クイズ一括 JSON エクスポート CTA は維持する
  - **完了状態**: `/creator/dashboard` にリスト作成ボタンが存在せず、クイズ新規作成・エクスポート導線は維持されること
  - _Requirements: 12.3, 12.4, 12.5_
  - _Depends: quizetika-core 23.6_
  - _Boundary: dashboard-actions_

- [x] 11.2 リストエディタ関連テスト・スケルトン・E2E の除去
  - リストタイプセレクタ・アタッチパネル専用テストを削除する
  - スケルトンテストから `ListEditorSkeleton` 期待を除去し、リスト作成シナリオを `phase8`・`creator-streaming-skeleton` から削除する
  - **完了状態**: リスト専用 creator テストが除去され、関連 Jest / E2E がグリーンであること
  - _Requirements: 12.1, 12.2, 12.8, 12.12_
  - _Depends: quizetika-play-flow-ui 28.1_
  - _Boundary: Testing_

- [x] 11.3 Phase 26 統合検証
  - クイズ新規作成・編集・参照リンク・〇×作問 UI（Phase 20）が回帰なく動作することを確認する
  - 作家ダッシュボードの Suspense スケルトン（`quiz-list-skeleton` 等・クイズ一覧用）が維持されることを確認する
  - **完了状態**: creator-dash 関連ビルド・テストがグリーンで、リストルート・エディタが存在しないこと
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12_
  - _Depends: 11.1, 11.2_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- リストルート・`components/quiz-list` 削除の正本は `quizetika-play-flow-ui` 28.1。本スペックはダッシュボード CTA と creator 専用テスト。
- 維持: `/quiz/create`・`/quiz/[id]/edit`、過去自作検索・参照リンク、〇×作問、`QuizListSkeleton`（クイズ一覧用 testId）。
- 実装順: `quizetika-core` 23.6 → play-flow 28.1 → 本スペック 11.1/11.2（並行可）→ 11.3。

---

### 12. Phase 27: 作家＆プレイヤー統合ダッシュボード（2026-06-28）

- [x] 12.1 (P) プレイヤープレイ履歴集計ライブラリ of 作成
  - `src/lib/player-stats.ts` を作成し、完了した `Attempt` リストと `Quiz` メタデータのマップを引数に取り、基本統計（累計プレイ数、平均正解率、平均解答時間、ユニーククイズ数）、日別プレイ数（直近7日間）、プレイモード分布、よくプレイするジャンル/タグ、および正答率の高いジャンル/タグ（プレイ回数3回以上を対象、各最大5件）を計算する純関数を実装する。
  - **完了状態**: 各種境界条件（履歴空、未定義クイズなど）をカバーする単体テストがグリーンであること。
  - _Requirements: 13.4, 13.5, 13.6_
  - _Boundary: player-stats_

- [x] 12.2 (P) プレイヤーダッシュボードクライアントコンポーネントの実装
  - `src/app/creator/dashboard/player-dashboard-client.tsx` を新規作成する。
  - `useEffect` 内で `listUserPlayHistory` を呼び出して直近最大 100 件の attempts をロードし、抽出したユニークなクイズIDリストに対して30件ずつのチャンク分割バッチフェッチを行い、ロード完了時に `player-stats.ts` を適用して状態を更新する。
  - ロード状態中は `data-testid="player-skeleton"` を付与したスケルトンプレースホルダーを表示する。
  - **完了状態**: 画面マウント時に非同期でロードと集計が走り、スケルトンからコンテンツ表示へ差し替わること。
  - _Requirements: 13.2, 13.3, 13.7_
  - _Boundary: PlayerDashboardClient_

- [x] 12.3 プレイヤーダッシュボード UI セクションの実装
  - `src/app/creator/dashboard/dashboard-sections.tsx` にプレイヤーダッシュボード専用の表示セクション（統計グリッド、グラフエリア、ジャンル・タグ分析、最近のプレイ履歴）を定義する。
  - 統計グリッド領域に `data-testid="player-stats"`、グラフ表示領域に `data-testid="player-charts"`、ジャンル・タグ分析領域に `data-testid="player-genre-tag-analysis"` を付与する。
  - **完了状態**: 統計カード、recharts によるプレイトレンド・モード割合グラフ、よくプレイする/得意なジャンル/タグ、最近のプレイ履歴のテーブルがデザインシステムに則って表示されること。
  - _Requirements: 13.4, 13.5, 13.6, 13.8, 13.9_
  - _Boundary: PlayerDashboardSections_

- [x] 12.4 ダッシュボード画面へのタブ切り替え統合
  - `src/app/creator/dashboard/page.tsx` を修正し、画面見出しを「ダッシュボード」に変更する。
  - `src/app/creator/dashboard/dashboard-client.tsx` に `Tabs` を導入し、デフォルトで「プレイヤーダッシュボード」、もう一方に「作家ダッシュボード」を配置する。
  - **完了状態**: URL `/creator/dashboard` アクセス時に「プレイヤー」「作家」のタブが表示され、デフォルトでプレイヤーダッシュボードが表示されること。
  - _Requirements: 13.1_
  - _Boundary: DashboardClient_

- [x] 12.5 Phase 27 結合テストとスモーク検証
  - 新規作成した集計ライブラリの単体テストを `tests/lib/player-stats.test.ts` に作成し、ダッシュボード画面のテストケースを更新する。
  - **完了状態**: `npm test` および `npm run build` がエラーなく通過すること。
  - _Requirements: 13.9_
  - _Boundary: Testing_

---

### 13. Phase 28: 間違い指摘キューの解消（解決）機能（2026-06-28）

- [x] 13.1 (P) API 通知バグ修正の実装
  - `src/services/review.ts` 内の `resolveReport` 関数を修正し、作成される通知ドキュメントのスキーマを `Notification` 型および `firestore.rules` の認可要件に適合させる。
  - 具体的には `recipientId -> userId`、`type: 'report_resolved' -> 'correction_resolved'`、`quizId/quizTitle -> targetId/targetTitle` へフィールド名を変更し、欠落している `senderId: 'system'`, `senderName: '運営'`, `senderAvatar: ''` を追加する。
  - **完了状態**: `resolveReport` の通知書き込みロジックが型エラーなしにコンパイルでき、Firestore Emulator 環境で通知ドキュメントが正しいスキーマで生成されること。
  - _Requirements: 2.6_
  - _Boundary: review-service_

- [x] 13.2 (P) 指摘解決ボタン UI とローカル状態制御の実装
  - `src/app/creator/dashboard/dashboard-sections.tsx` の `FeedbackSection` コンポーネントに `onResolve` props を追加する。
  - 指摘アイテムカードの「修正する」ボタンの隣に「解決済みにする」ボタン（`data-testid="resolve-feedback-btn-{id}"`、`CheckOutlined` アイコン）を追加する。
  - `resolvingId` ローカルステートを導入し、非同期処理の実行中は該当指摘カードの「解決済みにする」ボタンおよび「修正する」ボタンを disabled にして二重送信を防止する。
  - **完了状態**: 指摘カード上に解決ボタンが表示され、クリック中にローディング表示および disabled 状態になり、二重クリックが防止されること。
  - _Requirements: 2.6, 2.7_
  - _Boundary: FeedbackSection_

- [x] 13.3 ダッシュボード of クライアント側状態更新の統合
  - `src/app/creator/dashboard/dashboard-client.tsx` の `CreatorDashboardClientInner` コンポーネントに `handleResolveFeedback` ハンドラを実装する。
  - ハンドラ内から `resolveReport(reportId)` を非同期に呼び出し、Firestoreの更新成功後に `feedbacks` 状態から該当指摘を `filter` で除外するステート更新を行う。これを `FeedbackSection` の `onResolve` に受け渡す。
  - **完了状態**: 解決成功後、ダッシュボード画面上の指摘カード一覧から該当指摘が即座に消去されること。
  - _Requirements: 2.6_
  - _Boundary: DashboardClient_
  - _Depends: 13.1, 13.2_

- [x] 13.4 Phase 28 結合テストと E2E テストの作成・更新
  - `tests/services/review.test.ts` に `resolveReport` が正しい通知スキーマでドキュメントを追加し、ステータスを `resolved` に更新することを検証する単体テストを追加する。
  - `e2e/creator-dashboard.spec.ts` の「指摘・修正フロー」テストケースを拡張し、解決ボタンクリック後のローディング非活性が機能し、成功後に指摘カードが画面上から即座に消失することを確認するアサーションを追加する。
  - **完了状態**: `npm test`、`npm run build`、および Playwright による E2E テストがエラーなく通過すること。
  - _Requirements: 2.6, 2.7_
  - _Boundary: Testing_
  - _Depends: 13.3_

## Implementation Notes (Phase 28)
- データベースの `resolveReport` は UI 側と同じリポジトリに配置されているため、本フェーズで API 不整合バグを一緒に解消します。
- プレイヤー側への通知の表示は、既存の通知画面（`notifications-client.tsx`）が型 `correction_resolved` を処理可能であるため、追加のUI開発は不要です。

---

### 14. Phase 40: 作成クイズ管理画面（2026-07-12）

> **前提**: クイズの公開範囲（`visibility: 'public'/'followers'/'private'`）と Pro プラン制限（`assertCanSetQuizVisibilitySync` 等）は `quizetika-core`（`src/services/quiz.ts` の `updateQuiz`、`src/lib/quiz-access.ts`）に実装済み。本フェーズはこれを初めて UI に露出し、新規バックエンドAPIは作らない。

- [x] 14.1 (P) クイズ統合ステータス導出ロジックの実装
  - `status`（下書き/公開/凍結）と `visibility`（公開/限定公開/非公開）から、公開・限定公開・非公開・下書き・審査により非表示のいずれか1つを返す統合ステータス判定ロジックを実装する。
  - `status` が凍結（`suspended`）の場合を下書きより優先して判定し、両者を区別する。
  - **完了状態**: 下書き／凍結／公開×（公開・限定公開・非公開）の全組み合わせについて、期待する統合ステータス値が一意に決定できること。
  - _Requirements: 17.1, 17.2, 17.3_
  - _Boundary: creator-quiz-status (lib)_

- [ ] 14.2 クイズ検索・絞り込み・並び替えロジックの拡張
  - 既存の作成者クイズ検索に、統合ステータス・ジャンル・タグの条件を AND で合成する絞り込みと、クイズ名・プレイ回数・作成日（各昇順／降順）の並び替えを追加する。統合ステータスによる絞り込みは 14.1 の判定ロジックを利用する。
  - ジャンル絞り込みが指定されている場合、現行の有効ジャンルマスタに解決されていない（レガシー・マージ保留状態の）クイズは絞り込み結果から除外し、ジャンル未指定時は従来どおり全件を対象に含める。
  - **完了状態**: 統合ステータス・ジャンル・タグを組み合わせた絞り込みが AND 条件で正しく作用し、3種の並び替え基準がそれぞれ昇順・降順で意図した順序を返すこと。
  - _Requirements: 16.4, 16.5, 16.6, 16.7, 16.11, 16.12, 16.13_
  - _Boundary: author-quiz-search (lib/service)_
  - _Depends: 14.1_

- [ ] 14.3 (P) クイズ単位の未解決指摘件数集計機能の実装
  - 作成者に紐づく未解決（オープン状態）の指摘を、クイズIDごとに件数集計して返す機能を追加する。
  - 既存の指摘一覧取得ロジックとクエリ条件を揃え、指摘が1件もないクイズは集計結果に含めない。
  - **完了状態**: 複数クイズにまたがる指摘データに対し、クイズIDをキーとした正しい件数のマップが得られ、指摘が0件のクイズはキーに含まれないこと。
  - _Requirements: 18.1_
  - _Boundary: review-service_

- [ ] 14.4 作成クイズ管理画面のデータ取得・状態管理の実装
  - `/creator/quizzes` 用のクライアント側コンポーネントとして、未認証時のログイン画面リダイレクト（復帰先クエリ付き）を実装する。
  - 作成者の全クイズ（統合ステータス問わず）と未解決指摘件数を並行して取得し、キーワード・統合ステータス・ジャンル・タグ・並び替え条件をローカル状態として管理する。
  - 取得中はローディング状態、一覧本体の取得失敗時はエラーと再試行操作、フィルタ変更時は絞り込み・並び替え結果を即時反映する。
  - 未解決指摘件数の取得のみが失敗した場合は、一覧本体の表示はブロックせず、指摘件数バッジのみ「取得失敗」を示す非強調表示にフォールバックする。
  - **完了状態**: 認証済みユーザーで画面を開くと作成者の全クイズが取得され、未認証では復帰クエリ付きでログイン画面へ遷移すること。指摘件数取得のみが失敗した場合でも一覧本体は表示され続けること。
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 16.1, 16.2, 16.8, 16.9_
  - _Boundary: CreatorQuizManagementClient_
  - _Depends: 14.1, 14.2, 14.3_

- [ ] 14.5 (P) 作成クイズ管理画面の一覧・フィルタ表示UIの実装
  - クイズ一覧（サムネイル・タイトル・統合ステータス・プレイ回数・未解決指摘件数バッジ）、キーワード・統合ステータス・ジャンル・タグの絞り込みUI、並び替えセレクトを実装する。
  - 作成したクイズが1件もない場合と、絞り込み結果が0件の場合とで、異なる案内文言と導線（新規作成 / 条件クリア）を出し分ける。
  - 「クイズを新規作成する」導線と各行の「編集する」導線、および未解決指摘件数バッジのクリックで編集画面へ遷移する導線を配置する。
  - 統合ステータスが下書きまたは審査により非表示（凍結）の行では、公開範囲切り替えUI（14.6）を配置せず操作不可であることを一覧上で示す。
  - **完了状態**: 一覧・フィルタ・並び替え・空状態2種・指摘バッジがそれぞれ指定の要素で表示され、新規作成/編集/指摘バッジのリンク先が正しいこと。下書き・凍結ステータスの行に公開範囲切り替えUIが表示されないこと。
  - _Requirements: 15.5, 15.6, 15.7, 15.8, 15.9, 16.3, 16.4, 16.6, 16.9, 16.10, 16.11, 16.12, 16.14, 17.2, 17.3, 17.9, 18.2, 18.3, 18.4, 18.5_
  - _Boundary: CreatorQuizManagementSections_
  - _Depends: 14.4_

- [ ] 14.6 (P) クイズ公開範囲切り替えUIの実装
  - 公開済みクイズに対し、公開・限定公開・非公開を切り替えるUIを実装し、下書き・審査により非表示のクイズには切り替え操作を表示しない。
  - 有料プランの権利を保有しない場合は限定公開・非公開への切り替えを非活性表示にし、有料プランへの案内導線を提示する。
  - 切り替え処理を実行し、成功時は表示を即時更新、失敗時（権限エラー・その他エラー双方）はエラーメッセージを表示して切り替え前の表示に戻す。
  - **完了状態**: 有料プラン未保有ユーザーで限定公開・非公開が非活性表示となり、切り替え失敗時に元の公開範囲表示へ戻ること。
  - _Requirements: 17.4, 17.5, 17.6, 17.7, 17.8, 17.10_
  - _Boundary: CreatorQuizVisibilityToggle_
  - _Depends: 14.1_

- [ ] 14.7 作成クイズ管理画面の組み立てと導線統合
  - `/creator/quizzes` ページ本体を組み立て、データ取得・一覧表示・公開範囲切り替えの各部品を接続する。
  - 未解決指摘件数バッジのクリックが該当クイズの編集画面へ遷移することを実際の画面遷移として結線する。
  - **完了状態**: `/creator/quizzes` にアクセスすると一覧・検索・並び替え・公開範囲切り替え・指摘バッジ遷移が一連の画面として動作すること。
  - _Requirements: 15.1, 15.7, 15.8, 15.9, 17.9, 18.3_
  - _Boundary: creator/quizzes route_
  - _Depends: 14.4, 14.5, 14.6_

- [ ] 14.8 作家ダッシュボードの簡易クイズ一覧を管理画面導線へ置換
  - 作家ダッシュボードの簡易クイズ一覧セクション（検索・フィルタなしの一覧表示）を撤去し、作成クイズ管理画面への導線カードに置き換える。
  - ダッシュボードのアナリティクス・グラフ・プレイヤー統計表示ロジックには変更を加えない。
  - **完了状態**: ダッシュボードに簡易クイズ一覧が表示されなくなり、導線カードのクリックで作成クイズ管理画面へ遷移すること。
  - _Requirements: 19.1, 19.2, 19.3, 19.4_
  - _Boundary: CreatorDashboard_
  - _Depends: 14.7_

- [ ] 14.9 (P) 統合ステータス・検索/絞り込み/並び替えロジックの単体テスト
  - 統合ステータス判定が下書き／凍結／公開×3公開範囲の全組み合わせで期待値を返すことを検証する。
  - 統合ステータス・ジャンル・タグ絞り込みのAND合成、レガシー未解決ジャンルの除外、3並び替え基準×昇順/降順の順序が正しいことを検証する。
  - **完了状態**: 追加した単体テストがすべて成功すること。
  - _Requirements: 17.1, 17.2, 17.3, 16.4, 16.5, 16.6, 16.11, 16.12, 16.13_
  - _Boundary: Testing (lib)_
  - _Depends: 14.1, 14.2_

- [ ] 14.10 (P) 指摘件数集計機能の単体テスト
  - 複数クイズにまたがる未解決指摘データから、クイズIDごとの正しい件数マップが得られることを検証する。
  - 指摘が0件のクイズが集計結果のキーに含まれないことを検証する。
  - **完了状態**: 追加した単体テストがすべて成功すること。
  - _Requirements: 18.1_
  - _Boundary: Testing (service)_
  - _Depends: 14.3_

- [ ] 14.11 公開範囲切り替えUIの結合テスト
  - 有料プラン未保有時に限定公開・非公開の切り替え操作が非活性表示になることを検証する。
  - 切り替えAPIが権限エラーを返した場合に、エラー表示と切り替え前表示への復帰が行われることを、切り替えAPIをモックして検証する。
  - **完了状態**: 追加した結合テストがすべて成功すること。
  - _Requirements: 17.6, 17.7, 17.8_
  - _Boundary: Testing (CreatorQuizVisibilityToggle)_
  - _Depends: 14.6_

- [ ] 14.12 Phase 40 E2Eテストの作成・更新
  - 新規E2Eスモークテストとして、作成クイズ管理画面での一覧表示→キーワード検索→統合ステータス/ジャンル/タグ絞り込み→並び替え→新規作成導線→編集導線→指摘バッジ→編集画面遷移、の一連のフローを検証する。
  - 下書き・審査により非表示（凍結）ステータスの行に公開範囲切り替えUIが表示されないことを検証する。
  - 既存の作家ダッシュボードE2Eテストを更新し、簡易クイズ一覧が表示されないこと、管理画面への導線が機能することを検証する。
  - **完了状態**: 新規・更新したE2Eテストがすべて成功すること。
  - _Requirements: 15.1, 15.2, 15.4, 15.6, 16.7, 16.8, 17.2, 17.3, 17.9, 18.3, 19.1, 19.3_
  - _Boundary: Testing (E2E)_
  - _Depends: 14.7, 14.8_

- [ ] 14.13 Phase 40 統合検証
  - 作成クイズ管理画面と作家ダッシュボードの結線を通しで確認し、既存機能（クイズ作成・編集・アナリティクス・指摘解決サイドバー）に回帰がないことを確認する。
  - `npm test` / `npm run build` / Playwright E2E がすべて成功することを確認する。
  - **完了状態**: 関連する単体・結合・E2Eテストおよびビルドがすべてグリーンであること。
  - _Requirements: 15.1, 16.6, 17.1, 18.1, 19.1_
  - _Boundary: Testing_
  - _Depends: 14.9, 14.10, 14.11, 14.12_

## Implementation Notes (Phase 40)
- 公開範囲変更・Pro制限は既存 `updateQuiz`／`quiz-access.ts` をそのまま呼び出すのみで、新規バックエンドAPIは追加しません。
- 検索・絞り込み・並び替えは既存の「全件取得＋クライアント側フィルタ」方式（`searchAuthorQuizzes`）を拡張する形とし、DBカーソルページングとは統合しません（design.md Phase 40 参照）。
- `resolveReport`/`rejectReport` による指摘の解決・却下操作自体は本フェーズの範囲に含めません（既存の要件14編集画面が担当）。


