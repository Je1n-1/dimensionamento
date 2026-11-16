import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {consumerWorkflow} from '../../frontend/industrial/js/core/workflow.js';
import {missingConsumerData, filterConsumers} from '../../frontend/industrial/js/core/consumers.js';
import {consumerLinks} from '../../frontend/industrial/js/workflow-view.js';
import {consumersView} from '../../frontend/industrial/js/consumers-view.js';
import {preparationForm} from '../../frontend/industrial/js/topology-view.js';

const project=JSON.parse(execFileSync('python',['-X','utf8','-c',
  "import runpy,json; print(json.dumps(runpy.run_path('examples/industrial/example_15kw.py')['build_example']()))"],{encoding:'utf8'}));
const before=structuredClone(project), load=project.consumers[0];
const workflow=consumerWorkflow(project,load);
assert.equal(workflow.circuits.length,1);
assert.equal(workflow.segments.length,1);
assert.equal(workflow.panels[0].tag,'QD-DIDATICO');
assert.deepEqual(workflow.issues,[]);
assert.deepEqual(missingConsumerData(load,project),[]);
assert.equal(load.distance,10);
assert.deepEqual(filterConsumers(project,{segment:workflow.segments[0].id}).map(c=>c.id),[load.id]);
const view=consumersView(project);
assert.ok(view.includes('Nos trechos vinculados'));
assert.ok(view.includes('T-AQ-A: 10 m'));
assert.ok(!view.includes('Dados da carga pendentes'));
assert.ok(!view.includes('Conforme'));
assert.ok(consumerLinks(project,load).includes(`data-id="${workflow.circuits[0].id}"`));
assert.deepEqual(project,before);

const incomplete=structuredClone(project);
incomplete.segments[0].length=null;
incomplete.conductors[0].material=null;
const issues=consumerWorkflow(incomplete,incomplete.consumers[0]).issues;
assert.ok(issues.some(i=>i.message.includes('comprimento físico')&&i.id===incomplete.segments[0].id));
assert.ok(issues.some(i=>i.message.includes('material e isolação')&&i.id===incomplete.cables[0].id));
incomplete.consumers[0].panelId='another-panel';
assert.ok(consumerWorkflow(incomplete,incomplete.consumers[0]).issues.some(i=>i.message.includes('diverge')));
// A planning reference does not count as an electrical circuit.
incomplete.circuits=[];incomplete.consumers[0].distance=null;incomplete.consumers[0].plannedSegmentId=incomplete.segments[0].id;
assert.equal(consumerWorkflow(incomplete,incomplete.consumers[0]).linked,false);
assert.ok(missingConsumerData(incomplete.consumers[0],incomplete).includes('distância'));
incomplete.consumers[0].panelId=project.panels[0].id;
const form=preparationForm(incomplete,load.id);
assert.ok(form.includes(`value="${load.id}" checked`));
assert.ok(form.includes(`value="${project.panels[0].id}" selected`));
assert.ok(form.includes('Selecionar cargas deste quadro'));
const escaped=structuredClone(project);escaped.consumers[0].tag='<script>bad</script>';
assert.ok(!consumerLinks(escaped,escaped.consumers[0]).includes('<script>'));
console.log('Workflow links: declared sources, diagnostics, filters, preparation and no mutation passed.');
