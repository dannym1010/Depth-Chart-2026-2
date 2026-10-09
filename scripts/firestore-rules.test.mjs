import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { ref, uploadString, getBytes } from 'firebase/storage';

// Run from the project folder (needs Java; see the header of firestore.rules):
//   npx firebase-tools emulators:exec --only firestore,storage "node --test scripts/firestore-rules.test.mjs"
// with @firebase/rules-unit-testing and firebase installed where Node can find them.
const REPO = process.cwd();
let env;

const ACCESS = {
  admins: { 'dannym1010@gmail.com': true, 'head@coach.com': true },
  coaches: { 'asst@coach.com': true },
  viewers: { 'family@home.com': true, 'player@team.com': true },
};
const as = (email, verified = true) => env.authenticatedContext(email.replace(/\W/g, '_'), { email, email_verified: verified }).firestore();
const storageAs = (email, verified = true) => env.authenticatedContext(email.replace(/\W/g, '_'), { email, email_verified: verified }).storage();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'u-football-manager',
    firestore: { rules: readFileSync(`${REPO}/firestore.rules`, 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync(`${REPO}/storage.rules`, 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'teamData/access'), ACCESS);
    await setDoc(doc(db, 'teamData/depthChartData'), { staffList: [] });
    await setDoc(doc(db, 'teamData/ops_presence'), {});
    await setDoc(doc(db, 'signups/new@person.com'), { email: 'new@person.com' });
    await uploadString(ref(ctx.storage(), 'playbook_guides/a.txt'), 'guide');
  });
});

describe('not signed in', () => {
  it('can read and write nothing', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'teamData/depthChartData')));
    await assertFails(setDoc(doc(db, 'teamData/depthChartData'), { x: 1 }));
    await assertFails(setDoc(doc(db, 'signups/x@y.com'), { email: 'x@y.com' }));
  });
});

describe('a stranger signed in with Google', () => {
  const db = () => as('stranger@gmail.com');
  it("can't read or change team data", async () => {
    await assertFails(getDoc(doc(db(), 'teamData/depthChartData')));
    await assertFails(getDoc(doc(db(), 'teamData/access')));
    await assertFails(setDoc(doc(db(), 'teamData/depthChartData'), { staffList: [{ email: 'stranger@gmail.com', status: 'Active' }] }));
    await assertFails(setDoc(doc(db(), 'teamData/access'), { admins: { 'stranger@gmail.com': true } }));
    await assertFails(setDoc(doc(db(), 'teamData/ops_presence'), { me: 1 }));
  });
  it('can ask to join, only as themself, and not see other requests', async () => {
    await assertSucceeds(setDoc(doc(db(), 'signups/stranger@gmail.com'), { email: 'stranger@gmail.com', requestedAt: 1 }));
    await assertFails(setDoc(doc(db(), 'signups/someone@else.com'), { email: 'someone@else.com' }));
    await assertFails(setDoc(doc(db(), 'signups/stranger@gmail.com'), { email: 'someone@else.com' }));
    await assertFails(getDocs(collection(db(), 'signups')));
    await assertFails(deleteDoc(doc(db(), 'signups/new@person.com')));
  });
});

describe('an email / password account that has not verified', () => {
  it('is not trusted even when on the access list', async () => {
    const db = as('asst@coach.com', false);
    await assertFails(getDoc(doc(db, 'teamData/depthChartData')));
    await assertFails(setDoc(doc(db, 'teamData/depthChartData'), { x: 1 }));
    await assertFails(setDoc(doc(db, 'signups/asst@coach.com'), { email: 'asst@coach.com' }));
  });
});

describe('a coach', () => {
  const db = () => as('ASST@coach.com'); // emails are matched in lower case
  it('reads and writes team data', async () => {
    await assertSucceeds(getDoc(doc(db(), 'teamData/depthChartData')));
    await assertSucceeds(setDoc(doc(db(), 'teamData/depthChartData'), { staffList: [1] }));
    await assertSucceeds(setDoc(doc(db(), 'teamData/ops_plays'), { plays: [] }));
    await assertSucceeds(setDoc(doc(db(), 'teamData/filmroom_team_10u_own_g1'), { notes: [] }));
    await assertSucceeds(getDoc(doc(db(), 'teamData/access')));
  });
  it("can't change who has access or handle sign-ups", async () => {
    await assertFails(setDoc(doc(db(), 'teamData/access'), { ...ACCESS, admins: { 'asst@coach.com': true } }));
    await assertFails(getDocs(collection(db(), 'signups')));
  });
});

describe('a player or family member', () => {
  const db = () => as('family@home.com');
  it('reads, but only says they are online', async () => {
    await assertSucceeds(getDoc(doc(db(), 'teamData/depthChartData')));
    await assertSucceeds(setDoc(doc(db(), 'teamData/ops_presence'), { family: 1 }));
    await assertFails(setDoc(doc(db(), 'teamData/depthChartData'), { x: 1 }));
    await assertFails(setDoc(doc(db(), 'teamData/filmroom_team_10u_own_g1'), { notes: ['hi'] }));
    await assertFails(setDoc(doc(db(), 'teamData/access'), ACCESS));
  });
});

describe('a head coach / admin', () => {
  const db = () => as('head@coach.com');
  it('keeps the access list and handles sign-ups', async () => {
    await assertSucceeds(setDoc(doc(db(), 'teamData/access'), { ...ACCESS, coaches: { ...ACCESS.coaches, 'new@person.com': true } }));
    await assertSucceeds(getDocs(collection(db(), 'signups')));
    await assertSucceeds(deleteDoc(doc(db(), 'signups/new@person.com')));
    await assertSucceeds(setDoc(doc(db(), 'teamData/depthChartData'), { x: 1 }));
  });
});

describe('the owner', () => {
  it('can always fix the access list, even before it exists', async () => {
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'teamData/access')));
    const db = as('dannym1010@gmail.com');
    await assertSucceeds(getDoc(doc(db, 'teamData/depthChartData')));
    await assertSucceeds(setDoc(doc(db, 'teamData/access'), ACCESS));
    // Before the list exists nobody else gets in.
    await env.withSecurityRulesDisabled((ctx) => deleteDoc(doc(ctx.firestore(), 'teamData/access')));
    await assertFails(getDoc(doc(as('asst@coach.com'), 'teamData/depthChartData')));
  });
});

describe('other collections', () => {
  it('are closed', async () => {
    await assertFails(setDoc(doc(as('head@coach.com'), 'other/x'), { a: 1 }));
    await assertFails(getDoc(doc(as('head@coach.com'), 'other/x')));
  });
});

describe('uploaded files', () => {
  it('coaches upload, viewers read, strangers nothing', async () => {
    await assertSucceeds(uploadString(ref(storageAs('asst@coach.com'), 'playbook_guides/b.txt'), 'x'));
    await assertFails(uploadString(ref(storageAs('family@home.com'), 'playbook_guides/c.txt'), 'x'));
    await assertSucceeds(getBytes(ref(storageAs('family@home.com'), 'playbook_guides/a.txt')));
    await assertFails(getBytes(ref(storageAs('stranger@gmail.com'), 'playbook_guides/a.txt')));
  });
});
