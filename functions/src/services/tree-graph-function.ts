import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { mapPersonData, mapRelationshipData } from '../shared/admin-family-tree-utils';
import { consumeLimit } from './request-limits';

export async function readTreeGraph(db: Firestore, actor: string, input: { treeId: string; personId?: string; direction?: 'parents' | 'children' | 'spouses'; cursor?: string; mode?: 'page' | 'search' | 'edges'; term?: string }) {
  if (!input.treeId || input.treeId.includes('/') || input.personId?.includes('/')) throw new HttpsError('invalid-argument', 'Choose a tree and person.');
  await consumeLimit(db, 'graph-read', actor, 240);
  const tree = await db.collection('trees').doc(input.treeId).get();
  if (!tree.data()?.memberIds?.includes(actor) || tree.data()?.deleting) throw new HttpsError('permission-denied', 'You cannot view this tree.');
  if (input.mode === 'edges') {
    let query = db.collection('relationships').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(100);
    if (input.cursor) query = query.startAfter(input.cursor);
    const snapshot = await query.get();
    return { people: [], relationships: snapshot.docs.map(d => mapRelationshipData(d.id, d.data())), more: {}, cursor: snapshot.size === 100 ? snapshot.docs.at(-1)!.id : null };
  }
  if (input.mode === 'page' || input.mode === 'search') {
    let query = db.collection('persons').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(50);
    if (input.cursor) query = query.startAfter(input.cursor);
    const snapshot = await query.get();
    const people = snapshot.docs.map(d => mapPersonData(d.id, d.data()));
    // Page search returns a bounded projection; callers can continue scanning without loading profile assets.
    const term = String(input.term ?? '').trim().toLocaleLowerCase();
    return { people: input.mode === 'search' ? people.filter(p => `${p.firstName} ${p.middleNames} ${p.lastName}`.toLocaleLowerCase().includes(term)).map(p => ({ ...p, notes: '', photos: [], lifeEvents: [] })) : people,
      relationships: [], cursor: snapshot.size === 50 ? snapshot.docs.at(-1)!.id : null, more: {} };
  }
  let personId = input.personId;
  if (!personId) {
    personId = tree.data()?.personAssignments?.[actor];
    if (!personId) personId = (await db.collection('persons').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(1).get()).docs[0]?.id;
  }
  if (!personId) return { people: [], relationships: [], cursor: null, more: {} };
  const root = await db.collection('persons').doc(personId).get();
  if (!root.exists || root.data()?.treeId !== tree.id) throw new HttpsError('not-found', 'This person is unavailable in this tree.');
  const directions = input.direction ? [input.direction] : ['parents', 'children', 'spouses'] as const;
  const edges: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const more: Record<string, string | null> = {};
  for (const direction of directions) {
    if (!['parents', 'children', 'spouses'].includes(direction)) throw new HttpsError('invalid-argument', 'Invalid expansion.');
    const base = db.collection('relationships').where('treeId', '==', tree.id);
    const queries = direction === 'spouses'
      ? [base.where('type', '==', 'spouse').where('fromPersonId', '==', personId), base.where('type', '==', 'spouse').where('toPersonId', '==', personId)]
      : [base.where('type', '==', 'parent-child').where(direction === 'children' ? 'fromPersonId' : 'toPersonId', '==', personId)];
    const combined: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const baseQuery of queries) {
      let query = baseQuery.orderBy(FieldPath.documentId()).limit(5);
      if (input.cursor) query = query.startAfter(input.cursor);
      combined.push(...(await query.get()).docs);
    }
    const sorted = combined.sort((a, b) => a.id.localeCompare(b.id));
    const page = sorted.slice(0, 4);
    edges.push(...page);
    more[`${personId}:${direction}`] = sorted.length > 4 ? page.at(-1)!.id : null;
  }
  const ids = [...new Set([personId, ...edges.flatMap(d => [d.data().fromPersonId, d.data().toPersonId])])];
  const records = await db.getAll(...ids.map(id => db.collection('persons').doc(id)));
  const people = records.filter(p => p.exists && p.data()?.treeId === tree.id).map(p => mapPersonData(p.id, p.data()!));
  const visible = new Set(people.map(p => p.id));
  const relatives: Record<string, { parents: string[]; children: string[] }> = {};
  await Promise.all(people.map(async person => {
    const base = db.collection('relationships').where('treeId', '==', tree.id).where('type', '==', 'parent-child');
    const [parents, children] = await Promise.all([
      base.where('toPersonId', '==', person.id).select('fromPersonId').get(),
      base.where('fromPersonId', '==', person.id).select('toPersonId').get(),
    ]);
    relatives[person.id] = {
      parents: [...new Set(parents.docs.map(d => d.data().fromPersonId as string))],
      children: [...new Set(children.docs.map(d => d.data().toPersonId as string))],
    };
  }));
  return { people, relationships: edges.map(d => mapRelationshipData(d.id, d.data())).filter(r => visible.has(r.fromPersonId) && visible.has(r.toPersonId)), more, relatives, cursor: null };
}
