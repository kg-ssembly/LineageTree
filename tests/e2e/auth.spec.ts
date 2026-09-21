import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const backend = createRequire(resolve('functions/package.json'));
const { initializeApp, getApps } = backend('firebase-admin/app');
const { getAuth } = backend('firebase-admin/auth');
const { getFirestore } = backend('firebase-admin/firestore');

test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('These auth journeys require local emulators.');
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-lineagetree' });
  const auth = getAuth(app);
  try {
    await auth.createUser({ uid: 'auth-journey-user', email: 'auth-journey@example.invalid', password: 'Test-password-123', displayName: 'Auth Journey' });
  } catch (error) {
    if ((error as { code: string }).code !== 'auth/uid-already-exists') throw error;
  }
  await getFirestore(app).doc('users/auth-journey-user').set({ id: 'auth-journey-user', email: 'auth-journey@example.invalid', displayName: 'Auth Journey', preferredLanguage: 'en' });
});

test('email sign-in survives reload and recovers the authenticated route', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use email and password', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('auth-journey@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: /sign in/i, exact: true }).click();
  await expect(page).toHaveURL(/\/$|\/home/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Use email and password', exact: true })).toHaveCount(0);
  await expect(page.getByText('Startup error', { exact: true })).toHaveCount(0);
});

test('offline email sign-in reports a recoverable network error', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Use email and password', exact: true }).click();
  await page.context().setOffline(true);
  await page.getByLabel('Email', { exact: true }).fill('auth-journey@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: /sign in/i, exact: true }).click();
  await expect(page.getByText(/Network error/i)).toBeVisible();
});

test('expired magic link offers a fresh-link recovery path', async ({ page }) => {
  const app = getApps()[0];
  const auth = getAuth(app);
  const generatedLink = await auth.generateSignInWithEmailLink('auth-journey@example.invalid', {
    url: 'http://localhost:8091/login',
    handleCodeInApp: true,
  });
  const expiredLink = new URL(generatedLink);
  expiredLink.searchParams.set('oobCode', 'expired-auth-journey-code');
  expiredLink.hostname = 'localhost';
  expiredLink.port = '8091';
  await page.addInitScript(() => localStorage.setItem('lineagetree.emailForSignIn', 'auth-journey@example.invalid'));
  await page.goto(expiredLink.toString());
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('auth-journey@example.invalid');
  await page.getByRole('button', { name: /complete sign-in link/i }).click();
  await expect(page.getByText(/expired|invalid/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /email me a sign-in link/i })).toBeVisible();
});
