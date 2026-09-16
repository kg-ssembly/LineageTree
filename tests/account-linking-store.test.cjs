// Exercise the actual store with Firebase transport and device storage replaced.
// No browser, device, real account, SMS, email, or cloud service is used.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { createStore } = require('zustand/vanilla');

function loadTypescript(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Date, console,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    }, ...globals,
  }, { filename: file });
  return module.exports;
}

function fixture(providerIds = ['password']) {
  const calls = [];
  let linkError = null;
  let authTime = Date.now() / 1000;
  let verificationFails = false;
  let reloadHook;
  const user = {
    uid: 'original', email: 'original@example.test', displayName: 'Chosen name', photoURL: 'chosen-photo',
    phoneNumber: '+27821234567', emailVerified: true,
    providerData: providerIds.map(providerId => ({ providerId })),
    getIdTokenResult: async () => ({ claims: { auth_time: authTime } }),
  };
  const auth = { currentUser: user };
  const profile = { id: user.uid, email: user.email, displayName: user.displayName, photoUrl: 'chosen-photo', defaultTreeId: 'family', createdAt: '2026-01-01' };
  const documents = { [`users/${user.uid}`]: { ...profile } };
  const firebase = {
    async linkWithCredential(target, credential) {
      calls.push(['link', target.uid, credential.providerId]);
      if (linkError) throw Object.assign(new Error('occupied'), { code: linkError });
      target.providerData.push({ providerId: credential.providerId });
      if (credential.email) target.email = credential.email;
      return { user: target };
    },
    async linkWithPopup(target) { return firebase.linkWithCredential(target, { providerId: 'google.com' }); },
    async reauthenticateWithCredential(target) { calls.push(['reauthenticate', target.uid]); authTime = Date.now() / 1000; },
    async reauthenticateWithPopup(target) { return firebase.reauthenticateWithCredential(target); },
    async unlink(target, providerId) { calls.push(['unlink', target.uid, providerId]); target.providerData = target.providerData.filter(p => p.providerId !== providerId); },
    async reload(target) { if (reloadHook) await reloadHook(target); },
    async sendEmailVerification() { calls.push(['email']); if (verificationFails) throw new Error('offline'); },
    async updatePassword(target) { calls.push(['password', target.uid]); },
    async signOut() { auth.currentUser = null; },
    GoogleAuthProvider: class { setCustomParameters() {} addScope() {} },
    EmailAuthProvider: { credential: (email, password) => ({ providerId: 'password', email, password }) },
    PhoneAuthProvider: class {
      async verifyPhoneNumber(number) { calls.push(['sms', number]); return 'verification'; }
      static credential(verificationId, code) { return { providerId: 'phone', verificationId, code }; }
    },
    RecaptchaVerifier: class { clear() { calls.push(['clearCaptcha']); } },
  };
  const storage = { setItem: async () => {}, getItem: async () => null, getAllKeys: async () => [], multiRemove: async () => {} };
  const firestore = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    getDoc: async path => ({ exists: () => !!documents[path], data: () => documents[path] }),
    setDoc: async (path, data) => { documents[path] = { ...documents[path], ...data }; },
  };
  const security = loadTypescript('providers/account-security.ts', {});
  const { useAuthStore: store } = loadTypescript('stores/auth-store.ts', {
    '@react-native-async-storage/async-storage': storage,
    zustand: { create: createStore },
    'firebase/auth': firebase, 'firebase/firestore': firestore,
    '../providers/firebase-provider': { auth, db: {} },
    '../providers/email-service': {},
    '../providers/account-security': security,
    '../constants/app-metadata': { CURRENT_APP_VERSION: '1' },
  }, { document: { getElementById: () => ({}) } });
  store.setState({ user: profile, firebaseUser: user, loading: false });
  return {
    store, auth, user, profile, calls, documents,
    setOldLogin: () => { authTime = 1; },
    setCollision: code => { linkError = code; },
    failEmail: () => { verificationFails = true; },
    onReload: hook => { reloadHook = hook; },
  };
}

test('Google linking retains the original UID, tree, name and photo without global loading', async () => {
  const f = fixture();
  await f.store.getState().linkGoogle();
  assert.equal(f.auth.currentUser.uid, 'original');
  assert.equal(f.store.getState().user, f.profile);
  assert.equal(f.store.getState().user.defaultTreeId, 'family');
  assert.equal(f.store.getState().loading, false);
  assert.equal(f.store.getState().accountBusy, false);
  assert.match(f.store.getState().accountNotice, /Google is connected/);
  assert.equal(f.store.getState().accountRevision, 1);
});

test('old sessions must reauthenticate before linking', async () => {
  const f = fixture(); f.setOldLogin();
  await assert.rejects(f.store.getState().linkGoogle(), { code: 'auth/requires-recent-login' });
  assert.equal(f.calls.some(call => call[0] === 'link'), false);
  await f.store.getState().reauthenticatePassword('existing-password');
  await f.store.getState().linkGoogle();
  assert.equal(f.calls.filter(call => call[0] === 'link').length, 1);
});

test('occupied Google credential leaves profile intact and exposes a settings error', async () => {
  const f = fixture(); f.setCollision('auth/credential-already-in-use');
  await assert.rejects(f.store.getState().linkGoogle());
  assert.equal(f.store.getState().user, f.profile);
  assert.equal(f.auth.currentUser.uid, 'original');
  assert.match(f.store.getState().accountError, /No profiles were merged/);
  assert.equal(f.store.getState().accountBusy, false);
});

