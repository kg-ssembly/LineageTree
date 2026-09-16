import { httpsCallable } from 'firebase/functions';
import { collection, doc, onSnapshot, query, where, documentId } from 'firebase/firestore';
import type { PersonRecord } from '../components/dto/person';
import type { RelationshipRecord } from '../components/dto/relationship';
import { auth, db, functionsApi } from './firebase-provider';
import { mapPerson, mapRelationship } from './family-tree-mappers';

type Page = { people: PersonRecord[]; relationships: RelationshipRecord[]; more: Record<string, string | null>; relatives?: Record<string, { parents: string[]; children: string[] }>; cursor: string | null; totalPeople?: number };
type Input = { treeId: string; personId?: string; direction?: 'parents' | 'children' | 'spouses'; cursor?: string; mode?: 'page' | 'search' | 'edges' | 'connect'; term?: string };
const read = async (input: Input) => (await httpsCallable<Input, Page>(functionsApi, 'readTreeGraphServer')(input)).data;
let session: GraphSession | null = null;

class GraphSession {
  people = new Map<string, PersonRecord>();
  relationships = new Map<string, RelationshipRecord>();
  more: Record<string, string | null> = {};
  relatives: NonNullable<Page['relatives']> = {};
  totalPeople = 0;
  private fullLoad: Promise<void> | null = null;
  private collecting = false;
  stopped = false;
  complete = false;
  private stops: Array<() => void> = [];
  private watchedPeople = new Set<string>();
  private watchedEdges = new Set<string>();
  private pending = new Map<string, Promise<string[]>>();
  constructor(readonly treeId: string, readonly actor: string, readonly emit: (page: Page, complete: boolean) => void, readonly fail: (error: Error) => void) {}
  valid() { return !this.stopped && auth.currentUser?.uid === this.actor; }
  publish() { if (this.valid() && !this.collecting) this.emit({ people: [...this.people.values()], relationships: [...this.relationships.values()], more: { ...this.more }, relatives: { ...this.relatives }, cursor: null, totalPeople: this.totalPeople }, this.complete); }
  merge(page: Page) {
    if (!this.valid()) return;
    Object.assign(this.relatives, page.relatives);
    this.totalPeople = Math.max(this.totalPeople, page.totalPeople ?? 0, this.people.size, page.people.length);
    page.people.forEach(p => this.people.set(p.id, p)); page.relationships.forEach(r => this.relationships.set(r.id, r)); Object.assign(this.more, page.more);
    this.publish();
    // Watch only records already fetched. New branches are loaded explicitly.
    for (const [name, records, watched] of [['persons', page.people, this.watchedPeople], ['relationships', page.relationships, this.watchedEdges]] as const) {
      const ids = records.map(r => r.id).filter(id => !watched.has(id));
      ids.forEach(id => watched.add(id));
      for (let i = 0; i < ids.length; i += 10) {
        const chunk = ids.slice(i, i + 10);
        this.stops.push(onSnapshot(query(collection(db, name), where('treeId', '==', this.treeId), where(documentId(), 'in', chunk)), { includeMetadataChanges: true }, snapshot => {
          // Do not let an incomplete local cache snapshot replace the
          // authoritative callable branch loaded during refresh.
          if (!this.valid() || snapshot.metadata.fromCache) return;
          const seen = new Set(snapshot.docs.map(d => d.id));
          if (name === 'persons') { chunk.filter(id => !seen.has(id)).forEach(id => this.people.delete(id)); snapshot.docs.forEach(d => this.people.set(d.id, mapPerson(d))); }
          else { chunk.filter(id => !seen.has(id)).forEach(id => this.relationships.delete(id)); snapshot.docs.forEach(d => this.relationships.set(d.id, mapRelationship(d))); }
          this.publish();
        }, error => this.fail(error)));
      }
    }
  }
  async expand(personId?: string, direction?: Input['direction']) {
    const key = `${personId ?? ''}:${direction ?? 'initial'}`;
    if (this.pending.has(key)) return this.pending.get(key)!;
    const run = (async () => {
      const page = await read({ treeId: this.treeId, ...(personId ? { personId } : {}), ...(direction ? { direction } : {}) });
      this.merge(page); return page.people.map(p => p.id);
    })();
    this.pending.set(key, run);
    try { return await run; } finally { this.pending.delete(key); }
  }
  all() {
    if (this.complete) return Promise.resolve();
    if (!this.fullLoad) this.fullLoad = this.collectAll().finally(() => { this.fullLoad = null; });
    return this.fullLoad;
  }
  private async collectAll() {
    this.collecting = true;
    try {
    for (const mode of ['page', 'edges'] as const) {
    let cursor: string | null = null;
    do {
      if (!this.valid()) return;
      const page: Page = await read({ treeId: this.treeId, mode, ...(cursor ? { cursor } : {}) });
      this.merge(page);
      cursor = page.cursor;
    } while (cursor && this.valid());
    }
    this.complete = true;
    } finally { this.collecting = false; this.publish(); }
  }
  async connect(personId: string) {
    const page = await read({ treeId: this.treeId, personId, mode: 'connect' });
    this.merge(page);
    return page.people.map(person => person.id);
  }
  stop() { this.stopped = true; this.stops.forEach(stop => stop()); }
}

export function subscribeToTreeGraph(treeId: string, emit: (page: Page, complete: boolean) => void, fail: (error: Error) => void) {
  session?.stop();
  const current = new GraphSession(treeId, auth.currentUser?.uid ?? '', emit, fail); session = current;
  // Membership revocation clears already displayed data, not only future requests.
  const stopAccess = onSnapshot(doc(db, 'trees', treeId), () => {}, error => { current.stop(); emit({ people: [], relationships: [], more: {}, cursor: null }, false); fail(error); });
  void current.expand().catch(fail);
  return () => { stopAccess(); current.stop(); if (session === current) session = null; };
}
export function expandTreeGraph(treeId: string, personId: string, direction?: Input['direction']) {
  return session?.treeId === treeId ? session.expand(personId, direction) : Promise.resolve([]);
}
export function loadCompleteTreeGraph(treeId: string) { return session?.treeId === treeId ? session.all() : Promise.resolve(); }
export function connectTreeGraphSearchResult(treeId: string, personId: string) { return session?.treeId === treeId ? session.connect(personId) : Promise.resolve([]); }
export async function searchTreeGraph(treeId: string, term: string) {
  const actor = auth.currentUser?.uid; const results: PersonRecord[] = []; let cursor: string | null = null;
  do {
    if (auth.currentUser?.uid !== actor) return [];
    const page: Page = await read({ treeId, mode: 'search', term, ...(cursor ? { cursor } : {}) });
    results.push(...page.people); cursor = page.cursor;
  } while (cursor && results.length < 20);
  return results;
}
