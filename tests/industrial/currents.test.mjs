import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createEntity,validateEntity} from '../../frontend/industrial/js/core/model.js';
import {createStore} from '../../frontend/industrial/js/core/state.js';
import {serviceRequest,CurrentService} from '../../frontend/industrial/js/core/services.js';
import {applyCurrentResponse,currentResult,activePowerSummary} from '../../frontend/industrial/js/core/currents.js';
import {migrateProject} from '../../frontend/industrial/js/core/migrations.js';
import {LocalProjectRepository,INDUSTRIAL_STORAGE} from '../../frontend/industrial/js/core/local-repository.js';
import {upsertConsumer} from '../../frontend/industrial/js/core/consumers.js';
import {currentsView} from '../../frontend/industrial/js/currents-view.js';
import {consumerForm} from '../../frontend/industrial/js/consumers-view.js';

const read=v=>JSON.parse(fs.readFileSync(new URL(`../../data/industrial/contracts.v${v}.json`,import.meta.url)));
const contract=read(9), previous=[read(8),read(7),read(6),read(5),read(4),read(3),read(2)];
const e=(name,values={})=>createEntity(contract,name,values);
let p=e('Project',{name:'Teste de correntes',revision:3});
const c=e('Consumer',{type:'motor',tag:'M1',power:20,unit:'cv',powerBasis:'mechanical',voltage:380,frequency:60,connection:'3F',phaseSet:'ABC',balanced:true,powerFactor:.85,efficiency:.9});
const m=e('Motor',{consumerId:c.id,catalogId:'weg-w21-fockink-2006-v1',poles:4,nominalConditionsConfirmed:true,exclusiveS1Circuit:true,usesServiceFactor:true,serviceFactor:1.15});
p.consumers=[c];p.motors=[m];
const token=serviceRequest(contract,p,'currents');
assert.equal(token.rulesVersion,contract.currentRules.version);
// Exercise the real Python/JS boundary, not duplicated arithmetic in JS.
const code="import sys,json; from voltcalc.industrial.currents import current_request; print(json.dumps(current_request(json.load(sys.stdin))))";
const response=JSON.parse(execFileSync('python',['-c',code],{input:JSON.stringify({project:p,request:token}),encoding:'utf8'}));
const next=applyCurrentResponse(contract,p,response);
assert.deepEqual(validateEntity(contract,'Project',next),[]);
assert.equal(p.results.length,0);assert.equal(next.currentStage,4);assert.equal(next.revision,p.revision);
let r=currentResult(next,c.id);
assert.equal(r.currentSource,'catalog');assert.equal(r.measurements.find(v=>v.code==='nominal_a').value,30.4);
assert.ok(r.trace.includes('47/111'));
for(const transform of [
  r=>({...r,request:{...r.request,projectId:'other'}}),r=>({...r,results:[]}),
  r=>({...r,results:[{...r.results[0],targetId:'other'}]}),
  r=>({...r,results:[{...r.results[0],engineVersion:'old'}]}),
  r=>({...r,results:[{...r.results[0],trace:''}]}),
  r=>({...r,results:[{...r.results[0],domain:'protection'}]}),
  r=>({...r,results:[{...r.results[0],criteria:[{code:'global',status:'passed',reference:'2004',reason:'fake'}]}]}),
]) assert.throws(()=>applyCurrentResponse(contract,p,transform(structuredClone(response))));
const store=createStore(contract);store.setDraft(next);
store.update(p=>{p.consumers[0].quantity=2;});
assert.equal(currentResult(store.snapshot(),c.id),undefined);
assert.equal(store.acceptResult(token,response.results[0]),false);
const oldRules=structuredClone(next);oldRules.results[0].rulesVersion='old';store.setDraft(oldRules);
assert.equal(store.snapshot().results[0].status,'invalidated');
const noProtection=structuredClone(next);noProtection.results[0].domain='protection';store.setDraft(noProtection);
assert.equal(store.snapshot().results[0].status,'invalidated');
const html=currentsView(next);
assert.ok(html.includes('30,4 A'));assert.ok(html.includes('34,96 A'));assert.ok(html.includes('Catálogo'));
assert.ok(!html.includes('Conforme'));assert.ok(html.includes('não verificados'));
const malicious=structuredClone(next);malicious.results[0].trace='<script>alert(1)</script>';
assert.ok(!currentsView(malicious).includes('<script>'));assert.ok(currentsView(malicious).includes('&lt;script&gt;'));
assert.ok(!currentsView(store.snapshot()).includes('30,4 A'));
assert.equal(activePowerSummary(next).value,r.measurements.find(v=>v.code==='electrical_total_w').value);
const withPanel=structuredClone(next);withPanel.consumers.push(e('Consumer',{type:'panel',tag:'Q1'}));
assert.equal(activePowerSummary(withPanel).value,null);
const incomplete=structuredClone(next);incomplete.consumers.push(e('Consumer',{type:'lighting',tag:'L1'}));
assert.ok(activePowerSummary(incomplete).reason.includes('soma parcial'));
assert.ok(consumerForm(p,c,m,true).includes('nominalConditionsConfirmed'));

