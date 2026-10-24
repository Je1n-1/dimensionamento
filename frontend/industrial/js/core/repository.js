export class RepositoryUnavailable extends Error {
  constructor() { super('Persistência industrial não implementada. Prevista para a Etapa 2.'); this.code = 'REPOSITORY_NOT_IMPLEMENTED'; }
}

/** Async port, independent from storage technology.
 * save(project, expectedRevision) must reject revision conflicts and failed writes.
 * list(query) -> summaries; load(id) -> project; save -> committed project;
 * expectedRevision refers to storageRevision, not the electrical input revision.
 * duplicate(id, expectedRevision) -> independent project; delete -> acknowledged removal.
 */
export class ProjectRepository {
  async list(_query = {}) { throw new RepositoryUnavailable(); }
  async load(_id) { throw new RepositoryUnavailable(); }
  async save(_project, _expectedRevision) { throw new RepositoryUnavailable(); }
  async duplicate(_id, _expectedRevision) { throw new RepositoryUnavailable(); }
  async delete(_id, _expectedRevision) { throw new RepositoryUnavailable(); }
  async getCurrentId() { throw new RepositoryUnavailable(); }
  async setCurrentId(_id) { throw new RepositoryUnavailable(); }
}
