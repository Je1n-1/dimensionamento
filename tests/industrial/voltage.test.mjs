import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createEntity,validateEntity} from '../../frontend/industrial/js/core/model.js';
import {migrateProject} from '../../frontend/industrial/js/core/migrations.js';
import {VoltageService,serviceRequest} from '../../frontend/industrial/js/core/services.js';
import {voltageView,voltageForm,readVoltageForm} from '../../frontend/industrial/js/voltage-view.js';
import {LocalProjectRepository,duplicateProject} from '../../frontend/industrial/js/core/local-repository.js';

const read=v=>JSON.parse(fs.readFileSync(new URL(`../../data/industrial/contracts.v${v}.json`,import.meta.url)));
const contract=read(9),previous=[8,7,6,5,4,3,2].map(read);
const p=JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'tests');from industrial.test_voltage import fixture;print(json.dumps(fixture()))"],{encoding:'utf8'}));
const run=payload=>JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;from voltcalc.industrial.voltage import voltage_request;print(json.dumps(voltage_request(json.load(sys.stdin))))"],{input:JSON.stringify(payload),encoding:'utf8'}));
const token=serviceRequest(contract,p,'voltage');assert.equal(token.rulesVersion,contract.voltageRules.version);
const service=new VoltageService(async(url,o)=>{assert.equal(url,'/api/industrial/voltage');return {ok:true,json:async()=>run(JSON.parse(o.body))};});
const result=await service.calculate(token,p);
assert.equal(result.analysis.results[0].status,'calculated');assert.equal(result.analysis.results[2].distance,51);
const changed=await service.calculate(token,p,{collection:'project',id:p.id,data:{voltagePolicy:{...p.voltagePolicy,originType:'generator'}}});
assert.equal(changed.project.revision,p.revision+1);assert.equal(changed.analysis.results[0].totalLimit,7);
assert.equal(p.voltagePolicy.originType,'delivery_lv');
for(const mutate of [b=>b.analysis.inputRevision++,b=>b.analysis.results.pop(),b=>b.analysis.results[0].totalDrop=Infinity,b=>b.analysis.results[0].id='missing']) {
  const bad=structuredClone(result);mutate(bad);
  await assert.rejects(()=>new VoltageService(async()=>({ok:true,json:async()=>bad})).calculate(token,p),/incompatível/);
}
await assert.rejects(()=>new VoltageService(async()=>{throw Error();}).calculate(token,p),/Servidor indisponível/);
const html=voltageView(p,{analysis:result.analysis});
assert.ok(html.includes('Queda dentro dos limites'));assert.ok(html.includes('Participação de cada trecho'));assert.ok(!html.includes('Conforme'));
const evil=structuredClone(p);evil.consumers[0].tag='<img src=x onerror=alert(1)>';
assert.ok(!voltageView(evil).includes('<img src=x'));assert.ok(voltageView(null).includes('Abra um projeto'));
assert.ok(voltageForm(contract,p,'project',p).includes('Ponto de entrega em baixa tensão'));
const f=new FormData();f.set('resistance','2');f.set('reactance','0');f.set('temperature','70');f.set('sourceKind','manual');f.set('reference','Fixture');f.set('confirmed','on');
const z=readVoltageForm(contract,'cables',f,p.cables[0]).voltageImpedance;
assert.equal(z.reactance,0);assert.equal(z.confirmed,true);assert.deepEqual(validateEntity(contract,'VoltageImpedance',z),[]);
for(const source of previous) {
  const old=createEntity(source,'Project',{name:'Legado',revision:9});
  old.circuits.push(createEntity(source,'Circuit',{tag:'C1'}));if(old.cables)old.cables.push(createEntity(source,'Cable',{tag:'F1'}));
  const before=structuredClone(old),next=migrateProject(old,contract,previous);
  assert.deepEqual(old,before);assert.equal(next.revision,9);assert.equal(next.voltagePolicy.originConfirmed,null);
  assert.equal(next.circuits[0].voltageStudy.scopeConfirmed,null);if(old.cables)assert.equal(next.cables[0].voltageImpedance.resistance,null);
  assert.deepEqual(validateEntity(contract,'Project',next),[]);
}
const memory=new Map([['residential-key','unchanged']]),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},locks={request:async(_k,_o,f)=>f()};
const repo=new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
const saved=await repo.save({...changed.project,storageRevision:0},0),reopened=await repo.load(saved.id);
assert.deepEqual(reopened.voltagePolicy,changed.project.voltagePolicy);assert.deepEqual(reopened.cables[0].voltageImpedance,p.cables[0].voltageImpedance);
await assert.rejects(()=>repo.save(saved,0),/alterado|revisão|outra/i);
const dup=duplicateProject(contract,reopened,new Date().toISOString());
assert.notEqual(dup.voltagePolicy.originNodeId,reopened.voltagePolicy.originNodeId);
assert.equal(run({project:dup,request:serviceRequest(contract,dup,'voltage')}).analysis.results[0].status,'calculated');
assert.equal(memory.get('residential-key'),'unchanged');
console.log('Etapa 8: contratos, migração v2–v7, serviço Python/JS, persistência, duplicação, respostas obsoletas, escape e formulários OK.');
