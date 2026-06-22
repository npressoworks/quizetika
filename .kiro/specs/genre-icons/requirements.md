# Requirements Document

## Introduction
本文書は、ジャンルアイコン画像を Firebase Storage で管理するように移行するための要件定義書です。本変更により、従来のローカルサーバー依存を排除し、サーバーレス環境（Vercelなど）における画像アセットの永続化および信頼性の高い直接配信を実現します。

## Boundary Context
- **In scope**:
  - ジャンル新設申請時、または管理者画面からのジャンルアイコン画像の手動アップロードおよび一時保存（Firebase Storage `genres/temp/`）
  - ジャンル新設申請時、または管理者画面からのAIによるジャンルアイコン画像の自動生成および一時保存（Firebase Storage `genres/temp/`）
  - ジャンル申請が可決されたとき、または管理者がジャンルを直接保存したときの、一時画像から正式保存パス（`genres/${genreId}/`）へのコピーと、古い一時アセットの削除
  - ジャンルアイコン画像の参照URLを Firebase Storage の直接公開 URL（`https://storage.googleapis.com/...`）に変更
  - 画像アップロード時のファイル制限（PNG/JPEG/GIFのみ許可、最大容量2MB以下、SVG禁止）の強制
- **Out of scope**:
  - ジャンル以外の画像（クイズのカバー画像等）の Storage 移行（既存の仕組みを維持）
  - Firebase Storage 以外の外部オブジェクトストレージの導入
  - 本番環境にすでに存在する既存のジャンル画像URLのバッチ自動移行スクリプト（テストデータでの手動確認および動作整合のみとする）
- **Adjacent expectations**:
  - Firebase Storage エミュレータおよび本番の Storage バケットが正常に稼働していること
  - Firebase Storage Rules において、読み取りが全公開、書き込みが認証済みユーザーのみかつサイズ/コンテンツタイプの制限が機能していること

## Requirements

### Requirement 1: ジャンルアイコンのアップロード・一時保存
**Objective:** As a ユーザーまたは管理者, I want ジャンルアイコン画像をアップロード（手動またはAI生成）して一時保存できるようにしたい, so that 申請や登録のプレビューが正常に確認できる。

#### Acceptance Criteria
1. When ユーザーがジャンルアイコン画像をアップロードしたとき, the Storage Service shall ファイル形式（PNG/JPEG/GIF）とファイルサイズ（2MB以下）を検証し、Firebase Storageの一時フォルダ（`genres/temp/`）に保存する。
2. If アップロードされたファイルの形式がPNG/JPEG/GIF以外、またはファイルサイズが2MBを超えるとき, then the Storage Service shall アップロードを拒否し、適切なエラーメッセージを表示する。
3. When ユーザーがAIによるアイコン生成を実行したとき, the Storage Service shall 生成された画像バッファをFirebase Storageの一時フォルダ（`genres/temp/`）に保存し、公開URLを返却する。

### Requirement 2: ジャンルアイコンの正式移行
**Objective:** As a 管理者またはモデレーター, I want ジャンル申請の承認・可決、または直接登録時に一時画像を正式保存パスへ移行させたい, so that アイコン画像が恒久的に保護・表示される。

#### Acceptance Criteria
1. When 申請されたジャンルが承認・可決されたとき、または管理者がジャンルを直接登録したとき, the Storage Service shall 一時フォルダ（`genres/temp/`）にある画像ファイルを、正式な保存フォルダ（`genres/${genreId}/`）にコピーする。
2. When 正式な保存フォルダへのコピーが完了したとき, the Storage Service shall コピー元の画像ファイルを一時フォルダから削除し、正式な公開URLをジャンルデータに登録する。

### Requirement 3: ジャンルアイコンの配信と表示
**Objective:** As a 一般ユーザー, I want ジャンルのアイコン画像が正しく表示されること, so that 視覚的にジャンルを認識してクイズを探索できる。

#### Acceptance Criteria
1. The System shall 各ジャンルおよびジャンル申請情報の `iconImageUrl` フィールドに保存された Firebase Storage の直接公開 URL から画像を読み込んで表示する。
