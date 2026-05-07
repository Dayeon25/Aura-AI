import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration placeholder
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let app;
let databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;

// Use established pattern for Firebase initialization in Vite
if (!getApps().length) {
  if (!firebaseConfig.apiKey) {
    // If environment variables are missing, we try to load from the local config file
    // This is common in AI Studio dev environment
    try {
      // @ts-ignore - Dynamic import to handle missing file in external environments
      const localConfig = await import('../../firebase-applet-config.json');
      app = initializeApp(localConfig.default);
      databaseId = localConfig.default.firestoreDatabaseId;
    } catch (e) {
      console.warn("Firebase environment variables missing and local config not found. Auth may fail.");
      app = initializeApp(firebaseConfig); // Fallback to empty/env config
    }
  } else {
    app = initializeApp(firebaseConfig);
  }
} else {
  app = getApp();
}

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
