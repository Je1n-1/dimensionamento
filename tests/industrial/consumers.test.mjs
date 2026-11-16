import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createEntity, validateEntity } from '../../frontend/industrial/js/core/model.js';
import { upsertConsumer, removeConsumer, filterConsumers, conductorLabel, missingConsumerData, TYPES } from '../../frontend/industrial/js/core/consumers.js';
import { migrateProject } from '../../frontend/industrial/js/core/migrations.js';
import { LocalProjectRepository, INDUSTRIAL_STORAGE } from '../../frontend/industrial/js/core/local-repository.js';
import { consumersView, consumerForm } from '../../frontend/industrial/js/consumers-view.js';

const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/industrial/${name}`,import.meta.url)));
const contract = read('contracts.v3.json'), previous = read('contracts.v2.json');
const entity = (name, overrides = {}) => createEntity(contract,name,overrides);
let project = entity('Project',{name:'Painel de testes'});
const q = entity('Consumer',{type:'panel',tag:'QGBT'});
project = upsertConsumer(contract,project,q);
const originId = project.panels[0].id;
assert.equal(project.panels[0].consumerId,q.id);
assert.equal(project.supply.earthing,null);
assert.equal(project.currentStage,3);
const m = entity('Consumer',{type:'motor',tag:'M1',description:'Bomba',quantity:2,power:15,unit:'cv',powerBasis:'mechanical',voltage:380,frequency:60,connection:'3F',phaseSet:'ABC',hasPE:true,powerFactor:.85,efficiency:.92,panelId:originId,plannedSegmentTag:'T-01',distance:28,distanceBasis:'cumulative',environment:'Setor sul',temperature:35,installationMethod:'B1',cableMaterial:'copper',cableType:'unipolar',insulation:'XLPE',notes:'Bomba de processo'});
const motor = entity('Motor',{poles:4,serviceFactor:1.15,plateCurrent:30,catalogCurrent:29,source:entity('Source',{manufacturer:'Fabricante de teste',model:'Modelo QA',edition:'2026',reference:'Documento QA / p. 2'})});
const before = structuredClone(project);
project = upsertConsumer(contract,project,m,motor);
assert.deepEqual(before.consumers,[q]);
assert.deepEqual(validateEntity(contract,'Project',project),[]);
assert.equal(project.motors[0].consumerId,m.id);
assert.equal(project.motors[0].catalogCurrent,29);
assert.equal(project.motors[0].plateCurrent,30);
assert.equal(project.supply.earthing,null,'3F must not infer TT or another earthing system');
assert.equal(conductorLabel(m),'L1 + L2 + L3 + PE');
assert.deepEqual(missingConsumerData(m),[]);
assert.equal(project.segments.length,0,'planned tag and distance do not create topology');
assert.equal(filterConsumers(project,{type:'motor',environment:'Setor sul',segment:'T-01',search:'processo'}).length,1);
assert.equal(filterConsumers(project,{search:'<script>'}).length,0);
const stable = structuredClone(project);
for (const [changes,field] of [
  [{tag:' '},'tag'],[{tag:'qgbt'},'tag'],[{type:null},'type'],[{quantity:0},'quantity'],[{quantity:1.5},'quantity'],[{power:Infinity},'power'],[{power:0},'power'],[{power:-1},'power'],[{powerFactor:1.1},'powerFactor'],[{efficiency:0},'efficiency'],[{frequency:-1},'frequency'],[{voltage:0},'voltage'],[{temperature:250},'temperature'],[{unit:null},'unit'],[{powerBasis:null},'powerBasis'],[{unit:'VA'},'powerBasis'],[{phaseSet:'A'},'phaseSet'],[{distanceBasis:null},'distanceBasis'],[{distance:-5},'distance'],[{panelId:'missing'},'panelId'],[{plannedSegmentId:'missing'},'plannedSegmentId'],[{insulation:'other'},'insulationDescription'],
]) {
  assert.throws(() => upsertConsumer(contract,project,{...m,...changes},motor), error => error.field === field, JSON.stringify(changes));
  assert.deepEqual(project,stable,'rejected changes must be atomic');
}
assert.throws(() => upsertConsumer(contract,project,m,{...motor,source:entity('Source')}), /fabricante/);
assert.throws(() => upsertConsumer(contract,project,{...q,quantity:2}), /quantidade 1/);
assert.throws(() => removeConsumer(contract,project,q.id), /vínculos/);
assert.throws(() => upsertConsumer(contract,project,{...q,type:'other'}), /vínculos/);
assert.throws(() => upsertConsumer(contract,project,{...q,panelId:originId}), /ciclo/);
// Revisions, targeted deletion and conservative result invalidation.
project.results.push(entity('CalculationResult',{targetId:m.id,domain:'currents',engineVersion:contract.engineVersion,rulesVersion:contract.rules.version,inputRevision:project.revision}));
project = upsertConsumer(contract,project,{...m,distance:35},motor);
assert.equal(project.results[0].status,'invalidated');
assert.deepEqual(project.results[0].measurements,[]);
assert.equal(project.revision,stable.revision+1);
const motorId = project.motors[0].id;
project = upsertConsumer(contract,project,{...m,distance:36},motor);
assert.equal(project.motors[0].id,motorId);
// A circuit/node reference prevents deletion even when the UI does not edit graphs yet.
const linked = structuredClone(project); linked.circuits.push(entity('Circuit',{consumerIds:[m.id]}));
assert.throws(() => removeConsumer(contract,linked,m.id), /vínculos/);
const nodeLinked = structuredClone(project); nodeLinked.nodes.push(entity('Node',{kind:'consumer',entityId:m.id}));
assert.throws(() => removeConsumer(contract,nodeLinked,m.id), /vínculos/);
project = removeConsumer(contract,project,m.id);
assert.equal(project.results.length,0); assert.equal(project.motors.length,0); assert.equal(project.panels.length,1);
for (const [index,type] of Object.keys(TYPES).entries()) {
  const c = entity('Consumer',{type,tag:`C${index}`});
  project = upsertConsumer(contract,project,c);
  assert.ok(project.consumers.some(item=>item.id === c.id));
  const edited = {...c,description:'Editado',environment:'Área de teste',quantity:type === 'panel' ? 1 : 3};
  project = upsertConsumer(contract,project,edited);
  assert.equal(project.consumers.find(item=>item.id === c.id).description,'Editado');
  project = removeConsumer(contract,project,c.id);
  assert.ok(!project.consumers.some(item=>item.id === c.id));
}
// Valid alternative connections, units and distance bases remain separate data.
for (const [connection,phaseSet] of [['FN','B'],['FF','BC'],['3FN','ABC']]) assert.ok(upsertConsumer(contract,project,{...m,connection,phaseSet},motor));
for (const [unit,powerBasis] of [['W','electrical'],['kW','mechanical'],['VA','apparent'],['kVA','apparent'],['cv','mechanical'],['hp','mechanical']]) assert.ok(upsertConsumer(contract,project,{...m,unit,powerBasis,distance:0,distanceBasis:'physical'},motor));
project = upsertConsumer(contract,project,m,motor);
const html = consumersView(project,{type:'motor'});
assert.ok(html.includes('Placa informada: 30')); assert.ok(html.includes('Catálogo manual: 29'));
assert.ok(!html.includes('>Conforme<')); assert.ok(!html.includes('detail-column'));
assert.ok(html.includes('Calcular potências e correntes'));
const hostile = {...m,description:'<img src=x onerror=alert(1)>',notes:'<script>'};
assert.ok(consumersView({...project,consumers:[hostile]}).includes('&lt;img'));
assert.ok(consumerForm(project,hostile,motor,true).includes('&lt;script&gt;'));
assert.ok(consumerForm(project,m,motor,true).includes('value="true" selected'));
// Actual repository round-trip, no side effects on unrelated projects.
const data = new Map([['voltcalc_guiado_v3','residencial']]);
const storage = {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
const locks = { request:async (_name,_options,work)=>work() };
const repo = new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
const saved = await repo.save(project,0);
const other = await repo.save(entity('Project',{name:'Outro projeto'}),0);
const reopened = new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
assert.deepEqual(await reopened.load(saved.id),saved);
const change = upsertConsumer(contract,saved,{...m,notes:'Alterado'},motor);
await reopened.save(change,saved.storageRevision);
await assert.rejects(()=>repo.save(change,saved.storageRevision),{code:'REVISION_CONFLICT'});
assert.deepEqual(await repo.load(other.id),other);
assert.equal(data.get('voltcalc_guiado_v3'),'residencial');
// v2 stored projects are upgraded additively, only committed on successful write.
const old = createEntity(previous,'Project',{name:'Legado',storageRevision:1,createdAt:'2026-10-24T12:00:00Z',updatedAt:'2026-10-24T12:00:00Z'});
old.consumers.push(createEntity(previous,'Consumer',{type:'motor',tag:'M antigo',distance:12,distanceBasis:'physical'}));
old.motors.push(createEntity(previous,'Motor',{consumerId:old.consumers[0].id,plateCurrent:15}));
const oldSnapshot = structuredClone(old), envelope = JSON.stringify({format:'voltcalc-industrial-projects',version:1,currentId:old.id,projects:[old]});
data.set(INDUSTRIAL_STORAGE,envelope);
const migrated = await repo.load(old.id);
assert.equal(migrated.schemaVersion,3); assert.equal(migrated.storageRevision,1);
assert.equal(migrated.consumers[0].cableMaterial,null); assert.equal(migrated.motors[0].catalogCurrent,null);
assert.equal(migrated.motors[0].plateCurrent,15); assert.equal(migrated.consumers[0].distanceBasis,'physical');
assert.deepEqual(old,oldSnapshot); assert.equal(data.get(INDUSTRIAL_STORAGE),envelope,'reading must not rewrite storage');
const noWrite = new LocalProjectRepository(contract,{storage:{...storage,setItem(){throw Error('quota');}},locks,previousContract:previous});
await assert.rejects(()=>noWrite.save(migrated,1),{code:'STORAGE_WRITE'});
assert.equal(data.get(INDUSTRIAL_STORAGE),envelope);
await repo.save(migrated,1); assert.equal(JSON.parse(data.get(INDUSTRIAL_STORAGE)).projects[0].schemaVersion,3);
assert.throws(()=>migrateProject({...old,schemaVersion:999},contract,previous));
assert.throws(()=>migrateProject({...old,unknown:true},contract,previous));
assert.throws(()=>migrateProject(old,contract,null));
console.log('OK: consumer types, contextual validation, relations, invalidation, persistence, conflicts, v2 migration and honest UI.');
