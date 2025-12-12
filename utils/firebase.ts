// Import from the exact paths defined in importmap
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut,
  signInAnonymously,
  Auth
} from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGsYx0VAqEuNdY9SrHgj9WvX3nXqUZrYc",
  authDomain: "global-classroom-b4322.firebaseapp.com",
  projectId: "global-classroom-b4322",
  storageBucket: "global-classroom-b4322.firebasestorage.app",
  messagingSenderId: "322060753872",
  appId: "1:322060753872:web:4356b6646ccc324f15f7d5",
  measurementId: "G-4WPH84VZ32"
};

// Initialize Firebase App
// gstatic guarantees that imports share the same instance
const app = initializeApp(firebaseConfig);

// Initialize Auth Lazily to be safe
let authInstance: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

export const getAppAuth = (): Auth => {
  if (!authInstance) {
    // getAuth(app) should work if the 'auth' component is registered.
    // gstatic handles this registration via side-effects in the imported module.
    authInstance = getAuth(app);
  }
  return authInstance;
};

const getGoogleProvider = (): GoogleAuthProvider => {
  if (!googleProvider) {
    googleProvider = new GoogleAuthProvider();
    googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
    googleProvider.addScope('https://www.googleapis.com/auth/documents');
    googleProvider.addScope('https://www.googleapis.com/auth/classroom.coursework.students');
  }
  return googleProvider;
};

// --- Auth Functions ---
export const signInWithGoogle = async (): Promise<string | null> => {
  try {
    const auth = getAppAuth();
    const provider = getGoogleProvider();
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken || null;
  } catch (error) {
    console.error("Login failed", error);
    return null;
  }
};

export const signInAsGuest = async () => {
  try {
    const auth = getAppAuth();
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Guest login failed:", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    const auth = getAppAuth();
    await signOut(auth);
  } catch (error) {
    console.error("Logout failed", error);
  }
};

export default app;