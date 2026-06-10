/**
 * Firestore コレクション参照モック (src/lib/firebase/firestore.ts の代替)
 */
export const usersRef = {};
export const quizzesRef = {};
export const followsRef = {};
export const bookmarksRef = {};
export const getCollectionRef = jest.fn(() => ({}));
export const createConverter = jest.fn(() => ({}));
