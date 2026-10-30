import {escapeHTML as esc,panel,metric,badge,notice,emptyState} from './components.js';
import {createEntity} from './core/model.js';

const fmt=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
const button=(label,action,id='',collection='')=>`<button type="button" class="button" data-voltage-action="${action}" data-id="${esc(id)}" data-collection="${collection}">${esc(label)}</button>`;
const status=r=>badge(!r?'Não calculado':r.status==='calculated'?'Queda dentro dos limites':r.status==='review'?'Limite excedido':'Pendente',r?.status==='calculated'?'green':'amber');
const table=(headers,rows,label)=>`<div class="table-scroll" role="region" tabindex="0" aria-label="${esc(label)}"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
export const origins={delivery_lv:'Ponto de entrega em baixa tensão — 5%',own_transformer:'Secundário de transformador próprio MT/BT — 7%',utility_transformer:'Secundário da concessionária, com entrega nesse ponto — 7%',generator:'Saída de gerador próprio — 7%'};

export function voltageView(p,state={}) {
  if(!p)return emptyState('Abra um projeto','Escolha o projeto para analisar o percurso até suas cargas.','voltage','<a class="button primary" href="#/projetos">Abrir projetos</a>');
  const loads=p.consumers.filter(c=>c.type!=='panel'),results=state.analysis?.results||[];
  const selected=loads.find(c=>c.id===state.selected)||loads[0],r=results.find(x=>x.id===selected?.id);
  const complete=results.filter(x=>x.status!=='pending');
  const max=key=>complete.length?Math.max(...complete.map(x=>x[key])):null;
  const rows=loads.map(c=>{
    const a=results.find(x=>x.id===c.id),terminal=a?.segments?.at(-1);
    return `<tr class="${selected?.id===c.id?'selected':''}">
      <td>${button(c.tag||'Sem tag','select',c.id)}<small>${esc(c.description)}</small>
        <small>Origem: ${esc(p.nodes.find(n=>n.id===p.voltagePolicy.originNodeId)?.label||'Pendente')}</small>
        <small>${a?.segments.length?`${a.status==='pending'?'Parte analisada: ':''}${esc(a.segments.map(s=>s.circuitTag+'/'+s.tag).join(' → '))}`:'Percurso não calculado'}</small></td>
      <td>${fmt(a?.distance)}</td><td>${fmt(terminal?.current)}</td><td>${fmt(terminal?.section)}</td><td>${fmt(c.voltage)}</td>
      <td>${a?.status==='pending'?'—':fmt(a?.totalDrop)}</td><td>${a?.status==='pending'?'—':fmt(a?.totalPercent)}</td><td>${fmt(a?.totalLimit)}</td>
      <td>${status(a)}${a?.pending.map(t=>`<small class="conductor-row-reason">${esc(t)}</small>`).join('')||''}</td></tr>`;
  }).join('');
  const tools=`<div class="actions">${button('Origem e limites','edit',p.id,'project')}<button type="button" class="button primary" data-voltage-action="calculate" ${state.busy?'disabled':''}>${state.busy?'Analisando…':'Calcular queda'}</button></div>`;
  const parameters=`<div class="panel-body">
    <p><strong>Origem:</strong> ${esc(p.nodes.find(n=>n.id===p.voltagePolicy.originNodeId)?.label||'Não definida')}<br>${esc(origins[p.voltagePolicy.originType]||'Defina o ponto de referência para o limite total.')}</p>
    <h3>Condições dos circuitos</h3>
    ${p.circuits.map(c=>`<div class="infra-physical-row"><strong>${esc(c.tag)}</strong>${button('Condições','edit',c.id,'circuits')}</div>`).join('')||'<p>Cadastre os circuitos e caminhos.</p>'}
    <h3>Impedâncias das formações</h3>
    ${p.cables.map(c=>`<div class="infra-physical-row"><div><strong>${esc(c.tag)}</strong><small>R: ${fmt(c.voltageImpedance.resistance)} · X: ${fmt(c.voltageImpedance.reactance)} Ω/km</small></div>${button('R e X','edit',c.id,'cables')}</div>`).join('')||'<p>Cadastre as formações de cabos.</p>'}
    <p>R e X devem corresponder à seção, temperatura, frequência e disposição reais. Não usamos valores ilustrativos.</p>
    <a class="button" href="#/dimensionamento">Correntes e seções adotadas</a> <a class="button" href="#/consumidores">Caminhos e circuitos</a>
    </div>`;
  return `${state.error?notice('Não foi possível concluir',state.error,'amber'):''}
    <div class="metric-grid">${metric('Maior queda completa','voltage','Somente percursos calculados','blue',max('totalPercent')==null?'—':fmt(max('totalPercent'))+' %')}
      ${metric('Maior distância completa','nodes','Da origem normativa à carga','purple',max('distance')==null?'—':fmt(max('distance'))+' m')}
      ${metric('Queda dentro dos limites','shield','Regime permanente; não é conformidade global','green',state.analysis?String(results.filter(x=>x.status==='calculated').length):'—')}
      ${metric('Pendências ou limites excedidos','report','Selecione a carga para ver os motivos','amber',state.analysis?String(results.filter(x=>x.status!=='calculated').length):'—')}</div>
    <div class="workspace-grid infrastructure-workspace voltage-workspace"><div class="infra-main-column">
      ${panel('Análise por consumidor','list',loads.length?table(['Carga / origem e percurso','Distância (m)','Ib terminal (A)','Seção final (mm²)','Tensão (V)','Queda (V)','Queda (%)','Limite total (%)','Resultado'],rows,'Queda de tensão por consumidor'):emptyState('Nenhuma carga cadastrada','Cadastre consumidores e seus caminhos para iniciar.','voltage'),tools)}
      ${selected?details(selected,r):''}</div><aside class="detail-column">${panel('Dados para o cálculo','settings',parameters)}</aside></div>
    ${notice('Escopo e rastreabilidade','Análise longitudinal aproximada em regime permanente senoidal. Partida de motores, desequilíbrio, harmônicas, paralelismo e transformações intermediárias permanecem não calculados. Entradas são salvas; recalcule os resultados ao reabrir ou alterar o projeto.','amber')}`;
}

function details(c,r) {
  const rows=r?.segments||[],complete=r&&r.status!=='pending';
  return panel(`Percurso e memória · ${c.tag}`,'voltage',`<div class="panel-body">
    ${status(r)} ${c.type==='motor'?badge('Partida: não calculada','amber'):''}
    ${r?.pending.map(t=>`<p class="conductor-pending">${esc(t)}</p>`).join('')||''}
    ${!r?'<p>Calcule a queda para analisar todos os alimentadores e o circuito terminal.</p>':''}
    ${rows.length&&!complete?'<p>Percurso incompleto: os trechos abaixo são apenas a parte já analisada. Não representam a queda total.</p>':''}
    ${table(['Circuito / trecho','Comprimento (m)','Ib (A)','Seção (mm²)','R / X (Ω/km)','ΔU local (V)','ΔU (%)'],rows.map(s=>`<tr><td>${esc(s.circuitTag)} / ${esc(s.tag)}</td><td>${fmt(s.length)}</td><td>${fmt(s.current)}</td><td>${fmt(s.section)}</td><td>${fmt(s.resistance)} / ${fmt(s.reactance)}</td><td>${fmt(s.drop)}</td><td>${fmt(s.percent)}</td></tr>`).join(''),'Contribuição dos trechos')}
    ${complete?`<p><strong>Total:</strong> ${fmt(r.distance)} m · ${fmt(r.totalDrop)} V equivalentes na tensão da carga · ${fmt(r.totalPercent)} %.</p>
      <div class="voltage-bars" aria-label="Participação de cada trecho na queda total">${rows.map(s=>`<div><span>${esc(s.circuitTag)} / ${esc(s.tag)}</span><meter min="0" max="100" value="${s.contribution}" aria-label="${esc(s.circuitTag+' / '+s.tag)}"></meter><strong>${fmt(s.contribution)} %</strong></div>`).join('')}</div>`:''}
    ${r?.criteria.map(v=>`<p>${badge(v.status==='verified'?'Critério verificado':'Não atende',v.status==='verified'?'green':'amber')} ${esc(v.message)}</p>`).join('')||''}
    <details><summary>Fórmulas, referências e corrente utilizada</summary>
      ${r?.trace.map(t=>`<p>${esc(t)}</p>`).join('')||'<p>Memória disponível após o cálculo completo.</p>'}
      ${rows.map(s=>`<p><strong>${esc(s.cableTag)} / ${esc(s.tag)}:</strong> ${fmt(s.temperature)} °C; ${fmt(s.frequency)} Hz; FP ${fmt(s.powerFactor)}. ${esc([s.source.manufacturer,s.source.model,s.source.edition,s.source.reference].filter(Boolean).join(' · '))}</p><pre class="conductor-trace">${esc(JSON.stringify(s.trace,null,2))}</pre>`).join('')}
    </details></div>`);
}

const input=(name,label,value)=>`<label class="field"><span>${esc(label)}</span><input name="${name}" aria-label="${esc(label)}" type="number" step="any" value="${esc(value)}"></label>`;
const text=(name,label,value)=>`<label class="field"><span>${esc(label)}</span><input name="${name}" type="text" maxlength="200" value="${esc(value)}"></label>`;
const select=(name,label,value,options)=>`<label class="field"><span>${esc(label)}</span><select name="${name}" aria-label="${esc(label)}"><option value="">Não informado</option>${Object.entries(options).map(([v,t])=>`<option value="${esc(v)}" ${value===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
const check=(name,label,value)=>`<label class="conductor-check"><input name="${name}" type="checkbox" ${value===true?'checked':''}><span>${esc(label)}</span></label>`;

export function voltageForm(contract,p,collection,item) {
  if(collection==='project')return `<h2 id="voltage-dialog-title">Origem e limites</h2>
    ${select('originNodeId','Início do percurso completo',item.voltagePolicy.originNodeId,Object.fromEntries(p.nodes.filter(n=>['origin','panel'].includes(n.kind)).map(n=>[n.id,n.label])))}
    ${select('originType','Origem da alimentação',item.voltagePolicy.originType,origins)}
    <p>NBR 5410:2004, 6.2.7.1: limite total depende da origem. Circuito terminal: máximo 4% (6.2.7.2). Selecionar um quadro intermediário não elimina a queda a montante; o ponto deve ser a origem normativa real.</p>
    ${check('originConfirmed','Confirmei o ponto de entrega/origem e que todos os alimentadores até as cargas estão cadastrados',item.voltagePolicy.originConfirmed)}`;
  if(collection==='circuits') {
    const d=item.voltageStudy;
    return `<h2 id="voltage-dialog-title">Condições · ${esc(item.tag)}</h2>
      <p>Para uma única carga, campos vazios herdam seus dados. Grupos e alimentadores precisam de valores equivalentes de projeto. Ib é obtida no dimensionamento, sem demanda automática.</p>
      <div class="conductor-form-grid">${input('nominalVoltage','Tensão nominal (V)',d.nominalVoltage)}${input('frequency','Frequência (Hz)',d.frequency)}${input('powerFactor','Fator de potência',d.powerFactor)}
      ${select('balanced','Carga trifásica equilibrada',d.balanced===null?'':String(d.balanced),{true:'Sim',false:'Não'})}</div>
      ${check('scopeConfirmed','Confirmo regime permanente senoidal, sem harmônicas relevantes, carga resistiva/indutiva e dados válidos para este circuito',d.scopeConfirmed)}
      <h3>Limite adicional de projeto (opcional)</h3>
      ${input('voltageDropLimit','Limite deste circuito (%)',item.voltageDropLimit)}${text('limitReference','Referência do limite adicional',item.limitSource.reference)}
      <p>O limite adicional não substitui nem aumenta os limites normativos. A queda durante a partida de motores permanece pendente.</p>`;
  }
  const z=item.voltageImpedance;
  const cores=p.conductors.filter(w=>w.cableId===item.id);
  return `<h2 id="voltage-dialog-title">R e X · ${esc(item.tag)}</h2>
    <p><strong>Construção cadastrada:</strong> ${esc(cores.map(w=>`${w.role||'Função pendente'}: ${fmt(w.section)} mm² · ${w.material||'material pendente'} · ${w.insulation||'isolação pendente'}`).join('; '))}.</p>
    <p>Valores por condutor, em Ω/km, para a seção e formação adotadas. Informe resistência em corrente alternada na temperatura declarada e reatância para a frequência e disposição reais. Não informe a impedância do laço completo.</p>
    <div class="conductor-form-grid">${input('resistance','Resistência R (Ω/km)',z.resistance)}${input('reactance','Reatância X (Ω/km)',z.reactance)}${input('temperature','Temperatura adotada de R (°C)',z.temperature)}
    ${select('sourceKind','Origem de R e X',z.source.kind,{catalog:'Catálogo',manual:'Estudo de engenharia referenciado'})}
    ${text('manufacturer','Fabricante',z.source.manufacturer)}${text('model','Modelo / construção',z.source.model)}${text('edition','Edição / data',z.source.edition)}${text('reference','Documento, página ou URL',z.source.reference)}</div>
    ${check('confirmed','Conferi R/X para a seção, material, isolação, formação, arranjo, frequência, método e temperatura atuais',z.confirmed)}
    <p>Alterar a construção ou as condições invalida a confirmação. Não há modelo térmico automático nem conversão de resistência entre temperaturas. X = 0 exige justificativa na referência.</p>`;
}

export function readVoltageForm(contract,collection,f,item) {
  const num=k=>String(f.get(k)??'').trim()===''?null:Number(f.get(k));
  if(collection==='project')return {voltagePolicy:createEntity(contract,'VoltagePolicy',{originNodeId:f.get('originNodeId')||null,originType:f.get('originType')||null,originConfirmed:f.has('originConfirmed')})};
  if(collection==='circuits')return {voltageStudy:createEntity(contract,'VoltageStudy',{nominalVoltage:num('nominalVoltage'),frequency:num('frequency'),powerFactor:num('powerFactor'),balanced:f.get('balanced')===''?null:f.get('balanced')==='true',scopeConfirmed:f.has('scopeConfirmed')}),voltageDropLimit:num('voltageDropLimit'),limitSource:{...item.limitSource,kind:'manual',reference:String(f.get('limitReference')||'').trim()}};
  return {voltageImpedance:createEntity(contract,'VoltageImpedance',{resistance:num('resistance'),reactance:num('reactance'),temperature:num('temperature'),confirmed:f.has('confirmed'),source:createEntity(contract,'Source',{kind:f.get('sourceKind')||null,...Object.fromEntries(['manufacturer','model','edition','reference'].map(k=>[k,String(f.get(k)||'').trim()]))})})};
}
