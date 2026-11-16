import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEntity, validateEntity } from '../../frontend/industrial/js/core/model.js';
import { createStore } from '../../frontend/industrial/js/core/state.js';
import { ProjectRepository } from '../../frontend/industrial/js/core/repository.js';
import { ConductorService, ProtectionService } from '../../frontend/industrial/js/core/services.js';
import { ROUTES, resolveRoute } from '../../frontend/industrial/js/core/routes.js';
import { escapeHTML, field } from '../../frontend/industrial/js/components.js';
import { pageView } from '../../frontend/industrial/js/pages.js';

const contract = JSON.parse(fs.readFileSync(new URL('../../data/industrial/contracts.v1.json', import.meta.url)));
const cases = JSON.parse(fs.readFileSync(new URL('./contract_cases.json', import.meta.url)));
for (const test of cases) {
  assert.equal(validateEntity(contract, test.model, createEntity(contract, test.model, test.changes)).length === 0, test.valid, test.name);
}
for (const power of [NaN, Infinity, true, '20']) assert.ok(validateEntity(contract, 'Consumer', createEntity(contract, 'Consumer', { power })).length);
assert.throws(() => createEntity(contract, 'Project', { residential: true }));
const project = createEntity(contract, 'Project');
const consumer = createEntity(contract, 'Consumer', { tag: 'M1' });
project.consumers.push(consumer);
project.motors.push(createEntity(contract, 'Motor', { consumerId: consumer.id }));
assert.deepEqual(validateEntity(contract, 'Project', project), []);
const invalid = structuredClone(project);
invalid.motors[0].consumerId = 'missing';
assert.ok(validateEntity(contract, 'Project', invalid).some(e => e.code === 'reference'));
invalid.consumers.push(structuredClone(consumer));
assert.ok(validateEntity(contract, 'Project', invalid).some(e => e.code === 'duplicate'));

const store = createStore(contract);
assert.equal(store.snapshot(), null);
store.setDraft(project);
const token = store.token('conductors');
const result = createEntity(contract, 'CalculationResult', { ...Object.fromEntries(Object.entries(token).filter(([k]) => k !== 'projectId')), status: 'not_implemented' });
assert.equal(store.acceptResult(token, result), true);
assert.equal(store.acceptResult(token, { ...result, rulesVersion: '1997' }), false);
assert.equal(store.acceptResult(token, { ...result, status: 'calculated' }), false);
assert.equal(store.acceptResult(token, { ...result, measurements: [{ code: 'current', value: 28.9, unit: 'A' }] }), false);
assert.equal(store.acceptResult(token, { ...result, id: consumer.id }), false, 'result ID cannot collide with a consumer');
assert.equal(store.acceptResult(token, {}), false);
assert.equal(store.acceptResult({ ...token, domain: 'unknown' }, result), false);
store.update(p => { p.consumers[0].power = 15; });
assert.equal(store.snapshot().revision, 1);
assert.equal(store.snapshot().results[0].status, 'invalidated');
assert.equal(store.acceptResult(token, result), false, 'stale async response must be discarded');
const snapshot = store.snapshot(); snapshot.name = 'external mutation';
assert.notEqual(store.snapshot().name, snapshot.name);
assert.throws(() => store.update(p => { p.consumers[0].quantity = -1; }));
assert.equal(store.snapshot().revision, 1, 'invalid edit must be atomic');
assert.throws(() => store.update(p => { p.id = 'other'; }));
const old = structuredClone(project); old.results.push({ ...result, status: 'calculated' });
store.setDraft(old);
assert.equal(store.snapshot().results[0].status, 'invalidated');

const repo = new ProjectRepository();
for (const method of ['list', 'load', 'save', 'duplicate', 'delete']) await assert.rejects(() => repo[method](), { code: 'REPOSITORY_NOT_IMPLEMENTED' });
await assert.rejects(() => new ConductorService().calculate(token, project), /CONDUCTORS_NOT_IMPLEMENTED/);
await assert.rejects(() => new ProtectionService().verify(token, project), /PROTECTION_NOT_IMPLEMENTED/);
assert.deepEqual(ROUTES.filter(r => !r.auxiliary).map(r => r.id), ['projetos', 'consumidores', 'dimensionamento', 'infraestrutura', 'queda-de-tensao', 'visao-geral']);
assert.equal(resolveRoute('#/unknown').id, 'projetos');
assert.equal(resolveRoute('#/infraestrutura').id, 'infraestrutura');
for (const route of ROUTES) {
  const html = pageView(route, contract);
  assert.ok(html.includes('page-title'));
  assert.ok(!html.includes('>Conforme<'));
  assert.ok(!html.includes('map-placeholder'));
  if(route.id==='visao-geral')assert.ok(html.includes('Abra um projeto'));
}
assert.equal(pageView(ROUTES[1], contract).includes('detail-column'), false);
assert.equal(escapeHTML('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
assert.ok(field('Nome', { id: 'name', error: '<inválido>' }).includes('&lt;inválido&gt;'));
console.log('OK: industrial contracts, revision invalidation, isolated repository/services, routes and pending views.');
