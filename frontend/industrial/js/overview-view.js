import {escapeHTML as esc,panel,metric,badge,notice,emptyState,icon} from './components.js';
import {diagramPositions,diagramBounds,segmentFacts} from './core/overview.js';
import {infrastructureTypes} from './infrastructure-view.js';

const fmt=v=>v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
const button=(label,action,id='',kind='')=>`<button class="button" type="button" data-overview-action="${action}" data-id="${esc(id)}" data-kind="${kind}">${esc(label)}</button>`;
const kinds={panel:'Quadro',origin:'Origem',junction:'Derivação',consumer:'Consumidor'};
const typeNames={motor:'Motor',lighting:'Iluminação',heating:'Aquecimento',transformer:'Transformador',drive:'Acionamento',other:'Carga'};
const groupNames={bundle:'Mesmo feixe/eletroduto',spaced:'Espaçados',single_layer:'Camada única'};
const selected=(state,kind,id)=>state.selected?.kind===kind&&state.selected.id===id;
const short=t=>String(t).length>22?String(t).slice(0,21)+'…':String(t);

export function mapScene(p,state={}) {
  const positions=diagramPositions(p,state.positions),nodes=new Map(p.nodes.map(n=>[n.id,n]));
  const edges=p.segments.map(s=>{
    const from=positions[s.fromNodeId],to=positions[s.toNodeId];if(!from||!to)return '';
    const x1=from.x+180,y1=from.y+40,x2=to.x,y2=to.y+40;
    const shared=p.circuits.filter(c=>c.segmentIds.includes(s.id)).length>1;
    const bend=x2>=x1?(x1+x2)/2:Math.max(x1,x2)+45;
    const path=`M${x1} ${y1} H${bend} V${y2} H${x2}`;
    return `<g class="map-edge ${shared?'shared':''} ${s.kind==='branch'?'branch':''} ${selected(state,'segment',s.id)?'selected':''}" data-map-kind="segment" data-map-id="${esc(s.id)}" tabindex="0" role="button" aria-label="Trecho ${esc(s.tag)}: ${esc(nodes.get(s.fromNodeId)?.label)} para ${esc(nodes.get(s.toNodeId)?.label)}, ${fmt(s.length)} metros">
      <title>${esc(s.tag)} · ${fmt(s.length)} m · ${shared?'Compartilhado por circuitos':s.kind==='branch'?'Ramal':'Principal'}</title>
      <path class="edge-hit" d="${path}"/><path class="edge-line" d="${path}" marker-end="url(#map-arrow)"/>
      <rect x="${bend-47}" y="${(y1+y2)/2-25}" width="94" height="21" rx="5"/>
      <text x="${bend}" y="${(y1+y2)/2-10}" text-anchor="middle">${esc(short(s.tag))} · ${fmt(s.length)} m</text></g>`;
  }).join('');
  const nodeMarkup=p.nodes.map(n=>{
    const pos=positions[n.id],load=p.consumers.find(c=>c.id===n.entityId),title=n.kind==='consumer'?typeNames[load?.type]||'Consumidor':kinds[n.kind]||'Ponto';
    const symbol=n.kind==='consumer'?(load?.type==='motor'?'motor':'bolt'):n.kind==='junction'?'nodes':n.kind==='panel'?'infrastructure':'home';
    return `<g class="map-node ${n.kind||'unknown'} ${selected(state,'node',n.id)?'selected':''}" data-map-kind="node" data-map-id="${esc(n.id)}" transform="translate(${pos.x},${pos.y})" tabindex="0" role="button" aria-label="${esc(title+' '+n.label)}">
      <title>${esc(title+' · '+n.label)}</title><rect width="180" height="80" rx="9"/>
      <g transform="translate(12,15)" pointer-events="none">${icon(symbol).replace('<svg ','<svg width="24" height="24" ')}</g><text x="48" y="30" class="node-label">${esc(short(n.label||'Sem identificação'))}</text>
      <text x="48" y="51">${esc(title)}</text>${load?`<text x="12" y="69">${fmt(load.power)} ${esc(load.unit||'')} · ×${load.quantity}</text>`:''}</g>`;
  }).join('');
  return `<defs><marker id="map-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8z" fill="#1c63de"/></marker></defs>${edges}${nodeMarkup}`;
}

