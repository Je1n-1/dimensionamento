// Testes de migração e round-trip; o motor de cálculo é testado em Python.
const assert=require('node:assert/strict');
require('node:vm').runInThisContext(require('node:fs').readFileSync(require('node:path').join(__dirname,'../frontend/js/model.js'),'utf8'));
const M=globalThis.VoltModel;
const old={format:'VoltCalcGuiado-v2',projectName:'Original',reactance:.5,circuits:[{
 id:'legacy',description:'Circuito antigo',type:'lighting',phase:'mono',voltage:220,quantity:15,power:100,
 unit:'W',powerFactor:.97,length:50,maxDrop:3,insulation:'XLPE',temperature:35,loaded:2
}]};
const migrated=M.readProject(old,true);
assert.equal(migrated.circuits[0].connection,'legacy');
assert.equal(migrated.circuits[0].voltageMode,'manual');
assert.equal(migrated.circuits[0].voltage,220);
assert.equal(migrated.circuits[0].legacyLoaded,2);
assert.equal(migrated.circuits[0].loads[0].quantity,15);
assert.equal(migrated.circuits[0].loads[0].distance,50);
assert.equal(migrated.circuits[0].maxDrop,3);
assert.equal(migrated.reactance,.5);
migrated.circuits[0].loads.push({...M.newLoad(),description:'Segundo grupo',power:20,distance:80});
migrated.editingId='legacy';migrated.draft=M.cleanCircuit(migrated.circuits[0]);migrated.supply.network='220/380';
const restored=M.readProject(JSON.parse(JSON.stringify(M.projectData(migrated))),true);
assert.deepEqual(restored,migrated);
restored.draft.loads[0].power=75;
assert.equal(restored.circuits[0].loads[0].power,100,'Editar rascunho não deve mudar circuito salvo.');
assert.throws(()=>M.readProject({...old,reactance:''},true));
assert.throws(()=>M.readProject({...old,circuits:[old.circuits[0],old.circuits[0]]},true));
assert.throws(()=>M.readProject({...old,format:'unknown'},true));
console.log('OK: migração v2, backup v3, cargas e distâncias, alimentação, vínculo de edição e isolamento do rascunho.');
const imported=M.readProject({...old,format:'VoltCalcGuiado-v3',importInfo:{generalBreaker:32,warnings:['Divergência original']},circuits:[{
 ...M.newCircuit(),number:'8',source:{kind:'csv',filename:'exemplo.csv',p:5500,s:5500,breaker:32},
 loads:[{...M.newLoad(),description:'Carga total importada',distance:''}],temperature:'',metal:'',groupCount:''
}]},true);
const roundtrip=M.readProject(JSON.parse(JSON.stringify(M.projectData(imported))),true);
assert.deepEqual(roundtrip,imported);
assert.equal(roundtrip.circuits[0].loads[0].distance,'');
assert.equal(roundtrip.circuits[0].metal,'');
roundtrip.draft.source.p=7000;
assert.equal(roundtrip.circuits[0].source.p,5500);
console.log('OK: valores originais CSV, identificação, pendências e metadados preservados no backup.');
