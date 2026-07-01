# Research & Design Decisions

## Summary
- **Feature**: `quizetika-quiz-image-upload`
- **Discovery Scope**: Extension
- **Key Findings**:
  - `react-easy-crop` は React 19 で動作する。peerDependencies 警告は `--legacy-peer-deps` でインストールすることで回避可能。
  - Firebase Storage ルールには既に `request.resource.size < 2 * 1024 * 1024`（2MB以下）および MIME タイプのPNG, JPEG, GIF制限がグローバルに適用されている。
  - クイズサムネイル表示（`quiz-card.tsx` 等）は `aspect-video` (16:9) 固定となっており、トリミング比率も 16:9 に合わせる。
  - フルHD以下への制限および JPEG 変換は、切り抜き後の Canvas から blob にエクスポートする際、最大幅/高さ 1920 または 1080 を境界とし、`canvas.toBlob(..., 'image/jpeg', 0.85)` のようにして JPEG 画像を生成することで実現可能。

## Research Log

### React 19 と react-easy-crop の互換性
- **Context**: プロジェクトで React 19.2.4 が使用されているため、`react-easy-crop` が正常に導入可能か調査。
- **Sources Consulted**: `react-easy-crop` npm ページ、GitHub Issues
- **Findings**:
  - パッケージは正常に動作するが、npm i 時点では React 19 に対するピア依存警告が出る可能性がある。
  - `--legacy-peer-deps` フラグを使用することで安全にインストール可能。
- **Implications**: パッケージの導入手順を `npm install react-easy-crop --legacy-peer-deps` に指定。

### クライアントサイドでの画像リサイズとJPEG変換
- **Context**: ユーザーから「画像サイズはフルHD以下、JPEGに変換」という制限指示があったため、クライアントサイドでのトリミング処理内での実装方法を調査。
- **Sources Consulted**: MDN Canvas API, HTMLCanvasElement.toBlob()
- **Findings**:
  - `react-easy-crop` から得られるピクセル単位の切り抜き座標（`croppedAreaPixels`）を元に、別キャンバスに画像を描画する。
  - このキャンバスのサイズ（幅/高さ）が 1920x1080 を超える場合、アスペクト比 16:9 を維持したまま、長辺が最大 1920（または高さが最大 1080）になるようにリサイズ（縮小）してキャンバスを作成する。
  - `canvas.toBlob(callback, 'image/jpeg', 0.85)` を用いることで、形式を強制的に JPEG に変換し、画質（quality）を 0.85 等に設定してデータ量を最適化。
- **Implications**: 2MB 制限に収めるための容量削減にも繋がり、かつサーバー負荷ゼロで実行可能。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| クライアントサイドCanvas切り出し (採用) | クライアント側で `canvas.toBlob` によりリサイズ＆JPEG変換を行い、完成したBlobを直接Storageへアップロード | サーバー側コスト（Cloud Functions等）が不要。アップロードサイズ自体が削減されるため通信が高速。 | クライアント側の端末スペックに依存する（巨大な画像の場合にメモリ消費） | クイズ作成のUI性能としてはこれで十分に実用的。 |
| サーバサイド変換 (不採用) | オリジナル画像をそのまま Storage の temp パスへ上げ、Cloud Functions 等でトリミング・リサイズ・JPEG変換を行う | クライアント側の負荷が低い。 | 追加のクラウドコスト、実装の複雑化、アップロード時の通信量増大（オリジナルサイズが上がるため）。 | 今回の要件（フルHD、2MB以下）であればクライアントで完結させた方が体験が良い。 |

## Design Decisions

### Decision: トリミングとリサイズを HTML5 Canvas で一括処理する
- **Context**: ユーザー要件（フルHD以下制限、JPEG変換）と Firebase Storage ルール（2MB以下、SVG禁止）の共存。
- **Alternatives Considered**:
  - 1. 切り出しのみ行い、リサイズは行わない（不採用：フルHD超の巨大画像で2MB制限を超えやすい）。
  - 2. 切り出しとリサイズを両方行う（採用）。
- **Selected Approach**: トリミングモーダルでトリミング範囲確定時、Canvas 上にその範囲を描画し、サイズが 1920x1080 を超えていればアスペクト比を保ってリサイズし、`image/jpeg` 形式で Blob 出力する。
- **Rationale**: フルHD以下への制限とJPEG化をクライアント側でアトミックに適用することで、Storage ルール（2MB以下）のクリアが非常に容易になり、通信速度も最適化されます。
- **Trade-offs**: クライアントPC/スマホ側でCanvas描画負荷が発生しますが、1920x1080程度であればミリ秒単位で処理されるためUX影響はありません。

## Risks & Mitigations
- **SVGの選択**: ユーザーがSVGなどを選択した場合、`react-easy-crop` は正しくトリミングできない、またはアップロード時にStorageルールで拒否されます。
  - *対策*: ファイル選択時点で拡張子/MIMEタイプのチェックを行い、SVGファイルを弾く（MIMEが `image/png`, `image/jpeg`, `image/gif` のみに制限）。

## References
- [react-easy-crop npm](https://www.npmjs.com/package/react-easy-crop) — トリミングライブラリの公式ドキュメント
- [MDN Canvas toBlob](https://developer.mozilla.org/ja/docs/Web/API/HTMLCanvasElement/toBlob) — Canvas から指定形式（JPEG）へのエクスポート仕様
