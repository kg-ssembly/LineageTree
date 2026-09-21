const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports, process,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: file });
  return module.exports;
}

function fixture(phoneSnapshot = { state: 'sent', verificationId: 'verification-id', code: null, error: null }) {
  const calls = [];
  const security = load('providers/account-security.ts', {});
  const provider = load('providers/mobile-auth-provider.native.ts', {
    'react-native': { Platform: { OS: 'android' } },
    './account-security': security,
    '@react-native-google-signin/google-signin': {
      statusCodes: {
        SIGN_IN_CANCELLED: '12501',
        IN_PROGRESS: '12502',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
      },
      GoogleSignin: {
        configure: options => calls.push(['configure', options.webClientId]),
        hasPlayServices: async () => calls.push(['playServices']),
        signIn: async () => ({ type: 'success', data: { idToken: 'google-id-token' } }),
      },
    },
    '@react-native-firebase/auth': {
      getAuth: () => ({ app: 'native' }),
      verifyPhoneNumber: (_auth, number) => ({
        on: (_event, observer) => { calls.push(['sms', number]); observer(phoneSnapshot); },
      }),
    },
  });
  return { provider, calls };
}

test('native Google sign-in returns an ID token configured for the Firebase web client', async () => {
  const { provider, calls } = fixture();
  assert.equal(await provider.getMobileGoogleIdToken(), 'google-id-token');
  assert.ok(calls.some(([name, value]) => name === 'configure' && value.endsWith('.apps.googleusercontent.com')));
  assert.ok(calls.some(([name]) => name === 'playServices'));
});

test('native Google errors are converted into actionable app errors', () => {
  const { provider } = fixture();
  const cases = [
    ['10', 'account/google-configuration-error'],
    ['7', 'auth/network-request-failed'],
    ['12500', 'account/google-sign-in-failed'],
    ['12501', 'auth/popup-closed-by-user'],
    ['12502', 'account/google-sign-in-progress'],
    ['PLAY_SERVICES_NOT_AVAILABLE', 'account/google-play-services-unavailable'],
  ];
  for (const [nativeCode, expectedCode] of cases) {
    assert.equal(provider.normalizeGoogleSignInError({ code: nativeCode }).code, expectedCode);
  }
});

test('native phone verification resolves as soon as Firebase sends the code', async () => {
  const { provider, calls } = fixture();
  assert.equal(JSON.stringify(await provider.requestMobilePhoneVerification('+27821234567')), JSON.stringify({ verificationId: 'verification-id' }));
  assert.deepEqual(calls.find(([name]) => name === 'sms'), ['sms', '+27821234567']);
});

test('native phone verification preserves an Android auto-verification code', async () => {
  const { provider } = fixture({ state: 'verified', verificationId: 'automatic-id', code: '123456', error: null });
  assert.equal(JSON.stringify(await provider.requestMobilePhoneVerification('+27821234567')), JSON.stringify({ verificationId: 'automatic-id', code: '123456' }));
});
