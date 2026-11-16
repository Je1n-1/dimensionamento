// The declarative contract is shared with Python; it contains no electrical rules.
export function createEntity(contract, name, overrides = {}) {
  const fields = contract.models[name];
  if (!fields) throw new Error(`Modelo desconhecido: ${name}`);
  const entity = Object.fromEntries(Object.entries(fields).map(([key, spec]) => [key,
    spec.type === 'object' && !spec.nullable
      ? createEntity(contract, spec.model)
      : key === 'id' ? crypto.randomUUID() : structuredClone(spec.default),
  ]));
  for (const key of Object.keys(overrides)) {
    if (!Object.hasOwn(fields, key)) throw new Error(`Campo desconhecido: ${key}`);
    entity[key] = structuredClone(overrides[key]);
  }
  return entity;
}

export function validateEntity(contract, name, value) {
  const errors = [];
  const fail = (path, code) => errors.push({ path, code });
  function object(model, data, path) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail(path, 'object');
    const fields = contract.models[model];
    if (!fields) return fail(path, 'model');
    for (const key of Object.keys(data)) if (!Object.hasOwn(fields, key)) fail(`${path}.${key}`, 'unknown');
    for (const [key, spec] of Object.entries(fields)) check(spec, data[key], `${path}.${key}`);
  }
  function check(spec, data, path) {
    if (data === null && spec.nullable) return;
    if (spec.type === 'object') return object(spec.model, data, path);
    if (spec.type === 'array') {
      if (!Array.isArray(data)) return fail(path, 'array');
      if (data.length > spec.maxItems) fail(path, 'maxItems');
      data.forEach((item, i) => check(spec.items, item, `${path}[${i}]`));
      return;
    }
    if (typeof data !== spec.type) return fail(path, 'type');
    if (spec.type === 'number') {
      if (!Number.isFinite(data) || (spec.integer && !Number.isSafeInteger(data))) fail(path, 'number');
      if (data < spec.minimum || data > spec.maximum || data <= spec.exclusiveMinimum) fail(path, 'range');
    }
    if (spec.type === 'string' && ([...data].length > spec.maxLength || [...data.trim()].length < (spec.minLength || 0))) fail(path, 'length');
    if (spec.enum && !spec.enum.includes(data)) fail(path, 'enum');
  }
  object(name, value, name);
  if (name === 'Project' && !errors.length) {
    const ids = new Set();
    for (const [key, spec] of Object.entries(contract.models.Project)) {
      if (spec.type !== 'array') continue;
      value[key].forEach((item, index) => {
        if (ids.has(item.id)) fail(`Project.${key}[${index}].id`, 'duplicate');
        ids.add(item.id);
      });
    }
    function references(model, data, path) {
      for (const [key, spec] of Object.entries(contract.models[model])) {
        const v = data[key], p = `${path}.${key}`;
        if (v === null) continue;
        if (spec.target && !value[spec.target].some(item => item.id === v)) fail(p, 'reference');
        if (spec.type === 'object') references(spec.model, v, p);
        if (spec.type === 'array') v.forEach((item, i) => {
          if (spec.items.model) references(spec.items.model, item, `${p}[${i}]`);
          if (spec.items.target && !value[spec.items.target].some(target => target.id === item)) fail(`${p}[${i}]`, 'reference');
        });
      }
    }
    references('Project', value, 'Project');
  }
  return errors;
}