export function overviewView(p,state={}) {
  if(!p)return emptyState('Abra um projeto','A visão geral reúne os dados reais da instalação.','nodes','<a class="button primary" href="#/projetos">Abrir projetos</a>');
  const a=state.analysis,s=a?.summary,positions=diagramPositions(p,state.positions),box=state.camera||diagramBounds(positions);
  const missing=p.nodes.filter(n=>!p.segments.some(t=>t.fromNodeId===n.id||t.toNodeId===n.id)).length;
  const tools=`<div class="actions"><button class="button primary" data-overview-action="calculate" ${state.busy?'disabled':''}>${state.busy?'Processando…':'Atualizar análises'}</button>${button('Salvar projeto','save')}</div>`;
  const map=`<div class="map-toolbar" aria-label="Controles do mapa">${button('Ampliar +','zoom-in')}${button('Reduzir −','zoom-out')}${button('Enquadrar','fit')}${button('Organizar pontos','arrange')}
    <button class="button ${state.moving?'primary':''}" data-overview-action="move" aria-pressed="${Boolean(state.moving)}">Mover pontos</button></div>
    <p class="map-help">Arraste o fundo para deslocar. Selecione um ponto ou trecho para editar. “Mover pontos” altera apenas o desenho; as distâncias físicas permanecem iguais. Setas deslocam a vista quando o mapa tem foco.</p>
    ${p.nodes.length?`<svg class="overview-map" id="overview-map" tabindex="0" role="group" aria-label="Mapa da instalação" viewBox="${box.x} ${box.y} ${box.width} ${box.height}">${mapScene(p,state)}</svg>`:emptyState('Nenhum caminho cadastrado','Cadastre quadros, pontos e trechos em Consumidores e cargas.','nodes')}
    <div class="map-legend"><span>Azul: principal</span><span>Tracejado: ramal</span><span>Linha espessa: compartilhado</span><span>${missing} ponto(s) sem conexão</span></div>`;
  const rows=p.segments.map(t=>{
    const f=segmentFacts(p,t,a),functions=f.topology?.functions,physical=f.topology?.physicalCables,insulated=f.topology?.insulatedConductors;
    const infrastructure=f.infrastructure.map(i=>`${infrastructureTypes[i.type]||'Não definida'} · ${i.type==='conduit'?'Ø interno '+fmt(i.innerDiameter):fmt(i.width)+' × '+fmt(i.height)} mm`).join('; ');
    return `<tr class="${selected(state,'segment',t.id)?'selected':''}"><td>${button(t.tag||'Sem tag','select',t.id,'segment')}</td>
      <td>${esc(p.nodes.find(n=>n.id===t.fromNodeId)?.label||'Pendente')} → ${esc(p.nodes.find(n=>n.id===t.toNodeId)?.label||'Pendente')}</td>
      <td>${esc(f.loads.map(c=>c.tag).join(', ')||'Pendente')}</td><td>${fmt(t.length)} m</td>
      <td>${fmt(physical)} cabos / ${fmt(insulated)} isolados<small>${functions?Object.values(functions).reduce((sum,v)=>sum+v,0):'—'} funções condutoras, incluindo PE</small></td>
      <td>${esc(t.installationMethod||'Pendente')}</td><td>${esc([...new Set(f.cores.map(w=>`${w.material||'—'} ${w.insulation||'—'} ${fmt(w.section)} mm²`))].join('; ')||'Pendente')}<small>${esc(f.cables.map(c=>({multicore:'Multipolar',single_core:'Unipolar',insulated:'Condutor isolado'}[c.formation]||'Formação pendente')).join(', '))}</small></td>
      <td>${esc(infrastructure||'Pendente')}</td><td>${f.circuits.length} circuito(s)<small>${esc(groupNames[t.thermal.grouping]||t.thermal.grouping||'Arranjo pendente')}</small>${fmt(f.occupancy?.occupancy)} % ocupação</td>
      <td>${fmt(t.temperature)} °C</td><td>${f.drops.length?f.drops.map(d=>`${esc(d.circuitTag)}: ${fmt(d.percent)}%`).join('<br>'):'Não calculada'}</td>
      <td>${esc(t.notes||'—')}</td><td>${badge(!a?'Não calculado':f.needsReview?'Revisar':'Verificação parcial','amber')}</td></tr>`;
  }).join('');
  return `${state.error?notice('Não foi possível concluir',state.error,'amber'):''}${state.message?notice('Projeto atualizado',state.message):''}
    <div class="metric-grid overview-metrics">
      ${metric('Consumidores','bolt',`${p.panels.length} quadros cadastrados`,'blue',String(p.consumers.filter(c=>c.type!=='panel').length))}
      ${metric('Potência ativa das cargas','bolt',s?`${s.powerKnown}/${s.powerTotal} registros convertidos${s.powerKnown<s.powerTotal?' · soma parcial':''}`:'Atualize as análises','blue',s?.power==null?'—':fmt(s.power/1000)+' kW')}
      ${metric('Trechos físicos','nodes','Comprimentos independentes do desenho','purple',String(p.segments.length))}
      ${metric('Maior ocupação calculada','chart','Consulte as pendências por trecho','purple',s?.maxOccupancy==null?'—':fmt(s.maxOccupancy)+' %')}
      ${metric('Maior queda completa','voltage','Regime permanente','blue',s?.maxDrop==null?'—':fmt(s.maxDrop)+' %')}
      ${metric('Pendências nas análises','shield','Proteção geral ainda não verificada','amber',s?String(s.pending):'—')}</div>
    <div class="overview-composition"><div class="infra-main-column">${panel('Mapa da instalação','nodes',map,tools)}</div><aside class="detail-column">${selectionPanel(p,state)}</aside></div>
    ${panel('Trechos, circuitos e verificações','list',`<div class="table-scroll overview-table" tabindex="0" role="region" aria-label="Tabela completa de trechos"><table><thead><tr>${['Trecho','Origem → destino','Cargas a jusante','Comprimento','Cabos / condutores','Método','Construção e seções adotadas','Infraestrutura / dimensões úteis','Agrupamento / ocupação','Ambiente','ΔU local por circuito','Observações','Situação'].map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="13">Nenhum trecho cadastrado.</td></tr>'}</tbody></table></div>`)}
    ${analysisPanel(p,a)}
    ${notice('Verificação parcial do projeto','O mapa representa o cadastro, não uma aprovação elétrica. Proteção, partida e demais critérios fora dos serviços implementados permanecem não verificados. Consulte Relatórios para revisar a memória e exportar PDF, CSV ou backup JSON.','amber')}`;
}

function selectionPanel(p,state) {
  const sel=state.selected;
  if(sel?.kind==='node') {
    const n=p.nodes.find(n=>n.id===sel.id);if(n) {
      const pos=diagramPositions(p)[n.id],c=p.consumers.find(c=>c.id===n.entityId),q=p.panels.find(q=>q.id===n.entityId);
      const current=state.analysis?.currents.find(r=>r.targetId===c?.id),amps=current?.measurements.find(m=>m.code==='selected_a')?.value;
      return panel(n.label||'Ponto','nodes',`<div class="panel-body"><p>${esc(kinds[n.kind]||'Tipo pendente')}</p><p>${esc(c?.description||q?.description||'')}</p>
        ${c?`<p>${fmt(c.power)} ${esc(c.unit||'')} por equipamento · quantidade ${c.quantity}<br>${fmt(c.voltage)} V · ${esc(c.connection||'Ligação pendente')}</p>`:''}
        ${c?`<p>Corrente por equipamento: <strong>${fmt(amps)} A</strong>${current?.status==='pending'?' · Pendente':''}</p>${current?.status==='pending'?`<p class="conductor-pending">${esc(current.reason)}</p>`:''}`:''}
        <p>Coordenadas do desenho: ${fmt(pos.x)}, ${fmt(pos.y)}. Não são metros.</p>${button('Editar posição','position',n.id)}
        <p><a href="#/consumidores">Editar cadastro e vínculos</a></p></div>`);
    }
  }
  const t=p.segments.find(s=>s.id===sel?.id);
  if(t&&sel.kind==='segment') {
    const f=segmentFacts(p,t,state.analysis);
    return panel(`Trecho ${t.tag}`,'cable',`<div class="panel-body">
      <p><strong>${fmt(t.length)} m</strong> · ${t.kind==='branch'?'Ramal':'Principal'}<br>${esc(t.environment||'Ambiente pendente')} · ${fmt(t.temperature)} °C</p>
      <p>Método ${esc(t.installationMethod||'pendente')} · ${f.circuits.length} circuito(s)</p>
      ${button('Editar conexão e distância','segment',t.id)}
      <h3>Cargas alimentadas</h3><p>${esc(f.loads.map(c=>c.tag).join(', ')||'Vínculos pendentes')}</p>
      <h3>Ocupação</h3><p>${fmt(f.occupancy?.occupancy)} % · ${esc({calculated:'Critérios calculados atendidos',pending:'Pendente',review:'Revisar'}[f.occupancy?.status]||'Não calculada')}</p>
      ${(f.occupancy?.pending||[]).map(t=>`<p class="conductor-pending">${esc(t)}</p>`).join('')}
      <h3>Condutores</h3>${f.conductors.map(r=>`<p>${esc(r.tag)} · Ib ${fmt(r.ib)} A · seção sugerida ${fmt(r.section)} mm² · ${r.status==='calculated'?'Pré-dimensionado':'Pendente'}</p>`).join('')||'<p>Não calculados.</p>'}
      <h3>Queda neste segmento</h3>${f.drops.map(r=>`<p>${esc(r.circuitTag)}: ${fmt(r.drop)} V (${fmt(r.percent)}%). Parcela local, não o percurso completo.</p>`).join('')||'<p>Não calculada.</p>'}
      <p>${esc(t.notes)}</p><a href="#/dimensionamento">Dimensionamento</a> · <a href="#/infraestrutura">Infraestrutura</a> · <a href="#/queda-de-tensao">Queda</a></div>`);
  }
  return panel('Detalhes da instalação','info',`<div class="panel-body"><h3>Selecione um ponto ou trecho</h3><p>Consulte propriedades, circuitos e cargas atendidas. Conexões e comprimentos são editados com confirmação de salvamento.</p><a class="button" href="#/consumidores">Cadastrar caminhos e circuitos</a></div>`);
}

function analysisPanel(p,a) {
  if(!a)return notice('Análises ainda não atualizadas','Clique em Atualizar análises para reunir correntes, condutores, ocupação, queda e pendências da revisão atual.');
  const items=[...a.topology.issues.map(i=>({label:'Estrutura',message:i.message})),...a.errors.map(i=>({label:i.domain,message:i.message}))];
  for(const r of a.currents)if(r.status!=='calculated')items.push({label:`Corrente · ${p.consumers.find(c=>c.id===r.targetId)?.tag||''}`,message:r.reason});
  for(const [key,label] of [['conductors','Condutores'],['infrastructure','Infraestrutura'],['voltage','Queda']])for(const r of a[key]?.results||[])
    for(const message of [...(r.pending||[]),...(r.criteria||[]).filter(c=>c.status==='failed').map(c=>c.message)]) {
      // These services are consolidated below; this historical conductor disclaimer describes only its own scope.
      if(key==='conductors'&&message==='Queda de tensão: não calculada (Etapa 8). Ocupação: não calculada (Etapa 7).')continue;
      items.push({label:`${label} · ${r.tag||p.segments.find(s=>s.id===r.id)?.tag||''}`,message});
    }
  return panel('Resultados e pendências da revisão atual','report',`<div class="panel-body"><p>Revisão elétrica ${a.inputRevision}. Entradas salvas; a análise detalhada é recalculada ao reabrir. Status geral: ${badge('Verificação parcial','amber')}</p>
    <div class="overview-results">${[['Condutores',a.conductors,'dimensionamento'],['Infraestrutura',a.infrastructure,'infraestrutura'],['Queda permanente',a.voltage,'queda-de-tensao']].map(([label,r,route])=>`<div><strong>${label}</strong><p>${r?`${r.results.filter(v=>v.status==='calculated').length} de ${r.results.length} itens com critérios calculados atendidos`:'Análise indisponível: confira as pendências'}</p><a href="#/${route}">Ver memória detalhada</a></div>`).join('')}</div>
    <details><summary>Pendências e limites (${items.length} registros)</summary><ul class="topology-issues">${items.map(i=>`<li><strong>${esc(i.label)}:</strong> ${esc(i.message)}</li>`).join('')}</ul></details>
    <p>Proteção: não implementada. Partida de motores: não calculada. Potência é soma dos registros de cargas convertidos, sem demanda e sem somar novamente consumidores do tipo painel.</p></div>`);
}

export function overviewForm(p,kind,id) {
  if(kind==='position') {
    const n=p.nodes.find(n=>n.id===id),pos=diagramPositions(p)[id];
    return `<h2 id="overview-dialog-title">Posição · ${esc(n.label)}</h2><p>Coordenadas gráficas; não alteram distâncias ou cálculos elétricos.</p><div class="conductor-form-grid">${['x','y'].map(k=>`<label class="field"><span>Coordenada ${k.toUpperCase()}</span><input type="number" step="any" name="${k}" value="${pos[k]}" min="-10000000" max="10000000" required></label>`).join('')}</div>`;
  }
  const s=p.segments.find(s=>s.id===id);
  return `<h2 id="overview-dialog-title">Conexão e distância · ${esc(s.tag)}</h2><p>A alteração modifica o caminho físico e invalida os cálculos. Trocar uma conexão não transfere circuitos automaticamente; revise os vínculos em Consumidores e cargas.</p>
    <div class="conductor-form-grid">${[['fromNodeId','Origem'],['toNodeId','Destino']].map(([k,label])=>`<label class="field"><span>${label}</span><select name="${k}" aria-label="${label}" required><option value="" ${!s[k]?'selected':''}>Selecione o ponto</option>${p.nodes.map(n=>`<option value="${esc(n.id)}" ${s[k]===n.id?'selected':''}>${esc(n.label)}</option>`).join('')}</select></label>`).join('')}
    <label class="field"><span>Comprimento físico do segmento (m)</span><input type="number" step="any" min="0" name="length" value="${s.length??''}" required></label></div>
    <label class="field"><span>Observações do trecho</span><textarea name="notes" maxlength="2000" rows="3">${esc(s.notes)}</textarea></label>`;
}
