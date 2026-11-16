import { createEntity, validateEntity } from './model.js';
import { createStore } from './state.js';
import { consumerSegmentOptions } from './workflow.js';

export const TYPES = { motor: 'Motor', panel: 'Painel / quadro', transformer: 'Transformador', drive: 'Inversor / acionamento', lighting: 'Iluminação', heating: 'Aquecimento', other: 'Outra carga' };
export const CONNECTIONS = { FN: 'Fase + neutro', FF: 'Duas fases', '3F': 'Três fases, sem neutro', '3FN': 'Três fases + neutro' };
export const PHASES = { A: 'L1', B: 'L2', C: 'L3', AB: 'L1 + L2', BC: 'L2 + L3', CA: 'L3 + L1', ABC: 'L1 + L2 + L3' };
export const MATERIALS = { copper: 'Cobre', aluminum: 'Alumínio' };
export const CABLES = { insulated: 'Condutores isolados', unipolar: 'Cabos unipolares', multipolar: 'Cabo multipolar', other: 'Outro' };
export const BASES = { electrical: 'Ativa elétrica absorvida', apparent: 'Aparente', mechanical: 'Mecânica de saída' };
export const DISTANCES = { cumulative: 'Acumulada desde o quadro', physical: 'Comprimento de um segmento' };
export const METHODS = {
  A1: 'A1 — condutores em eletroduto em parede termicamente isolante',
  A2: 'A2 — cabo multipolar em eletroduto em parede termicamente isolante',
  B1: 'B1 — condutores / unipolares em eletroduto', B2: 'B2 — multipolar em eletroduto',
  C: 'C — cabos fixados diretamente sobre superfície', D: 'D — linha enterrada',
  E: 'E — multipolar ao ar livre', F: 'F — unipolares justapostos ao ar livre',
  G: 'G — unipolares espaçados ao ar livre',
};

export function suggestedPowerBasis(unit, type) {
  if (['VA','kVA'].includes(unit)) return 'apparent';
  if (['cv','hp'].includes(unit)) return 'mechanical';
  if (['W','kW'].includes(unit)) return type === 'motor' ? 'mechanical' : 'electrical';
  return null;
}

/** Copy equipment data only, never a physical circuit or calculation. */
export function copyConsumer(contract, project, id) {
  const original = project.consumers.find(c => c.id === id);
  if (!original) throw new Error('Consumidor não encontrado.');
  const consumer = createEntity(contract, 'Consumer', {...original, id: crypto.randomUUID(), plannedSegmentId: null});
  let index = 2;
  do { consumer.tag = `${original.tag.slice(0,48)} (cópia ${index++})`; }
  while (project.consumers.some(c => c.tag.toLocaleLowerCase() === consumer.tag.toLocaleLowerCase()));
  const oldMotor = project.motors.find(m => m.consumerId === id);
  const motor = createEntity(contract, 'Motor', oldMotor ? {...oldMotor, id: crypto.randomUUID(), consumerId: consumer.id, nominalConditionsConfirmed: null} : {});
  return {consumer, motor};
}
const fail = (field, message) => Object.assign(new Error(message), { field });

export function conductorLabel(consumer) {
  if (!consumer.connection) return 'Não informado';
  const phases = PHASES[consumer.phaseSet] || (consumer.connection === 'FN' ? 'F' : consumer.connection === 'FF' ? '2F' : 'L1 + L2 + L3');
  return phases + (['FN', '3FN'].includes(consumer.connection) ? ' + N' : '') + (consumer.hasPE ? ' + PE' : ' (sem PE informado)');
}

export function missingConsumerData(c, project = null) {
  if (project && c.type === 'panel') return [];
  const linked = project?.circuits.some(r => r.consumerIds.includes(c.id));
  const missing = [];
  for (const [key, label] of [['power','potência'],['voltage','tensão'],['frequency','frequência'],['connection','ligação'],['phaseSet','fases'],['installationMethod','método'],['cableMaterial','material'],['cableType','tipo de cabo'],['insulation','isolação'],['distance','distância'],['temperature','temperatura']]) {
    if (linked && ['installationMethod','cableMaterial','cableType','insulation','distance','temperature'].includes(key)) continue;
    if (c[key] == null || c[key] === '') missing.push(label);
  }
  return missing;
}

