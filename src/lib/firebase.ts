import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Try to load from environment variables first, then fallback to local config file
// This ensures portability between AI Studio and external environments like Vercel/GitHub
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Fallback logic for AI Studio environment
let finalConfig = firebaseConfig;
let databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

if (!firebaseConfig.apiKey) {
  try {
    // @ts-ignore - Dynamic import to handle missing file in external environments
    const localConfig = await import('../../firebase-applet-config.json');
    finalConfig = localConfig.default;
    databaseId = localConfig.default.firestoreDatabaseId;
  } catch (e) {
    console.error("Firebase config missing. Please set environment variables.");
  }
}

const app = initializeApp(finalConfig);
export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
