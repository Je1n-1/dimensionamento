import { icon, panel, badge, metric, notice, emptyState, escapeHTML as esc } from './components.js';
import { TOPOLOGY_FIELDS, TOPOLOGY_MODELS } from './core/topology.js';

const names = { panels: 'Quadros', nodes: 'Pontos de conexão', segments: 'Trechos e ramais', circuits: 'Circuitos e destinos', cables: 'Formações de cabos', infrastructures: 'Infraestrutura declarada' };
const labels = { tag: 'Identificação', description: 'Descrição', parentPanelId: 'Quadro superior planejado', label: 'Nome do ponto', kind: 'Tipo', entityId: 'Vínculo do ponto',
  fromNodeId: 'Origem', toNodeId: 'Destino', length: 'Comprimento físico (m)', installationMethod: 'Método de instalação informado', temperature: 'Temperatura ambiente (°C)', environment: 'Ambiente', groupingArrangement: 'Disposição do agrupamento', soilResistivity: 'Resistividade térmica do solo (K·m/W)', soilDepth: 'Profundidade no solo (m)',
  loadedConductors: 'Condutores carregados — opcional, conferido na Etapa 6', purpose: 'Finalidade', role: 'Função do circuito', originNodeId: 'Quadro ou origem externa', consumerIds: 'Consumidores atendidos', destinationPanelIds: 'Quadros atendidos', segmentIds: 'Trechos percorridos', circuitId: 'Circuito', formation: 'Formação', quantity: 'Quantidade de formações idênticas em paralelo', routeMode: 'Percurso da formação', segmentId: 'Trecho', type: 'Tipo de infraestrutura' };
const values = { origin:'Origem externa', panel:'Quadro', consumer:'Consumidor', junction:'Derivação / passagem', trunk:'Trecho principal', branch:'Ramal', lighting:'Iluminação', power:'Força', control:'Comando', other:'Outro', terminal:'Terminal', feeder:'Alimentador', insulated:'Condutores isolados', single_core:'Cabos unipolares', multicore:'Cabo multipolar', circuit:'Todo o percurso do circuito', selected:'Somente trechos selecionados', conduit:'Eletroduto', tray:'Eletrocalha', solid_tray:'Calha lisa', perforated_tray:'Calha perfurada', ladder:'Leito' };
const num = value => value == null ? 'Pendente' : Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const label = item => item?.tag || item?.label || 'Sem identificação';
const find = (p, collection, id) => label(p[collection].find(i => i.id === id));
const button = (text, action, collection = '', id = '', primary = false) => `<button type="button" class="button${primary ? ' primary' : ''}" data-topology-action="${action}" data-collection="${collection}" data-id="${esc(id)}">${esc(text)}</button>`;

export function preparationForm(p, selectedConsumerId = '') {
  const selected = p.consumers.find(c => c.id === selectedConsumerId);
  const loads = p.consumers.filter(c => c.type !== 'panel' && !p.circuits.some(r => r.consumerIds.includes(c.id)));
  return `<h2 id="topology-dialog-title">Preparar circuitos a partir das cargas</h2>
    <p>Crie um circuito terminal e um percurso independente para cada registro selecionado. Equipamentos com quantidade maior que 1 serão tratados no mesmo ponto de destino. Para lâmpadas ao longo de um percurso comum, use Caminhos e circuitos.</p>
    <label class="field">Quadro de origem<select name="panelId" required><option value="">Selecione o quadro</option>${p.panels.map(q=>`<option value="${esc(q.id)}" ${q.id===selected?.panelId?'selected':''}>${esc(q.tag)}</option>`).join('')}</select></label>
    ${!p.panels.length ? '<p class="form-error">Feche esta janela e use Adicionar quadro para cadastrar a origem.</p>' : ''}
    <div class="actions"><button type="button" class="button" data-preparation-select="all">Selecionar cargas deste quadro / sem origem</button><button type="button" class="button" data-preparation-select="none">Limpar seleção</button></div>
    <div class="preparation-loads">${loads.map(c=>`<div class="preparation-row" data-preparation-row>
      <label><input type="checkbox" name="consumerId" value="${esc(c.id)}" ${c.id===selectedConsumerId?'checked':''}> <strong>${esc(c.tag)}</strong> · ${esc(c.description || '')}<small>${esc(c.quantity)} equipamento(s) no mesmo ponto · ${esc(c.connection || 'Ligação pendente')} · ${esc(c.plannedSegmentTag || 'Trecho será identificado pela tag')}</small></label>
      <label class="field">Percurso completo desde o quadro (m)<input type="number" name="distance-${esc(c.id)}" min="0.001" step="any" value="${c.distanceBasis==='cumulative' ? esc(c.distance??'') : ''}"></label>
    </div>`).join('') || '<p>Todas as cargas já têm circuito, ou ainda não há cargas cadastradas.</p>'}</div>
    <label class="conductor-check"><input type="checkbox" name="independentConfirmed" required> Confirmo: cada registro selecionado tem seu próprio circuito e percurso desde este quadro, sem compartilhar trechos físicos com outros circuitos.</label>
    <p class="field-hint">Serão copiados método, temperatura, material, isolação e funções dos condutores informados no cadastro. Seção, proteção e confirmações das condições reais continuam pendentes. Nada será criado até você confirmar.</p>`;
}

