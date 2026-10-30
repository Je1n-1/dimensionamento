import {escapeHTML as esc, panel, metric, badge, notice, emptyState} from './components.js';
import {createEntity} from './core/model.js';

export const infrastructureTypes={conduit:'Eletroduto',tray:'Eletrocalha',solid_tray:'Calha lisa',perforated_tray:'Calha perfurada',ladder:'Leito',other:'Outro encaminhamento'};
const fmt=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
const button=(label,action,id='',collection='',primary=false)=>`<button type="button" class="button${primary?' primary':''}" data-infra-action="${action}" data-id="${esc(id)}" data-collection="${collection}">${esc(label)}</button>`;
const status=r=>badge(!r?'Não calculado':r.status==='calculated'?'Geometria atende':r.status==='review'?'Revisar':'Pendente',r?.status==='calculated'?'green':'amber');
const dataTable=(headers,rows,label)=>`<div class="table-scroll" role="region" tabindex="0" aria-label="${esc(label)}"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;

export function physicalRows(p,segmentId) {
  return p.cables.filter(c=>{
    const circuit=p.circuits.find(i=>i.id===c.circuitId);
    return (c.routeMode==='circuit'?circuit?.segmentIds:c.segmentIds)?.includes(segmentId);
  }).flatMap(c=>c.formation==='multicore'?[{collection:'cables',item:c,label:`${c.tag} · multipolar`,quantity:c.quantity}]:
    p.conductors.filter(w=>w.cableId===c.id).map(w=>({collection:'conductors',item:w,label:`${c.tag} · ${w.role||'Função pendente'}`,quantity:c.quantity})));
}

export function infrastructureView(p,state={}) {
  if(!p)return emptyState('Abra um projeto','Escolha um projeto para analisar os trechos reais.','infrastructure','<a class="button primary" href="#/projetos">Abrir projetos</a>');
  if(!p.segments.length)return emptyState('Cadastre os caminhos físicos','A infraestrutura usa os trechos e circuitos cadastrados em Consumidores e cargas.','nodes','<a class="button primary" href="#/consumidores">Abrir cadastro</a>');
  const results=state.analysis?.results||[],selected=p.segments.find(s=>s.id===state.selected)||p.segments[0];
  const result=id=>results.find(r=>r.id===id), measured=results.filter(r=>r.occupancy!==null);
  const maximum=measured.length?Math.max(...measured.map(r=>r.occupancy)):null;
  const rows=p.segments.map(s=>{
    const r=result(s.id),infra=p.infrastructures.filter(i=>i.segmentId===s.id),i=infra[0];
    const circuits=p.circuits.filter(c=>c.segmentIds.includes(s.id));
    const ids=new Set(circuits.flatMap(c=>c.consumerIds));
    const panelIds=new Set(circuits.flatMap(c=>c.destinationPanelIds));
    const destinations=[...p.consumers.filter(c=>ids.has(c.id)).map(c=>c.tag),...p.panels.filter(q=>panelIds.has(q.id)).map(q=>'Quadro '+q.tag)];
    const cores=p.conductors.filter(w=>physicalRows(p,s.id).some(row=>row.item.id===w.id||row.item.id===w.cableId));
    const conductors=cores.reduce((n,w)=>n+(p.cables.find(c=>c.id===w.cableId)?.quantity||0),0);
    const dimensions=i?.type==='conduit'?`Ø interno ${fmt(i.innerDiameter)} mm`:i?`${fmt(i.width)} × ${fmt(i.height)} mm`: '—';
    return `<tr class="${s.id===selected.id?'selected':''}"><td>${button(s.tag||'Sem tag','select',s.id)}<small>${s.kind==='branch'?'Ramal':'Principal'}</small></td>
      <td>${esc(destinations.join(', ')||'Destino não vinculado')}<small>${fmt(s.length)} m</small></td>
      <td>${esc(s.installationMethod||'—')}<small>${fmt(s.temperature)} °C</small></td>
      <td>${fmt(r?.count)} elementos<small>${fmt(conductors)} condutores · ${esc([...new Set(cores.map(c=>c.section))].map(fmt).join(' / '))} mm²</small></td>
      <td>${esc(infra.length>1?'Múltiplas · revisar':infrastructureTypes[i?.type]||'Não definida')}<small>${esc(dimensions)}</small></td>
      <td>${r?.occupancy==null?'—':`${fmt(r.occupancy)} %`}<small>${fmt(r?.area)} mm²</small></td>
      <td>${status(r)}</td></tr>`;
  }).join('');
  const tools=`<button class="button primary" type="button" data-infra-action="calculate" ${state.busy?'disabled':''}>${state.busy?'Analisando…':'Calcular ocupação'}</button>`;
  const details=segmentDetails(p,selected,result(selected.id));
  return `${state.error?notice('Não foi possível concluir',state.error,'amber'):''}
    <div class="metric-grid">${metric('Trechos analisados','nodes','Na revisão atual','blue',state.analysis?`${results.length} / ${p.segments.length}`:'—')}
      ${metric('Maior ocupação geométrica','chart','Compare com o critério de cada trecho','purple',maximum==null?'—':`${fmt(maximum)} %`)}
      ${metric('Critérios calculados atendidos','infrastructure','Não equivale à conformidade global','green',state.analysis?String(results.filter(r=>r.status==='calculated').length):'—')}
      ${metric('Trechos com pendências/ajustes','shield','Abra os dados físicos para corrigir','amber',state.analysis?String(results.filter(r=>r.status!=='calculated').length):'—')}</div>
    <div class="workspace-grid infrastructure-workspace"><div class="infra-main-column">${panel('Infraestrutura por trecho e ramal','list',
      dataTable(['Trecho','Cargas / percurso','Método / meio','Cabos e condutores','Infraestrutura','Ocupação / área','Situação'],rows,'Ocupação por trecho'),tools)}${details.memory}</div>
      <aside class="detail-column">${details.physical}</aside></div>
    ${notice('Resultados vinculados à revisão do projeto','Dados físicos são salvos. A análise detalhada deve ser recalculada ao reabrir ou alterar entradas. Alterações físicas também exigem rever método e agrupamento no dimensionamento.')}
    ${notice('Escopo desta verificação','Ocupação e encaixe físico não comprovam capacidade de corrente, proteção ou queda de tensão. Suportação, solicitações mecânicas, caixas, acessibilidade, requisitos de produto e demais prescrições de instalação permanecem não verificados.','amber')}`;
}

function segmentDetails(p,s,r) {
  const infra=p.infrastructures.filter(i=>i.segmentId===s.id),i=infra[0];
  const physical=physicalRows(p,s.id);
  const formationCount=physical.reduce((n,x)=>n+x.quantity,0);
  return {physical:panel(`Dados físicos · ${s.tag}`,'infrastructure',`<div class="panel-body">
    <p>${esc(s.environment||'Ambiente não informado')} · ${fmt(s.temperature)} °C · ${formationCount} elementos declarados</p>
    <p>Unipolares e condutores isolados são contados por função. Multipolares usam o diâmetro externo do cabo completo.</p>
    ${infra.length>1?notice('Repartição pendente','Há mais de uma infraestrutura no trecho. Ajuste o cadastro em Caminhos e circuitos; a divisão entre condutos ainda não é calculada.','amber'):
      button(i?'Editar infraestrutura':'Definir infraestrutura','edit',i?.id||s.id,'infrastructures',true)}
    <h3>Cabos e diâmetros externos</h3>
    <div class="infra-physical-list" role="region" aria-label="Diâmetros dos cabos deste trecho" tabindex="0">${physical.length?physical.map(x=>`<div class="infra-physical-row"><div><strong>${esc(x.label)}</strong><small>× ${x.quantity} · Ø ${fmt(x.item.outerDiameter)} mm</small></div>${button('Informar diâmetro','edit',x.item.id,x.collection)}</div>`).join(''):'<p>Defina as formações de cabos no cadastro.</p>'}</div>
    <p class="muted">Use a dimensão do fabricante para a seção e construção adotadas. Seção em mm² não é área externa do cabo.</p>
    ${i?.notes?`<p><strong>Observações:</strong> ${esc(i.notes)}</p>`:''}
    </div>`),memory:panel('Memória e recomendações','report',`<div class="panel-body">${r?`
      ${status(r)}
      ${r.minimumDiameter!==null?`<p>Diâmetro interno mínimo por ocupação: <strong>${fmt(r.minimumDiameter)} mm</strong>.</p>`:''}
      ${r.suggestedDiameter!==null?`<p>Menor diâmetro interno da lista informada: <strong>${fmt(r.suggestedDiameter)} mm</strong>. Confira o tamanho nominal no catálogo; sugestão não aplicada automaticamente.</p>`:''}
      ${r.minimumWidth!==null?`<p>Envelope mínimo da camada: <strong>${fmt(r.minimumWidth)} × ${fmt(r.minimumHeight)} mm</strong>, sem margens adicionais.</p>`:''}
      <ul class="topology-issues">${r.pending.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
      ${r.criteria.map(c=>`<p>${badge(c.status==='verified'?'Verificado':'Não atende',c.status==='verified'?'green':'amber')} ${esc(c.message)}</p>`).join('')}
      <details><summary>Fórmulas e referências</summary>${r.trace.map(t=>`<p>${esc(t)}</p>`).join('')}${r.items.map(x=>`<p>${esc(x.label)}: ${fmt(x.outerDiameter)} mm × ${x.quantity}. ${esc([x.source.manufacturer,x.source.model,x.source.edition,x.source.reference].filter(Boolean).join(' · '))}</p>`).join('')}</details>
      `:'<p>Calcule a ocupação para ver os critérios, dimensões mínimas e motivos de pendência.</p>'}</div>`)};
}

function input(name,label,value,type='text',extra='') {
  return `<label class="field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="any"':'maxlength="200"'} ${extra}></label>`;
}
function select(name,label,value,options) {
  return `<label class="field"><span>${esc(label)}</span><select name="${name}" aria-label="${esc(label)}"><option value="">Não informado</option>${Object.entries(options).map(([v,t])=>`<option value="${v}" ${value===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
}
function sourceFields(name,s,catalog=false) {
  return `<fieldset><legend>${catalog?'Referência do fabricante do cabo':name==='dimensionSource'?'Origem das dimensões úteis':'Critério de arranjo / ventilação'}</legend><div class="conductor-form-grid">
    ${catalog?`<input type="hidden" name="${name}.kind" value="catalog">`:select(`${name}.kind`,'Tipo de referência',s.kind,{catalog:'Catálogo de fabricante',manual:'Estudo / especificação de projeto'})}
    ${input(`${name}.manufacturer`,'Fabricante',s.manufacturer)}${input(`${name}.model`,'Modelo / linha',s.model)}
    ${input(`${name}.edition`,'Edição / data (quando disponível)',s.edition)}${input(`${name}.reference`,'Documento, página ou URL',s.reference)}
    </div></fieldset>`;
}
const check=(name,label,value)=>`<label class="conductor-check"><input type="checkbox" name="${name}" ${value===true?'checked':''}><span>${esc(label)}</span></label>`;

export function infrastructureForm(contract,p,collection,item) {
  if(collection!=='infrastructures') {
    const core=collection==='conductors'?item:p.conductors.find(c=>c.cableId===item.id);
    return `<h2 id="infra-dialog-title">Diâmetro externo · ${esc(item.tag||item.role)}</h2>
      <p>Construção cadastrada: ${esc(core?.material||'material pendente')} · ${esc(core?.insulation||'isolação pendente')} · ${fmt(core?.section)} mm². Defina as seções adotadas no dimensionamento antes de confirmar a referência.</p>
      <p>${collection==='cables'?'Informe a envoltória do cabo multipolar completo.':'Inclua isolação e cobertura no diâmetro do condutor/cabo individual.'} Não utilize o diâmetro do cobre nu.</p>
      ${input('outerDiameter','Diâmetro externo de projeto (mm), considerando tolerância do fabricante',item.outerDiameter,'number')}
      ${sourceFields('source',item.source,true)}
      ${notice('Vínculo à construção cadastrada','Salvar vincula esta referência à seção, material e isolação atuais. Alterar esses dados exige reconfirmar a dimensão. O sistema não autentica catálogos automaticamente.')}`;
  }
  return `<h2 id="infra-dialog-title">Infraestrutura do trecho</h2>
    ${select('segmentId','Trecho',item.segmentId,Object.fromEntries(p.segments.map(s=>[s.id,s.tag])))}
    ${select('type','Tipo de infraestrutura',item.type,infrastructureTypes)}
    <section data-infra-fields="conduit"><h3>Eletroduto</h3><div class="conductor-form-grid">
      ${input('innerDiameter','Diâmetro interno útil (mm)',item.innerDiameter,'number')}
      ${input('candidateDiameters','Diâmetros internos disponíveis (mm), separados por ponto e vírgula',item.candidateDiameters.join('; '))}
      ${select('location','Localização do percurso',item.location,{indoor:'Interno à edificação',outdoor:'Externo à edificação'})}
      ${input('continuousLength','Percurso contínuo entre caixas/extremidades (m)',item.continuousLength,'number')}
      ${input('bends90','Número de curvas de 90° no percurso',item.bends90,'number')}
    </div>${check('routeConfirmed','Confirmei os limites entre caixas/extremidades e o percurso é reto ou contém apenas as curvas de 90° informadas',item.routeConfirmed)}
    <p>O comprimento contínuo pode abranger vários trechos cadastrados. Não use a soma total dos cabos. Outros ângulos e a exceção de aumento de tamanho nominal exigem estudo específico.</p></section>
    <section data-infra-fields="tray"><h3>Calha / leito</h3><div class="conductor-form-grid">
      ${input('width','Largura interna útil (mm)',item.width,'number')}${input('height','Altura interna útil (mm)',item.height,'number')}
      ${select('arrangement','Arranjo físico',item.arrangement,{single_layer:'Camada única, horizontal'})}
      ${input('spacing','Espaçamento livre entre cabos (mm)',item.spacing,'number')}
      ${input('occupancyLimit','Limite adicional de projeto (%) — opcional',item.occupancyLimit,'number')}
    </div>${sourceFields('limitSource',item.limitSource)}
    ${check('arrangementConfirmed','Revisei as instruções do fabricante e o critério de projeto para arranjo, espaçamento e ventilação. Agrupamento térmico será conferido no dimensionamento.',item.arrangementConfirmed)}
    <p>Não existe limite universal de 70% ou 75% adotado pelo sistema. O encaixe é verificado em camada única; outras disposições ficam pendentes.</p></section>
    ${sourceFields('dimensionSource',item.dimensionSource)}
    <label class="field"><span>Observações</span><textarea name="notes" rows="2" maxlength="2000">${esc(item.notes)}</textarea></label>
    ${notice('Revisão dos cálculos afetados','Salvar os dados físicos invalida resultados anteriores e pede nova confirmação de método, agrupamento e escopo no dimensionamento.')}`;
}

export function readInfrastructureForm(contract,collection,form,previous) {
  const number=name=>String(form.get(name)??'').trim()===''?null:Number(form.get(name));
  const source=name=>createEntity(contract,'Source',Object.fromEntries(['kind','manufacturer','model','edition','reference'].map(k=>[k,k==='kind'?form.get(`${name}.${k}`)||null:String(form.get(`${name}.${k}`)||'').trim()])));
  if(collection!=='infrastructures')return {outerDiameter:number('outerDiameter'),source:source('source')};
  // Hidden type-specific controls are not disabled, preserving a user's previous choices.
  const data={};
  for(const k of ['width','height','innerDiameter','spacing','occupancyLimit','continuousLength','bends90'])data[k]=number(k);
  for(const k of ['type','segmentId','location','arrangement'])data[k]=form.get(k)||null;
  for(const k of ['routeConfirmed','arrangementConfirmed'])data[k]=form.has(k);
  data.candidateDiameters=String(form.get('candidateDiameters')||'').split(';').map(s=>s.trim()).filter(Boolean).map(s=>Number(s.replace(',','.')));
  if(data.candidateDiameters.some(d=>!Number.isFinite(d)||d<=0))throw new Error('Separe os diâmetros positivos por ponto e vírgula, por exemplo: 16; 21; 27.');
  data.notes=String(form.get('notes')||'').trim();
  data.dimensionSource=source('dimensionSource');data.limitSource=source('limitSource');
  return data;
}
