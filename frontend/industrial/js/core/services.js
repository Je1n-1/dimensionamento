// Distinct ports: conductor sizing never implies protection verification.
export const DOMAINS = Object.freeze(['currents', 'topology', 'conductors', 'protection', 'infrastructure', 'voltage']);
export const rulesVersionFor = (contract, domain) => domain === 'topology' && contract.topology ? contract.topology.version : domain === 'currents' && contract.currentRules ? contract.currentRules.version : contract.rules.version;
export function serviceRequest(contract, project, domain) {
  if (!DOMAINS.includes(domain)) throw new Error('Serviço desconhecido.');
  return Object.freeze({ projectId: project.id, inputRevision: project.revision,
    domain, engineVersion: contract.engineVersion, rulesVersion: rulesVersionFor(contract, domain) });
}
export class ConductorService {
  async calculate(_request, _project) { throw new Error('CONDUCTORS_NOT_IMPLEMENTED'); }
}
export class ProtectionService {
  async verify(_request, _project) { throw new Error('PROTECTION_NOT_IMPLEMENTED'); }
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
