import { ProjectRepository } from './repository.js';
import { validateEntity } from './model.js';
import { migrateProject } from './migrations.js';

export const INDUSTRIAL_STORAGE = 'voltcalc_industrial_projects_v1';
export const INDUSTRIAL_LOCK = 'voltcalc-industrial-projects-v1';
const fail = (code, message) => Object.assign(new Error(message), { code });
const clone = value => structuredClone(value);
export const STATUS_LABELS = Object.freeze({ draft: 'Em edição', active: 'Ativo', archived: 'Arquivado' });

export function summarize(project) {
  return { id: project.id, name: project.name, description: project.description,
    workflowStatus: project.workflowStatus, currentStage: project.currentStage,
    storageRevision: project.storageRevision, updatedAt: project.updatedAt,
    consumers: project.consumers.length, panels: project.panels.length, segments: project.segments.length };
}

export function duplicateProject(contract, original, now) {
  const copy = clone(original), ids = new Map([[original.id, crypto.randomUUID()]]);
  for (const [key, spec] of Object.entries(contract.models.Project)) {
    if (spec.type === 'array') for (const item of copy[key]) ids.set(item.id, crypto.randomUUID());
  }
  // Remap only identity/reference fields, never names, descriptions or catalog strings.
  function remap(model, entity) {
    for (const [key, spec] of Object.entries(contract.models[model])) {
      const value = entity[key];
      if (value === null) continue;
      if (key === 'id' || spec.target || (model === 'Node' && key === 'entityId') || (model === 'CalculationResult' && key === 'targetId')) entity[key] = ids.get(value) || value;
      if (spec.type === 'object') remap(spec.model, value);
      if (spec.type === 'array') {
        if (spec.items.model) value.forEach(item => remap(spec.items.model, item));
        if (spec.items.target) entity[key] = value.map(id => ids.get(id) || id);
      }
    }
  }
  remap('Project', copy);
  copy.name = `${original.name.slice(0, 112)} (cópia)`;
  copy.createdAt = now; copy.updatedAt = now;
  copy.storageRevision = 1; copy.revision = 0; copy.workflowStatus = 'draft';
  copy.results = copy.results.map(result => ({ ...result, status: 'invalidated', criteria: [], measurements: [], reason: 'Projeto duplicado. Recalcule para validar os resultados desta cópia.' }));
  return copy;
}

/** A single atomic localStorage envelope; Web Locks serialize cooperating tabs.
 * No fallback to residential data or to an empty catalog on corruption.
 * Both dependencies are injected so real failure/concurrency behavior can be tested.
 */