export function topologyTabs(active = 'consumers') {
  return `<nav class="topology-tabs" aria-label="Cadastro de cargas e caminhos">
    <button type="button" class="button ${active === 'consumers' ? 'primary' : ''}" data-topology-tab="consumers" aria-pressed="${active === 'consumers'}">${icon('motor')} Consumidores e correntes</button>
    <button type="button" class="button ${active === 'topology' ? 'primary' : ''}" data-topology-tab="topology" aria-pressed="${active === 'topology'}">${icon('nodes')} Caminhos e circuitos</button>
  </nav>`;
}

function register(p, collection, columns, cells, analysis) {
  return panel(names[collection], collection === 'cables' ? 'cable' : 'nodes', `
    <div class="table-scroll" role="region" aria-label="${names[collection]}" tabindex="0"><table class="topology-table">
      <thead><tr>${columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}<th scope="col">Ações</th></tr></thead>
      <tbody>${p[collection].length ? p[collection].map(item => `<tr>${cells(item, analysis).map(v => `<td>${v}</td>`).join('')}
        <td><div class="actions">${button('Editar', 'edit', collection, item.id)}${button('Excluir', 'delete', collection, item.id)}</div></td></tr>`).join('') : `<tr><td colspan="${columns.length+1}">Nenhum item cadastrado.</td></tr>`}</tbody>
    </table></div>`, button('Adicionar', 'edit', collection));
}

