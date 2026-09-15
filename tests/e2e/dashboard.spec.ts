import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const backend = createRequire(resolve('functions/package.json'));
const { initializeApp, getApps } = backend('firebase-admin/app');
const { getAuth } = backend('firebase-admin/auth');
const { getFirestore } = backend('firebase-admin/firestore');
const testPhoto = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=';

test.beforeEach(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Local emulators required.');
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-lineagetree' });
  const db = getFirestore(app);
  try { await getAuth(app).createUser({ uid: 'dashboard-owner', email: 'dashboard@example.invalid', password: 'Test-password-123', displayName: 'Dashboard Family' }); }
  catch (error) { if ((error as { code: string }).code !== 'auth/uid-already-exists') throw error; }
  await db.doc('users/dashboard-owner').set({ id: 'dashboard-owner', email: 'dashboard@example.invalid', displayName: 'Dashboard Family', lastSeenAppVersion: '1.0.15', discoverabilityPromptSeenAt: new Date().toISOString(), preferredLanguage: 'en' });
  await db.doc('trees/dashboard-tree').set({ name: 'Dashboard Family', ownerId: 'dashboard-owner', memberIds: ['dashboard-owner'], editorIds: ['dashboard-owner'], collaborators: [{ userId: 'dashboard-owner', role: 'owner', email: 'dashboard@example.invalid', displayName: 'Dashboard Family' }], discoverable: true, personAssignments: {}, membershipHistory: [], surnameVariantGroups: [], searchKeywords: [], connectedTreeIds: [], approvalWindowHours: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
  await db.doc('persons/dashboard-person').set({ id: 'dashboard-person', treeId: 'dashboard-tree', treeMembershipIds: ['dashboard-tree'], treeMemberships: [], ownerId: 'dashboard-owner', firstName: 'Ava', lastName: 'Family', birthDate: '1980-09-20', deathDate: '', gender: 'female', notes: 'Original story', lifeEvents: [], photos: [{ id: 'original-photo', url: 'data:image/png;base64,' + testPhoto, path: 'unused-fixture', description: 'Earlier photograph', createdAt: '2026-01-01T00:00:00.000Z' }], preferredPhotoId: '', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });
});

test('dashboard writes another person memory, restores a draft and stays within the viewport', async ({ page }, testInfo) => {
  await page.goto('/join/dashboard-tree');
  await page.getByLabel('Email', { exact: true }).fill('dashboard@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Test-password-123');
  await page.getByRole('button', { name: /sign in|log in/i, exact: true }).click();
  await page.getByRole('button', { name: 'Open this family tree', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add a memory', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard.png'), fullPage: true });
  await page.getByRole('button', { name: 'Write a memory', exact: true }).first().click();
  await page.getByLabel('Written memory', { exact: true }).fill('A new family story');
  await page.getByRole('button', { name: 'Save draft and close', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Add a memory', exact: true }).click();
  await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
  await expect(page.getByLabel('Written memory', { exact: true })).toHaveValue('A new family story');
  await page.screenshot({ path: testInfo.outputPath('composer.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect.poll(async () => (await getFirestore(getApps()[0]).doc('persons/dashboard-person').get()).data().notes).toBe('Original story\n\nA new family story');
  await page.getByRole('button', { name: 'Add a memory', exact: true }).click();
  await page.getByRole('button', { name: 'Ava Family', exact: true }).last().click();
  const fileChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose photo', exact: true }).click();
  await (await fileChooser).setFiles({ name: 'memory.png', mimeType: 'image/png', buffer: Buffer.from(testPhoto, 'base64') });
  await expect(page.getByRole('button', { name: 'Change photo', exact: true })).toBeVisible();
  await page.getByLabel('Photo description', { exact: true }).fill('Dashboard photo');
  await page.getByRole('button', { name: 'Save memory', exact: true }).click();
  await expect.poll(async () => (await getFirestore(getApps()[0]).doc('persons/dashboard-person').get()).data().photos.length).toBe(2);
  await page.getByRole('button', { name: /View memories: Ava Family · Dashboard photo/ }).click();
  await expect(page.getByText('2 / 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByLabel('Search family members', { exact: true }).fill('Missing name');
  await expect(page.getByText('No family members found.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

