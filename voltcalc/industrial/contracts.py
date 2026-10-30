"""Shared declarative data contract; validation is structural, not normative."""
import copy
import json
import math
from uuid import uuid4
from voltcalc.paths import ROOT

CONTRACT = json.loads((ROOT / 'data/industrial/contracts.v9.json').read_text(encoding='utf-8'))


def create_entity(model_name, **overrides):
    fields = CONTRACT['models'][model_name]
    unknown = overrides.keys() - fields.keys()
    if unknown:
        raise ValueError(f'Campos desconhecidos: {sorted(unknown)}')
    result = {key: (create_entity(spec['model']) if spec['type'] == 'object' and not spec['nullable']
                    else str(uuid4()) if key == 'id' else copy.deepcopy(spec['default']))
              for key, spec in fields.items()}
    return result | copy.deepcopy(overrides)


def validate_entity(name, value):
    errors = []

    def fail(path, code):
        errors.append({'path': path, 'code': code})

    def obj(model, data, path):
        if not isinstance(data, dict):
            return fail(path, 'object')
        fields = CONTRACT['models'].get(model)
        if fields is None:
            return fail(path, 'model')
        for key in data.keys() - fields.keys():
            fail(f'{path}.{key}', 'unknown')
        for key, spec in fields.items():
            if key not in data:
                fail(f'{path}.{key}', 'type')
            else:
                check(spec, data[key], f'{path}.{key}')

    def check(spec, data, path):
        if data is None and spec.get('nullable'):
            return
        kind = spec['type']
        if kind == 'object':
            return obj(spec['model'], data, path)
        if kind == 'array':
            if not isinstance(data, list):
                return fail(path, 'array')
            if len(data) > spec['maxItems']:
                fail(path, 'maxItems')
            for i, item in enumerate(data):
                check(spec['items'], item, f'{path}[{i}]')
            return
        types = {'string': str, 'number': (int, float), 'boolean': bool}
        if not isinstance(data, types[kind]) or (kind == 'number' and isinstance(data, bool)):
            return fail(path, 'type')
        if kind == 'number':
            try:
                finite = math.isfinite(data)
            except OverflowError:
                finite = False
            if not finite or (spec.get('integer') and (int(data) != data or abs(data) > 9007199254740991)):
                fail(path, 'number')
            if data < spec.get('minimum', -math.inf) or data > spec.get('maximum', math.inf) or data <= spec.get('exclusiveMinimum', -math.inf):
                fail(path, 'range')
        if kind == 'string' and (len(data) > spec['maxLength'] or len(data.strip()) < spec.get('minLength', 0)):
            fail(path, 'length')
        if 'enum' in spec and data not in spec['enum']:
            fail(path, 'enum')

    obj(name, value, name)
    if name == 'Project' and not errors:
        ids = set()
        for key, spec in CONTRACT['models']['Project'].items():
            if spec['type'] == 'array':
                for i, item in enumerate(value[key]):
                    if item['id'] in ids:
                        fail(f'Project.{key}[{i}].id', 'duplicate')
                    ids.add(item['id'])

        def references(model, data, path):
            for key, spec in CONTRACT['models'][model].items():
                item, p = data[key], f'{path}.{key}'
                if item is None:
                    continue
                if 'target' in spec and not any(v['id'] == item for v in value[spec['target']]):
                    fail(p, 'reference')
                if spec['type'] == 'object':
                    references(spec['model'], item, p)
                if spec['type'] == 'array':
                    for i, entry in enumerate(item):
                        sub = spec['items']
                        if 'model' in sub:
                            references(sub['model'], entry, f'{p}[{i}]')
                        if 'target' in sub and not any(v['id'] == entry for v in value[sub['target']]):
                            fail(f'{p}[{i}]', 'reference')
        references('Project', value, 'Project')
    return errors
