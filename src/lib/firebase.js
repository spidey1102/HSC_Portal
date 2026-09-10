import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error) {
    if (error.code === 'auth/popup-blocked') {
      try {
        return await signInWithRedirect(auth, googleProvider);
      } catch (redirectError) {
        console.warn("signInWithRedirect warning:", redirectError);
        throw redirectError;
      }
    }
    if (error.code === 'auth/unauthorized-domain' || error.code === 'auth/popup-closed-by-user') {
      console.warn("signInWithGoogle warning:", error.message || error.code);
    } else {
      console.error("signInWithGoogle error:", error);
    }
    throw error;
  }
};

export const logOut = () => signOut(auth);
export { onAuthStateChanged, getRedirectResult };

