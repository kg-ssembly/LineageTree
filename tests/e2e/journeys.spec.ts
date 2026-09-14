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


test('quick add repeats a child without copying personal details and retains draft recovery', async ({ page }, testInfo) => {
  const db = getFirestore(getApps()[0]);
  const parentId = 'quick-parent-' + testInfo.project.name;
  const stamp = new Date().toISOString();
  await db.doc('persons/' + parentId).set({ treeId: 'journey-tree', treeMembershipIds: ['journey-tree'], ownerId: 'journey-owner', firstName: 'Sarah', lastName: 'Quickfamily', birthDate: '1970', deathDate: '', gender: 'female', notes: '', photos: [], lifeEvents: [], createdAt: stamp, updatedAt: stamp });
  try {
    await openWorkspace(page);
    await expect(page.getByText('Connected · changes saved', { exact: true })).toHaveCount(0);
    const close = page.getByRole('button', { name: 'Close', exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole('tab', { name: 'Members', exact: true })
      .or(page.getByRole('button', { name: 'Members', exact: true })).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Child', exact: true }).click();
    await page.getByText('Sarah Quickfamily', { exact: true }).last().click();
    await expect(page.getByText('Quick add', { exact: true })).toBeVisible();
    await page.getByLabel('First name *', { exact: true }).fill('Firstchild');
    await expect(page.getByLabel('Current / last-used surname', { exact: true })).toHaveValue('');
    await page.getByLabel('Current / last-used surname', { exact: true }).fill('Quickfamily');
    await page.getByRole('button', { name: 'Different', exact: true }).click();
    await page.getByLabel('Birth surname (maiden surname)', { exact: true }).fill('Dlamini');
    await page.getByRole('button', { name: 'Swap surnames', exact: true }).click();
    await expect(page.getByLabel('Current / last-used surname', { exact: true })).toHaveValue('Dlamini');
    await page.getByRole('button', { name: 'Swap surnames', exact: true }).click();

    await page.getByRole('button', { name: 'Add optional details: dates, status and more', exact: true }).click();
    await page.getByPlaceholder('1940, ~1940, or 1940-06-15', { exact: true }).fill('2000');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save and add another', exact: true })).toBeVisible();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('quick-add-review.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Save and add another', exact: true }).click();
    await page.getByRole('button', { name: 'Add sibling', exact: true }).click();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveValue('');
    await expect(page.getByText('Quick add', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quickfamily', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('quick-add-next.png') });
    await page.getByRole('button', { name: 'Add optional details: dates, status and more', exact: true }).click();
    await expect(page.getByPlaceholder('1940, ~1940, or 1940-06-15', { exact: true })).toHaveValue('');
    await page.getByLabel('First name *', { exact: true }).fill('Secondchild');
    await expect(page.getByLabel('Current / last-used surname', { exact: true })).toHaveValue('');
    await page.getByLabel('Current / last-used surname', { exact: true }).fill('Quickfamily');
    await page.getByRole('button', { name: 'Review or change relationships', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveValue('Secondchild');
    await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
    await page.getByRole('button', { name: 'Save draft and close', exact: true }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Child', exact: true }).click();
    await page.getByText('Sarah Quickfamily', { exact: true }).last().click();
    await page.getByRole('button', { name: 'Restore draft', exact: true }).click();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveValue('Secondchild');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveCount(0);
    await expect.poll(async () => {
      const children = await db.collection('persons').where('lastName', '==', 'Quickfamily').get();
      return children.docs.map((doc: { data: () => { firstName: string } }) => doc.data().firstName).sort();
    }).toEqual(['Firstchild', 'Sarah', 'Secondchild']);
    await expect(page.getByText('Creating family member', { exact: true })).toHaveCount(0);
    const links = await db.collection('relationships').where('fromPersonId', '==', parentId).get();
    expect(links.size).toBe(2);
    const saved = await db.collection('persons').where('firstName', '==', 'Firstchild').get();
    expect(saved.docs[0].data().maidenName).toBe('Dlamini');
    expect(saved.docs[0].data().birthSurnameStatus).toBe('different');

    expect(links.docs.every((doc: { data: () => { parentChildKind: string } }) => doc.data().parentChildKind === 'biological')).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally {
    for (const collection of ['persons', 'relationships']) {
      const docs = await db.collection(collection).where('treeId', '==', 'journey-tree').get();
      const batch = db.batch(); docs.docs.forEach((doc: { ref: unknown }) => batch.delete(doc.ref)); if (docs.size) await batch.commit();
    }
  }
});


test('guided parents preselect gender and a single co-parent can be connected as a spouse', async ({ page }, testInfo) => {
  const db = getFirestore(getApps()[0]);
  const childId = 'guided-child-' + testInfo.project.name;
  const stamp = new Date().toISOString();
  await db.doc('persons/' + childId).set({ treeId: 'journey-tree', treeMembershipIds: ['journey-tree'], ownerId: 'journey-owner', firstName: 'Anchor', lastName: 'Guidedfamily', birthDate: '2000', deathDate: '', gender: 'unspecified', notes: '', photos: [], lifeEvents: [], createdAt: stamp, updatedAt: stamp });
  try {
    await openWorkspace(page);
    const close = page.getByRole('button', { name: 'Close', exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole('tab', { name: 'Members', exact: true }).or(page.getByRole('button', { name: 'Members', exact: true })).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Parent', exact: true }).click();
    await page.getByText('Anchor Guidedfamily', { exact: true }).last().click();
    await page.getByRole('button', { name: 'Add father', exact: true }).click();
    await page.getByLabel('First name *', { exact: true }).fill('Father');
    await expect(page.getByLabel('Current / last-used surname', { exact: true })).toHaveValue('');
    await page.getByLabel('Current / last-used surname', { exact: true }).fill('Guidedfamily');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Continue building your family', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add mother', exact: true }).click();
    await page.getByLabel('First name *', { exact: true }).fill('Mother');
    await expect(page.getByLabel('Current / last-used surname', { exact: true })).toHaveValue('');
    await page.getByLabel('Current / last-used surname', { exact: true }).fill('Guidedfamily');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText('Gender: female', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Spouse', exact: true }).click();
    await page.getByText('Father Guidedfamily', { exact: true }).last().click();
    await expect(page.getByText('Possible connections', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect Mother Guidedfamily', exact: true })).toBeVisible();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('possible-spouse.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Add someone new', exact: true }).click();
    await expect(page.getByLabel('First name *', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Spouse', exact: true }).click();
    await page.getByText('Father Guidedfamily', { exact: true }).last().click();
    await expect(page.getByLabel('First name *', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Connect Mother Guidedfamily', exact: true }).click();
    await expect(page.getByText('Mother Guidedfamily', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(async () => (await db.collection('relationships').where('treeId', '==', 'journey-tree').get()).docs.filter((d: { data: () => { type: string } }) => d.data().type === 'spouse').length).toBe(1);
    expect((await db.collection('persons').where('lastName', '==', 'Guidedfamily').get()).size).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally {
    for (const collection of ['persons', 'relationships']) {
      const docs = await db.collection(collection).where('treeId', '==', 'journey-tree').get();
      const batch = db.batch(); docs.docs.forEach((doc: { ref: unknown }) => batch.delete(doc.ref)); if (docs.size) await batch.commit();
    }
  }
});

test('tree line filters reveal selected connections and add-relative choices expand below their button', async ({ page }, testInfo) => {
  const db = getFirestore(getApps()[0]);
  const stamp = new Date().toISOString();
  for (const [id, firstName] of [['line-parent', 'Parent'], ['line-child', 'Child']]) {
    await db.doc('persons/' + id).set({ treeId: 'journey-tree', treeMembershipIds: ['journey-tree'], ownerId: 'journey-owner', firstName, lastName: 'Linefamily', birthDate: '', deathDate: '', gender: 'unspecified', notes: '', photos: [], lifeEvents: [], createdAt: stamp, updatedAt: stamp });
  }
  await db.doc('relationships/line-adopted').set({ treeId: 'journey-tree', ownerId: 'journey-owner', type: 'parent-child', fromPersonId: 'line-parent', toPersonId: 'line-child', parentChildKind: 'adopted', createdAt: stamp });
  try {
    await openWorkspace(page);
    const close = page.getByRole('button', { name: 'Close', exact: true });
    if (await close.isVisible()) await close.click();
    await page.getByRole('tab', { name: 'Tree', exact: true }).or(page.getByRole('button', { name: 'Tree', exact: true })).click();
    await page.getByRole('button', { name: 'Fit tree to screen', exact: true }).click();
    const dotted = page.locator('path[stroke-dasharray="1,6"]');
    await expect(dotted.first()).toBeAttached();
    await page.screenshot({ path: testInfo.outputPath('relationship-line.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Relationship lines', exact: true }).click();
    await page.getByLabel('Adoptive · dotted: Visible', { exact: true }).click();
    await expect(dotted).toHaveCount(0);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: /^Parent Linefamily,/ }).click();
    await expect(dotted.first()).toBeAttached();
    const add = page.getByRole('button', { name: 'Add relative', exact: true });
    await add.click();
    const parent = page.getByRole('button', { name: 'Add parent', exact: true });
    await expect(parent).toBeVisible();
    const addBox = await add.boundingBox(), parentBox = await parent.boundingBox();
    expect(parentBox!.y).toBeGreaterThanOrEqual(addBox!.y + addBox!.height);
    await expect(page.getByText('Add a parent first, then connect a sibling through that shared parent.', { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('relative-menu.png'), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  } finally {
    for (const path of ['persons/line-parent', 'persons/line-child', 'relationships/line-adopted']) await db.doc(path).delete();
  }
});
