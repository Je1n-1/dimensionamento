import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createEntity,validateEntity} from '../../frontend/industrial/js/core/model.js';
import {migrateProject} from '../../frontend/industrial/js/core/migrations.js';
import {OverviewService,diagramPositions,diagramBounds,segmentFacts} from '../../frontend/industrial/js/core/overview.js';
import {overviewView,overviewForm,mapScene} from '../../frontend/industrial/js/overview-view.js';
import {LocalProjectRepository,duplicateProject} from '../../frontend/industrial/js/core/local-repository.js';

const read=v=>JSON.parse(fs.readFileSync(new URL(`../../data/industrial/contracts.v${v}.json`,import.meta.url)));
const contract=read(9),previous=[8,7,6,5,4,3,2].map(read);
const p=JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;sys.path.insert(0,'tests');from industrial.test_voltage import feeder_fixture;print(json.dumps(feeder_fixture()))"],{encoding:'utf8'}));
const run=payload=>JSON.parse(execFileSync('python',['-X','utf8','-c',"import sys,json;from voltcalc.industrial.overview import overview_request;print(json.dumps(overview_request(json.load(sys.stdin))))"],{input:JSON.stringify(payload),encoding:'utf8'}));
const service=new OverviewService(async(url,o)=>{assert.equal(url,'/api/industrial/overview');return {ok:true,json:async()=>run(JSON.parse(o.body))};});
const before=structuredClone(p),result=await service.execute(contract,p);
assert.deepEqual(p,before);assert.equal(result.analysis.summary.status,'partial');assert.equal(result.analysis.summary.consumers,3);
assert.equal(result.analysis.voltage.results[0].distance,48);
for(const mutate of [b=>b.analysis.inputRevision++,b=>b.analysis.voltage.results.pop(),b=>b.analysis.currents.pop(),b=>b.analysis.summary.maxDrop=Infinity,b=>b.analysis.conductors.results[0].id='missing',b=>b.project.revision++]) {
  const bad=structuredClone(result);mutate(bad);
  await assert.rejects(()=>new OverviewService(async()=>({ok:true,json:async()=>bad})).execute(contract,p),/incompat|desatualizada/i);
}
await assert.rejects(()=>new OverviewService(async()=>{throw Error();}).execute(contract,p),/Servidor indisponível/);
await assert.rejects(()=>new OverviewService(async()=>({ok:true,json:async()=>{throw Error();}})).execute(contract,p),/Resposta inválida/);

// Layout is independent of lengths, supports disconnected/cyclic input, and does not mutate entities.
const positions=diagramPositions(p);assert.ok(diagramBounds(positions).width>0);
const changedLength=structuredClone(p);changedLength.segments[0].length=9999;
assert.deepEqual(diagramPositions(changedLength),positions);
const cyclic={nodes:Array.from({length:150},(_,i)=>({id:String(i)})),segments:[{fromNodeId:'0',toNodeId:'1'},{fromNodeId:'1',toNodeId:'0'}]};
const layout=diagramPositions(cyclic);assert.equal(Object.keys(layout).length,150);
assert.equal(new Set(Object.values(layout).map(v=>`${v.x},${v.y}`)).size,150);
assert.deepEqual(diagramBounds({}),{x:0,y:0,width:800,height:400});
const move={action:'positions',positions:[{id:p.nodes[0].id,position:{x:-150,y:220}}]};
const moved=await service.execute(contract,p,move);
assert.equal(moved.project.revision,p.revision);assert.deepEqual(moved.project.segments,p.segments);
assert.deepEqual(diagramPositions(moved.project)[p.nodes[0].id],{x:-150,y:220});
assert.deepEqual((await service.execute(contract,moved.project)).analysis.voltage,result.analysis.voltage);
const edited=await service.execute(contract,moved.project,{action:'segment',id:p.segments[0].id,data:{length:56,notes:'Conferido'}});
assert.equal(edited.project.revision,p.revision+1);assert.equal(edited.project.segments[0].length,56);
assert.equal(edited.analysis,null);
const feeder=p.segments.find(s=>s.tag==='MAIN')||p.segments.at(-1);
const facts=segmentFacts(p,feeder,result.analysis);
assert.equal(facts.loads.length,3);assert.equal(facts.drops.length,1,'Common feeder contribution must not be counted three times');
const failedDrop=structuredClone(result.analysis);failedDrop.voltage.results[0].status='review';
assert.equal(segmentFacts(p,feeder,failedDrop).needsReview,true);
const html=overviewView(p,{analysis:result.analysis,selected:{kind:'segment',id:feeder.id}});
assert.ok(html.includes('Verificação parcial'));assert.ok(!html.includes('Conforme'));
assert.ok(!html.includes('Queda de tensão: não calculada (Etapa 8)'));
const evil=structuredClone(p);evil.nodes[0].label='<img src=x onerror=alert(1)>';evil.segments[0].notes='<script>bad</script>';
assert.ok(!mapScene(evil).includes('<img'));assert.ok(!overviewView(evil).includes('<script>'));
assert.ok(overviewView(null).includes('Abra um projeto'));
assert.ok(overviewForm(p,'position',p.nodes[0].id).includes('não alteram distâncias'));
const missing=structuredClone(p);missing.segments[0].fromNodeId=null;
assert.ok(overviewForm(missing,'segment',missing.segments[0].id).includes('value="" selected'));

for(const source of previous) {
  const old=createEntity(source,'Project',{name:'Legado',revision:9});
  if(source.models.Node){old.nodes.push(createEntity(source,'Node',{label:'Quadro'}));old.segments.push(createEntity(source,'Segment',{tag:'T1'}));}
  const original=structuredClone(old),next=migrateProject(old,contract,previous);
  assert.deepEqual(old,original);assert.equal(next.revision,9);assert.equal(next.schemaVersion,9);
  if(next.nodes.length){assert.equal(next.nodes[0].position,null);assert.equal(next.segments[0].notes,'');}
  assert.deepEqual(validateEntity(contract,'Project',next),[]);
}
const memory=new Map([['residential-key','unchanged']]),storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)},locks={request:async(_k,_o,f)=>f()};
const repo=new LocalProjectRepository(contract,{storage,locks,previousContract:previous});
const saved=await repo.save({...edited.project,storageRevision:0},0),reopened=await repo.load(saved.id);
assert.deepEqual(reopened.nodes,edited.project.nodes);assert.deepEqual(reopened.segments,edited.project.segments);
await assert.rejects(()=>repo.save(saved,0),/alterado|revisão|outra/i);
const dup=duplicateProject(contract,reopened,new Date().toISOString());
assert.notEqual(dup.nodes[0].id,reopened.nodes[0].id);assert.deepEqual(dup.nodes[0].position,reopened.nodes[0].position);
assert.equal(dup.segments[0].length,56);assert.notEqual(dup.segments[0].fromNodeId,reopened.segments[0].fromNodeId);
assert.equal(memory.get('residential-key'),'unchanged');
console.log('Etapa 9: consolidação, layout, 150 pontos, alimentadores, migração, edição, reabertura, duplicação, revisão e escape OK.');
