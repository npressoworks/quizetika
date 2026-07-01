# Implementation Plan - quizetika-quiz-image-upload

## 1. Foundation: 環境設定とヘルパー関数の追加
- [x] 1.1 `react-easy-crop` のインストールと動作確認
  - プロジェクトルートで `npm install react-easy-crop --legacy-peer-deps` を実行してパッケージを追加する
  - Next.js 開発環境でビルドエラーや依存解決の警告が発生しないことを確認する
  - _Requirements: 2.1_

- [x] 1.2 `storage.ts` へのアップロード関数の追加
  - `src/services/storage.ts` 内に、Blobを受け取り、クイズIDからカバー画像のパス（`quizzes/{quizId}/cover_{timestamp}.jpeg`）を生成してアップロードする `uploadQuizCover(file: Blob, quizId: string): Promise<string>` メソッドを追加する
  - アップロード完了後に正しい JPEG ファイルのダウンロード URL が返却されることをテスト呼び出し等で確認する
  - _Requirements: 3.1_

## 2. Core: 新規コンポーネントの実装
- [x] 2.1 (P) `ImageCropper` コンポーネントの構築
  - `src/components/ui/image-cropper.tsx` を新規作成する
  - `react-easy-crop` を使用し、読み込んだ画像を 16:9 の固定アスペクト比でドラッグ・ズーム操作にて切り抜くモーダル UI を実装する
  - 切り出し確定時に HTML5 Canvas を使用して、長辺が 1920（幅）または 1080（高さ）を超える場合にアスペクト比を維持したまま縮小（FHD制限）し、`canvas.toBlob(..., 'image/jpeg', 0.85)` により JPEG Blob を生成してコールバック `onCropComplete` へ渡す処理を記述する
  - 切り抜かれたデータが指定アスペクト比（16:9）・フルHD以下の解像度の JPEG Blob 形式で正しく生成されることをダミー画像を用いて検証する
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Boundary: ImageCropper_

## 3. Core/Integration: UIの結合とアップロードの統合
- [x] 3.1 `QuizMetadataSection` へのローカル画像アップロード動線の統合
  - `src/components/quiz/editor/quiz-metadata-section.tsx` 内のサムネイル表示エリアに、ローカルファイル選択をトリガーするボタンを追加する
  - 非表示の `<input type="file" accept="image/png,image/jpeg,image/gif" />` を配置し、ファイル選択時に 2MB以下のサイズ検証、および PNG, JPEG, GIF 限定（SVG禁止）の検証を適用する
  - 検証通過後に `ImageCropper` モーダルを表示させ、確定後に `uploadQuizCover` を実行して、アップロード中は進行インジケータ（ローディング）を表示すると共にボタンを無効化する
  - アップロード完了後に返されたダウンロードURLで親の `thumbnailUrl` state を更新する
  - AI サムネイル生成処理と排他的に動作し、最終的な `thumbnailUrl` が正しく上書き更新されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
  - _Depends: 1.2, 2.1_

## 4. Validation: テストの作成とE2E確認
- [x] 4.1* クライアント側バリデーションとリサイズ計算の単体テストの記述
  - 2MB制限やMIMEタイプ検証、および長辺FHD制限におけるアスペクト比縮小計算ロジックに対する Jest 単体テスト（`tests/` 下）を追加する
  - _Requirements: 1.3, 1.4, 2.3_

- [x] 4.2 画像アップロードおよびトリミングフローのE2Eテスト
  - クイズエディタ画面での画像選択、トリミングモーダル出現、確定後のダミーアップロードおよび `thumbnailUrl` のプレビュー更新にわたる Playwright E2E テストを追加する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_
  - _Depends: 3.1_