export class LocalProjectRepository extends ProjectRepository {
  constructor(contract, { storage, locks, previousContract, now = () => new Date().toISOString() }) {
    super(); this.contract = contract; this.storage = storage; this.locks = locks; this.now = now; this.previousContract = previousContract;
  }
  validateProject(project) {
    const errors = validateEntity(this.contract, 'Project', project);
    if (errors.length || !project.name.trim()) throw fail('INVALID_PROJECT', 'Informe um nome válido e confira os dados do projeto.');
  }
  read() {
    let raw;
    try { raw = this.storage.getItem(INDUSTRIAL_STORAGE); }
    catch { throw fail('STORAGE_READ', 'O navegador bloqueou a leitura dos projetos industriais.'); }
    if (raw === null) return { format: 'voltcalc-industrial-projects', version: 1, currentId: null, projects: [] };
    try {
      const data = JSON.parse(raw);
      if (data.format !== 'voltcalc-industrial-projects' || data.version !== 1 || !Array.isArray(data.projects) || data.projects.length > 500 || !(data.currentId === null || typeof data.currentId === 'string')) throw new Error();
      const ids = new Set();
      data.projects = data.projects.map(project => migrateProject(project, this.contract, this.previousContract));
      for (const project of data.projects) {
        this.validateProject(project);
        if (project.storageRevision < 1 || ids.has(project.id) || !project.createdAt || !project.updatedAt || !Number.isFinite(Date.parse(project.createdAt)) || !Number.isFinite(Date.parse(project.updatedAt))) throw new Error();
        ids.add(project.id);
      }
      if (data.currentId !== null && !ids.has(data.currentId)) throw new Error();
      return data;
    } catch { throw fail('STORAGE_CORRUPT', 'Não foi possível ler o catálogo industrial: formato ou dados inválidos. O conteúdo original foi preservado; nenhuma gravação será feita.'); }
  }
  async transaction(change) {
    if (!this.locks?.request) throw fail('LOCK_UNAVAILABLE', 'Este navegador não oferece o bloqueio necessário para salvar com segurança entre abas. Use um navegador atualizado em localhost.');
    return this.locks.request(INDUSTRIAL_LOCK, { mode: 'exclusive' }, async () => {
      const data = this.read();
      const result = change(data);
      const serialized = JSON.stringify(data);
      try {
        this.storage.setItem(INDUSTRIAL_STORAGE, serialized);
      } catch { throw fail('STORAGE_WRITE', 'Não foi possível salvar no navegador. O espaço pode estar cheio ou a gravação bloqueada. Nenhum sucesso foi confirmado.'); }
      let verified;
      try { verified = this.storage.getItem(INDUSTRIAL_STORAGE) === serialized; } catch { verified = false; }
      if (!verified) throw fail('STORAGE_VERIFY', 'A gravação não pôde ser confirmada. Recarregue a lista antes de tentar novamente.');
      return clone(result);
    });
  }
  entry(data, id, expectedRevision) {
    const project = data.projects.find(p => p.id === id);
    if (!project) throw fail('NOT_FOUND', 'Este projeto não existe mais. Atualize a lista.');
    if (expectedRevision !== undefined && project.storageRevision !== expectedRevision) throw fail('REVISION_CONFLICT', 'O projeto foi alterado em outra aba. Feche esta edição e abra a versão salva antes de editar novamente.');
    return project;
  }
  async list({ search = '', status = 'all', sort = 'updated' } = {}) {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return this.read().projects.filter(p => (status === 'all' || p.workflowStatus === status) && `${p.name} ${p.description}`.toLocaleLowerCase('pt-BR').includes(query))
      .map(summarize).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'pt-BR') : b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name, 'pt-BR'));
  }
  async load(id) { return clone(this.entry(this.read(), id)); }
  async save(project, expectedRevision) {
    this.validateProject(project);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw fail('INVALID_REVISION', 'Revisão de gravação inválida.');
    if (project.storageRevision !== expectedRevision) throw fail('INVALID_REVISION', 'A revisão do projeto não corresponde à revisão de gravação esperada.');
    const snapshot = clone(project);
    return this.transaction(data => {
      const existing = data.projects.find(p => p.id === snapshot.id);
      if (expectedRevision === 0 && existing) throw fail('REVISION_CONFLICT', 'Já existe um projeto com esta identificação.');
      if (expectedRevision !== 0) this.entry(data, snapshot.id, expectedRevision);
      if (!existing && data.projects.length >= 500) throw fail('PROJECT_LIMIT', 'O catálogo atingiu o limite de 500 projetos.');
      const timestamp = this.now();
      const saved = { ...snapshot, name: snapshot.name.trim(), description: snapshot.description.trim(),
        storageRevision: expectedRevision + 1, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp };
      this.validateProject(saved);
      if (existing) data.projects[data.projects.indexOf(existing)] = saved;
      else data.projects.push(saved);
      data.currentId = saved.id;
      return saved;
    });
  }
  async duplicate(id, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw fail('INVALID_REVISION', 'Revisão de gravação inválida.');
    return this.transaction(data => {
      const original = this.entry(data, id, expectedRevision);
      if (data.projects.length >= 500) throw fail('PROJECT_LIMIT', 'O catálogo atingiu o limite de 500 projetos.');
      const copy = duplicateProject(this.contract, original, this.now());
      this.validateProject(copy); data.projects.push(copy);
      return copy;
    });
  }
  async delete(id, expectedRevision) {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw fail('INVALID_REVISION', 'Revisão de gravação inválida.');
    return this.transaction(data => {
      this.entry(data, id, expectedRevision);
      data.projects = data.projects.filter(p => p.id !== id);
      if (data.currentId === id) data.currentId = null;
      return { deletedId: id };
    });
  }
  async getCurrentId() { return this.read().currentId; }
  async setCurrentId(id) {
    return this.transaction(data => {
      if (id !== null) this.entry(data, id);
      data.currentId = id;
      return id;
    });
  }
}