export function topologyView(p, state = {}) {
  if (!p) return emptyState('Abra um projeto', 'Crie ou abra um projeto para organizar sua instalação.', 'nodes');
  const a = state.analysis;
  const itemName = id => {
    for (const key of ['nodes','panels','segments','circuits','cables','consumers','conductors']) {
      const item = p[key].find(i => i.id === id); if (item) return label(item);
    }
    return 'Projeto';
  };
  return `<div class="topology-toolbar"><div><h2>Caminhos físicos e circuitos</h2><p>1. Quadros e pontos → 2. Trechos → 3. Circuitos → 4. Formações e infraestrutura.</p></div>
    <div class="actions">${button('Criar pontos das cargas e quadros', 'points')}${button('Criar caminho', 'path', '', '', true)}${button(state.busy ? 'Verificando…' : 'Verificar estrutura', 'analyze')}</div></div>
    ${state.error ? `<p class="form-error" role="alert">${esc(state.error)}</p>` : ''}
    ${notice('Um caminho pode ser compartilhado por vários circuitos', 'O circuito informa quais trechos percorre. Após uma derivação, selecione somente os trechos onde seus cabos continuam. Um ponto de consumidor representa a localização da derivação, não uma ligação elétrica através do equipamento.')}
    <div class="metric-grid">${metric('Quadros', 'folder', 'Origens e quadros atendidos', 'blue', p.panels.length)}${metric('Trechos', 'nodes', 'Comprimentos físicos', 'blue', p.segments.length)}${metric('Circuitos', 'bolt', 'Percursos declarados', 'blue', p.circuits.length)}${metric('Verificação estrutural', 'shield', 'Sem declaração de conformidade elétrica', 'amber', a ? (a.issues.length ? `${a.issues.length} pendências` : 'Estrutura válida') : 'Não verificada')}</div>
    <div class="topology-registers">
      ${register(p, 'panels', ['Quadro', 'Descrição'], i => [esc(i.tag), esc(i.description)])}
      ${register(p, 'nodes', ['Ponto', 'Tipo', 'Vínculo'], i => [esc(i.label), esc(values[i.kind]), esc(i.entityId ? itemName(i.entityId) : '—')])}
      ${register(p, 'segments', ['Trecho', 'Percurso', 'Extensão física', 'Condições', 'Circuitos', 'Cabos / condutores isolados'], i => {
        const row = a?.segments.find(s => s.id === i.id);
        return [esc(i.tag), `${esc(find(p,'nodes',i.fromNodeId))} → ${esc(find(p,'nodes',i.toNodeId))}`, `${num(i.length)} m`, `${esc(i.installationMethod || 'Método pendente')} · ${num(i.temperature)} °C<br>${esc(i.environment)}`, esc((row?.circuitIds || p.circuits.filter(c=>c.segmentIds.includes(i.id)).map(c=>c.id)).map(id=>find(p,'circuits',id)).join(', ') || 'Nenhum'), row?.complete ? `${num(row.physicalCables)} cabos / ${num(row.insulatedConductors)} isolados<small>${esc(Object.entries(row.functions).map(([k,v])=>`${k}: ${v}`).join(' · '))}</small>` : badge('Contagem pendente','amber')];
      })}
      ${register(p, 'circuits', ['Circuito', 'Origem', 'Destinos', 'Percursos verificados'], i => {
        const row = a?.circuits.find(c => c.id === i.id);
        return [esc(i.tag), esc(find(p,'nodes',i.originNodeId)), esc([...i.consumerIds.map(id=>find(p,'consumers',id)), ...i.destinationPanelIds.map(id=>find(p,'panels',id))].join(', ') || 'Pendente'), row?.paths.length ? row.paths.map(path=>`${esc(itemName(path.entityId))}: ${num(path.length)} m`).join('<br>') + (row.valid ? '' : '<br>'+badge('Revisar percurso','amber')) : badge('Não verificado')];
      })}
      ${register(p, 'cables', ['Formação', 'Circuito', 'Tipo / quantidade', 'Funções', 'Percurso'], i => [esc(i.tag), esc(find(p,'circuits',i.circuitId)), `${esc(values[i.formation] || 'Pendente')} × ${i.quantity}`, esc(p.conductors.filter(w=>w.cableId===i.id).map(w=>w.role).join(' + ') || 'Pendente'), esc(i.routeMode === 'circuit' ? 'Todo o circuito' : i.segmentIds.map(id=>find(p,'segments',id)).join(', ') || 'Pendente')])}
      ${register(p, 'infrastructures', ['Trecho', 'Tipo', 'Ocupação'], i => [esc(find(p,'segments',i.segmentId)), esc(values[i.type]), '<a href="#/infraestrutura">Analisar ocupação</a>'])}
    </div>
    ${panel('Verificações e pendências da estrutura', 'shield', `<div class="panel-body">${a ? a.issues.length ? `<ul class="topology-issues">${a.issues.map(i=>`<li>${badge(i.severity === 'error' ? 'Revisar' : 'Pendente','amber')} <strong>${esc(itemName(i.targetId))}</strong> — ${esc(i.message)}</li>`).join('')}</ul>` : notice('Estrutura lógica validada', 'Os caminhos e vínculos declarados passaram pelas verificações estruturais. Cabos, proteção, ocupação e queda de tensão ainda não foram dimensionados.') : '<p>Clique em Verificar estrutura para analisar os dados atuais.</p>'}</div>`)}
    ${notice('Contagens declaradas, sem dimensionamento', 'Uma formação unipolar L1 + L2 + L3 + PE contém quatro cabos. Uma formação multipolar com essas funções contém um cabo com quatro condutores. A quantidade em paralelo multiplica a formação; a quantidade de equipamentos não é multiplicada automaticamente. Contagens ficam pendentes quando o percurso ou a formação estão incompletos.')}`;
}

