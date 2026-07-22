import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../providers/firebase-provider';
import { sendPasswordResetEmailNotification, sendWelcomeEmailNotification } from '../providers/email-service';
import type { UserProfile } from '../components/dto/user';
import type { TreeRole } from '../components/dto/tree';
import type { AppLanguage } from '../i18n';
import { CURRENT_APP_VERSION } from '../constants/app-metadata';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ emailRegistered: boolean }>;
  signOut: () => Promise<void>;
  setDefaultTreeId: (treeId: string | null) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePreferredLanguage: (language: AppLanguage) => Promise<void>;
  markAppVersionSeen: (version: string) => Promise<void>;
  markDiscoverabilityPromptSeen: () => Promise<void>;
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

function normaliseDisplayName(displayName: string) {
  return displayName
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function deriveUsername(email: string) {
  return email.split('@')[0]?.trim().toLowerCase() ?? '';
}

function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'en'
    || value === 'af'
    || value === 'zu'
    || value === 'xh'
    || value === 'nso'
    || value === 'st'
    || value === 'tn'
    || value === 'ts'
    || value === 'ss'
    || value === 've'
    || value === 'nr'
    || value === 'it'
    || value === 'es'
    || value === 'fr'
    || value === 'de'
    || value === 'pt';
}

function buildUserProfileDocument(user: Pick<FirebaseUser, 'uid' | 'email' | 'displayName'>, createdAt?: string) {
  const email = user.email ?? '';
  const displayName = user.displayName ?? '';

  return {
    id: user.uid,
    email,
    normalizedEmail: normaliseEmail(email),
    displayName,
    normalizedDisplayName: normaliseDisplayName(displayName),
    username: deriveUsername(email),
    lastSeenAppVersion: CURRENT_APP_VERSION,
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
  const normalizedDisplayName = data.normalizedDisplayName ?? normaliseDisplayName(displayName);
  const username = data.username ?? deriveUsername(email);

  if (
    (data.email == null && email)
    || (data.displayName == null && displayName)
    || (data.normalizedEmail == null && normalizedEmail)
    || (data.normalizedDisplayName == null && normalizedDisplayName)
    || (data.username == null && username)
  ) {
    await setDoc(userRef, {
      email,
      displayName,
      normalizedEmail,
      normalizedDisplayName,
      username,
    }, { merge: true });
  }

  return {
    id: fbUser.uid,
    email,
    normalizedEmail,
    displayName,
    normalizedDisplayName,
    username,
    defaultTreeId: typeof data.defaultTreeId === 'string' && data.defaultTreeId.trim() ? data.defaultTreeId.trim() : undefined,
    preferredLanguage: isAppLanguage(data.preferredLanguage) ? data.preferredLanguage : undefined,
    lastSeenAppVersion: typeof data.lastSeenAppVersion === 'string' && data.lastSeenAppVersion.trim()
      ? data.lastSeenAppVersion.trim()
      : undefined,
    discoverabilityPromptSeenAt: typeof data.discoverabilityPromptSeenAt === 'string' && data.discoverabilityPromptSeenAt.trim()
      ? data.discoverabilityPromptSeenAt.trim()
      : undefined,
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
    normalizedDisplayName: data.normalizedDisplayName ?? normaliseDisplayName(displayName),
    username: data.username ?? deriveUsername(email),
    defaultTreeId: typeof data.defaultTreeId === 'string' && data.defaultTreeId.trim() ? data.defaultTreeId.trim() : undefined,
    preferredLanguage: isAppLanguage(data.preferredLanguage) ? data.preferredLanguage : undefined,
    lastSeenAppVersion: typeof data.lastSeenAppVersion === 'string' && data.lastSeenAppVersion.trim()
      ? data.lastSeenAppVersion.trim()
      : undefined,
    discoverabilityPromptSeenAt: typeof data.discoverabilityPromptSeenAt === 'string' && data.discoverabilityPromptSeenAt.trim()
      ? data.discoverabilityPromptSeenAt.trim()
      : undefined,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt,
  };
}

function getTreeRoleForUser(data: Record<string, any>, userId: string): TreeRole | null {
  if (data.ownerId === userId) {
    return 'owner';
  }

  if (!Array.isArray(data.collaborators)) {
    return null;
  }

  const collaborator = data.collaborators.find((entry: any) => entry?.userId === userId && typeof entry?.role === 'string');
  return collaborator?.role ?? null;
}

async function findOtherLinkedTreeForUser(userId: string, excludedTreeId?: string | null) {
  const snapshot = await getDocs(query(collection(db, 'trees'), where('memberIds', 'array-contains', userId)));

  for (const treeSnapshot of snapshot.docs) {
    if (excludedTreeId && treeSnapshot.id === excludedTreeId) {
      continue;
    }

    const treeData = treeSnapshot.data() as Record<string, any>;
    const assignedPersonId = typeof treeData.personAssignments?.[userId] === 'string'
      ? treeData.personAssignments[userId].trim()
      : '';
    if (!assignedPersonId) {
      continue;
    }

    return {
      id: treeSnapshot.id,
      name: typeof treeData.name === 'string' && treeData.name.trim() ? treeData.name.trim() : 'your other family tree',
    };
  }

  return null;
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
      try {
        if (fbUser) {
          const profile = await fetchUserProfile(fbUser.uid, fbUser);
          set({ firebaseUser: fbUser, user: profile, loading: false });
        } else {
          set({ firebaseUser: null, user: null, loading: false });
        }
      } catch (err: any) {
        console.error('Auth state initialization failed', err);
        set({
          firebaseUser: fbUser ?? null,
          user: null,
          loading: false,
          error: humaniseError(err?.code ?? ''),
        });
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
      try {
        await sendWelcomeEmailNotification();
      } catch (notificationError) {
        console.warn('Welcome email request failed', notificationError);
      }
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  requestPasswordReset: async (email) => {
    set({ error: null });
    try {
      const result = await sendPasswordResetEmailNotification(email);
      return { emailRegistered: result.emailRegistered };
    } catch (err: any) {
      set({ error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  setDefaultTreeId: async (treeId) => {
    const currentUser = get().user;
    if (!currentUser) {
      return;
    }

    const trimmedTreeId = treeId?.trim();
    if (trimmedTreeId) {
      const otherLinkedTree = await findOtherLinkedTreeForUser(currentUser.id, trimmedTreeId);
      if (otherLinkedTree) {
        throw new Error(`Unlink your profile from "${otherLinkedTree.name}" before making another tree your default.`);
      }

      const treeSnapshot = await getDoc(doc(db, 'trees', trimmedTreeId));
      if (!treeSnapshot.exists()) {
        throw new Error('That family tree no longer exists.');
      }

      const treeData = treeSnapshot.data() as Record<string, any>;
      const role = getTreeRoleForUser(treeData, currentUser.id);
      if (!role) {
        throw new Error('You do not have access to that family tree.');
      }

      if (role === 'viewer') {
        throw new Error('Viewer trees cannot be set as your default tree.');
      }
    }

    await setDoc(doc(db, 'users', currentUser.id), {
      defaultTreeId: trimmedTreeId ? trimmedTreeId : deleteField(),
    }, { merge: true });

    set((state) => ({
      user: state.user
        ? {
          ...state.user,
          defaultTreeId: trimmedTreeId || undefined,
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
    await updateDoc(doc(db, 'users', user.id), {
      displayName: trimmed,
      normalizedDisplayName: normaliseDisplayName(trimmed),
    });

    set((state) => ({
      user: state.user ? { ...state.user, displayName: trimmed, normalizedDisplayName: normaliseDisplayName(trimmed) } : null,
    }));
  },

  updatePreferredLanguage: async (language) => {
    const { user } = get();
    if (!user) {
      return;
    }

    await setDoc(doc(db, 'users', user.id), {
      preferredLanguage: language,
    }, { merge: true });

    set((state) => ({
      user: state.user ? { ...state.user, preferredLanguage: language } : null,
    }));
  },

  markAppVersionSeen: async (version) => {
    const { user } = get();
    if (!user || !version.trim()) {
      return;
    }

    await setDoc(doc(db, 'users', user.id), {
      lastSeenAppVersion: version.trim(),
    }, { merge: true });

    set((state) => ({
      user: state.user ? { ...state.user, lastSeenAppVersion: version.trim() } : null,
    }));
  },

  markDiscoverabilityPromptSeen: async () => {
    const { user } = get();
    if (!user) {
      return;
    }

    const timestamp = new Date().toISOString();
    await setDoc(doc(db, 'users', user.id), {
      discoverabilityPromptSeenAt: timestamp,
    }, { merge: true });

    set((state) => ({
      user: state.user ? { ...state.user, discoverabilityPromptSeenAt: timestamp } : null,
    }));
  },
}));