export function filterConsumers(project, query = {}) {
  const search = (query.search || '').trim().toLocaleLowerCase('pt-BR');
  return (project?.consumers || []).filter(c => (!query.type || c.type === query.type) && (!query.environment || c.environment === query.environment) && (!query.segment || consumerSegmentOptions(project,c).some(([id]) => id === query.segment)) &&
    `${c.tag} ${c.description} ${c.notes} ${c.environment} ${c.plannedSegmentTag}`.toLocaleLowerCase('pt-BR').includes(search));
}

function validateInput(contract, project, consumer, motor) {
  const c = consumer;
  if (!Object.hasOwn(TYPES, c.type)) throw fail('type', 'Selecione o tipo de consumidor.');
  if (!c.tag.trim()) throw fail('tag', 'Informe um identificador/tag para este consumidor.');
  if (project.consumers.some(other => other.id !== c.id && other.tag.trim().toLocaleLowerCase('pt-BR') === c.tag.trim().toLocaleLowerCase('pt-BR'))) throw fail('tag', 'Já existe um consumidor com esta tag neste projeto.');
  const structural = validateEntity(contract, 'Consumer', c);
  if (structural.length) throw fail(structural[0].path.split('.').at(-1), 'Confira os valores e limites do campo destacado.');
  if (c.type === 'panel' && c.quantity !== 1) throw fail('quantity', 'Cadastre cada painel separadamente, com quantidade 1, para identificar sua origem.');
  if (c.power !== null && (!c.unit || !c.powerBasis)) throw fail(!c.unit ? 'unit' : 'powerBasis', 'Informe a unidade e o tipo da potência.');
  if (c.unit && c.powerBasis) {
    const allowed = ['VA','kVA'].includes(c.unit) ? ['apparent'] : ['cv','hp'].includes(c.unit) ? ['mechanical'] : ['electrical','mechanical'];
    if (!allowed.includes(c.powerBasis)) throw fail('powerBasis', 'A unidade não corresponde ao tipo de potência informado.');
  }
  const phases = { FN: ['A','B','C'], FF: ['AB','BC','CA'], '3F': ['ABC'], '3FN': ['ABC'] };
  if (c.phaseSet && (!c.connection || !phases[c.connection].includes(c.phaseSet))) throw fail('phaseSet', 'Selecione fases compatíveis com a ligação informada.');
  if (c.distance !== null && !c.distanceBasis) throw fail('distanceBasis', 'Identifique se a distância é acumulada ou de um segmento físico.');
  if (c.insulation === 'other' && !c.insulationDescription.trim()) throw fail('insulationDescription', 'Descreva a outra isolação informada.');
  if (c.panelId && !project.panels.some(p => p.id === c.panelId)) throw fail('panelId', 'O painel de origem não existe neste projeto.');
  if (c.plannedSegmentId && !project.segments.some(s => s.id === c.plannedSegmentId)) throw fail('plannedSegmentId', 'O trecho não existe neste projeto.');
  if (c.type === 'motor') {
    const errors = validateEntity(contract, 'Motor', motor);
    if (errors.length) throw fail('motor.' + errors[0].path.split('.').slice(1).join('.'), 'Confira os dados do motor no campo destacado.');
    if (motor.catalogCurrent !== null && (!motor.source.manufacturer.trim() || !motor.source.reference.trim())) throw fail('motor.source.reference', 'Para corrente de catálogo, informe fabricante e referência do catálogo.');
  }
}

/** Prevent dangling references instead of silently rewriting future topology. */
function assertUnreferenced(contract, project, ids, ignoredIds) {
  function inspect(model, item) {
    for (const [key, spec] of Object.entries(contract.models[model])) {
      const value = item[key];
      if (value === null) continue;
      if ((spec.target || (model === 'Node' && key === 'entityId')) && ids.has(value)) throw fail('', 'Este item possui vínculos com outros consumidores, circuitos ou trechos. Remova os vínculos antes de excluir ou mudar seu tipo.');
      if (spec.type === 'object') inspect(spec.model, value);
      if (spec.type === 'array' && spec.items.target && value.some(id => ids.has(id))) throw fail('', 'Este item possui vínculos com circuitos ou trechos. Remova os vínculos antes de excluir ou mudar seu tipo.');
    }
  }
  for (const [key, spec] of Object.entries(contract.models.Project)) {
    if (spec.type === 'array') for (const item of project[key]) if (!ignoredIds.has(item.id)) inspect(spec.items.model, item);
  }
}

