# Brief: quizetika-quiz-image-upload

## Problem
ユーザー（クリエイター）がクイズを作成・編集する際、AIによるサムネイル生成だけでなく、自身のローカルデバイスから画像をアップロードしてカバー画像に設定する機能が不足しています。

## Current State
- クイズエディタ (`QuizMetadataSection`) には「AIでサムネイルを生成」ボタンと、生成されたプレビュー表示枠しか存在しません。
- Firebase Storage へのアップロードやルール (`storage.rules`) はすでに定義されていますが、ローカルファイルの選択、およびそれをカード規格（16:9）に整形してアップロードするフローがありません。

## Desired Outcome
- クイズ作成・編集画面で、ユーザーがPC・スマホのローカルから画像（PNG, JPEG, GIF）を選択できる。
- 選択した画像を 16:9 のアスペクト比で直感的に切り抜けるトリミングモーダルが動作する。
- トリミングされた画像（2MB未満）が Firebase Storage の `quizzes/{quizId}/cover_{timestamp}.png` に保存され、`thumbnailUrl` が更新される。
- 保存・公開時に問題なくサムネイル画像として他のユーザーに表示される。

## Approach
- `react-easy-crop` パッケージを導入し、React 19 との互換性を担保しつつトリミング機能を提供。
- shadcn/ui Dialog と Tailwind CSS v4 をベースにした `ImageCropper` コンポーネントを新規作成。
- クライアント側でアップロード前のサイズ（2MB以下）および MIME タイプ（PNG, JPEG, GIF 限定。SVG禁止）のバリデーションを適用。
- アップロード成功後、親の `thumbnailUrl` state を更新し、既存のクイズ保存・公開フローに統合。

## Scope
- **In**:
  - `src/components/ui/image-cropper.tsx` [NEW]: 画像トリミングを行う汎用的なモーダルコンポーネント。
  - `src/components/quiz/editor/quiz-metadata-section.tsx` [MODIFY]: 画像選択用 `<input type="file" />` を配置し、トリミングモーダルを呼び出し、ローカルアップロード結果を反映するUIの統合。
  - `src/services/storage.ts` [MODIFY]: クイズ用画像アップロード（サイズ制限・MIMEタイプ確認を含む）のバリデーション/アップロード関数の整理・流用。
- **Out**:
  - 各設問（クイズ内の各問題）での画像アップロード対応。
  - サーバサイドでの画像圧縮バッチ処理。

## Boundary Candidates
- `src/components/ui/image-cropper.tsx`
- `src/components/quiz/editor/quiz-metadata-section.tsx`
- `src/services/storage.ts`

## Out of Boundary
- `quizetika-core` の Firestore 保存トランザクションロジック（スキーマや保存先フィールドは既存の `thumbnailUrl` がそのまま使えるため不変）。

## Upstream / Downstream
- **Upstream**: `quizeum-ui-editor` （エディタUI）, `quizetika-core` （Firebase Storage設定および rules）
- **Downstream**: `quizeum-play-flow-ui` （クイズカード・詳細画面でのカバー画像表示）

## Existing Spec Touchpoints
- **Adjacent**: `quizeum-ui-editor` (本機能の組み込み対象画面)

## Constraints
- SVGアップロードの禁止（XSS脆弱性排除）。
- Firebase Storage ルールに準拠した 2MB 制限。
