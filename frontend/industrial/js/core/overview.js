import {serviceRequest} from './services.js';
import {validateEntity} from './model.js';

export class OverviewService {
  constructor(transport=(...args)=>globalThis.fetch(...args)){this.transport=transport;}
  async execute(contract,project,operation) {
    const request=serviceRequest(contract,project,'overview');let response,body;
    try {response=await this.transport('/api/industrial/overview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({request,project,...(operation?{operation}:{})}),signal:AbortSignal.timeout(60000)});}
    catch {throw new Error('Servidor indisponível. Inicie python server.py. Dados salvos preservados.');}
    try {body=await response.json();}catch{throw new Error('Resposta inválida da visão geral.');}
    if(!response.ok)throw new Error(body.error||'Falha na visão geral.');
    const revision=project.revision+(operation?.action==='segment'?1:0),a=body.analysis;
    if(Object.keys(request).some(k=>body.request?.[k]!==request[k])||body.project?.id!==project.id||body.project.revision!==revision||validateEntity(contract,'Project',body.project).length)
      throw new Error('Resposta incompatível com a revisão do projeto.');
    if(!operation) {
      if(a?.projectId!==project.id||a.inputRevision!==revision||a.version!==contract.overview.version||!a.summary||!Array.isArray(a.errors)||!Array.isArray(a.currents))throw new Error('Análise desatualizada ou incompleta.');
      const summary=a.summary;
      if(['consumers','equipment','panels','segments','powerKnown','powerTotal','pending'].some(k=>!Number.isInteger(summary[k])||summary[k]<0)||
        ['power','maxOccupancy','maxDrop'].some(k=>summary[k]!==null&&(!Number.isFinite(summary[k])||summary[k]<0))||summary.status!=='partial'||summary.protection!=='not_implemented')throw new Error('Resumo incompatível.');
      const currentIds=a.currents.map(r=>r.targetId),failedIds=a.errors.filter(e=>e.domain==='currents'&&e.targetId!==project.id).map(e=>e.targetId);
      if(new Set([...currentIds,...failedIds]).size!==project.consumers.length||currentIds.length+failedIds.length!==project.consumers.length||
        [...currentIds,...failedIds].some(id=>!project.consumers.some(c=>c.id===id))||a.currents.some(r=>r.inputRevision!==revision||r.rulesVersion!==contract.currentRules.version))throw new Error('Correntes incompatíveis.');
      const domains=[['topology',project.segments,contract.topology.version],['conductors',project.cables,contract.conductorRules.version],['infrastructure',project.segments,contract.infrastructureRules.version],['voltage',project.consumers.filter(c=>c.type!=='panel'),contract.voltageRules.version]];
      for(const [name,items,version] of domains) {
        const result=a[name];
        if(result===null&&name!=='topology'&&a.errors.some(e=>e.domain===name))continue;
        const rows=name==='topology'?result?.segments:result?.results;
        if(result?.projectId!==project.id||result.inputRevision!==revision||result.version!==version||!Array.isArray(rows)||rows.length!==items.length||new Set(rows.map(r=>r.id)).size!==items.length||rows.some(r=>!items.some(i=>i.id===r.id)))throw new Error('Análise contém resultados incompatíveis: '+name);
      }
    } else if(a!==null)throw new Error('Recalcule após a edição.');
    return body;
  }
}

/** Diagram positions are never physical lengths. Handles disconnected nodes and cycles. */
export function diagramPositions(project,overrides={}) {
  const degrees=new Map(project.nodes.map(n=>[n.id,0])),out=new Map(project.nodes.map(n=>[n.id,[]])),depth=new Map();
  for(const s of project.segments)if(out.has(s.fromNodeId)&&degrees.has(s.toNodeId)) {out.get(s.fromNodeId).push(s.toNodeId);degrees.set(s.toNodeId,degrees.get(s.toNodeId)+1);}
  const queue=project.nodes.filter(n=>degrees.get(n.id)===0).map(n=>n.id);
  for(const id of queue)depth.set(id,0);
  for(let i=0;i<queue.length;i++)for(const id of out.get(queue[i])) {
    depth.set(id,Math.max(depth.get(id)||0,depth.get(queue[i])+1));degrees.set(id,degrees.get(id)-1);if(degrees.get(id)===0)queue.push(id);
  }
  const rows=new Map(),positions={};
  for(const n of project.nodes) {
    const x=depth.get(n.id)||0,y=rows.get(x)||0;rows.set(x,y+1);
    positions[n.id]=overrides[n.id]||n.position||{x:60+x*260,y:60+y*140};
  }
  return positions;
}
export function diagramBounds(positions) {
  const values=Object.values(positions);
  if(!values.length)return {x:0,y:0,width:800,height:400};
  const xs=values.map(p=>p.x),ys=values.map(p=>p.y),x=Math.min(...xs)-40,y=Math.min(...ys)-40;
  return {x,y,width:Math.max(500,Math.max(...xs)-x+240),height:Math.max(300,Math.max(...ys)-y+140)};
}
export function segmentFacts(p,s,a) {
  const circuits=p.circuits.filter(c=>c.segmentIds.includes(s.id));
  const cables=p.cables.filter(c=>(c.routeMode==='selected'?c.segmentIds:p.circuits.find(i=>i.id===c.circuitId)?.segmentIds||[]).includes(s.id));
  const cores=p.conductors.filter(w=>cables.some(c=>c.id===w.cableId));
  // Follow feeder destinations through their panels, without summing consumers twice.
  const ids=new Set(),seen=new Set(),queue=[...circuits];
  for(let i=0;i<queue.length;i++) {
    const c=queue[i];if(seen.has(c.id))continue;seen.add(c.id);c.consumerIds.forEach(id=>ids.add(id));
    for(const panel of c.destinationPanelIds)queue.push(...p.circuits.filter(next=>next.originPanelId===panel&&!seen.has(next.id)));
  }
  const drops=new Map();
  for(const r of a?.voltage?.results||[])if(r.status!=='pending')for(const row of r.segments)if(row.segmentId===s.id)drops.set(row.id,row);
  const needsReview=(a?.infrastructure?.results||[]).some(r=>r.id===s.id&&r.status==='review')||
    (a?.conductors?.results||[]).some(r=>cables.some(c=>c.id===r.id)&&r.status==='review')||
    (a?.voltage?.results||[]).some(r=>r.status==='review'&&r.segments.some(row=>row.segmentId===s.id));
  return {circuits,cables,cores,loads:p.consumers.filter(c=>ids.has(c.id)),topology:a?.topology?.segments.find(r=>r.id===s.id),
    infrastructure:p.infrastructures.filter(i=>i.segmentId===s.id),occupancy:a?.infrastructure?.results.find(r=>r.id===s.id),
    conductors:(a?.conductors?.results||[]).filter(r=>cables.some(c=>c.id===r.id)),drops:[...drops.values()],needsReview};
}
