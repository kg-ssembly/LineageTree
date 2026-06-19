import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { deleteField, doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../providers/firebase-provider';
import type { UserProfile } from '../components/dto/user';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDefaultTreeId: (treeId: string | null) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
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

function buildUserProfileDocument(user: Pick<FirebaseUser, 'uid' | 'email' | 'displayName'>, createdAt?: string) {
  const email = user.email ?? '';
  const displayName = user.displayName ?? '';

  return {
    id: user.uid,
    email,
    normalizedEmail: normaliseEmail(email),
    displayName,
    ...(createdAt ? { createdAt } : {}),
  };
}

async function ensureUserProfileDocument(fbUser: Pick<FirebaseUser, 'uid' | 'email' | 'displayName'>): Promise<UserProfile> {
  const userRef = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(userRef);
  const fallbackProfile: UserProfile = {
    ...buildUserProfileDocument(fbUser),
    createdAt: new Date().toISOString(),
  };

  if (!snap.exists()) {
    await setDoc(userRef, {
      ...buildUserProfileDocument(fbUser),
      createdAt: serverTimestamp(),
    }, { merge: true });

    return fallbackProfile;
  }

  const data = snap.data();
  const email = data.email ?? fallbackProfile.email;
  const displayName = data.displayName ?? fallbackProfile.displayName;
  const normalizedEmail = data.normalizedEmail ?? normaliseEmail(email);

  if ((data.email == null && email) || (data.displayName == null && displayName) || (data.normalizedEmail == null && normalizedEmail)) {
    await setDoc(userRef, {
      email,
      displayName,
      normalizedEmail,
    }, { merge: true });
  }

  return {
    id: fbUser.uid,
    email,
    normalizedEmail,
    displayName,
    defaultTreeId: typeof data.defaultTreeId === 'string' && data.defaultTreeId.trim() ? data.defaultTreeId.trim() : undefined,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? fallbackProfile.createdAt,
  };
}

async function fetchUserProfile(uid: string, fallbackUser?: FirebaseUser | null): Promise<UserProfile | null> {
  if (fallbackUser && fallbackUser.uid === uid) {
    return ensureUserProfileDocument(fallbackUser);
  }

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  const email = data.email ?? '';
  const displayName = data.displayName ?? '';

  return {
    id: uid,
    email,
    normalizedEmail: data.normalizedEmail ?? normaliseEmail(email),
    displayName,
    defaultTreeId: typeof data.defaultTreeId === 'string' && data.defaultTreeId.trim() ? data.defaultTreeId.trim() : undefined,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
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
      const profile = await ensureUserProfileDocument({
        uid: fbUser.uid,
        displayName,
        email,
      });
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  setDefaultTreeId: async (treeId) => {
    const currentUser = get().user;
    if (!currentUser) {
      return;
    }

    await setDoc(doc(db, 'users', currentUser.id), {
      defaultTreeId: treeId ? treeId.trim() : deleteField(),
    }, { merge: true });

    set((state) => ({
      user: state.user
        ? {
          ...state.user,
          defaultTreeId: treeId ? treeId.trim() : undefined,
        }
        : null,
    }));
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

  updateDisplayName: async (displayName: string) => {
    const { firebaseUser, user } = get();
    if (!firebaseUser || !user) {
      return;
    }

    const trimmed = displayName.trim();
    if (!trimmed) {
      return;
    }

    await updateProfile(firebaseUser, { displayName: trimmed });
    await updateDoc(doc(db, 'users', user.id), { displayName: trimmed });

    set((state) => ({
      user: state.user ? { ...state.user, displayName: trimmed } : null,
    }));
  },
}));

