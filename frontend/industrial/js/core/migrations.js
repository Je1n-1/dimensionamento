import { validateEntity, createEntity } from './model.js';

/** Additive v2/v3/v4 upgrades. Never writes storage or changes existing inputs. */
export function migrateProject(project, contract, previousContract) {
  if (project?.schemaVersion === contract.version) return structuredClone(project);
  const sources = Array.isArray(previousContract) ? previousContract : [previousContract];
  const source = sources.find(c => c?.version === project?.schemaVersion);
  if (![3,4,5,6,7,8,9].includes(contract.version) || ![2,3,4,5,6,7,8].includes(project?.schemaVersion) || project.schemaVersion >= contract.version || !source || validateEntity(source, 'Project', project).length) {
    throw new Error('Versão ou dados do projeto incompatíveis.');
  }
  function upgrade(model, value) {
    const next = createEntity(contract,model,value);
    for (const [key,spec] of Object.entries(contract.models[model])) {
      if (spec.type === 'object' && next[key] !== null) next[key] = upgrade(spec.model,next[key]);
      if (spec.type === 'array' && spec.items.model) next[key] = next[key].map(item => upgrade(spec.items.model,item));
    }
    return next;
  }
  const upgraded = upgrade('Project',project);
  upgraded.schemaVersion = contract.version;
  if (validateEntity(contract, 'Project', upgraded).length) throw new Error('Falha ao atualizar o contrato do projeto.');
  return upgraded;
}
