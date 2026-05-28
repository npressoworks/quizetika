/**
 * Firebase Firestore モック
 * 純粋関数テストでは Firestore の実際の呼び出しは不要なため、空のスタブを提供する
 */
export const doc = jest.fn();
export const getDoc = jest.fn();
export const setDoc = jest.fn();
export const updateDoc = jest.fn();
export const deleteDoc = jest.fn();
export const collection = jest.fn();
export const query = jest.fn();
export const where = jest.fn();
export const getDocs = jest.fn();
export const arrayUnion = jest.fn((...items: any[]) => items);
export const arrayRemove = jest.fn((...items: any[]) => items);
export const runTransaction = jest.fn();
export const getFirestore = jest.fn(() => ({}));