function select(name, options, selected, blank = true) {
  return `<select name="${name}">${blank ? '<option value="">Não informado</option>' : ''}${options.map(([id,text])=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(text)}</option>`).join('')}</select>`;
}
const choices = (name, options, selected) => `<div class="topology-choices">${options.length ? options.map(([id,text])=>`<label><input type="checkbox" name="${name}" value="${esc(id)}" ${selected.includes(id)?'checked':''}> ${esc(text)}</label>`).join('') : '<span>Nenhum item disponível. Cadastre os itens antes de selecionar.</span>'}</div>`;
export function topologyForm(contract, p, collection, item) {
  const model = TOPOLOGY_MODELS[collection];
  const fields = TOPOLOGY_FIELDS[collection].map(key => {
    const spec = contract.models[model][key];
    let control;
    if (key === 'entityId') {
      control = select(key, [...p.panels.map(i=>[i.id,`Quadro: ${label(i)}`]),...p.consumers.filter(i=>i.type!=='panel').map(i=>[i.id,`Consumidor: ${label(i)}`])],item[key]);
    } else if (spec.type === 'array') {
      let entries = p[spec.items.target];
      if (key === 'consumerIds') entries = entries.filter(i=>i.type!=='panel');
      control = choices(key, entries.map(i=>[i.id,label(i)]),item[key]);
    } else if (spec.target) {
      let entries = p[spec.target];
      if (key === 'originNodeId') entries = entries.filter(i=>['panel','origin'].includes(i.kind));
      if (key === 'parentPanelId') entries = entries.filter(i=>i.id!==item.id);
      control = select(key,entries.map(i=>[i.id,label(i)]),item[key]);
    } else if (spec.enum) control = select(key,spec.enum.map(v=>[v,values[v]||v]),item[key],Boolean(spec.nullable));
    else control = `<input name="${key}" type="${spec.type==='number'?'number':'text'}" value="${esc(item[key])}" ${spec.type==='number' ? `step="${spec.integer?1:'any'}" ${spec.minimum!==undefined?`min="${spec.minimum}"`:''} ${spec.maximum!==undefined?`max="${spec.maximum}"`:''}` : `maxlength="${spec.maxLength}"`}>`;
    return spec.type==='array' ? `<fieldset><legend>${esc(labels[key])}</legend>${control}</fieldset>` : `<label class="field"><span>${esc(labels[key])}</span>${control}</label>`;
  }).join('');
  return `<h2 id="topology-dialog-title">${esc(names[collection])}</h2>
    <p class="field-hint">Campos não informados permanecem pendentes. Nenhum dado deste formulário comprova conformidade normativa.</p>
    ${collection==='nodes'?'<p>Escolha o tipo e o vínculo correspondente. Origens externas e derivações não têm vínculo.</p>':''}
    ${collection==='cables'?'<p>A formação define as funções e a quantidade física. Cada função aparece uma vez; use a quantidade para formações idênticas em paralelo. Com “Todo o percurso do circuito”, os trechos são herdados automaticamente. Marque trechos abaixo somente ao escolher “Somente trechos selecionados”.</p>':''}
    <div class="topology-form-grid">${fields}</div>
    ${collection==='cables'?`<fieldset><legend>Funções dos condutores por formação</legend>${choices('roles',['L1','L2','L3','N','PE','PEN'].map(v=>[v,v]),p.conductors.filter(w=>w.cableId===item.id).map(w=>w.role))}</fieldset>`:''}`;
}

export function pathForm(p) {
  return `<h2 id="topology-dialog-title">Criar caminho físico</h2><p>Informe os pontos na ordem do percurso. Distâncias acumuladas são medidas a partir da origem escolhida aqui. O sistema salva a diferença entre cada par de pontos como comprimento físico.</p>
    <div class="topology-form-grid"><label class="field"><span>Prefixo dos trechos</span><input name="prefix" required maxlength="180" placeholder="Ex.: A"></label>
    <label class="field"><span>Ponto de origem</span>${select('origin',p.nodes.map(i=>[i.id,label(i)]),'')}</label>
    <label class="field"><span>Como você mediu as distâncias?</span>${select('basis',[['physical','Comprimento de cada trecho'],['cumulative','Distância acumulada desde a origem']],'physical',false)}</label>
    <label class="field"><span>Tipo do caminho</span>${select('kind',[['trunk','Principal'],['branch','Ramal']],'trunk',false)}</label></div>
    <div id="path-rows">${pathRow(p,1)}</div><button type="button" class="button" data-path-add>Adicionar próximo ponto</button>
    <p class="field-hint">Exemplo acumulado: 28, 35 e 51 m geram trechos de 28, 7 e 16 m. Depois, associe os trechos a cada circuito. O ramo começa no ponto escolhido como origem.</p>`;
}
export function pathRow(p, index) {
  return `<div class="path-row"><label class="field"><span>Destino ${index}</span>${select('destination',p.nodes.map(i=>[i.id,label(i)]),'')}</label><label class="field"><span>Distância informada (m)</span><input type="number" name="distance" min="0" step="any" required></label><button type="button" class="button" data-path-remove aria-label="Remover destino ${index}">Remover</button></div>`;
}
