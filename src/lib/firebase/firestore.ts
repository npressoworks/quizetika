import {
  collection,
  CollectionReference,
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  SnapshotOptions,
} from 'firebase/firestore';
import { db } from './config';
import { User, Quiz, Follow, Bookmark, Question } from '@/types';

/**
 * 汎用 Firestore データコンバーター
 * - fromFirestore: Timestamp型を再帰的に JavaScript Date型に自動変換し、documentId を id プロパティにマッピングします。
 * - toFirestore: ドキュメント書き込み時に、型定義の 'id' プロパティを除去して保存します（IDはドキュメント名に格納されるため）。
 */
export const createConverter = <T extends DocumentData>(): FirestoreDataConverter<T> => ({
  toFirestore(data: T): DocumentData {
    // オブジェクトをシャローコピーし、ドキュメントデータから id を取り除く
    const { id, ...rest } = data as any;
    
    // 未定義値(undefined)を除去 (Firestoreはundefinedを許容しないため)
    const cleanObject = (obj: any): any => {
      if (obj === undefined) return null;
      if (Array.isArray(obj)) return obj.map(cleanObject);
      if (obj !== null && typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (val !== undefined) {
            result[key] = cleanObject(val);
          }
        }
        return result;
      }
      return obj;
    };
    
    return cleanObject(rest);
  },
  
  fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): T {
    const data = snapshot.data(options)!;
    
    // Firestore の Timestamp オブジェクトを再帰的に JavaScript の Date オブジェクトに変換する
    const convertTimestamps = (obj: any): any => {
      if (!obj) return obj;
      
      // Timestamp オブジェクトの検知 (toDateメソッドが存在するか)
      if (typeof obj.toDate === 'function') {
        return obj.toDate();
      }
      
      if (Array.isArray(obj)) {
        return obj.map(convertTimestamps);
      }
      
      if (typeof obj === 'object') {
        const result: any = {};
        for (const key of Object.keys(obj)) {
          result[key] = convertTimestamps(obj[key]);
        }
        return result;
      }
      
      return obj;
    };

    // ドキュメントIDを 'id' プロパティとして注入
    return {
      id: snapshot.id,
      ...convertTimestamps(data),
    } as T;
  },
});

/**
 * 指定したコレクションパスに対して withConverter を適用した型安全な参照を取得
 */
export const getCollectionRef = <T extends DocumentData>(
  collectionPath: string
): CollectionReference<T> => {
  return collection(db, collectionPath).withConverter(createConverter<T>());
};

// 各ドメインモデル用の型安全な Firestore コレクション参照
export const usersRef = getCollectionRef<User>('users');
export const quizzesRef = getCollectionRef<Quiz>('quizzes');
export const questionsRef = getCollectionRef<Question>('questions');
export const followsRef = getCollectionRef<Follow>('follows');
export const bookmarksRef = getCollectionRef<Bookmark>('bookmarks');
