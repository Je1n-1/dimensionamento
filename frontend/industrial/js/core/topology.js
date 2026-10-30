import { serviceRequest } from './services.js';

export class TopologyService {
  constructor(transport = (...args) => globalThis.fetch(...args)) { this.transport = transport; }
  async execute(contract, project, operation) {
    const request = serviceRequest(contract, project, 'topology');
    let response, body;
    try {
      response = await this.transport('/api/industrial/topology', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, project, ...(operation ? { operation } : {}) }),
        signal: AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Servidor indisponível. Inicie python server.py e tente novamente. Seus dados salvos foram preservados.'); }
    try { body = await response.json(); } catch { throw new Error('Resposta inválida. Reinicie o servidor Python.'); }
    if (!response.ok) throw new Error(body.error || 'Não foi possível verificar a estrutura.');
    if (!body.request || Object.keys(request).some(k => body.request[k] !== request[k]) || body.project?.id !== project.id ||
        body.project?.revision !== project.revision + (operation ? 1 : 0) || body.analysis?.projectId !== project.id ||
        body.analysis?.inputRevision !== body.project.revision || body.analysis?.version !== contract.topology.version) {
      throw new Error('Resposta da estrutura incompatível com o projeto aberto.');
    }
    return body;
  }
}

export const TOPOLOGY_FIELDS = {
  panels: ['tag', 'description', 'parentPanelId'],
  nodes: ['label', 'kind', 'entityId'],
  segments: ['tag', 'kind', 'fromNodeId', 'toNodeId', 'length', 'installationMethod', 'temperature', 'environment', 'groupingArrangement', 'soilResistivity', 'soilDepth'],
  circuits: ['tag', 'purpose', 'role', 'loadedConductors', 'originNodeId', 'consumerIds', 'destinationPanelIds', 'segmentIds'],
  cables: ['tag', 'circuitId', 'formation', 'quantity', 'routeMode', 'segmentIds'],
  infrastructures: ['segmentId', 'type'],
};
export const TOPOLOGY_MODELS = { panels: 'Panel', nodes: 'Node', segments: 'Segment', circuits: 'Circuit', cables: 'Cable', infrastructures: 'Infrastructure' };

export function readTopologyForm(contract, collection, form) {
  const model = TOPOLOGY_MODELS[collection], data = {};
  for (const key of TOPOLOGY_FIELDS[collection]) {
    const spec = contract.models[model][key];
    if (spec.type === 'array') data[key] = form.getAll(key);
    else {
      const raw = String(form.get(key) ?? '').trim();
      data[key] = raw === '' && spec.nullable ? null : spec.type === 'number' ? Number(raw) : raw;
    }
  }
  return data;
}
