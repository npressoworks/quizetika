# Requirements Document: quizeum-auth-profile-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」におけるユーザー認証、プロフィール管理、ソーシャル連携、および通知機能のフロントエンドUI要件を定義します。本機能はユーザーが快適にプロフィールを構築し、他のユーザーと繋がり、アクティビティ通知を受け取るための基本UIを提供します。

## Boundary Context
- **In scope**:
  - Google認証によるログイン・新規登録UIおよびログイン状態による動的リダイレクト処理。
  - 称号バッジ一覧、信頼スコア、権限ティアー表示を統合したプロフィール画面。
  - 表示名（最大30文字）および自己紹介（最大200文字）の編集フォーム。
  - フォロー・フォロワー一覧およびダイレクトフォロートグルUI。
  - 時系列順のアクティビティ通知一覧表示。
  - 退会処理中アカウントへのアクセスブロックと404フォールバック。
- **Out of scope**:
  - 退会処理の裏側のFirestoreデータ匿名化クレンジング処理（`quizeum-core`が担当）。
  - クイズのプレイや作成画面UI（後続スペックが担当）。

## Requirements

### Requirement 1: ユーザー認証画面 (/login)
**Objective:** As a Guest User, I want to authenticate via Google, so that I can securely log in and customize my quizeum experience.

#### Acceptance Criteria
1. When the guest user clicks the Google Sign-In button on the Authentication Screen, the User Authentication System shall trigger the Google OAuth popup window using Firebase Auth.
2. If the user successfully completes Google Authentication, then the User Authentication System shall redirect the user to the redirect source page or the Home Screen (`/`).
3. While the user is already authenticated, when they attempt to directly access the Authentication Screen (`/login`), the User Authentication System shall automatically redirect them to the Home Screen (`/`).

### Requirement 2: プロフィール画面 (/profile/[uid])
**Objective:** As a Quizeum User, I want to view user profiles, so that I can see their stats, achievements, created content, and manage connections.

#### Acceptance Criteria
1. The Profile Screen shall display the target user's avatar, display name, biography, reputation score, moderation tier badge, and list of awarded badges.
2. The Profile Screen shall display two tab panels: "作成したクイズ" and "作成したリスト".
3. When the authenticated user views another user's profile, the Profile Screen shall display a Follow / Unfollow toggle button.
4. When the authenticated user clicks the Follow / Unfollow button, the Profile Screen shall atomically toggle the connection state via `UserService.followUser` and update the follower count display.
5. If the target profile has the deleteStatus set to 'delete_pending', then the Profile Screen shall block access, displaying a 404 page instead of the private profile.

### Requirement 3: プロフィール編集画面 (/profile/edit)
**Objective:** As an Authenticated User, I want to edit my profile details, so that I can update my public identity on quizeum.

#### Acceptance Criteria
1. The Profile Edit Screen shall display an edit form containing fields for the user's display name and biography.
2. When the user enters their display name and biography, the Profile Edit Screen shall enforce validation limits (display name maximum 30 characters, biography maximum 200 characters).
3. When the user clicks the "保存する" button with valid inputs, the Profile Edit Screen shall invoke `UserService.updateProfile` and redirect the user back to their Profile Screen.

### Requirement 4: フォロー/フォロワー一覧画面 (/profile/[uid]/connections)
**Objective:** As a Quizeum User, I want to view follow connections, so that I can discover users and manage my social network.

#### Acceptance Criteria
1. The Connections Screen shall display a tabbed list allowing users to toggle between "フォロー中 (Following)" and "フォロワー (Followers)".
2. Each user card in the list shall display the user's avatar, display name, biography, and a Follow/Unfollow toggle button (except for the logged-in user themselves).

### Requirement 5: 通知一覧画面 (/notifications)
**Objective:** As a Quizeum User, I want to view my activity notifications, so that I can stay updated on social interactions and corrections.

#### Acceptance Criteria
1. The Notifications Screen shall display a chronological list of activities, including "followed by someone" and "quiz issues fixed by creators".
2. When the user clicks a "quiz issues fixed" notification card, the Notifications Screen shall redirect the user to the corresponding Quiz Detail Screen.

### Requirement 6: リアクション履歴画面 (/profile/[uid]/likes)
**Objective:** As a Quizeum User, I want to view reaction history, so that I can see the positive feedback I've sent or received.

#### Acceptance Criteria
1. The Likes History Screen shall display two tabs: "送ったリアクション" and "受け取ったリアクション".
2. Each reaction card shall display the related quiz title and click-to-navigate to the corresponding Quiz Detail Screen.
