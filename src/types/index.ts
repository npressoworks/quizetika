/**
 * クイズ投稿SNS「quizeum」共通型定義
 */

// 1. ユーザー情報 (Users)
export interface User {
  id: string;             // Firebase Auth の uid
  email: string;
  displayName: string;
  avatarUrl: string;
  bio: string;            // 自己紹介
  followedGenres: string[]; // フォロー中のジャンル名の配列
  createdAt: Date;
  updatedAt: Date;
}

// 2. 選択肢 (Choice)
export interface Choice {
  id: string;             // 選択肢ID (UUIDまたは連番)
  choiceText: string;
  isCorrect: boolean;     // 正解フラグ
}

// 3. 問題 (Question)
export interface Question {
  id: string;             // 問題ID (UUIDまたは連番)
  questionText: string;
  explanation: string;    // 正解後の解説
  choices: Choice[];      // 選択肢リスト
}

// 4. クイズ (Quiz)
export interface Quiz {
  id: string;             // クイズID (FirestoreドキュメントID)
  authorId: string;       // 作成者のユーザーID
  authorName: string;     // 作成者の表示名 (非正規化)
  authorAvatar: string;   // 作成者のアバターURL (非正規化)
  title: string;
  description: string;
  thumbnailUrl: string;
  difficulty: 'easy' | 'medium' | 'hard';
  genre: string;          // ジャンル (例: 'programming', 'history' など)
  tags: string[];         // タグの配列 (例: ['React', '歴史'])
  questions: Question[];  // 問題の配列 (ドキュメントに内包)
  isPublished: boolean;   // 公開フラグ
  playCount: number;      // 挑戦回数
  bookmarksCount: number; // ブックマークされている数
  createdAt: Date;
  updatedAt: Date;
}

// 5. 問題集 (QuizList)
export interface QuizList {
  id: string;             // 問題集ID (FirestoreドキュメントID)
  authorId: string;       // 作成者のユーザーID
  authorName: string;     // 作成者の表示名 (非正規化)
  authorAvatar: string;   // 作成者のアバターURL (非正規化)
  title: string;
  description: string;
  quizIds: string[];      // 含まれるクイズIDの配列
  isPublished: boolean;   // 公開フラグ
  bookmarksCount: number; // ブックマークされている数
  createdAt: Date;
  updatedAt: Date;
}

// 6. フォロー関係 (Follow)
export interface Follow {
  id: string;             // followerId_followingId の形式
  followerId: string;     // フォローした側 (ログイン中ユーザー)
  followingId: string;    // フォローされた側 (ターゲット)
  createdAt: Date;
}

// 7. ブックマーク (Bookmark)
export interface Bookmark {
  id: string;             // userId_targetId の形式
  userId: string;         // ブックマークしたユーザー
  targetId: string;       // クイズID または リストID
  targetType: 'quiz' | 'list'; // 対象のタイプ
  createdAt: Date;
}

// クイズ挑戦結果 (APIやローカル再生の記録用)
export interface Attempt {
  id?: string;
  userId: string;
  quizId: string;
  score: number;          // 正解数
  totalQuestions: number; // 全問題数
  completedAt: Date;
}
