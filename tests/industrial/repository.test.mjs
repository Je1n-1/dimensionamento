import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEntity, validateEntity } from '../../frontend/industrial/js/core/model.js';
import { createStore } from '../../frontend/industrial/js/core/state.js';
import { LocalProjectRepository, INDUSTRIAL_STORAGE } from '../../frontend/industrial/js/core/local-repository.js';
import { projectsView } from '../../frontend/industrial/js/projects-view.js';

const contract = JSON.parse(fs.readFileSync(new URL('../../data/industrial/contracts.v2.json', import.meta.url)));
class MemoryStorage {
  data = new Map([['voltcalc_guiado_v3', 'residential-preserved']]);
  denyRead = false; denyWrite = false; writes = 0;
  getItem(key) { if (this.denyRead) throw Error('denied'); return this.data.get(key) ?? null; }
  setItem(key, value) { if (this.denyWrite) throw Error('quota'); this.writes++; this.data.set(key, value); }
}
function serialLocks() {
  let chain = Promise.resolve();
  return { request(_key, _options, work) { const task = chain.then(work); chain = task.catch(() => {}); return task; } };
}
const storage = new MemoryStorage(), locks = serialLocks();
let clock = 0;
const options = { storage, locks, now: () => new Date(Date.UTC(2026, 9, 24, 12, 0, clock++)).toISOString() };
const repo = new LocalProjectRepository(contract, options);
const entity = (name, values = {}) => createEntity(contract, name, values);
const a = entity('Project', { name: 'Bombeamento A', description: 'Unidade sul', workflowStatus: 'active' });
const load = entity('Consumer', { type: 'motor', tag: 'M1', power: 15, unit: 'cv', powerBasis: 'mechanical', connection: '3F' });
const panel = entity('Panel', { tag: 'Q1' });
const circuit = entity('Circuit', { originPanelId: panel.id, consumerIds: [load.id] });
const origin = entity('Node', { kind: 'panel', entityId: panel.id });
const end = entity('Node', { kind: 'consumer', entityId: load.id });
const segment = entity('Segment', { fromNodeId: origin.id, toNodeId: end.id, circuitIds: [circuit.id], length: 20 });
circuit.segmentIds = [segment.id]; load.panelId = panel.id; load.plannedSegmentId = segment.id;
const conductor = entity('Conductor', { circuitId: circuit.id, role: 'PE' });
a.consumers = [load]; a.panels = [panel]; a.circuits = [circuit]; a.nodes = [origin, end]; a.segments = [segment]; a.conductors = [conductor];
a.motors = [entity('Motor', { consumerId: load.id, source: entity('Source', { reference: load.id, kind: 'plate' }) })];
a.infrastructures = [entity('Infrastructure', { segmentId: segment.id, conductorIds: [conductor.id], type: 'conduit' })];
a.results = [entity('CalculationResult', { domain: 'conductors', targetId: circuit.id, engineVersion: contract.engineVersion, rulesVersion: contract.rules.version, reason: 'Dados pendentes', criteria: [entity('Criterion', { code: 'protection', status: 'pending' })] })];
assert.deepEqual(validateEntity(contract, 'Project', a), []);
const savedA = await repo.save(a, 0);
assert.equal(savedA.storageRevision, 1); assert.equal(a.storageRevision, 0);
const savedB = await repo.save(entity('Project', { name: 'Embalagem B', description: 'Linha norte' }), 0);
assert.equal((await repo.list()).length, 2);
assert.equal((await repo.list({ search: 'sul' }))[0].id, savedA.id);
assert.equal((await repo.list({ status: 'draft' })).length, 1);
assert.equal((await repo.list({ sort: 'name' }))[0].name, 'Bombeamento A');
assert.equal(await repo.getCurrentId(), savedB.id);
await repo.setCurrentId(savedA.id);
const store = createStore(contract); store.setDraft(await repo.load(savedA.id));
assert.equal(store.snapshot().motors[0].consumerId, load.id);
await repo.setCurrentId(null); store.clear();
assert.equal(store.snapshot(), null); assert.equal(await repo.getCurrentId(), null);
// New adapter instance represents closing/reopening the application.
const reopened = new LocalProjectRepository(contract, options);
assert.deepEqual(await reopened.load(savedA.id), savedA);
const detached = await reopened.load(savedA.id); detached.consumers[0].tag = 'changed outside';
assert.equal((await reopened.load(savedA.id)).consumers[0].tag, 'M1');
const edited = { ...savedA, name: 'Bombeamento revisado' };
const savedEdit = await reopened.save(edited, savedA.storageRevision);
assert.equal(savedEdit.revision, savedA.revision, 'metadata save must not invalidate electrical input revision');
assert.equal(savedEdit.createdAt, savedA.createdAt); assert.notEqual(savedEdit.updatedAt, savedA.updatedAt);
assert.deepEqual((await reopened.load(savedB.id)), savedB, 'editing A must preserve B');
const copy = await reopened.duplicate(savedEdit.id, savedEdit.storageRevision);
assert.notEqual(copy.id, savedEdit.id); assert.notEqual(copy.consumers[0].id, load.id);
assert.equal(copy.motors[0].consumerId, copy.consumers[0].id);
assert.equal(copy.circuits[0].originPanelId, copy.panels[0].id);
assert.equal(copy.circuits[0].segmentIds[0], copy.segments[0].id);
assert.equal(copy.segments[0].fromNodeId, copy.nodes[0].id);
assert.equal(copy.nodes[0].entityId, copy.panels[0].id);
assert.equal(copy.infrastructures[0].conductorIds[0], copy.conductors[0].id);
assert.equal(copy.results[0].targetId, copy.circuits[0].id);
assert.equal(copy.motors[0].source.reference, load.id, 'catalog/source text must not be remapped');
assert.equal(copy.results[0].status, 'invalidated');
assert.deepEqual(validateEntity(contract, 'Project', copy), []);
copy.consumers[0].tag = 'M2'; await reopened.save(copy, copy.storageRevision);
assert.equal((await reopened.load(savedEdit.id)).consumers[0].tag, 'M1');
// Competing saves must not silently overwrite one another.
const v1 = await repo.load(savedEdit.id), v2 = await reopened.load(savedEdit.id);
const races = await Promise.allSettled([repo.save({ ...v1, description: 'one' }, v1.storageRevision), reopened.save({ ...v2, description: 'two' }, v2.storageRevision)]);
assert.equal(races.filter(r => r.status === 'fulfilled').length, 1);
assert.equal(races.find(r => r.status === 'rejected').reason.code, 'REVISION_CONFLICT');
await assert.rejects(() => repo.delete(savedEdit.id, savedEdit.storageRevision), { code: 'REVISION_CONFLICT' });
await assert.rejects(() => repo.duplicate(savedEdit.id, savedEdit.storageRevision), { code: 'REVISION_CONFLICT' });
const beforeFailure = storage.getItem(INDUSTRIAL_STORAGE);
storage.denyWrite = true;
await assert.rejects(() => repo.save(entity('Project', { name: 'Not saved' }), 0), { code: 'STORAGE_WRITE' });
assert.equal(storage.getItem(INDUSTRIAL_STORAGE), beforeFailure);
storage.denyWrite = false;
await repo.setCurrentId(savedB.id); await repo.delete(savedB.id, savedB.storageRevision);
assert.equal(await repo.getCurrentId(), null);
await assert.rejects(() => repo.load(savedB.id), { code: 'NOT_FOUND' });
assert.ok(await repo.load(savedEdit.id));
const empty = entity('Project');
await assert.rejects(() => repo.save(empty, 0), { code: 'INVALID_PROJECT' });
await assert.rejects(() => new LocalProjectRepository(contract, { storage, locks: null }).save(entity('Project', { name: 'No locks' }), 0), { code: 'LOCK_UNAVAILABLE' });
storage.denyRead = true;
await assert.rejects(() => repo.list(), { code: 'STORAGE_READ' }); storage.denyRead = false;
const preserved = storage.getItem(INDUSTRIAL_STORAGE);
for (const corrupt of ['{broken', '{"version":999}', JSON.stringify({ format: 'voltcalc-industrial-projects', version: 1, currentId: 'unknown', projects: [] })]) {
  storage.data.set(INDUSTRIAL_STORAGE, corrupt); const writes = storage.writes;
  await assert.rejects(() => repo.save(entity('Project', { name: 'Blocked overwrite' }), 0), { code: 'STORAGE_CORRUPT' });
  assert.equal(storage.getItem(INDUSTRIAL_STORAGE), corrupt); assert.equal(storage.writes, writes);
}
storage.data.set(INDUSTRIAL_STORAGE, preserved);
assert.equal(storage.getItem('voltcalc_guiado_v3'), 'residential-preserved');
const html = projectsView({ all: await repo.list(), rows: await repo.list(), current: null, query: {} });
assert.ok(html.includes('Potência não calculada')); assert.ok(!html.includes('>Conforme<'));
const hostile = { ...(await repo.list())[0], name: '<img src=x onerror=alert(1)>' };
assert.ok(projectsView({ all: [hostile], rows: [hostile] }).includes('&lt;img'));
console.log('OK: create/save/close/reopen/edit/duplicate/delete; references, isolation, conflicts, failures, corruption and catalog UI.');
