import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const backend = createRequire(resolve('functions/package.json'));
const { initializeApp, getApps } = backend('firebase-admin/app');
const { getAuth } = backend('firebase-admin/auth');
const { getFirestore } = backend('firebase-admin/firestore');

test.beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('These journeys require local emulators.');
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-lineagetree' });
  const auth = getAuth(app); const db = getFirestore(app);
  try { await auth.createUser({ uid: 'journey-owner', email: 'journey@example.invalid', password: 'Test-password-123', displayName: 'Journey Family' }); }
  catch (error) { if ((error as { code: string }).code !== 'auth/uid-already-exists') throw error; }
  await db.doc('users/journey-owner').set({ id: 'journey-owner', email: 'journey@example.invalid', displayName: 'Journey Family', lastSeenAppVersion: '1.0.15', discoverabilityPromptSeenAt: new Date().toISOString(), preferredLanguage: 'en' });
  for (const id of ['journey-tree', 'second-tree']) await db.doc(`trees/${id}`).set({ name: id === 'journey-tree' ? 'Journey Family' : 'Second Family', ownerId: 'journey-owner', memberIds: ['journey-owner'], editorIds: ['journey-owner'], collaborators: [{ userId: 'journey-owner', role: 'owner', email: 'journey@example.invalid', displayName: 'Journey Family' }], discoverable: true, personAssignments: {}, membershipHistory: [], surnameVariantGroups: [], searchKeywords: [], connectedTreeIds: [], approvalWindowHours: 24, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
});

test.beforeEach(async () => {
  const db = getFirestore(getApps()[0]);
  const notifications = await db.collection('notifications').where('userId', '==', 'journey-owner').get();
  if (notifications.size) { const batch = db.batch(); notifications.docs.forEach((doc: { ref: unknown }) => batch.delete(doc.ref)); await batch.commit(); }
});

test('invitation survives login and reload, and existing access opens the invited tree', async ({ page }) => {
  await page.goto('/join/second-tree');
  await page.getByLabel('Email', { exact: true }).fill('journey@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: /sign in|log in/i, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open this family tree', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open this family tree', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open this family tree', exact: true }).click();
  await expect(page.getByText(/Second Family/).first()).toBeVisible();
  await expect(page.getByText('Startup error', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

async function openWorkspace(page: import('@playwright/test').Page) {
  await page.goto('/join/journey-tree');
  await page.getByLabel('Email', { exact: true }).fill('journey@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: /sign in|log in/i, exact: true }).click();
  await page.getByRole('button', { name: 'Open this family tree', exact: true }).click();
}

test('a person draft survives closing and reopening the form', async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Start my profile', exact: true }).click();
  await page.getByLabel('First name *', { exact: true }).fill('Unfinished');
  await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
  await page.getByRole('button', { name: 'Save draft and close', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Start my profile', exact: true }).click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.getByLabel('First name *', { exact: true })).toHaveValue('Unfinished');
});

test('old pending activity survives the history cap and reload', async ({ page }) => {
  const db = getFirestore(getApps()[0]);
  const batch = db.batch();
  for (let i = 0; i < 125; i++) {
    const timestamp = new Date(1700000000000 + i * 1000).toISOString();
    batch.set(db.doc('notifications/journey-' + i), { userId: 'journey-owner', type: 'merge-invite', status: i === 0 ? 'pending' : 'dismissed', requestedByUserId: 'other', requestedByLabel: i === 0 ? 'Old pending invite' : 'Family member', sourceTreeId: 'journey-tree', sourceTreeName: 'Journey Family', targetIdentifier: '', message: 'Family invitation', createdAt: timestamp, updatedAt: timestamp });
  }
  await batch.commit();
  await openWorkspace(page);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: /Notifications/ }).click();
  await expect(page.getByText(/Old pending invite/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Old pending invite/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Load older activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load older activity', exact: true })).toHaveCount(0);
});
