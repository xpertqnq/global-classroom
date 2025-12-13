// Import from the exact paths defined in importmap
import * as firebaseApp from 'firebase/app';
import { 
  getAuth, 
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
const app = (firebaseApp as any).initializeApp(firebaseConfig);

let authInstance: Auth | null = null;

export const getAppAuth = (): Auth => {
  if (!authInstance) {
    authInstance = getAuth(app);
  }
  return authInstance;
};

// --- Auth Functions ---

// Google Login is now handled via Google Identity Services (GIS) in App.tsx
// This avoids iframe/popup blocking issues in environments like AI Studio.

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