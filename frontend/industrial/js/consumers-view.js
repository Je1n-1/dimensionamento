import { icon, metric, panel, emptyState, badge, escapeHTML as esc } from './components.js';
import { TYPES, CONNECTIONS, PHASES, MATERIALS, CABLES, BASES, DISTANCES, conductorLabel, missingConsumerData, filterConsumers } from './core/consumers.js';
import { activePowerSummary } from './core/currents.js';
import { currentsView } from './currents-view.js';

const number = value => value === null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
function button(label, symbol, operation, id = '') {
  return `<button type="button" class="button ${operation === 'add' ? 'primary' : operation === 'delete' ? 'danger icon-only' : 'icon-only'}" data-consumer-action="${operation}" data-consumer-id="${esc(id)}" aria-label="${esc(label)}" title="${esc(label)}">${icon(symbol)}<span>${esc(label)}</span></button>`;
}
const options = (entries, value, blank = 'Não informado') => `<option value="">${esc(blank)}</option>${Object.entries(entries).map(([key,label]) => `<option value="${esc(key)}" ${key === String(value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}`;
function filter(label, id, entries, value, blank) {
  return `<label class="field" for="${id}"><span>${label}</span><select id="${id}">${options(entries, value, blank)}</select></label>`;
}

export function consumersView(project, query = {}) {
  if (!project) return panel('Consumidores e cargas', 'list', emptyState('Abra um projeto para começar', 'Os consumidores serão salvos no projeto selecionado.', 'folder', '<a class="button primary" href="#/projetos">Ir para projetos</a>'));
  const rows = filterConsumers(project, query);
  const powerSummary = activePowerSummary(project);
  const environments = Object.fromEntries([...new Set(project.consumers.map(c => c.environment).filter(Boolean))].sort().map(v => [v,v]));
  const segments = Object.fromEntries(project.consumers.filter(c => c.plannedSegmentId || c.plannedSegmentTag).map(c => [c.plannedSegmentId || c.plannedSegmentTag, project.segments.find(s => s.id === c.plannedSegmentId)?.tag || c.plannedSegmentTag || c.plannedSegmentId]));
  const columns = ['Nº','Tipo','Tag / descrição','Quantidade','Potência por unidade','Tensão / frequência','Fases / condutores','Método','Cabo / isolação','Distância informada','Ambiente / temperatura','Origem / trecho','Cadastro','Ações'];
  const body = rows.map((c,index) => {
    const missing = missingConsumerData(c);
    const motor = project.motors.find(m => m.consumerId === c.id);
    return `<tr><td>${index+1}</td><td><span class="consumer-type">${icon(c.type === 'motor' ? 'motor' : c.type === 'panel' ? 'infrastructure' : 'bolt')}${esc(TYPES[c.type])}</span></td>
      <td class="consumer-name"><strong>${esc(c.tag)}</strong><span>${esc(c.description || 'Sem descrição')}</span>${motor ? `<small>Placa informada: ${number(motor.plateCurrent)} A · ${motor.catalogId ? 'Tabela WEG W21 selecionada' : 'Catálogo manual: '+number(motor.catalogCurrent)+' A'}</small>` : ''}</td>
      <td>${number(c.quantity)}</td><td>${number(c.power)} ${esc(c.unit || '')}<small>${esc(BASES[c.powerBasis] || 'Tipo não informado')}</small></td>
      <td>${number(c.voltage)} V<small>${number(c.frequency)} Hz</small></td><td>${esc(conductorLabel(c))}</td>
      <td>${esc(c.installationMethod || 'Não informado')}</td><td>${esc(MATERIALS[c.cableMaterial] || '—')}<small>${esc(CABLES[c.cableType] || '—')} · ${esc(c.insulation === 'other' ? c.insulationDescription : c.insulation || '—')}</small></td>
      <td>${number(c.distance)} m<small>${esc(DISTANCES[c.distanceBasis] || 'Base não informada')}</small></td><td>${esc(c.environment || 'Não informado')}<small>${number(c.temperature)} °C</small></td>
      <td>${esc(project.panels.find(p => p.id === c.panelId)?.tag || 'Origem não definida')}<small>${esc(project.segments.find(s => s.id === c.plannedSegmentId)?.tag || c.plannedSegmentTag || 'Trecho não definido')}</small></td>
      <td>${badge(missing.length ? 'Dados pendentes' : 'Cadastrado', missing.length ? 'amber' : 'blue')}${missing.length ? `<details class="consumer-missing"><summary>${missing.length} campo(s) a completar</summary><p>Faltam: ${esc(missing.join(', '))}.</p></details>` : '<small>Preenchimento do cadastro</small>'}</td>
      <td><div class="row-actions">${button(`Editar ${c.tag}`, 'edit','edit',c.id)}${button(`Excluir ${c.tag}`,'trash','delete',c.id)}</div></td></tr>`;
  }).join('');
  return `<div class="metric-grid count-5" id="consumer-summary">
      ${metric('Consumidores cadastrados','report',`${number(project.consumers.reduce((sum,c) => sum+c.quantity,0))} equipamentos informados`,'blue',project.consumers.length)}
      ${metric('Potência ativa das cargas','bolt',powerSummary.reason,'blue',powerSummary.value === null ? 'Pendente' : number(powerSummary.value / 1000) + ' kW')}
      ${metric('Motores','motor','Registros no projeto','blue',project.consumers.filter(c => c.type === 'motor').length)}
      ${metric('Painéis e quadros','infrastructure','Registros no projeto','purple',project.panels.length)}
      ${metric('Com trecho informado','nodes','Referência de planejamento','blue',project.consumers.filter(c => c.plannedSegmentId || c.plannedSegmentTag).length)}</div>
    ${panel('Consumidores e cargas','list', `<div class="consumer-filters">
      ${filter('Tipo','consumer-filter-type',TYPES,query.type,'Todos os tipos')}
      ${filter('Ambiente','consumer-filter-environment',environments,query.environment,'Todos os ambientes')}
      ${filter('Trecho planejado','consumer-filter-segment',segments,query.segment,'Todos os trechos')}
      <label class="field consumer-search" for="consumer-search"><span>Buscar</span><input id="consumer-search" type="search" placeholder="Tag, descrição ou observações…" value="${esc(query.search || '')}"></label></div>
      <div id="consumer-results"><div class="table-scroll consumer-scroll" role="region" aria-label="Cadastro de consumidores" tabindex="0"><table class="consumer-table"><caption class="sr-only">Consumidores do projeto ${esc(project.name)}</caption><thead><tr>${columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}" class="empty-cell"><strong>${project.consumers.length ? 'Nenhum consumidor corresponde aos filtros' : 'Cadastre o primeiro consumidor'}</strong><span>Use Adicionar item para informar uma carga, motor ou painel.</span></td></tr>`}</tbody></table></div><p class="consumer-count">${rows.length} de ${project.consumers.length} registros · Dados salvos no projeto atual · Grandezas e pendências disponíveis abaixo</p></div>`,
      `<div class="actions">${button('Adicionar item','plus','add')}<button class="button" type="button" disabled title="Importação prevista para a Etapa 10">${icon('export')}Importar planilha</button><button id="calculate-currents" class="button primary" type="button" data-calculate-currents ${project.consumers.length ? '' : 'disabled'}>${icon('bolt')}Calcular potências e correntes</button></div>`)}
    <p class="storage-note">“Cadastrado” indica preenchimento. A corrente obtida não significa conformidade do circuito.</p>
    ${currentsView(project,rows)}`;
}

function input(label, name, value, { type = 'text', choices, required = false, maxLength = 200, min, max, step = 'any', hint = '' } = {}) {
  const id = `consumer-${name.replaceAll('.', '-')}`;
  const attrs = `id="${id}" name="${name}" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}-hint"` : ''}`;
  const control = choices ? `<select ${attrs}>${options(choices, value)}</select>` : type === 'textarea'
    ? `<textarea ${attrs} maxlength="${maxLength}" rows="3">${esc(value)}</textarea>`
    : `<input ${attrs} type="${type}" value="${esc(value ?? '')}" ${type === 'number' ? `step="${step}" ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}` : `maxlength="${maxLength}"`}>`;
  return `<label class="field" for="${id}"><span>${label}${required ? ' *' : ''}</span>${control}${hint ? `<small id="${id}-hint">${hint}</small>` : ''}</label>`;
}

export function consumerForm(project, consumer, motor, editing) {
  const c = consumer, m = motor;
  const n = (label,key,config={}) => input(label,key,c[key],{type:'number',...config});
  const s = (label,key,choices,config={}) => input(label,key,c[key],{choices,...config});
  const panels = Object.fromEntries(project.panels.filter(p => p.consumerId !== c.id).map(p => [p.id,p.tag]));
  const segments = Object.fromEntries(project.segments.map(s => [s.id,s.tag || s.id]));
  const mn = (label,key,config={}) => input(label,`motor.${key}`,m[key],{type:'number',...config});
  return `<form id="consumer-form"><header class="consumer-dialog-heading"><div><span class="eyebrow">${esc(project.name)}</span><h2 id="consumer-dialog-title">${editing ? 'Editar consumidor' : 'Adicionar consumidor'}</h2></div><button type="button" class="icon-button" data-consumer-cancel aria-label="Fechar cadastro">${icon('close')}</button></header>
    <p class="dialog-note">Informe os dados conhecidos. Os campos com * são obrigatórios; dados ausentes ficam pendentes. Ao salvar, os resultados anteriores serão invalidados.</p>
    <fieldset><legend>1 · Identificação</legend><div class="consumer-form-grid">
      ${s('Tipo de consumidor','type',TYPES,{required:true})}${input('Identificador / tag','tag',c.tag,{required:true,maxLength:60})}
      ${input('Descrição','description',c.description)}${n('Quantidade de equipamentos','quantity',{required:true,min:1,step:1})}
    </div><p class="field-hint" id="consumer-type-hint">Cada registro reúne equipamentos com os mesmos dados. Para valores diferentes, use registros separados.</p></fieldset>
    <fieldset><legend>2 · Dados elétricos</legend><div class="consumer-form-grid">
      ${n('Potência por equipamento','power',{min:0})}${s('Unidade de potência','unit',Object.fromEntries(['W','kW','VA','kVA','cv','hp'].map(v=>[v,v])))}${s('Tipo de potência informada','powerBasis',BASES)}
      ${n('Tensão nominal (V)','voltage',{min:0})}${n('Frequência (Hz)','frequency',{min:0})}${s('Ligação','connection',CONNECTIONS)}${s('Fases utilizadas','phaseSet',PHASES)}
      ${s('Condutor de proteção (PE)','hasPE',{'true':'PE incluído','false':'PE não informado / ausente'},{required:true})}
      ${n('Fator de potência (0 a 1)','powerFactor',{min:0,max:1})}${n('Rendimento (0 a 1)','efficiency',{min:0,max:1})}
      ${s('Carga trifásica equilibrada?','balanced',{'true':'Sim, confirmo','false':'Não'},{hint:'Necessário para a fórmula trifásica. Em FN/FF este campo não é usado. Tensão: entre fases para FF/3F; fase-neutro para FN.'})}
    </div><p class="field-hint" id="consumer-connection-preview">${esc(conductorLabel(c))}</p><p class="field-hint">A ligação indica fases e neutro. A presença de PE não define o esquema de aterramento da instalação.</p></fieldset>
    <fieldset id="consumer-motor-fields" ${c.type === 'motor' ? '' : 'hidden disabled'}><legend>3 · Dados do motor</legend><div class="consumer-form-grid">
      ${mn('Número de polos','poles',{min:1,step:1})}${mn('Fator de serviço','serviceFactor',{min:0})}${mn('Corrente nominal de placa (A)','plateCurrent',{min:0})}${mn('Corrente nominal de catálogo (A)','catalogCurrent',{min:0})}
      ${input('Fabricante','motor.source.manufacturer',m.source.manufacturer)}${input('Modelo','motor.source.model',m.source.model)}
      ${input('Edição do catálogo','motor.source.edition',m.source.edition)}${input('Referência / página / documento','motor.source.reference',m.source.reference)}
      ${input('Fonte de corrente a utilizar','motor.currentPreference',m.currentPreference,{required:true,choices:{auto:'Automática: placa → catálogo → fórmula',plate:'Placa',catalog:'Catálogo',formula:'Fórmula (estimativa)'}})}
      ${input('Tabela de referência específica','motor.catalogId',m.catalogId,{choices:{'weg-w21-fockink-2006-v1':'WEG W21 · 60 Hz · IP55 · setembro/2006'},hint:'Selecione somente se o motor corresponde a esta linha. Reprodução Fockink, Rev.05/2021, p.47. Sem seleção, o catálogo usa os dados manuais acima.'})}
      ${input('Corrente nominal nas condições efetivas?','motor.nominalConditionsConfirmed',m.nominalConditionsConfirmed,{choices:{true:'Sim, conferi placa / catálogo',false:'Não conferido'},hint:'Confirme tensão, frequência e corrente da maior potência/velocidade utilizada. A consulta à tabela não comprova a compatibilidade com um motor real.'})}
      ${input('Circuito exclusivo e escopo do motor?','motor.exclusiveS1Circuit',m.exclusiveS1Circuit,{choices:{true:'Sim, confirmo as condições abaixo',false:'Não / outro caso'},hint:'Um único motor de indução de gaiola, serviço S1, aplicação industrial normal, até 150 kW. Exclui motores até 1,5 kW que acionam aparelhos domésticos ou eletroprofissionais. NBR 5410:2004, 6.5.1.1.'})}
      ${input('A operação explorará o fator de serviço?','motor.usesServiceFactor',m.usesServiceFactor,{choices:{true:'Sim, FS > 1 declarado pelo fabricante',false:'Não'},hint:'Se sim: Ib mínimo = In × FS. Se não: Ib mínimo = In. Não reduzimos In por rendimento, demanda ou fator arbitrário.'})}
      ${mn('Corrente de partida informada (A)','startingCurrent',{min:0})}${mn('Corrente medida informada (A)','measuredCurrent',{min:0})}
    </div><p class="field-hint">A corrente de placa tem prioridade no modo automático. Escolher uma fonte explicitamente impede substituição silenciosa quando ela estiver incompleta. Partida e medição não substituem a corrente nominal. Valores da tabela são por motor.</p></fieldset>
    <fieldset><legend>Instalação e percurso</legend><div class="consumer-form-grid">
      ${input('Método de instalação','installationMethod',c.installationMethod,{hint:'Informe o método conhecido (ex.: B1). Nenhum método é deduzido pelo tipo de ambiente.'})}
      ${s('Material do condutor','cableMaterial',MATERIALS)}${s('Tipo de cabo','cableType',CABLES)}${s('Isolação','insulation',{PVC:'PVC',XLPE:'XLPE',EPR:'EPR',other:'Outra'})}
      <div id="consumer-other-insulation" ${c.insulation === 'other' ? '' : 'hidden'}>${input('Descreva a isolação','insulationDescription',c.insulationDescription)}</div>
      ${n('Distância informada (m)','distance',{min:0})}${s('Esta distância representa','distanceBasis',DISTANCES)}
      ${input('Ambiente / setor','environment',c.environment)}${n('Temperatura do ambiente (°C)','temperature',{min:-100,max:200})}
      ${s('Painel de origem','panelId',panels)}${input('Identificação do trecho planejado','plannedSegmentTag',c.plannedSegmentTag,{hint:'Referência de planejamento, como T-01. Não cria um segmento físico.'})}
      ${project.segments.length ? s('Vincular trecho existente','plannedSegmentId',segments) : ''}
    </div><p class="field-hint">Distância acumulada: percurso desde o quadro de origem até a carga. Comprimento físico: somente um segmento desse percurso. O cadastro não soma distâncias nem monta a topologia; isso será tratado na Etapa 5.</p></fieldset>
    <fieldset><legend>Observações</legend>${input('Observações do consumidor','notes',c.notes,{type:'textarea',maxLength:2000})}</fieldset>
    <p class="form-error" id="consumer-form-error" role="alert"></p><footer class="dialog-actions"><button type="button" class="button" data-consumer-cancel>Cancelar</button><button type="submit" class="button primary">${icon('save')}Salvar consumidor</button></footer></form>`;
}
