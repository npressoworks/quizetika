# Research & Design Decisions

## Summary
- **Feature**: `genre-icons`
- **Discovery Scope**: Extension (ジャンルアイコン管理機能の Firebase Storage 移行)
- **Key Findings**:
  - 現状のジャンルアイコン処理はローカルファイルシステム (`assets/genre/`) に強く依存しており、Vercelなどのサーバーレス環境で永続化できない。
  - すでにクイズカバー画像のアップロード (`uploadQuizCoverBuffer`) では Firebase Storage を用いた保存および `https://storage.googleapis.com/...` による公開URL返却が実装されている。
  - Firebase Storage Admin SDK (`@google-cloud/storage`) を用いることで、サーバーサイドでのファイルのコピー (`file.copy()`) や削除 (`file.delete()`)、公開権限付与 (`file.makePublic()`) が安全に実行可能である。

## Research Log

### Firebase Storage Admin SDK によるアセット操作
- **Context**: 一時アップロードされたアイコンを正式なジャンルIDのパスにコピーし、元のファイルを削除する処理を Storage 上で実現する方法の調査。
- **Sources Consulted**: Firebase Admin SDK Cloud Storage Reference
- **Findings**:
  - `bucket.file(sourcePath).copy(bucket.file(destinationPath))` メソッドにより、同一バケット内でのファイルコピーがアトミックに行える。
  - コピー先のファイルに対し `file.makePublic()` を実行することで、一般公開URL (`https://storage.googleapis.com/{bucket}/{path}`) から直接アクセス可能になる。
  - 元の一時ファイルは `file.delete()` で削除できる。
- **Implications**:
  - `migrate-icon` API および `/api/admin/genres` 内のローカルコピー処理を、上記 Admin SDK を用いたバケット内操作に置き換える。

## Architecture Pattern Evaluation

| Option                                       | Description                                                                                             | Strengths                                                | Risks / Limitations                                                                 | Notes                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------- |
| Firebase Storage 直接保存 (アプローチ1)      | API経由で Storage に直接アップロードし、参照は公開URLを使用する。                                       | パフォーマンスが良く、サーバーレス環境で完全に動作する。 | 既存のローカルアセットURLとの互換性への考慮が必要。                                 | 採用。一貫性があり最もシンプル。 |
| Storage保存 + ローカルプロキシ (アプローチ2) | 保存は Storage に行い、配信は `/api/assets/genre/...` API を介して Storage からデータを取得・中継する。 | 既存のURL形式を変更せずに済むため互換性が高い。          | リクエストごとに API サーバーが中継するため、帯域コストとパフォーマンスが低下する。 | 非採用。                         |

## Design Decisions

### Decision: 配信URLの Firebase Storage 公開URL化
- **Context**: 既存のローカルアセット配信 API を経由せず、Storage の直接公開 URL を登録・参照する。
- **Alternatives Considered**:
  1. ローカルアセット配信 API を残し、Storage へのプロキシにする。
  2. 直接 Storage の URL を使用し、ローカルアセット配信 API は廃止する。
- **Selected Approach**: オプション 2 (直接 Storage の URL を使用し、配信 API は削除)
- **Rationale**: クイズカバー画像ですでに直接 Storage の URL を返す方式が採用されており、ジャンルのアイコン画像もこれに合わせることで一貫性が保たれ、パフォーマンスも最大化される。
- **Trade-offs**: テストデータや既存 DB にハードコードされたローカル URL があった場合、それらは参照できなくなるが、初期ジャンルデータ（`initial_genres.json`）のアイコンは `null` もしくは外部 API (`dicebear.com`) のもののみであるため、影響は極めて軽微。
- **Follow-up**: ローカルアセット配信 API (`d/quizetika/src/app/api/assets/genre/[...path]/route.ts`) の不要化に伴う削除。

## Risks & Mitigations
- **不適切な画像形式（SVG等）のアップロードによる XSS 脆弱性**:
  - *Mitigation*: 既存のサーバーサイドファイル検証 `validateGenreIconFile` を引き続き適用し、`storage.rules` でも MIME タイプのチェック（`image/(png|jpeg|gif)`）を維持する。
- **孤立アセット（ゴミファイル）の蓄積**:
  - *Mitigation*: `migrate-icon` 処理において、コピー完了後に必ず `tempFile.delete()` を実行する。また、長期的に削除されずに残った `genres/temp/` 配下の一時ファイルについては、Firebase Storage のライフサイクルルール等で自動クリーンアップされる設計とする（今回はライフサイクル自体の実装は Out とし、API上での削除を徹底する）。

## References
- [Google Cloud Storage Node.js Client API](https://googleapis.dev/nodejs/storage/latest/) — ファイルコピーおよび削除のメソッドリファレンス
