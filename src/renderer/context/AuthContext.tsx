// ============================================
// Auth Context (Firebase Authentication State)
// ============================================
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface AuthState {
  user: User | null;
  isPremium: boolean;
  tier: 'free' | 'premium';
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isPremium: false,
    tier: 'free',
    loading: true,
    error: null,
  });

  // Fetch user tier from Firestore
  const fetchUserTier = useCallback(async (user: User): Promise<'free' | 'premium'> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return data.tier === 'premium' ? 'premium' : 'free';
      }
      // New user → create default document
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        tier: 'free',
        created_at: Date.now(),
        profiles_count: 0,
      });
      return 'free';
    } catch (err) {
      console.error('[Auth] Failed to fetch user tier:', err);
      return 'free';
    }
  }, []);

  // Send verified token to main process for server-side enforcement
  const syncTokenToMain = useCallback(async (user: User) => {
    try {
      const idToken = await user.getIdToken();
      await window.electronAPI.auth.verifyToken(idToken);
    } catch (err) {
      console.error('[Auth] Failed to sync token to main process:', err);
    }
  }, []);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const tier = await fetchUserTier(user);
        await syncTokenToMain(user);
        setState({
          user,
          isPremium: tier === 'premium',
          tier,
          loading: false,
          error: null,
        });
      } else {
        setState({
          user: null,
          isPremium: false,
          tier: 'free',
          loading: false,
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, [fetchUserTier, syncTokenToMain]);

  const login = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = getFirebaseErrorMessage(err.code);
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  };

  const register = async (email: string, password: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = getFirebaseErrorMessage(err.code);
      setState(prev => ({ ...prev, loading: false, error: message }));
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await window.electronAPI.auth.logout();
    } catch (err: any) {
      console.error('[Auth] Logout error:', err);
    }
  };

  const clearError = () => {
    setState(prev => ({ ...prev, error: null }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'Email sudah terdaftar.';
    case 'auth/invalid-email': return 'Format email tidak valid.';
    case 'auth/weak-password': return 'Password terlalu lemah (min 6 karakter).';
    case 'auth/user-not-found': return 'Akun tidak ditemukan.';
    case 'auth/wrong-password': return 'Password salah.';
    case 'auth/too-many-requests': return 'Terlalu banyak percobaan. Coba lagi nanti.';
    case 'auth/invalid-credential': return 'Email atau password salah.';
    default: return 'Terjadi kesalahan. Silakan coba lagi.';
  }
}

export default AuthContext;
