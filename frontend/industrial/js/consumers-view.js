import { icon, metric, panel, emptyState, badge, escapeHTML as esc } from './components.js';
import { TYPES, CONNECTIONS, PHASES, MATERIALS, CABLES, BASES, DISTANCES, METHODS, conductorLabel, missingConsumerData, filterConsumers } from './core/consumers.js';
import { activePowerSummary } from './core/currents.js';
import { currentsView } from './currents-view.js';
import { consumerWorkflow, consumerSegmentOptions } from './core/workflow.js';
import { consumerLinks } from './workflow-view.js';

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
  const segments = Object.fromEntries(project.consumers.flatMap(c => consumerSegmentOptions(project,c)));
  const columns = ['Nº','Tipo','Tag / descrição','Quantidade','Potência por unidade','Tensão / frequência','Fases / condutores','Método / fonte','Cabo / fonte','Comprimentos / fonte','Ambiente / temperatura','Quadro / circuito / trechos','Cadastro','Ações'];
  const body = rows.map((c,index) => {
    const missing = missingConsumerData(c,project);
    const workflow = consumerWorkflow(project,c);
    const motor = project.motors.find(m => m.consumerId === c.id);
    return `<tr><td>${index+1}</td><td><span class="consumer-type">${icon(c.type === 'motor' ? 'motor' : c.type === 'panel' ? 'infrastructure' : 'bolt')}${esc(TYPES[c.type])}</span></td>
      <td class="consumer-name"><strong>${esc(c.tag)}</strong><span>${esc(c.description || 'Sem descrição')}</span>${motor ? `<small>Placa informada: ${number(motor.plateCurrent)} A · ${motor.catalogId ? 'Tabela WEG W21 selecionada' : 'Catálogo manual: '+number(motor.catalogCurrent)+' A'}</small>` : ''}</td>
      <td>${number(c.quantity)}</td><td>${number(c.power)} ${esc(c.unit || '')}<small>${esc(BASES[c.powerBasis] || 'Tipo não informado')}</small></td>
      <td>${number(c.voltage)} V<small>${number(c.frequency)} Hz</small></td><td>${esc(conductorLabel(c))}</td>
      <td>${workflow.linked ? esc([...new Set(workflow.segments.map(s=>s.installationMethod || 'Pendente'))].join(' / ') || 'Sem trecho')+'<small>Nos trechos vinculados</small>' : esc(c.installationMethod || 'Não informado')+'<small>Planejamento</small>'}</td>
      <td>${workflow.linked ? esc([...new Set(project.conductors.filter(w=>workflow.cables.some(f=>f.id===w.cableId)).map(w=>(w.material || 'Material pendente')+' / '+(w.insulation || 'Isolação pendente')))].join('; ') || 'Sem condutores')+'<small>Nas formações vinculadas</small>' : esc(MATERIALS[c.cableMaterial] || '—')+'<small>'+esc(CABLES[c.cableType] || '—')+' · '+esc(c.insulation || '—')+' · Planejamento</small>'}</td>
      <td>${workflow.linked ? workflow.segments.map(s=>esc(s.tag)+': '+number(s.length)+' m').join('<br>')+'<small>Trechos declarados; percurso validado no cálculo</small>' : number(c.distance)+' m<small>'+esc(DISTANCES[c.distanceBasis] || 'Base não informada')+' · Planejamento</small>'}</td>
      <td>${esc(c.environment || 'Não informado')}<small>${workflow.linked ? workflow.segments.map(s=>esc(s.tag)+': '+number(s.temperature)+' °C').join('<br>') : number(c.temperature)+' °C · Planejamento'}</small></td>
      <td>${esc(workflow.panels.map(p=>p.tag).join(', ') || project.panels.find(p => p.id === c.panelId)?.tag || 'Origem não definida')}<small>${esc(workflow.circuits.map(r=>r.tag).join(', ') || 'Sem circuito vinculado')}</small>${consumerLinks(project,c)}</td>
      <td>${badge(missing.length ? 'Dados da carga pendentes' : 'Cadastrado', missing.length ? 'amber' : 'blue')}${missing.length ? `<details class="consumer-missing"><summary>${missing.length} campo(s) a completar</summary><p>Faltam: ${esc(missing.join(', '))}.</p></details>` : '<small>Preenchimento do cadastro</small>'}</td>
      <td><div class="row-actions">${button(`Editar ${c.tag}`, 'edit','edit',c.id)}${button(`Duplicar ${c.tag}`,'copy','copy',c.id)}${button(`Excluir ${c.tag}`,'trash','delete',c.id)}</div></td></tr>`;
  }).join('');
  return `<section class="workflow-start" aria-label="Como começar"><div><strong>${esc(project.name)} · Quadro → cargas → circuitos → cálculo</strong><p>Cadastre o quadro de origem, inclua suas cargas e prepare os circuitos. Cada salvamento pertence a este projeto. Use quantidade para equipamentos iguais no mesmo ponto; para outra distância, use Duplicar.</p></div><div class="actions"><button type="button" class="button" data-topology-action="edit" data-collection="panels">${icon('plus')}Adicionar quadro</button><button type="button" class="button primary" data-topology-action="prepare">Preparar circuitos</button><a class="button" href="#/dimensionamento">Ver dimensionamento</a></div></section>
    <div class="metric-grid count-5" id="consumer-summary">
      ${metric('Consumidores cadastrados','report',`${number(project.consumers.reduce((sum,c) => sum+c.quantity,0))} equipamentos informados`,'blue',project.consumers.length)}
      ${metric('Potência ativa das cargas','bolt',powerSummary.reason,'blue',powerSummary.value === null ? 'Pendente' : number(powerSummary.value / 1000) + ' kW')}
      ${metric('Motores','motor','Registros no projeto','blue',project.consumers.filter(c => c.type === 'motor').length)}
      ${metric('Painéis e quadros','infrastructure','Registros no projeto','purple',project.panels.length)}
      ${metric('Com circuito vinculado','nodes','Vínculos declarados; cálculo separado','blue',project.consumers.filter(c => c.type!=='panel' && consumerWorkflow(project,c).linked).length)}</div>
    ${panel('Consumidores e cargas','list', `<div class="consumer-filters">
      ${filter('Tipo','consumer-filter-type',TYPES,query.type,'Todos os tipos')}
      ${filter('Ambiente','consumer-filter-environment',environments,query.environment,'Todos os ambientes')}
      ${filter('Trecho planejado ou vinculado','consumer-filter-segment',segments,query.segment,'Todos os trechos')}
      <label class="field consumer-search" for="consumer-search"><span>Buscar</span><input id="consumer-search" type="search" placeholder="Tag, descrição ou observações…" value="${esc(query.search || '')}"></label></div>
      <div id="consumer-results"><div class="table-scroll consumer-scroll" role="region" aria-label="Cadastro de consumidores" tabindex="0"><table class="consumer-table"><caption class="sr-only">Consumidores do projeto ${esc(project.name)}</caption><thead><tr>${columns.map(label => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}" class="empty-cell"><strong>${project.consumers.length ? 'Nenhum consumidor corresponde aos filtros' : 'Cadastre o primeiro consumidor'}</strong><span>Use Adicionar item para informar uma carga, motor ou painel.</span></td></tr>`}</tbody></table></div><p class="consumer-count">${rows.length} de ${project.consumers.length} registros · Dados salvos no projeto atual · Grandezas e pendências disponíveis abaixo</p></div>`,
      `<div class="actions">${button('Adicionar item','plus','add')}<button class="button" type="button" disabled title="Importação prevista para a Etapa 10">${icon('export')}Importar planilha</button><button id="calculate-currents" class="button primary" type="button" data-calculate-currents ${project.consumers.length ? '' : 'disabled'}>${icon('bolt')}Calcular potências e correntes</button></div>`)}
    <p class="storage-note">“Cadastrado” indica preenchimento. A corrente obtida não significa conformidade do circuito.</p>
    ${currentsView(project,rows)}`;
}

function input(label, name, value, { type = 'text', choices, required = false, maxLength = 200, min, max, step = 'any', hint = '', blank = 'Não informado' } = {}) {
  const id = `consumer-${name.replaceAll('.', '-')}`;
  const attrs = `id="${id}" name="${name}" ${required ? 'required' : ''} ${hint ? `aria-describedby="${id}-hint"` : ''}`;
  const control = choices ? `<select ${attrs}>${options(choices, value, blank)}</select>` : type === 'textarea'
    ? `<textarea ${attrs} maxlength="${maxLength}" rows="3">${esc(value)}</textarea>`
    : `<input ${attrs} type="${type}" value="${esc(value ?? '')}" ${type === 'number' ? `step="${step}" ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''}` : `maxlength="${maxLength}"`}>`;
  return `<label class="field" for="${id}"><span>${label}${required ? ' *' : ''}</span>${control}${hint ? `<small id="${id}-hint">${hint}</small>` : ''}</label>`;
}

export function motorBatchRow(project,index,tag) {
  const field=(label,key,config={})=>input(label,`batch.${index}.${key}`,key==='tag'?tag:'',{blank:'Usar dados comuns',...config});
  const number=(label,key,config={})=>field(label,key,{type:'number',min:0,...config});
  const select=(label,key,choices)=>field(label,key,{choices});
  return `<fieldset data-motor-row="${index}"><legend>Motor ${index+1}</legend><div class="consumer-form-grid">
    ${field('Identificação / tag','tag',{required:true,maxLength:60})}${field('Descrição','description')}
  </div><h3 class="motor-card-heading">Dados elétricos deste motor</h3><div class="consumer-form-grid">
    ${number('Potência individual','power')}${select('Unidade','unit',Object.fromEntries(['W','kW','VA','kVA','cv','hp'].map(v=>[v,v])))}
    ${select('Tipo de potência','powerBasis',BASES)}${number('Tensão (V)','voltage')}${number('Frequência (Hz)','frequency')}
    ${select('Ligação','connection',CONNECTIONS)}${select('Fases','phaseSet',PHASES)}
    ${number('Fator de potência (0 a 1)','powerFactor',{max:1})}${number('Rendimento (0 a 1)','efficiency',{max:1})}
    ${number('Corrente de placa (A)','motor.plateCurrent')}
  </div><h3 class="motor-card-heading">Percurso deste motor</h3><div class="consumer-form-grid">
    ${number('Distância individual (m)','distance')}${select('Base da distância','distanceBasis',DISTANCES)}
    ${field('Trecho planejado','plannedSegmentTag',{maxLength:60})}
  </div><details class="consumer-advanced"><summary>Outras características deste motor</summary><div class="consumer-form-grid">
    ${select('Carga equilibrada','balanced',{'true':'Sim','false':'Não'})}${select('Condutor de proteção','hasPE',{'true':'PE incluído','false':'PE não informado / ausente'})}
    ${number('Número de polos','motor.poles',{min:1,step:1})}${number('Fator de serviço','motor.serviceFactor')}
    ${select('Fonte de corrente','motor.currentPreference',{auto:'Automática',plate:'Placa',catalog:'Catálogo',formula:'Fórmula (estimativa)'})}
    ${select('Método','installationMethod',METHODS)}${select('Material','cableMaterial',MATERIALS)}${select('Tipo de cabo','cableType',CABLES)}
    ${select('Isolação','insulation',{PVC:'PVC — 70 °C',XLPE:'XLPE — 90 °C',EPR:'EPR — 90 °C'})}
    ${number('Temperatura ambiente (°C)','temperature',{min:-100,max:200})}${field('Ambiente / setor','environment')}
    ${select('Quadro de origem','panelId',Object.fromEntries(project.panels.map(p=>[p.id,p.tag])))}
  </div></details></fieldset>`;
}

export function consumerForm(project, consumer, motor, editing) {
  const c = consumer, m = motor;
  const n = (label,key,config={}) => input(label,key,c[key],{type:'number',...config});
  const s = (label,key,choices,config={}) => input(label,key,c[key],{choices,...config});
  const panels = Object.fromEntries(project.panels.filter(p => p.consumerId !== c.id).map(p => [p.id,p.tag]));
  const segments = Object.fromEntries(project.segments.map(s => [s.id,s.tag || s.id]));
  const linked = consumerWorkflow(project,c).linked;
  const mn = (label,key,config={}) => input(label,`motor.${key}`,m[key],{type:'number',...config});
  return `<form id="consumer-form"><header class="consumer-dialog-heading"><div><span class="eyebrow">${esc(project.name)}</span><h2 id="consumer-dialog-title">${editing ? 'Editar consumidor' : 'Adicionar consumidor'}</h2></div><button type="button" class="icon-button" data-consumer-cancel aria-label="Fechar cadastro">${icon('close')}</button></header>
    <p class="dialog-note">Informe os dados conhecidos. Os campos com * são obrigatórios; dados ausentes ficam pendentes. Ao salvar, os resultados anteriores serão invalidados.</p>
    <fieldset><legend>1 · Identificação</legend><div class="consumer-form-grid">
      ${s('Tipo de consumidor','type',TYPES,{required:true})}${input('Identificador / tag','tag',c.tag,{required:true,maxLength:60})}
      ${input('Descrição','description',c.description)}${n('Quantidade de equipamentos','quantity',{required:true,min:1,step:1})}
    </div><p class="field-hint" id="consumer-type-hint">Cada registro reúne equipamentos com os mesmos dados. Para valores diferentes, use registros separados.</p></fieldset>
    <fieldset id="consumer-motor-batch" hidden disabled><legend>Cadastro individual dos motores</legend>
      <p id="motor-batch-summary" role="status"></p>
      <p>Os campos abaixo dos cartões são os <strong>dados comuns</strong>. Preencha nos cartões somente o que for diferente para cada motor; campos vazios usam os dados comuns. Cada motor será salvo separadamente, com quantidade 1. Revise as condições nominais de cada motor depois de salvar.</p>
      <p>Reduzir a quantidade inclui somente os primeiros cartões no salvamento. Os demais rascunhos ficam guardados enquanto esta janela estiver aberta.</p>
      <div id="motor-batch-rows"></div>
    </fieldset>
    <fieldset><legend data-common-legend="2 · Dados elétricos">2 · Dados elétricos</legend><div class="consumer-form-grid">
      ${n('Potência por equipamento','power',{min:0})}${s('Unidade de potência','unit',Object.fromEntries(['W','kW','VA','kVA','cv','hp'].map(v=>[v,v])))}${s('Tipo de potência informada','powerBasis',BASES,{hint:'Sugerido ao escolher a unidade. Em W/kW, confira se o valor é elétrico absorvido ou mecânico de saída.'})}
      ${n('Tensão nominal (V)','voltage',{min:0,hint:'220 V não define a ligação. Confira se a carga usa fase e neutro, duas fases ou três fases.'})}${n('Frequência (Hz)','frequency',{min:0})}${s('Ligação do equipamento','connection',CONNECTIONS)}${s('Fases utilizadas','phaseSet',PHASES)}
      ${s('Condutor de proteção (PE)','hasPE',{'true':'PE incluído','false':'PE não informado / ausente'},{required:true})}
      ${n('Fator de potência (0 a 1)','powerFactor',{min:0,max:1})}${n('Rendimento (0 a 1)','efficiency',{min:0,max:1})}
      ${s('Carga trifásica equilibrada?','balanced',{'true':'Sim, confirmo','false':'Não'},{hint:'Necessário para a fórmula trifásica. Em FN/FF este campo não é usado. Tensão: entre fases para FF/3F; fase-neutro para FN.'})}
    </div><p class="field-hint" id="consumer-connection-preview">${esc(conductorLabel(c))}</p><p class="field-hint">A ligação indica fases e neutro. A presença de PE não define o esquema de aterramento da instalação.</p></fieldset>
    <fieldset id="consumer-motor-fields" ${c.type === 'motor' ? '' : 'hidden disabled'}><legend data-common-legend="3 · Dados do motor">3 · Dados do motor</legend><div class="consumer-form-grid">
      ${mn('Corrente nominal de placa (A)','plateCurrent',{min:0,hint:'Se conhecida, informe a corrente para a tensão de operação. Sem placa ou catálogo compatível, a fórmula fornece uma estimativa com potência, tensão, rendimento e fator de potência.'})}
      ${input('Fonte de corrente a utilizar','motor.currentPreference',m.currentPreference,{required:true,choices:{auto:'Automática: placa → catálogo → fórmula',plate:'Placa',catalog:'Catálogo',formula:'Fórmula (estimativa)'}})}
    </div><details class="consumer-advanced" ${m.currentPreference === 'catalog' || m.catalogId || m.catalogCurrent !== null ? 'open' : ''}><summary>Catálogo e identificação do motor (opcional)</summary><div class="consumer-form-grid">
      ${mn('Número de polos','poles',{min:1,step:1})}${mn('Corrente nominal de catálogo (A)','catalogCurrent',{min:0})}
      ${input('Fabricante','motor.source.manufacturer',m.source.manufacturer)}${input('Modelo','motor.source.model',m.source.model)}
      ${input('Edição do catálogo','motor.source.edition',m.source.edition)}${input('Referência / página / documento','motor.source.reference',m.source.reference)}
      ${input('Tabela de referência específica','motor.catalogId',m.catalogId,{choices:{'weg-w21-fockink-2006-v1':'WEG W21 · 60 Hz · IP55 · setembro/2006'},hint:'Selecione somente se o motor corresponde a esta linha. Reprodução Fockink, Rev.05/2021, p.47. Sem seleção, o catálogo usa os dados manuais acima.'})}
    </div></details><details class="consumer-advanced"><summary>Condições para dimensionar o circuito do motor</summary><p>Estimar a corrente não confirma a corrente nominal. Para obter Ib, confira abaixo os dados do motor e seu regime de operação.</p><div class="consumer-form-grid">
      ${input('Corrente nominal nas condições efetivas?','motor.nominalConditionsConfirmed',m.nominalConditionsConfirmed,{choices:{true:'Sim, conferi placa / catálogo',false:'Não conferido'},hint:'Confirme tensão, frequência e corrente da maior potência/velocidade utilizada. A consulta à tabela não comprova a compatibilidade com um motor real.'})}
      ${input('Circuito exclusivo e escopo do motor?','motor.exclusiveS1Circuit',m.exclusiveS1Circuit,{choices:{true:'Sim, confirmo as condições abaixo',false:'Não / outro caso'},hint:'Um único motor de indução de gaiola, serviço S1, aplicação industrial normal, até 150 kW. Exclui motores até 1,5 kW que acionam aparelhos domésticos ou eletroprofissionais. NBR 5410:2004, 6.5.1.1.'})}
      ${input('A operação explorará o fator de serviço?','motor.usesServiceFactor',m.usesServiceFactor,{choices:{true:'Sim, FS > 1 declarado pelo fabricante',false:'Não'},hint:'Se sim: Ib mínimo = In × FS. Se não: Ib mínimo = In. Não reduzimos In por rendimento, demanda ou fator arbitrário.'})}
      ${mn('Fator de serviço (FS)','serviceFactor',{min:0,hint:'Multiplicador de carga admissível declarado pelo fabricante sob condições específicas. Não é rendimento. Informe o valor da placa se a operação usar essa capacidade adicional.'})}
    </div></details><details class="consumer-advanced"><summary>Partida e medição (opcional)</summary><div class="consumer-form-grid">
      ${mn('Corrente de partida informada (A)','startingCurrent',{min:0})}${mn('Corrente medida informada (A)','measuredCurrent',{min:0})}
    </div></details><p class="field-hint">A corrente de placa tem prioridade no modo automático. Escolher uma fonte explicitamente impede substituição silenciosa quando ela estiver incompleta. Partida e medição não substituem a corrente nominal. Valores da tabela são por motor.</p></fieldset>
    <details class="consumer-advanced" ${linked ? '' : 'open'}><summary>Planejamento da instalação e percurso${linked ? ' — circuito já vinculado' : ''}</summary><p>Estes campos auxiliam a preparação inicial. Depois de criar o circuito, os cálculos usam os trechos, as formações e os condutores. Editar o planejamento não altera esses registros. Acesse os vínculos na tabela de consumidores para editar a estrutura efetiva.</p><fieldset><legend data-common-legend="Instalação e percurso">Instalação e percurso</legend><div class="consumer-form-grid">
      ${s('Método de instalação','installationMethod',{...METHODS,...(c.installationMethod && !METHODS[c.installationMethod] ? {[c.installationMethod]:c.installationMethod+' — valor cadastrado'} : {})},{hint:'Descrição resumida. A disposição física deve ser conferida na tabela 33 ao dimensionar; o nome do ambiente não determina o método.'})}
      ${s('Material do condutor','cableMaterial',MATERIALS)}${s('Tipo de cabo','cableType',CABLES)}${s('Isolação','insulation',{PVC:'PVC — serviço até 70 °C',XLPE:'XLPE — serviço até 90 °C',EPR:'EPR — serviço até 90 °C',other:'Outra'},{hint:'Limite de temperatura do condutor em serviço contínuo, não a temperatura do ambiente.'})}
      <div id="consumer-other-insulation" ${c.insulation === 'other' ? '' : 'hidden'}>${input('Descreva a isolação','insulationDescription',c.insulationDescription)}</div>
      ${n('Distância informada (m)','distance',{min:0})}${s('Esta distância representa','distanceBasis',DISTANCES)}
      ${input('Ambiente / setor','environment',c.environment)}${n('Temperatura do ambiente (°C)','temperature',{min:-100,max:200})}
      ${s('Painel de origem','panelId',panels)}${input('Identificação do trecho planejado','plannedSegmentTag',c.plannedSegmentTag,{hint:'Referência de planejamento, como T-01. Não cria um segmento físico.'})}
      ${project.segments.length ? s('Vincular trecho existente','plannedSegmentId',segments) : ''}
    </div><p class="field-hint">Exemplo: quadro → ponto A a 10 m → ponto B a 25 m do quadro. Distâncias acumuladas: 10 e 25 m; comprimentos físicos: 10 e 15 m. Para lâmpadas em posições diferentes, duplique o registro e ajuste a distância. “Preparar circuitos” cria saídas independentes; percursos compartilhados são definidos em Caminhos e circuitos.</p></fieldset></details>
    <fieldset><legend>Observações</legend>${input('Observações do consumidor','notes',c.notes,{type:'textarea',maxLength:2000})}</fieldset>
    <p class="form-error" id="consumer-form-error" role="alert"></p><footer class="dialog-actions"><button type="button" class="button" data-consumer-cancel>Cancelar</button><button type="submit" class="button primary">${icon('save')}Salvar consumidor</button></footer></form>`;
}
