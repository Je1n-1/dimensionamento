import { createStore } from './state.js';
import { serviceRequest } from './services.js';

export function applyCurrentResponse(contract, project, response) {
  const expected = serviceRequest(contract, project, 'currents');
  if (!response?.request || Object.keys(expected).some(k => response.request[k] !== expected[k]) ||
      !Array.isArray(response.results) || response.results.length !== project.consumers.length ||
      new Set(response.results.map(r => r.targetId)).size !== project.consumers.length) {
    throw new Error('Resposta incompleta ou desatualizada. Nenhum resultado foi salvo.');
  }
  const draft = createStore(contract); draft.setDraft(project);
  for (const result of response.results) {
    if (!draft.acceptResult(expected, result)) throw new Error('Resultado incompatível com as entradas ou versões atuais.');
  }
  const next = draft.snapshot(); next.currentStage = Math.max(next.currentStage, 4);
  return next;
}

export function currentResult(project, consumerId) {
  return project.results.find(r => r.domain === 'currents' && r.targetId === consumerId &&
    r.inputRevision === project.revision && ['calculated','pending'].includes(r.status));
}

export function activePowerSummary(project) {
  // Aggregate only an explicit list of end uses; panel/drive chains require Stage 5.
  if (!project.consumers.length) return { value: null, reason: 'Nenhum consumidor informado' };
  if (project.consumers.some(c => ['panel','drive','transformer','other'].includes(c.type))) {
    return { value: null, reason: 'Cargas especiais: consulte potências por item. A Visão geral soma registros, sem resolver cadeias de transformação ou acionamento.' };
  }
  let total = 0, known = 0;
  for (const c of project.consumers) {
    const value = currentResult(project, c.id)?.measurements.find(m => m.code === 'electrical_total_w')?.value;
    if (Number.isFinite(value)) { total += value; known++; }
  }
  if (!Number.isFinite(total)) return { value: null, reason: 'Soma fora do intervalo numérico suportado' };
  return { value: known ? total : null, reason: `${known}/${project.consumers.length} registros convertidos${known < project.consumers.length ? ' · soma parcial' : ' · sem demanda aplicada'}` };
}
