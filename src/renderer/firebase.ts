// ============================================
// Firebase Client SDK Configuration (Renderer)
// ============================================
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAQlnshZc7LfFWNTltYGY_SZ4QGk_B_APg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'multi-2a8d3.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'multi-2a8d3',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'multi-2a8d3.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '368161298580',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:368161298580:web:51556e71a37f11acb0fc81',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
