import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  linkWithPopup,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  unlink,
  reload,
  sendEmailVerification,
  updatePassword,
  EmailAuthProvider,
  PhoneAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  type ConfirmationResult,
  isSignInWithEmailLink,
  GoogleAuthProvider,
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
import { sendMagicLinkEmailNotification, sendPasswordResetEmailNotification, sendWelcomeEmailNotification } from '../providers/email-service';
import type { UserProfile } from '../components/dto/user';
import type { KinshipSystem, TreeRole } from '../components/dto/tree';
import type { AppLanguage } from '../i18n';
import { accountError, accountSecurityErrorMessage, assertSameAccount, assertRecentAuthentication, assertPhoneChallenge, assertRemovableProvider, normalizeAccountPhone, type AccountPhoneChallenge } from '../providers/account-security';
import { CURRENT_APP_VERSION } from '../constants/app-metadata';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  error: string | null;
  accountBusy: boolean;
  accountError: string | null;
  accountNotice: string | null;
  accountRevision: number;
  clearAccountFeedback: () => void;
  cancelAccountPhoneCode: () => void;
  reauthenticatePassword: (password: string) => Promise<void>;
  reauthenticateGoogle: () => Promise<void>;
  sendPhoneReauthCode: () => Promise<void>;
  verifyPhoneReauthCode: (code: string) => Promise<void>;
  removeSignInMethod: (providerId: string) => Promise<void>;
  refreshSignInMethods: () => Promise<void>;
  verifyAccountEmail: () => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;
  sendMagicLink: (email: string) => Promise<void>;
  completeMagicLink: (email: string, link?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  linkGoogle: () => Promise<void>;
  linkEmailPassword: (email: string, password: string) => Promise<void>;
  sendPhoneLinkCode: (phoneNumber: string) => Promise<void>;
  verifyPhoneLinkCode: (code: string) => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<void>;
  verifyPhoneCode: (code: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ emailRegistered: boolean }>;
  signOut: () => Promise<void>;
  setDefaultTreeId: (treeId: string | null) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePreferredLanguage: (language: AppLanguage) => Promise<void>;
  updatePreferredKinshipSystem: (kinshipSystem: KinshipSystem) => Promise<void>;
  markAppVersionSeen: (version: string) => Promise<void>;
  markDiscoverabilityPromptSeen: () => Promise<void>;
  clearError: () => void;
  /** Call once on app mount to listen for auth state changes */
  init: () => () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humaniseError(code: string): string {
  const securityMessage = accountSecurityErrorMessage({ code });
  if (securityMessage) return securityMessage;
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
    case 'auth/argument-error':
      return 'The Google sign-in configuration is invalid. Refresh the page and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in window. Please allow pop-ups and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another Google sign-in window is already open.';
    case 'auth/provider-already-linked':
      return 'That sign-in method is already connected to this profile.';
    case 'auth/credential-already-in-use':
      return 'That sign-in method belongs to another profile. Sign into that profile first to connect it.';
    case 'auth/account-exists-with-different-credential':
      return 'This sign-in method is already registered. Sign in with your original method, then connect this one from Sign-in methods in your profile.';
    case 'auth/requires-recent-login':
      return 'For your security, sign in again before changing sign-in methods.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase yet.';
    case 'auth/unauthorized-domain':
      return 'This website is not authorized for sign-in. Add its domain in Firebase Authentication settings.';
    case 'auth/invalid-phone-number':
      return 'Enter a valid phone number.';
    case 'auth/code-expired':
      return 'That verification code has expired. Request a new code.';
    case 'auth/invalid-verification-code':
      return 'That verification code is incorrect.';
    case 'auth/missing-phone-number':
      return 'Enter your phone number first.';
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
      return 'The sign-in link destination is not configured correctly.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'That sign-in link is invalid or has expired. Request a new one.';
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

let phoneConfirmationResult: ConfirmationResult | null = null;
let accountPhoneChallenge: AccountPhoneChallenge | null = null;
let accountRecaptchaVerifier: RecaptchaVerifier | null = null;
let accountPhoneGeneration = 0;

function clearAccountPhoneChallenge() {
  accountPhoneGeneration += 1;
  accountPhoneChallenge = null;
  accountRecaptchaVerifier?.clear();
  accountRecaptchaVerifier = null;
}

async function runAccountAction(action: (user: FirebaseUser) => Promise<string | void>, requireRecent = true) {
  const state = useAuthStore.getState();
  if (state.accountBusy) throw accountError('account/busy');
  useAuthStore.setState({ accountBusy: true, accountError: null, accountNotice: null });
  const currentUser = auth.currentUser;
  try {
    if (!currentUser || state.user?.id !== currentUser.uid) throw accountError('account/session-changed');
    if (requireRecent) {
      const token = await currentUser.getIdTokenResult();
      assertRecentAuthentication(token.claims.auth_time);
    }
    assertSameAccount(currentUser.uid, auth.currentUser?.uid);
    const notice = await action(currentUser);
    assertSameAccount(currentUser.uid, auth.currentUser?.uid);
    let refreshFailed = false;
    try {
      await reload(currentUser);
    } catch (error) {
      // A completed provider change must not be reported as a failed link just
      // because the subsequent refresh went offline. Do not repeat the mutation.
      if (!notice) throw error;
      refreshFailed = true;
    }
    assertSameAccount(currentUser.uid, auth.currentUser?.uid);
    useAuthStore.setState((latest) => ({
      firebaseUser: currentUser, accountRevision: latest.accountRevision + 1,
      accountNotice: refreshFailed ? 'Your sign-in change was saved. Refresh sign-in methods to check the latest status.' : notice || null,
    }));
  } catch (error: unknown) {
    if (auth.currentUser?.uid === currentUser?.uid) {
      useAuthStore.setState({ accountError: humaniseError((error as { code?: string }).code ?? '') });
    }
    throw error;
  } finally {
    useAuthStore.setState({ accountBusy: false });
  }
}

async function requestAccountPhoneCode(user: FirebaseUser, phone: string, purpose: AccountPhoneChallenge['purpose']) {
  if (typeof document === 'undefined') throw accountError('account/web-only');
  clearAccountPhoneChallenge();
  const generation = accountPhoneGeneration;
  const anchor = document.getElementById('account-phone-recaptcha');
  if (!anchor) throw accountError('account/web-only');
  accountRecaptchaVerifier = new RecaptchaVerifier(auth, anchor, { size: 'invisible' });
  try {
    const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber(normalizeAccountPhone(phone), accountRecaptchaVerifier);
    assertSameAccount(user.uid, auth.currentUser?.uid);
    if (generation !== accountPhoneGeneration) throw accountError('auth/code-expired');
    accountPhoneChallenge = { uid: user.uid, verificationId, purpose, expiresAt: Date.now() + 5 * 60_000 };
  } finally {
    accountRecaptchaVerifier?.clear();
    accountRecaptchaVerifier = null;
  }
}

function accountPhoneCredential(user: FirebaseUser, code: string, purpose: AccountPhoneChallenge['purpose']) {
  assertPhoneChallenge(accountPhoneChallenge, user.uid, purpose);
  if (!/^\d{6}$/.test(code.trim())) throw accountError('auth/invalid-verification-code');
  return PhoneAuthProvider.credential(accountPhoneChallenge.verificationId, code.trim());
}
let phoneRecaptchaVerifier: RecaptchaVerifier | null = null;

function isKinshipSystem(value: unknown): value is KinshipSystem {
  return value === 'auto' || value === 'generic' || value === 'northern-sotho'
    || value === 'nso' || value === 'ss' || value === 'st' || value === 'tn'
    || value === 'ts' || value === 've' || value === 'zu';
}

function buildUserProfileDocument(user: Pick<FirebaseUser, 'uid' | 'email' | 'displayName'> & { photoURL?: string | null }, createdAt?: string) {
  const email = user.email ?? '';
  const displayName = user.displayName ?? '';

  return {
    id: user.uid,
    email,
    normalizedEmail: normaliseEmail(email),
    displayName,
    ...(user.photoURL ? { photoUrl: user.photoURL } : {}),
    normalizedDisplayName: normaliseDisplayName(displayName),
    username: deriveUsername(email),
    lastSeenAppVersion: CURRENT_APP_VERSION,
    ...(createdAt ? { createdAt } : {}),
  };
}

async function ensureUserProfileDocument(fbUser: Pick<FirebaseUser, 'uid' | 'email' | 'displayName'> & { photoURL?: string | null }): Promise<UserProfile> {
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
  const email = data.email || fallbackProfile.email;
  const displayName = data.displayName ?? fallbackProfile.displayName;
  const normalizedEmail = data.normalizedEmail || normaliseEmail(email);
  const normalizedDisplayName = data.normalizedDisplayName ?? normaliseDisplayName(displayName);
  const username = data.username || deriveUsername(email);
  const photoUrl = data.photoUrl ?? fallbackProfile.photoUrl;

  if (
    (!data.email && email)
    || (data.displayName == null && displayName)
    || (!data.normalizedEmail && normalizedEmail)
    || (data.normalizedDisplayName == null && normalizedDisplayName)
    || (!data.username && username)
    || (data.photoUrl == null && photoUrl)
  ) {
    await setDoc(userRef, {
      email,
      displayName,
      normalizedEmail,
      normalizedDisplayName,
      username,
      ...(photoUrl ? { photoUrl } : {}),
    }, { merge: true });
  }

  return {
    id: fbUser.uid,
    email,
    normalizedEmail,
    displayName,
    normalizedDisplayName,
    username,
    photoUrl: typeof photoUrl === 'string' && photoUrl.trim() ? photoUrl.trim() : undefined,
    defaultTreeId: typeof data.defaultTreeId === 'string' && data.defaultTreeId.trim() ? data.defaultTreeId.trim() : undefined,
    preferredLanguage: isAppLanguage(data.preferredLanguage) ? data.preferredLanguage : undefined,
    preferredKinshipSystem: isKinshipSystem(data.preferredKinshipSystem) ? data.preferredKinshipSystem : undefined,
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
    try {
      const profile = await ensureUserProfileDocument(fallbackUser);
      await AsyncStorage.setItem(`profile-cache:${uid}`, JSON.stringify(profile)).catch(() => {});
      return profile;
    } catch (error) {
      if ((error as { code?: string }).code !== 'unavailable') throw error;
      const cached = await AsyncStorage.getItem(`profile-cache:${uid}`);
      const profile = cached ? JSON.parse(cached) as UserProfile : null;
      if (profile?.id === uid) return profile;
      throw error;
    }
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
    preferredKinshipSystem: isKinshipSystem(data.preferredKinshipSystem) ? data.preferredKinshipSystem : undefined,
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
  accountBusy: false,
  accountError: null,
  accountNotice: null,
  accountRevision: 0,
  clearAccountFeedback: () => set({ accountError: null, accountNotice: null }),
  cancelAccountPhoneCode: clearAccountPhoneChallenge,

  clearError: () => set({ error: null }),

  init: () => {
    const startupEmailLink = typeof window !== 'undefined'
      && isSignInWithEmailLink(auth, window.location.href)
      ? window.location.href
      : null;
    const startupEmail = typeof window !== 'undefined'
      ? window.localStorage.getItem('lineagetree.emailForSignIn')
      : null;
    let startupMagicLinkPending = Boolean(startupEmailLink && startupEmail);

    if (
      typeof window !== 'undefined'
      && startupEmailLink
      && startupEmail
    ) {
      void get().completeMagicLink(startupEmail, startupEmailLink)
        .catch(() => {})
        .finally(() => {
          startupMagicLinkPending = false;
          if (!get().firebaseUser) set({ loading: false });
        });
    }

    return onAuthStateChanged(auth, async (fbUser) => {
      if (startupMagicLinkPending) return;
      if (fbUser?.uid !== get().firebaseUser?.uid) {
        clearAccountPhoneChallenge();
        set({ accountError: null, accountNotice: null });
      }
      try {
        if (fbUser) {
          const profile = await fetchUserProfile(fbUser.uid, fbUser);
          if (auth.currentUser?.uid !== fbUser.uid) return;
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
      const userId = get().user?.id;
      clearAccountPhoneChallenge();
      phoneConfirmationResult = null;
      phoneRecaptchaVerifier?.clear();
      phoneRecaptchaVerifier = null;
      await firebaseSignOut(auth);
      if (userId) {
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys.filter((key) => key.startsWith(`person-draft:v1:${userId}:`) || key === `profile-cache:${userId}`));
      }
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

  sendMagicLink: async (email) => {
    set({ loading: true, error: null });
    try {
      if (typeof window === 'undefined') throw new Error('Magic links are available on web only.');
      const normalizedEmail = normaliseEmail(email);
      await sendMagicLinkEmailNotification(normalizedEmail);
      window.localStorage.setItem('lineagetree.emailForSignIn', normalizedEmail);
      set({ loading: false });
    } catch (err: any) {
      console.error('Magic-link email failed', err?.code, err?.message);
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  completeMagicLink: async (email, link) => {
    set({ loading: true, error: null });
    try {
      if (typeof window === 'undefined') throw new Error('Magic links are available on web only.');
      const emailLink = link ?? window.location.href;
      if (!isSignInWithEmailLink(auth, emailLink)) throw new Error('That is not a valid sign-in link.');
      const { user: fbUser } = await signInWithEmailLink(auth, normaliseEmail(email), emailLink);
      window.localStorage.removeItem('lineagetree.emailForSignIn');
      const profile = await fetchUserProfile(fbUser.uid, fbUser);
      window.history.replaceState({}, document.title, `${window.location.origin}/`);
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      console.error('Magic-link completion failed', err?.code, err?.message);
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      if (typeof window === 'undefined') throw new Error('Google sign-in is available on web only.');
      const provider = new GoogleAuthProvider();
      provider.addScope('profile');
      const { user: fbUser } = await signInWithPopup(auth, provider);
      const profile = await fetchUserProfile(fbUser.uid, fbUser);
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      console.error('Google sign-in failed', err?.code, err?.message);
      set({ loading: false, error: humaniseError(err.code ?? '') });
      throw err;
    }
  },

  linkGoogle: () => runAccountAction(async (currentUser) => {
    if (typeof document === 'undefined') throw accountError('account/web-only');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await linkWithPopup(currentUser, provider);
    return 'Google is connected to this profile.';
  }),

  linkEmailPassword: (email, password) => runAccountAction(async (currentUser) => {
    const normalizedEmail = normaliseEmail(email);
    if (currentUser.email && normaliseEmail(currentUser.email) !== normalizedEmail) throw accountError('account/email-change');
    // This SDK uses accounts:signUp with the current ID token, supporting
    // email enumeration protection without looking up sign-in methods.
    if (currentUser.providerData.some(provider => provider.providerId === 'password')) {
      // Email-link users have the same provider ID, even without a password.
      await updatePassword(currentUser, password);
    } else {
      await linkWithCredential(currentUser, EmailAuthProvider.credential(normalizedEmail, password));
    }
    assertSameAccount(currentUser.uid, auth.currentUser?.uid);
    if (!get().user?.email) {
      try {
        const profile = await fetchUserProfile(currentUser.uid, currentUser);
        assertSameAccount(currentUser.uid, auth.currentUser?.uid);
        set({ user: profile });
      } catch {
        // Authentication linking has succeeded. The profile's empty contact
        // fields will be repaired by ensureUserProfileDocument on the next login.
        return 'Email and password connected. Sign in again to refresh your profile contact details.';
      }
    }
    if (!currentUser.emailVerified) {
      try {
        await sendEmailVerification(currentUser);
        return 'Email and password connected. Check your inbox to verify your email.';
      } catch {
        return 'Email and password connected. Use Send verification email to verify your address.';
      }
    }
    return 'Email and password are connected to this profile.';
  }),

  sendPhoneLinkCode: (phoneNumber) => runAccountAction(async (user) => {
    await requestAccountPhoneCode(user, phoneNumber, 'link');
  }),

  verifyPhoneLinkCode: (code) => runAccountAction(async (user) => {
    await linkWithCredential(user, accountPhoneCredential(user, code, 'link'));
    clearAccountPhoneChallenge();
    return 'Phone number is connected to this profile.';
  }),

  reauthenticatePassword: (password) => runAccountAction(async (user) => {
    if (!password) throw accountError('auth/missing-password');
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', password));
  }, false),

  reauthenticateGoogle: () => runAccountAction(async (user) => {
    if (typeof document === 'undefined') throw accountError('account/web-only');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account', login_hint: user.providerData.find(p => p.providerId === 'google.com')?.email ?? '' });
    await reauthenticateWithPopup(user, provider);
  }, false),

  sendPhoneReauthCode: () => runAccountAction(async (user) => {
    await requestAccountPhoneCode(user, user.phoneNumber ?? '', 'reauthenticate');
  }, false),

  verifyPhoneReauthCode: (code) => runAccountAction(async (user) => {
    await reauthenticateWithCredential(user, accountPhoneCredential(user, code, 'reauthenticate'));
    clearAccountPhoneChallenge();
  }, false),

  removeSignInMethod: (providerId) => runAccountAction(async (user) => {
    await reload(user);
    assertSameAccount(user.uid, auth.currentUser?.uid);
    assertRemovableProvider(user.providerData.map(provider => provider.providerId), providerId);
    await unlink(user, providerId);
    return 'Sign-in method removed. Use a remaining connected method next time.';
  }),

  refreshSignInMethods: () => runAccountAction(async () => {}, false),
  verifyAccountEmail: () => runAccountAction(async (user) => {
    await sendEmailVerification(user);
    return 'Verification email sent. Check your inbox, then refresh your sign-in methods.';
  }, false),

  sendPhoneCode: async (phoneNumber) => {
    set({ loading: true, error: null });
    try {
      if (typeof window === 'undefined') throw new Error('Phone sign-in is available on web only.');
      const anchor = document.getElementById('phone-recaptcha-anchor');
      if (!anchor) throw new Error('Phone sign-in could not initialise. Refresh the page and try again.');
      phoneRecaptchaVerifier?.clear();
      phoneRecaptchaVerifier = new RecaptchaVerifier(auth, anchor, { size: 'invisible' });
      phoneConfirmationResult = await signInWithPhoneNumber(auth, phoneNumber.trim(), phoneRecaptchaVerifier);
      set({ loading: false });
    } catch (err: any) {
      phoneConfirmationResult = null;
      phoneRecaptchaVerifier?.clear();
      phoneRecaptchaVerifier = null;
      console.error('Phone sign-in code failed', err?.code, err?.message);
      set({ loading: false, error: humaniseError(err?.code ?? '') });
      throw err;
    }
  },

  verifyPhoneCode: async (code) => {
    set({ loading: true, error: null });
    try {
      if (!phoneConfirmationResult) throw new Error('Request a verification code first.');
      const { user: fbUser } = await phoneConfirmationResult.confirm(code.trim());
      phoneConfirmationResult = null;
      phoneRecaptchaVerifier?.clear();
      phoneRecaptchaVerifier = null;
      const profile = await fetchUserProfile(fbUser.uid, fbUser);
      set({ firebaseUser: fbUser, user: profile, loading: false });
    } catch (err: any) {
      console.error('Phone sign-in verification failed', err?.code, err?.message);
      set({ loading: false, error: humaniseError(err?.code ?? '') });
      throw err;
    }
  },

  updatePreferredKinshipSystem: async (kinshipSystem) => {
    const { user } = get();
    if (!user) {
      return;
    }

    await setDoc(doc(db, 'users', user.id), { preferredKinshipSystem: kinshipSystem }, { merge: true });
    set((state) => ({
      user: state.user ? { ...state.user, preferredKinshipSystem: kinshipSystem } : null,
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