function editProject(contract, project, change) {
  const temporary = createStore(contract);
  temporary.setDraft(project);
  temporary.update(next => { change(next); next.currentStage = Math.max(3, next.currentStage); });
  return temporary.snapshot();
}

export function upsertConsumer(contract, project, input, motorInput = null) {
  if (!project) throw fail('', 'Abra um projeto antes de cadastrar consumidores.');
  const c = structuredClone(input); c.tag = c.tag.trim(); c.description = c.description.trim(); c.environment = c.environment.trim(); c.plannedSegmentTag = c.plannedSegmentTag.trim();
  const old = project.consumers.find(item => item.id === c.id);
  const ownMotor = project.motors.find(m => m.consumerId === c.id);
  const ownPanel = project.panels.find(p => p.consumerId === c.id);
  const motor = c.type === 'motor' ? createEntity(contract, 'Motor', { ...(ownMotor || {}), ...(motorInput || {}), consumerId: c.id }) : null;
  validateInput(contract, project, c, motor);
  if (ownPanel && c.type !== 'panel') assertUnreferenced(contract, project, new Set([ownPanel.id]), new Set([c.id, ownPanel.id]));
  if (c.type === 'panel' && c.panelId) {
    const visited = new Set(ownPanel ? [ownPanel.id] : []);
    let parent = project.panels.find(p => p.id === c.panelId);
    while (parent) {
      if (visited.has(parent.id)) throw fail('panelId', 'O painel de origem não pode apontar para si mesmo nem formar um ciclo de painéis.');
      visited.add(parent.id); parent = project.panels.find(p => p.id === parent.parentPanelId);
    }
  }
  return editProject(contract, project, next => {
    if (old) next.consumers[next.consumers.findIndex(item => item.id === c.id)] = c;
    else next.consumers.push(c);
    next.motors = next.motors.filter(m => m.consumerId !== c.id);
    if (motor) next.motors.push(motor);
    next.panels = next.panels.filter(p => p.consumerId !== c.id);
    if (c.type === 'panel') next.panels.push(createEntity(contract, 'Panel', { ...(ownPanel || {}), consumerId: c.id, tag: c.tag, description: c.description, parentPanelId: c.panelId }));
  });
}

export function removeConsumer(contract, project, id) {
  if (!project?.consumers.some(c => c.id === id)) throw fail('', 'O consumidor não existe mais neste projeto.');
  const owned = [...project.motors, ...project.panels].filter(item => item.consumerId === id).map(item => item.id);
  const ids = new Set([id, ...owned]);
  assertUnreferenced(contract, project, ids, ids);
  const updated = editProject(contract, project, next => {
    next.consumers = next.consumers.filter(c => c.id !== id);
    next.motors = next.motors.filter(m => m.consumerId !== id);
    next.panels = next.panels.filter(p => p.consumerId !== id);
  });
  updated.results = updated.results.filter(r => !ids.has(r.targetId));
  return updated;
}

/** Individual motor records, validated on a private draft and persisted as one batch. */
export function upsertMotorBatch(contract, project, base, motor, overrides) {
  if (base.type !== 'motor' || !Array.isArray(overrides) || overrides.length !== base.quantity || overrides.length < 2 || overrides.length > 150) {
    throw fail('quantity', 'Informe de 2 a 150 motores para o cadastro individual.');
  }
  const existing = project.consumers.find(c => c.id === base.id);
  if (existing) {
    const own = project.motors.filter(m => m.consumerId === base.id).map(m => m.id);
    try { assertUnreferenced(contract, project, new Set([base.id]), new Set([base.id,...own])); }
    catch { throw fail('quantity', 'Este registro já está vinculado à estrutura. Cadastre os novos motores em Adicionar item; a divisão deste registro exige revisar seus vínculos primeiro.'); }
  }
  let next = structuredClone(project);
  overrides.forEach((row,index) => {
    const c = createEntity(contract,'Consumer', {...base,...row.consumer,
      id:index===0?base.id:crypto.randomUUID(), type:'motor', quantity:1, plannedSegmentId:null});
    const m = createEntity(contract,'Motor', {...motor,...row.motor,
      id:index===0?motor.id:crypto.randomUUID(), consumerId:c.id, nominalConditionsConfirmed:null});
    try { next = upsertConsumer(contract,next,c,m); }
    catch(error) {
      error.message = `Motor ${index+1} (${c.tag || 'sem tag'}): ${error.message}`;
      error.batchIndex = index;
      throw error;
    }
  });
  next.revision = project.revision+1;
  return next;
}
