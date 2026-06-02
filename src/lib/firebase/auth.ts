import { 
  signInWithPopup,
  GoogleAuthProvider,
  TwitterAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';

/** Firebase Microsoft プロバイダ（Azure AD / 職場・学校アカウント対応） */
export function createMicrosoftAuthProvider(): OAuthProvider {
  const provider = new OAuthProvider('microsoft.com');
  provider.addScope('email');
  provider.addScope('profile');
  const tenantId = process.env.NEXT_PUBLIC_AZURE_AD_TENANT_ID;
  if (tenantId) {
    provider.setCustomParameters({ tenant: tenantId });
  }
  return provider;
}

export {
  signInWithPopup,
  GoogleAuthProvider,
  TwitterAuthProvider,
  OAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};
export type { FirebaseUser, Auth };
