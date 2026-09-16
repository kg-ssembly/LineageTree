import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { mapPersonData, mapRelationshipData } from '../shared/admin-family-tree-utils';
import { consumeLimit } from './request-limits';

export async function readTreeGraph(db: Firestore, actor: string, input: { treeId: string; personId?: string; direction?: 'parents' | 'children' | 'spouses'; cursor?: string; mode?: 'page' | 'search' | 'edges' | 'connect'; term?: string }) {
  if (!input.treeId || input.treeId.includes('/') || input.personId?.includes('/')) throw new HttpsError('invalid-argument', 'Choose a tree and person.');
  await consumeLimit(db, 'graph-read', actor, 240);
  const tree = await db.collection('trees').doc(input.treeId).get();
  if (!tree.data()?.memberIds?.includes(actor) || tree.data()?.deleting) throw new HttpsError('permission-denied', 'You cannot view this tree.');
  const shouldCountPeople = !input.cursor && (!input.personId || input.mode === 'page' || input.mode === 'search' || input.mode === 'connect');
  const totalPeople = shouldCountPeople
    ? (await db.collection('persons').where('treeId', '==', tree.id).count().get()).data().count
    : undefined;
  if (input.mode === 'edges') {
    const pageSize = 250;
    let query = db.collection('relationships').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(pageSize);
    if (input.cursor) query = query.startAfter(input.cursor);
    const snapshot = await query.get();
    return { people: [], relationships: snapshot.docs.map(d => mapRelationshipData(d.id, d.data())), more: {}, cursor: snapshot.size === pageSize ? snapshot.docs.at(-1)!.id : null, totalPeople };
  }
  if (input.mode === 'page' || input.mode === 'search') {
    const pageSize = input.mode === 'page' ? 200 : 50;
    let query = db.collection('persons').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(pageSize);
    if (input.cursor) query = query.startAfter(input.cursor);
    const snapshot = await query.get();
    const people = snapshot.docs.map(d => mapPersonData(d.id, d.data()));
    // Page search returns a bounded projection; callers can continue scanning without loading profile assets.
    const term = String(input.term ?? '').trim().toLocaleLowerCase();
    return { people: input.mode === 'search' ? people.filter(p => `${p.firstName} ${p.middleNames} ${p.lastName}`.toLocaleLowerCase().includes(term)).map(p => ({ ...p, notes: '', photos: [], lifeEvents: [] })) : people,
      relationships: [], cursor: snapshot.size === pageSize ? snapshot.docs.at(-1)!.id : null, more: {}, totalPeople };
  }
  let personId = input.personId;
  if (!personId) {
    personId = tree.data()?.personAssignments?.[actor];
    if (!personId) personId = (await db.collection('persons').where('treeId', '==', tree.id).orderBy(FieldPath.documentId()).limit(1).get()).docs[0]?.id;
  }
  if (!personId) return { people: [], relationships: [], cursor: null, more: {}, totalPeople };
  const root = await db.collection('persons').doc(personId).get();
  if (!root.exists || root.data()?.treeId !== tree.id) throw new HttpsError('not-found', 'This person is unavailable in this tree.');
  const edges = new Map<string, ReturnType<typeof mapRelationshipData>>();
  const neighbourCache = new Map<string, Promise<string[]>>();
  const relatives: Record<string, { parents: string[]; children: string[] }> = {};
  const neighbours = (id: string, direction: 'parents' | 'children' | 'spouses') => {
    const key = `${id}:${direction}`;
    if (!neighbourCache.has(key)) neighbourCache.set(key, (async () => {
      const base = db.collection('relationships').where('treeId', '==', tree.id);
      const queries = direction === 'spouses'
        ? [base.where('type', '==', 'spouse').where('fromPersonId', '==', id), base.where('type', '==', 'spouse').where('toPersonId', '==', id)]
        : [base.where('type', '==', 'parent-child').where(direction === 'children' ? 'fromPersonId' : 'toPersonId', '==', id)];
      const snapshots = await Promise.all(queries.map(query => query.get()));
      const ids = new Set<string>();
      snapshots.forEach(snapshot => snapshot.docs.forEach(doc => {
        const edge = mapRelationshipData(doc.id, doc.data());
        edges.set(edge.id, edge);
        ids.add(edge.fromPersonId === id ? edge.toPersonId : edge.fromPersonId);
      }));
      return [...ids].sort();
    })());
    return neighbourCache.get(key)!;
  };
  const collectBranch = async (branchRoot: string) => {
    const ids = new Set<string>([branchRoot]);
    await Promise.all((['parents', 'children'] as const).map(async direction => {
      let frontier = [branchRoot];
      for (let depth = 0; depth < 2; depth++) {
        const groups = await Promise.all(frontier.map(id => neighbours(id, direction)));
        frontier = [...new Set(groups.flatMap(group => direction === 'children' ? group.slice(0, 4) : group))];
        frontier.forEach(id => ids.add(id));
      }
    }));
    const parents = await neighbours(branchRoot, 'parents');
    (await Promise.all(parents.map(id => neighbours(id, 'children')))).flat().forEach(id => ids.add(id));
    (await Promise.all([...ids].map(id => neighbours(id, 'spouses')))).flat().forEach(id => ids.add(id));
    return ids;
  };
  let ids = new Set<string>([personId]);
  if (input.mode === 'connect') {
    const sourceId = tree.data()?.personAssignments?.[actor] ?? personId;
    const allEdges = await db.collection('relationships').where('treeId', '==', tree.id).get();
    const adjacency = new Map<string, Array<{ id: string; edge: ReturnType<typeof mapRelationshipData> }>>();
    allEdges.docs.forEach(doc => {
      const edge = mapRelationshipData(doc.id, doc.data());
      adjacency.set(edge.fromPersonId, [...(adjacency.get(edge.fromPersonId) ?? []), { id: edge.toPersonId, edge }]);
      adjacency.set(edge.toPersonId, [...(adjacency.get(edge.toPersonId) ?? []), { id: edge.fromPersonId, edge }]);
    });
    const previous = new Map<string, { id: string; edge: ReturnType<typeof mapRelationshipData> }>();
    const queue = [sourceId];
    const visited = new Set(queue);
    for (let index = 0; index < queue.length && !visited.has(personId); index++) {
      for (const next of adjacency.get(queue[index]) ?? []) if (!visited.has(next.id)) {
        visited.add(next.id); previous.set(next.id, { id: queue[index], edge: next.edge }); queue.push(next.id);
      }
    }
    if (visited.has(personId)) {
      let cursor = personId;
      while (cursor !== sourceId) {
        const step = previous.get(cursor)!;
        edges.set(step.edge.id, step.edge); ids.add(step.id); cursor = step.id;
      }
    }
    (await collectBranch(personId)).forEach(id => ids.add(id));
  } else if (input.direction) {
    if (!['parents', 'children', 'spouses'].includes(input.direction)) throw new HttpsError('invalid-argument', 'Invalid expansion.');
    (await neighbours(personId, input.direction)).forEach(id => ids.add(id));
  } else {
    ids = await collectBranch(personId);
  }
  const records: FirebaseFirestore.DocumentSnapshot[] = [];
  const orderedIds = [...ids];
  for (let offset = 0; offset < orderedIds.length; offset += 100) {
    records.push(...await db.getAll(...orderedIds.slice(offset, offset + 100).map(id => db.collection('persons').doc(id))));
  }
  const people = records.filter(p => p.exists && p.data()?.treeId === tree.id).map(p => mapPersonData(p.id, p.data()!));
  await Promise.all(people.map(async person => {
    const [parents, children] = await Promise.all([neighbours(person.id, 'parents'), neighbours(person.id, 'children')]);
    relatives[person.id] = { parents, children };
  }));
  const visible = new Set(people.map(p => p.id));
  return { people, relationships: [...edges.values()].filter(r => visible.has(r.fromPersonId) && visible.has(r.toPersonId)), more: {}, relatives, cursor: null, totalPeople };
}
