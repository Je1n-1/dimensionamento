// Distinct ports: conductor sizing never implies protection verification.
export const DOMAINS = Object.freeze(['currents', 'topology', 'conductors', 'protection', 'infrastructure', 'voltage']);
export function serviceRequest(contract, project, domain) {
  if (!DOMAINS.includes(domain)) throw new Error('Serviço desconhecido.');
  return Object.freeze({ projectId: project.id, inputRevision: project.revision,
    domain, engineVersion: contract.engineVersion, rulesVersion: contract.rules.version });
}
export class ConductorService {
  async calculate(_request, _project) { throw new Error('CONDUCTORS_NOT_IMPLEMENTED'); }
}
export class ProtectionService {
  async verify(_request, _project) { throw new Error('PROTECTION_NOT_IMPLEMENTED'); }
}
