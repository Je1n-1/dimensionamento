import { validateEntity } from './model.js';
import { serviceRequest } from './services.js';

/** Editing state; persistence is delegated to the repository. */
export function createStore(contract) {
  let project = null;
  function assertValid(data) {
    const errors = validateEntity(contract, 'Project', data);
    if (errors.length) throw Object.assign(new Error('Dados industriais inválidos.'), { errors });
  }
  return {
    snapshot: () => structuredClone(project),
    clear() { project = null; },
    setDraft(data) {
      assertValid(data);
      project = structuredClone(data);
      project.results = project.results.map(result => {
        const stale = result.inputRevision !== project.revision || result.engineVersion !== contract.engineVersion || result.rulesVersion !== contract.rules.version;
        const unavailable = contract.rules.status !== 'implemented' && (result.status === 'calculated' || result.criteria.some(c => c.status !== 'pending') || result.measurements.some(m => m.value !== null));
        return stale || unavailable ? { ...result, status: 'invalidated', measurements: [], criteria: [], reason: 'Resultado sem validade para as entradas e versões atuais.' } : result;
      });
    },
    update(change) {
      if (!project) throw new Error('Nenhum projeto selecionado.');
      const next = structuredClone(project);
      change(next);
      if (next.id !== project.id) throw new Error('A identidade do projeto não pode mudar.');
      next.revision = project.revision + 1;
      // Conservative invalidation until dependencies are implemented in later stages.
      next.results = project.results.map(result => ({ ...result, status: 'invalidated',
        measurements: [], criteria: [], reason: 'Entradas alteradas. Recalcule este resultado.' }));
      assertValid(next);
      project = next;
    },
    token(domain) {
      if (!project) throw new Error('Nenhum projeto selecionado.');
      return serviceRequest(contract, project, domain);
    },
    acceptResult(token, result) {
      if (!project || !token || !result || typeof result !== 'object') return false;
      const errors = validateEntity(contract, 'CalculationResult', result);
      if (errors.length || !['currents', 'topology', 'conductors', 'protection', 'infrastructure', 'voltage'].includes(token.domain)) return false;
      const current = serviceRequest(contract, project, token.domain);
      if (Object.keys(current).some(key => token[key] !== current[key])) return false;
      if (['inputRevision', 'domain', 'engineVersion', 'rulesVersion'].some(key => result[key] !== current[key])) return false;
      // This registry has no implemented rules. Never accept a calculated verdict yet.
      if (contract.rules.status !== 'implemented' && (result.status === 'calculated' || result.criteria.some(c => c.status !== 'pending') || result.measurements.some(m => m.value !== null))) return false;
      const next = structuredClone(project);
      next.results = next.results.filter(r => !(r.domain === result.domain && r.targetId === result.targetId));
      next.results.push(structuredClone(result));
      if (validateEntity(contract, 'Project', next).length) return false;
      project = next;
      return true;
    },
  };
}
