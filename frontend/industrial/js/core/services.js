// Distinct ports: conductor sizing never implies protection verification.
export const DOMAINS = Object.freeze(['currents', 'topology', 'conductors', 'protection', 'infrastructure', 'voltage', 'overview']);
export const rulesVersionFor = (contract, domain) => domain === 'overview' && contract.overview ? contract.overview.version : domain === 'voltage' && contract.voltageRules ? contract.voltageRules.version : domain === 'infrastructure' && contract.infrastructureRules ? contract.infrastructureRules.version : domain === 'conductors' && contract.conductorRules ? contract.conductorRules.version : domain === 'topology' && contract.topology ? contract.topology.version : domain === 'currents' && contract.currentRules ? contract.currentRules.version : contract.rules.version;
export function serviceRequest(contract, project, domain) {
  if (!DOMAINS.includes(domain)) throw new Error('Serviço desconhecido.');
  return Object.freeze({ projectId: project.id, inputRevision: project.revision,
    domain, engineVersion: contract.engineVersion, rulesVersion: rulesVersionFor(contract, domain) });
}
export class ConductorService {
  constructor(transport = (...args) => globalThis.fetch(...args)) { this.transport = transport; }
  async calculate(request, project, operation) {
    if (!request?.rulesVersion?.startsWith('nbr5410-2004-conductors-')) throw new Error('CONDUCTORS_NOT_IMPLEMENTED: contrato sem regras de condutores.');
    let response, body;
    try {
      response = await this.transport('/api/industrial/conductors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({request, project, ...(operation ? {operation} : {})}),
        signal: AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Servidor indisponível. Inicie python server.py e tente novamente. Dados salvos preservados.'); }
    try { body = await response.json(); } catch { throw new Error('Resposta inválida do servidor de condutores.'); }
    if (!response.ok) throw new Error(body.error || 'Falha ao dimensionar condutores.');
    if (Object.keys(request).some(k => body.request?.[k] !== request[k]) || body.project?.id !== project.id ||
      body.project?.revision !== project.revision + (operation ? 1 : 0) || body.analysis?.projectId !== project.id ||
      body.analysis?.inputRevision !== body.project.revision || body.analysis?.version !== request.rulesVersion ||
      !Array.isArray(body.analysis?.results)) throw new Error('Resposta de condutores desatualizada ou incompatível.');
    const ids = body.analysis.results.map(r => r.id);
    if (ids.length !== body.project.cables.length || new Set(ids).size !== ids.length ||
      ids.some(id => !body.project.cables.some(c => c.id === id)) ||
      body.analysis.results.some(r => !['calculated','pending'].includes(r.status) ||
        ['ib','section','pe','neutral'].some(k => r[k] !== null && (!Number.isFinite(r[k]) || r[k] <= 0)))) {
      throw new Error('Resultados de condutores incompatíveis com as formações do projeto.');
    }
    return body;
  }
}
export class ProtectionService {
  async verify(_request, _project) { throw new Error('PROTECTION_NOT_IMPLEMENTED'); }
}

export class VoltageService {
  constructor(transport = (...args) => globalThis.fetch(...args)) { this.transport = transport; }
  async calculate(request, project, operation) {
    let response, body;
    try {
      response = await this.transport('/api/industrial/voltage', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({request,project,...(operation?{operation}:{})}), signal:AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Servidor indisponível. Inicie python server.py. Seus dados salvos foram preservados.'); }
    try { body=await response.json(); } catch { throw new Error('Resposta inválida da análise de queda.'); }
    if (!response.ok) throw new Error(body.error || 'Falha na análise de queda.');
    const a=body.analysis, ids=project.consumers.filter(c=>c.type!=='panel').map(c=>c.id);
    if (Object.keys(request).some(k=>body.request?.[k]!==request[k]) || body.project?.id!==project.id ||
        body.project.revision!==project.revision+(operation?1:0) || a?.projectId!==project.id ||
        a.inputRevision!==body.project.revision || a.version!==request.rulesVersion || !Array.isArray(a.results) ||
        a.results.length!==ids.length || new Set(a.results.map(r=>r.id)).size!==ids.length ||
        a.results.some(r=>!ids.includes(r.id) || !['calculated','review','pending'].includes(r.status) ||
          ['distance','totalDrop','totalPercent','terminalPercent','totalLimit'].some(k=>r[k]!==null&&(!Number.isFinite(r[k])||r[k]<0)) ||
          !['segments','criteria','pending','trace'].every(k=>Array.isArray(r[k])))) {
      throw new Error('Resposta de queda desatualizada ou incompatível.');
    }
    return body;
  }
}

export class InfrastructureService {
  constructor(transport = (...args) => globalThis.fetch(...args)) { this.transport = transport; }
  async calculate(request, project, operation) {
    let response, body;
    try {
      response = await this.transport('/api/industrial/infrastructure', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({request,project,...(operation?{operation}:{})}), signal:AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Servidor indisponível. Inicie python server.py. Seus dados salvos foram preservados.'); }
    try { body=await response.json(); } catch { throw new Error('Resposta inválida de infraestrutura.'); }
    if (!response.ok) throw new Error(body.error || 'Falha na análise de infraestrutura.');
    const a=body.analysis;
    if (Object.keys(request).some(k=>body.request?.[k]!==request[k]) || body.project?.id!==project.id ||
        body.project.revision!==project.revision+(operation?1:0) || a?.projectId!==project.id ||
        a.inputRevision!==body.project.revision || a.version!==request.rulesVersion || !Array.isArray(a.results) ||
        a.results.length!==body.project.segments.length || new Set(a.results.map(r=>r.id)).size!==a.results.length ||
        a.results.some(r=>!body.project.segments.some(s=>s.id===r.id) || !['calculated','review','pending'].includes(r.status) ||
          ['count','area','occupancy','limit','minimumDiameter','minimumWidth','minimumHeight','suggestedDiameter'].some(k=>r[k]!==null&&(!Number.isFinite(r[k])||r[k]<0)))) {
      throw new Error('Resposta de infraestrutura desatualizada ou incompatível.');
    }
    return body;
  }
}

export class CurrentService {
  constructor(transport = (...args) => globalThis.fetch(...args)) { this.transport = transport; }
  async calculate(request, project) {
    let response;
    try {
      response = await this.transport('/api/industrial/currents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, project }), signal: AbortSignal.timeout(30000),
      });
    } catch { throw new Error('Servidor indisponível. Inicie python server.py e tente novamente. Os dados salvos foram preservados.'); }
    let body;
    try { body = await response.json(); } catch { throw new Error('Resposta inválida do servidor. Reinicie o servidor Python e recarregue a página.'); }
    if (!response.ok) throw new Error(body.error || 'Falha no cálculo industrial. Nenhum resultado foi salvo.');
    return body;
  }
}
