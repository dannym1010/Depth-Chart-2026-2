// The board save with a stand-in database: when one kind of document fails, the others still count as saved and only
// the failed kind is reported (it alone goes again).
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const writes: string[] = [];
let failDoc = '';
const docRef = (id: string) => ({
  id,
  set: async () => {
    writes.push(id);
    if (id === failDoc) throw Object.assign(new Error('Document exceeds the maximum allowed size'), { code: 'invalid-argument' });
  },
  update: async () => undefined,
  get: async () => ({ exists: false, data: () => ({}) }),
  onSnapshot: () => () => undefined,
});
const fakeDb = {
  collection: (_name: string) => ({ doc: (id: string) => docRef(id), where: () => ({}) }),
  runTransaction: async (fn: (tx: any) => Promise<any>) => {
    let target = '';
    const tx = { get: async (ref: any) => ((target = ref.id), { exists: false, data: () => ({}) }), set: (ref: any) => (target = ref.id) };
    const out = await fn(tx);
    writes.push(target);
    if (target === failDoc) throw Object.assign(new Error('Document exceeds the maximum allowed size'), { code: 'invalid-argument' });
    return out;
  },
  enableNetwork: async () => undefined,
  disableNetwork: async () => undefined,
};

let save: typeof import('./storageService.ts').saveSharedBoardCloud;
let failedKinds: typeof import('./storageService.ts').boardSaveFailedKinds;
let lastError: typeof import('./storageService.ts').lastCloudSaveError;

before(async () => {
  (globalThis as any).window = {
    firebase: {
      apps: [{}],
      initializeApp: () => undefined,
      firestore: Object.assign(() => fakeDb, { FieldValue: { delete: () => undefined } }),
      auth: () => ({ onAuthStateChanged: () => () => undefined, currentUser: null }),
      storage: () => ({}),
    },
    addEventListener: () => undefined,
    location: { hostname: 'depth-chart.example.app', protocol: 'https:', port: '' },
  };
  (globalThis as any).localStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };
  (globalThis as any).sessionStorage = { getItem: () => null, setItem: () => undefined };
  const m = await import('./storageService.ts');
  save = m.saveSharedBoardCloud;
  failedKinds = m.boardSaveFailedKinds;
  lastError = m.lastCloudSaveError;
});

describe('board save, one kind failing', () => {
  it('reports only the kind that failed, and why', async () => {
    writes.length = 0;
    failDoc = 'ops_formations';
    const ok = await save({
      teamId: 'team_10u',
      week: 'w4',
      weekSlice: { depthChart: {} },
      practiceData: [],
      scheduleEvents: [],
      defaultFormations: [],
      deletedFormationIds: [],
      callSheetData: {},
      modules: ['week', 'practice', 'schedule', 'formations', 'call_sheet'],
    } as any);
    assert.equal(ok, false);
    assert.deepEqual(failedKinds(), ['formations']);
    assert.ok(writes.includes('ops_practice') && writes.includes('ops_call_sheet'), writes.join(','));
    assert.match(lastError(), /^formations: this week is too big for one cloud save/);
  });

  it('all through: nothing failed', async () => {
    failDoc = '';
    const ok = await save({ practiceData: [], modules: ['practice'] } as any);
    assert.equal(ok, true);
    assert.deepEqual(failedKinds(), []);
  });
});