// Atomic migration/persistence retains old input and never invents confirmations.
const data=new Map([['voltcalc_guiado_v3','residential-preserved']]);
const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
const locks={request:async(_key,_options,fn)=>fn()};
for(const legacy of previous){
  const old=createEntity(legacy,'Project',{name:'Legado',storageRevision:1,createdAt:'2026-10-25T12:00:00Z',updatedAt:'2026-10-25T12:00:00Z'});
  old.consumers.push(createEntity(legacy,'Consumer',{type:'motor',tag:'Anterior',power:15,unit:'cv',powerBasis:'mechanical'}));
  old.motors.push(createEntity(legacy,'Motor',{consumerId:old.consumers[0].id,plateCurrent:22.7}));
  const raw=JSON.stringify({format:'voltcalc-industrial-projects',version:1,currentId:old.id,projects:[old]});data.set(INDUSTRIAL_STORAGE,raw);
  const repo=new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
  const migrated=await repo.load(old.id);
  assert.equal(migrated.schemaVersion,9);assert.equal(migrated.revision,old.revision);
  assert.equal(migrated.motors[0].plateCurrent,22.7);assert.equal(migrated.motors[0].exclusiveS1Circuit,null);
  assert.equal(migrated.motors[0].catalogId,null);assert.equal(migrated.consumers[0].balanced,null);
  assert.equal(data.get(INDUSTRIAL_STORAGE),raw);
  const failing=new LocalProjectRepository(contract,{storage:{...storage,setItem(){throw Error('quota');}},locks,previousContract:previous});
  await assert.rejects(()=>failing.save(migrated,1),{code:'STORAGE_WRITE'});assert.equal(data.get(INDUSTRIAL_STORAGE),raw);
  await repo.save(migrated,1);assert.equal(JSON.parse(data.get(INDUSTRIAL_STORAGE)).projects[0].schemaVersion,9);
}
assert.throws(()=>migrateProject({...p,schemaVersion:999},contract,previous));
data.delete(INDUSTRIAL_STORAGE);
const repo=new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
const saved=await repo.save(next,0);assert.deepEqual((await repo.load(saved.id)).results,next.results);
const edited=upsertConsumer(contract,saved,{...c,quantity:2},m);
assert.equal(edited.results[0].status,'invalidated');assert.deepEqual(edited.results[0].measurements,[]);
await repo.save(edited,saved.storageRevision);
await assert.rejects(()=>repo.save(saved,saved.storageRevision),{code:'REVISION_CONFLICT'});
const duplicate=await repo.duplicate(saved.id,2);
assert.ok(duplicate.results.every(r=>r.status==='invalidated'&&r.measurements.length===0));
assert.equal(data.get('voltcalc_guiado_v3'),'residential-preserved');
await assert.rejects(()=>new CurrentService(async()=>{throw Error('offline');}).calculate(token,p),/python server.py/);
await assert.rejects(()=>new CurrentService(async()=>({ok:false,json:async()=>({error:'Dados inválidos'})})).calculate(token,p),/Dados inválidos/);
await assert.rejects(()=>new CurrentService(async()=>({ok:true,json:async()=>{throw Error();}})).calculate(token,p),/Resposta inválida/);
const originalFetch=globalThis.fetch;
try {
  globalThis.fetch=function(url,options){
    assert.equal(this,globalThis,'native browser fetch requires its global receiver');
    assert.equal(url,'/api/industrial/currents');assert.equal(JSON.parse(options.body).project.id,p.id);
    return Promise.resolve({ok:true,json:async()=>response});
  };
  assert.deepEqual(await new CurrentService().calculate(token,p),response);
} finally {globalThis.fetch=originalFetch;}
console.log('OK: Python/JS current contract, provenance, invalidation, isolated persistence, conflicts, v2/v3 migration, source UI and offline service.');