test('SMS verifies and links without ever signing into another account', async () => {
  const f = fixture();
  await f.store.getState().sendPhoneLinkCode('+27 82 123 4567');
  await f.store.getState().verifyPhoneLinkCode('123456');
  assert.equal(f.auth.currentUser.uid, 'original');
  assert.ok(f.user.providerData.some(p => p.providerId === 'phone'));
  assert.deepEqual(f.calls.find(call => call[0] === 'sms'), ['sms', '+27821234567']);
  await assert.rejects(f.store.getState().verifyPhoneLinkCode('123456'), { code: 'auth/code-expired' });
});

test('cancelled SMS challenge cannot be reused', async () => {
  const f = fixture();
  await f.store.getState().sendPhoneLinkCode('+27821234567');
  f.store.getState().cancelAccountPhoneCode();
  await assert.rejects(f.store.getState().verifyPhoneLinkCode('123456'), { code: 'auth/code-expired' });
  assert.equal(f.calls.some(call => call[0] === 'link'), false);
});

test('SMS challenge cannot be attached to a different signed-in user', async () => {
  const f = fixture();
  await f.store.getState().sendPhoneLinkCode('+27821234567');
  f.auth.currentUser = { ...f.user, uid: 'other' };
  f.store.setState({ user: { ...f.profile, id: 'other' }, firebaseUser: f.auth.currentUser });
  await assert.rejects(f.store.getState().verifyPhoneLinkCode('123456'), { code: 'account/session-changed' });
  assert.equal(f.calls.some(call => call[0] === 'link'), false);
});

test('phone reauthentication cannot be submitted as a linking code', async () => {
  const f = fixture(['phone']);
  await f.store.getState().sendPhoneReauthCode();
  await assert.rejects(f.store.getState().verifyPhoneLinkCode('123456'), { code: 'auth/code-expired' });
  await f.store.getState().verifyPhoneReauthCode('123456');
  assert.equal(f.calls.filter(call => call[0] === 'reauthenticate').length, 1);
});

test('removal preserves at least one method and catches session changes during reload', async () => {
  const f = fixture();
  await assert.rejects(f.store.getState().removeSignInMethod('password'), { code: 'account/last-sign-in-method' });
  f.user.providerData.push({ providerId: 'google.com' });
  f.onReload(() => { f.auth.currentUser = { ...f.user, uid: 'other' }; });
  await assert.rejects(f.store.getState().removeSignInMethod('password'), { code: 'account/session-changed' });
  assert.equal(f.calls.some(call => call[0] === 'unlink'), false);
});

test('password connection fills a phone-only contact without overwriting profile choices', async () => {
  const f = fixture(['phone']);
  f.user.email = null; f.user.emailVerified = false;
  f.profile.email = ''; f.documents['users/original'].email = '';
  f.documents['users/original'].normalizedEmail = ''; f.documents['users/original'].username = '';
  await f.store.getState().linkEmailPassword(' New@Example.test ', 'password123');
  assert.equal(f.store.getState().user.email, 'new@example.test');
  assert.equal(f.store.getState().user.displayName, 'Chosen name');
  assert.equal(f.store.getState().user.photoUrl, 'chosen-photo');
  assert.equal(f.store.getState().user.defaultTreeId, 'family');
  assert.match(f.store.getState().accountNotice, /Check your inbox/);
});

test('failed verification email reports successful linking and offers a retry', async () => {
  const f = fixture(['google.com']); f.user.emailVerified = false; f.failEmail();
  await f.store.getState().linkEmailPassword(f.user.email, 'password123');
  assert.equal(f.store.getState().accountError, null);
  assert.match(f.store.getState().accountNotice, /connected.*Send verification email/);
});

test('linking cannot silently replace an existing account email', async () => {
  const f = fixture(['google.com']);
  await assert.rejects(f.store.getState().linkEmailPassword('different@example.test', 'password123'), { code: 'account/email-change' });
  assert.equal(f.calls.some(call => call[0] === 'link'), false);
});

test('email-link users can set a password without attempting to link their existing provider again', async () => {
  const f = fixture(['password']);
  await f.store.getState().linkEmailPassword(f.user.email, 'password123');
  assert.deepEqual(f.calls.find(call => call[0] === 'password'), ['password', 'original']);
  assert.equal(f.calls.some(call => call[0] === 'link'), false);
});

test('a refresh failure after successful linking does not tell the user to repeat the mutation', async () => {
  const f = fixture();
  f.onReload(() => { throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' }); });
  await f.store.getState().linkGoogle();
  assert.match(f.store.getState().accountNotice, /change was saved/);
  assert.equal(f.store.getState().accountError, null);
  assert.equal(f.calls.filter(call => call[0] === 'link').length, 1);
});

test('sign-out invalidates an outstanding SMS challenge even after returning to the same UID', async () => {
  const f = fixture();
  await f.store.getState().sendPhoneLinkCode('+27821234567');
  await f.store.getState().signOut();
  f.auth.currentUser = f.user;
  f.store.setState({ user: f.profile, firebaseUser: f.user });
  await assert.rejects(f.store.getState().verifyPhoneLinkCode('123456'), { code: 'auth/code-expired' });
});
