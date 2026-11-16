import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createEntity,validateEntity} from '../../frontend/industrial/js/core/model.js';
import {LocalProjectRepository,INDUSTRIAL_STORAGE} from '../../frontend/industrial/js/core/local-repository.js';
import {projectBackup,readProjectBackup,MAX_PROJECT_BYTES} from '../../frontend/industrial/js/core/project-files.js';
import {ReportService,reportKey} from '../../frontend/industrial/js/core/reports.js';
import {reportsView} from '../../frontend/industrial/js/reports-view.js';
const read=v=>JSON.parse(fs.readFileSync(new URL(`../../data/industrial/contracts.v${v}.json`,import.meta.url)));
const contract=read(9),previous=[8,7,6,5,4,3,2].map(read);
const p=JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'tests');from industrial.test_voltage import feeder_fixture;print(json.dumps(feeder_fixture()))"],{encoding:'utf8'}));
p.nodes[0].position={x:-120,y:350};p.segments[0].notes='Percurso conferido';
const before=structuredClone(p),backup=projectBackup(contract,p),parsed=readProjectBackup(contract,previous,backup);
assert.deepEqual(p,before);assert.deepEqual(parsed,{...p,results:[]});
const altered=JSON.parse(backup);altered.project.cables[0].circuitId='missing';
assert.throws(()=>readProjectBackup(contract,previous,JSON.stringify(altered)),/inválid/);
for(const text of ['{}','null','[1]',backup.slice(0,-2),'x'.repeat(MAX_PROJECT_BYTES+1)])assert.throws(()=>readProjectBackup(contract,previous,text));
for(const source of previous){
 const legacy=createEntity(source,'Project',{name:'Legado'});
 const upgraded=readProjectBackup(contract,previous,projectBackup(source,legacy));
 assert.equal(upgraded.schemaVersion,9);assert.equal(upgraded.name,'Legado');assert.deepEqual(validateEntity(contract,'Project',upgraded),[]);
}
const memory=new Map([['residential','preservado']]),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},locks={request:async(_k,_o,f)=>f()};
const repo=new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
const original=await repo.save({...p,storageRevision:0},0),imported=await repo.importProject(parsed);
assert.notEqual(imported.id,original.id);assert.equal((await repo.list()).length,2);assert.deepEqual(await repo.load(original.id),original);
assert.deepEqual(imported.nodes[0].position,p.nodes[0].position);assert.equal(imported.segments[0].notes,p.segments[0].notes);
assert.notEqual(imported.cables[0].circuitId,p.cables[0].circuitId);
assert.equal(imported.cables[0].circuitId,imported.circuits[0].id);assert.equal(imported.voltagePolicy.originNodeId,imported.nodes.at(-1).id);
assert.equal(imported.results.length,0);assert.equal(memory.get('residential'),'preservado');
await repo.setCurrentId(null);assert.equal(await repo.getCurrentId(),null);
await repo.setCurrentId(imported.id);assert.deepEqual(await repo.load(await repo.getCurrentId()),imported);
const duplicate=await repo.duplicate(imported.id,imported.storageRevision);assert.deepEqual(duplicate.nodes[0].position,imported.nodes[0].position);
const latest=await repo.save(imported,imported.storageRevision);await assert.rejects(()=>repo.save(imported,imported.storageRevision),/outra aba/);
const raw=storage.getItem(INDUSTRIAL_STORAGE),badRepo=new LocalProjectRepository(contract,{storage:{getItem:storage.getItem,setItem:()=>{throw Error('quota');}},locks,previousContract:previous});
await assert.rejects(()=>badRepo.importProject(parsed),/Não foi possível salvar/);assert.equal(storage.getItem(INDUSTRIAL_STORAGE),raw);
const corruptRepo=new LocalProjectRepository(contract,{storage:{getItem:()=>'{bad',setItem:()=>assert.fail('Must not overwrite corruption')},locks});
await assert.rejects(()=>corruptRepo.importProject(parsed),/original foi preservado/);
const run=payload=>JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;from voltcalc.industrial.reports import report_request;print(json.dumps(report_request(json.load(sys.stdin))))"],{input:JSON.stringify(payload),encoding:'utf8'}));
const service=new ReportService(contract,async(url,o)=>{assert.equal(url,'/api/industrial/reports');return {ok:true,json:async()=>run(JSON.parse(o.body))};});
const result=await service.generate(latest);
assert.equal(result.report.status,'partial');assert.equal(result.report.summary.consumers,3);
assert.equal(result.report.diagram.nodes[0].x,-120);assert.ok(reportsView(latest,{report:result.report}).includes('Backup JSON'));
assert.ok(!reportsView(latest,{report:result.report}).includes('>Conforme<'));
assert.ok(reportsView(null).includes('Abra um projeto'));
const escaped=structuredClone(result.report);escaped.sections[0].blocks[0].rows[0][1]='<img src=x onerror=alert(1)>';
assert.ok(!reportsView(latest,{report:escaped}).includes('<img src=x'));
for(const mutate of [b=>b.report.inputRevision++,b=>b.report.versions.conductorRules='old',b=>b.report.sections[0].blocks[0].rows[0].pop(),b=>b.report.status='conforme']){
 const bad=structuredClone(result);mutate(bad);await assert.rejects(()=>new ReportService(contract,async()=>({ok:true,json:async()=>bad})).generate(latest),/incompatível|incompatíveis/);
}
const changed=structuredClone(latest);changed.nodes[0].position.x++;assert.notEqual(reportKey(changed),reportKey(latest));
const csv=await service.generate(latest,'csv');assert.equal(csv.extension,'csv');assert.ok(csv.content.includes('Correntes')||csv.content.includes('correntes'));
await assert.rejects(()=>new ReportService(contract,async()=>{throw Error();}).generate(latest),/servidor Python/);
console.log('Etapa 10: backup, migração, importação sem sobrescrita, vínculos, posição, fechamento/reabertura, duplicação, quota, corrupção, conflitos, relatório, versões e CSV OK.');

// PDF mode must be explicit and echoed, never silently downgraded by an older server.
const pdfTransport=async(_url,o)=>{
 const payload=JSON.parse(o.body);assert.equal(payload.format,'pdf');
 return {ok:true,json:async()=>({...result,extension:'pdf',mime:'application/pdf',content:'JVBERg==',pdfDetail:payload.pdfDetail})};
};
const pdfService=new ReportService(contract,pdfTransport);
assert.equal((await pdfService.generate(latest,'pdf')).pdfDetail,'summary');
assert.equal((await pdfService.generate(latest,'pdf','full')).pdfDetail,'full');
await assert.rejects(()=>new ReportService(contract,async()=>({ok:true,json:async()=>({...result,extension:'pdf',mime:'application/pdf',content:'JVBERg=='})})).generate(latest,'pdf'),/Detalhamento/);
assert.match(reportsView(latest,{report:result.report}),/value="summary" selected/);
assert.match(reportsView(latest,{report:result.report,pdfDetail:'full'}),/value="full" selected/);
console.log('PDF: resumo padrão, memória completa selecionável e rejeição de servidor sem suporte OK.');
