import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserProfile } from '../types/user';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  /** Call once on app mount to listen for auth state changes */
  init: () => () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humaniseError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with that email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

async function fetchUserProfile(uid: string, fallbackUser?: FirebaseUser | null): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  const email = data.email ?? fallbackUser?.email ?? '';
  const displayName = data.displayName ?? fallbackUser?.displayName ?? '';
  const normalizedEmail = data.normalizedEmail ?? normaliseEmail(email);

  if ((data.email == null && email) || (data.displayName == null && displayName) || (data.normalizedEmail == null && normalizedEmail)) {
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName,
      normalizedEmail,
    }, { merge: true });
  }

  return {
    id: uid,
    email,
    normalizedEmail,
    displayName,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  error: null,

  clearError: () => set({ error: null }),

  init: () => {
    return onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await fetchUserProfile(fbUser.uid, fbUser);
        set({ firebaseUser: fbUser, user: profile, loading: false });
      } else {
        set({ firebaseUser: null, user: null, loading: false });
      }
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { user: fbUser } = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchUserProfile(fbUser.uid, fbUser);
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(fbUser, { displayName });
      const normalizedEmail = normaliseEmail(email);
      const profile: UserProfile = {
        id: fbUser.uid,
        email,
        normalizedEmail,
        displayName,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', fbUser.uid), {
        ...profile,
        createdAt: serverTimestamp(),
      });
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      await firebaseSignOut(auth);
      set({ user: null, firebaseUser: null, loading: false });
    } catch (err: any) {
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },
}));

