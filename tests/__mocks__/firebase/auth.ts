/**
 * Firebase Auth モック
 */
export const getAuth = jest.fn(() => ({}));
export const signInWithPopup = jest.fn();
export const signOut = jest.fn();
export const GoogleAuthProvider = jest.fn(() => ({}));
export const TwitterAuthProvider = jest.fn(() => ({}));
export const OAuthProvider = jest.fn((providerId?: string) => ({
  addScope: jest.fn(),
  setCustomParameters: jest.fn(),
}));
export const createMicrosoftAuthProvider = jest.fn(() => new OAuthProvider('microsoft.com'));
