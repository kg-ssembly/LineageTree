const { spawn } = require('node:child_process');
const env = { ...process.env, EXPO_NO_DOTENV: '1', CI: '1', EXPO_PUBLIC_USE_EMULATORS: 'true',
  EXPO_PUBLIC_FIREBASE_API_KEY: 'demo-key', EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-lineagetree.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-lineagetree', EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-lineagetree.appspot.com',
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789', EXPO_PUBLIC_FIREBASE_APP_ID: 'demo-app' };
const child = spawn(process.execPath, [require.resolve('expo/bin/cli'), 'start', '--web', '--port', '8091'], { env, stdio: 'inherit' });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
