"""Stage 5: declared physical routes, independent of electrical sizing rules."""
from collections import defaultdict, deque
from copy import deepcopy
import math

from .contracts import CONTRACT, create_entity, validate_entity
from .preparation import prepare_independent

VERSION = 'industrial-topology-1'
MODELS = {'nodes': 'Node', 'panels': 'Panel', 'segments': 'Segment',
          'circuits': 'Circuit', 'cables': 'Cable', 'conductors': 'Conductor',
          'infrastructures': 'Infrastructure'}


def checked(project):
    errors = validate_entity('Project', project)
    if errors:
        raise ValueError('Dados inválidos: ' + errors[0]['path'])


def analyze_topology(project):
    """Never mutate inputs. Counts describe explicit formations, not ampacity."""
    checked(project)
    issues = []

    def issue(code, target, message, severity='pending'):
        issues.append(dict(code=code, targetId=target, message=message, severity=severity))

    nodes = {n['id']: n for n in project['nodes']}
    segments = {s['id']: s for s in project['segments']}
    circuits = {c['id']: c for c in project['circuits']}
    panels = {p['id']: p for p in project['panels']}
    consumers = {c['id']: c for c in project['consumers']}
    bound = {}
    if not circuits:
        issue('no_circuits', project['id'], 'Cadastre os circuitos e seus percursos para verificar a estrutura.')
    for p in panels.values():
        seen, cursor = set(), p
        while cursor:
            if cursor['id'] in seen:
                issue('panel_cycle', p['id'], 'Há um ciclo na hierarquia planejada dos quadros.', 'error')
                break
            seen.add(cursor['id'])
            cursor = panels.get(cursor['parentPanelId'])
    for collection in ('panels', 'segments', 'circuits', 'cables'):
        tags = set()
        for item in project[collection]:
            tag = item['tag'].strip().casefold()
            if not tag:
                issue('missing_tag', item['id'], 'Informe a identificação do item.')
            elif tag in tags:
                issue('duplicate_tag', item['id'], 'Identificação repetida no mesmo cadastro.', 'error')
            tags.add(tag)
    for node in nodes.values():
        kind, entity = node['kind'], node['entityId']
        if kind is None:
            issue('node_kind', node['id'], 'Informe o tipo do ponto de conexão.')
        if not node['label'].strip():
            issue('node_label', node['id'], 'Informe o nome do ponto.')
        if kind in ('consumer', 'panel'):
            target = consumers if kind == 'consumer' else panels
            if entity not in target:
                issue('node_binding', node['id'], 'Vincule o ponto a um consumidor ou quadro existente.', 'error' if entity else 'pending')
            else:
                if kind == 'consumer' and consumers[entity]['type'] == 'panel':
                    issue('panel_as_consumer', node['id'], 'Use o ponto do quadro associado ao consumidor painel.', 'error')
                key = (kind, entity)
                if key in bound:
                    issue('duplicate_binding', node['id'], 'O item já tem um ponto físico associado.', 'error')
                bound[key] = node['id']
        elif entity is not None:
            issue('unexpected_binding', node['id'], 'Origem externa e derivação não têm vínculo de consumidor/quadro.', 'error')

    # Kahn ordering avoids recursion depth and exponential path enumeration.
    outgoing, indegree = defaultdict(list), dict.fromkeys(nodes, 0)
    for s in segments.values():
        a, b = s['fromNodeId'], s['toNodeId']
        if not a or not b:
            issue('segment_endpoints', s['id'], 'Informe origem e destino do trecho.')
        else:
            outgoing[a].append(s)
            indegree[b] += 1
        if s['length'] is None:
            issue('segment_length', s['id'], 'Informe o comprimento físico do trecho.')
        if s['installationMethod'] is None or s['temperature'] is None:
            issue('segment_conditions', s['id'], 'Método ou temperatura do trecho não informados.')
        infrastructures = [i for i in project['infrastructures'] if i['segmentId'] == s['id']]
        if len(infrastructures) > 1:
            issue('duplicate_infrastructure', s['id'], 'Use uma infraestrutura por trecho; divida o trecho se necessário.', 'error')
        elif not infrastructures:
            issue('segment_infrastructure', s['id'], 'Tipo de infraestrutura não informado.')
        elif infrastructures[0]['type'] is None:
            issue('infrastructure_type', s['id'], 'Selecione o tipo de infraestrutura do trecho.')
    for infrastructure in project['infrastructures']:
        if not infrastructure['segmentId']:
            issue('infrastructure_segment', infrastructure['id'], 'Vincule a infraestrutura a um trecho.')
    queue = deque(n for n in nodes if indegree[n] == 0)
    order = []
    while queue:
        n = queue.popleft()
        order.append(n)
        for edge in outgoing[n]:
            indegree[edge['toNodeId']] -= 1
            if indegree[edge['toNodeId']] == 0:
                queue.append(edge['toNodeId'])
    cyclic = len(order) != len(nodes)
    if cyclic:
        issue('cycle', project['id'], 'Há um ciclo nos trechos. Esta etapa admite caminhos dirigidos sem ciclos.', 'error')

    circuit_rows, assigned = [], defaultdict(list)
    for c in circuits.values():
        start = len(issues)
        origin = nodes.get(c['originNodeId'])
        if not origin or origin['kind'] not in ('origin', 'panel'):
            issue('circuit_origin', c['id'], 'Defina um quadro ou uma origem externa para o circuito.')
        elif c['originPanelId'] != (origin['entityId'] if origin['kind'] == 'panel' else None):
            issue('origin_conflict', c['id'], 'O quadro do circuito diverge do ponto de origem.', 'error')
        targets = []
        for kind, ids in (('consumer', c['consumerIds']), ('panel', c['destinationPanelIds'])):
            if len(ids) != len(set(ids)):
                issue('duplicate_destination', c['id'], 'Destino repetido no circuito.', 'error')
            for entity in ids:
                if entity is None:
                    issue('null_destination', c['id'], 'Destino vazio no circuito.', 'error')
                    continue
                if kind == 'consumer' and consumers[entity]['type'] == 'panel':
                    issue('panel_destination', c['id'], 'Selecione o quadro em Quadros atendidos.', 'error')
                assigned[(kind, entity)].append(c['id'])
                node_id = bound.get((kind, entity))
                if not node_id:
                    issue('destination_node', c['id'], 'Crie o ponto físico de cada destino do circuito.')
                targets.append((kind, entity, node_id))
        if not targets:
            issue('circuit_destinations', c['id'], 'Escolha os consumidores ou quadros atendidos.')
        selected = set(c['segmentIds'])
        if None in selected:
            issue('null_segment', c['id'], 'Trecho vazio no circuito.', 'error')
        if len(selected) != len(c['segmentIds']):
            issue('duplicate_segment', c['id'], 'Trecho repetido no circuito.', 'error')
        if not selected:
            issue('circuit_segments', c['id'], 'Selecione os trechos percorridos pelo circuito.')
        ways, previous = defaultdict(int), {}
        if origin and not cyclic:
            ways[origin['id']] = 1
            for n in order:
                for edge in outgoing[n]:
                    if edge['id'] in selected and ways[n]:
                        dest = edge['toNodeId']
                        ways[dest] = min(2, ways[dest] + ways[n])
                        previous[dest] = edge
        paths, used = [], set()
        for kind, entity, target in targets:
            if target and origin and target == origin['id']:
                issue('self_supply', c['id'], 'Origem e destino do circuito não podem ser o mesmo ponto.', 'error')
            if not target or ways[target] == 0:
                issue('unreachable', c['id'], 'Um destino não é alcançado pelos trechos selecionados.')
                continue
            if ways[target] > 1:
                issue('ambiguous_path', c['id'], 'Há mais de um caminho até um destino. Selecione um percurso único.', 'error')
                continue
            path, cursor = [], target
            while cursor != origin['id']:
                edge = previous[cursor]
                path.append(edge['id'])
                cursor = edge['fromNodeId']
            path.reverse()
            used.update(path)
            lengths = [segments[s]['length'] for s in path]
            distance = sum(lengths) if all(v is not None for v in lengths) else None
            if distance is not None and not math.isfinite(distance):
                raise ValueError('Comprimento acumulado fora do intervalo numérico.')
            paths.append(dict(kind=kind, entityId=entity, segmentIds=path, length=distance))
            if kind == 'consumer' and consumers[entity]['panelId'] and consumers[entity]['panelId'] != c['originPanelId']:
                issue('planned_panel_conflict', c['id'], 'O quadro planejado do consumidor diverge da origem deste circuito.')
            if kind == 'panel' and panels[entity]['parentPanelId'] and panels[entity]['parentPanelId'] != c['originPanelId']:
                issue('parent_panel_conflict', c['id'], 'O quadro superior cadastrado diverge da origem do alimentador.')
        if selected - used:
            issue('unused_segments', c['id'], 'Há trechos selecionados que não fazem parte de um percurso válido até os destinos.')
        valid = not cyclic and len(paths) == len(targets) and bool(targets) and not issues[start:]
        circuit_rows.append(dict(id=c['id'], paths=paths, valid=valid, segmentIds=sorted(used)))

    for (kind, entity), feeds in assigned.items():
        if len(feeds) > 1:
            issue('multiple_feeds', entity, 'Destino vinculado a mais de um circuito. Múltiplas alimentações não são modeladas nesta etapa.', 'error')
    for kind, items in (('consumer', consumers), ('panel', panels)):
        for entity, item in items.items():
            if kind == 'consumer' and item['type'] == 'panel':
                continue  # Its associated Panel is the electrical destination.
            if not assigned[(kind, entity)] and not (kind == 'panel' and any(c['originPanelId'] == entity for c in circuits.values())):
                issue('unassigned', entity, 'Item sem circuito de alimentação declarado.')

    cable_rows = {}
    for cable in project['cables']:
        c = circuits.get(cable['circuitId'])
        cores = [w for w in project['conductors'] if w['cableId'] == cable['id']]
        valid = bool(c and cores and cable['formation'])
        if not c or not cores or not cable['formation']:
            issue('cable_incomplete', cable['id'], 'Informe circuito, formação e funções dos condutores.')
        roles = [w['role'] for w in cores]
        if len(roles) != len(set(roles)) or ('PEN' in roles and ('N' in roles or 'PE' in roles)):
            issue('core_roles', cable['id'], 'Funções repetidas ou PEN combinado com N/PE na mesma formação.', 'error')
            valid = False
        if any(w['circuitId'] != cable['circuitId'] or w['formation'] != cable['formation'] for w in cores):
            issue('core_binding', cable['id'], 'Os condutores devem pertencer ao mesmo circuito e formação do cabo.', 'error')
            valid = False
        selected = set(c['segmentIds'] if c and cable['routeMode'] == 'circuit' else cable['segmentIds'])
        if c and not selected <= set(c['segmentIds']):
            issue('cable_route', cable['id'], 'O cabo contém trechos fora do circuito.', 'error')
            valid = False
        if not selected:
            issue('cable_segments', cable['id'], 'A formação não possui trechos definidos.')
        cable_rows[cable['id']] = dict(valid=valid, segments=selected, roles=roles)
    for w in project['conductors']:
        if w['cableId'] is None:
            issue('unbound_conductor', w['id'], 'Condutor sem formação de cabos; não incluído nas contagens.')

    segment_rows = []
    for s in segments.values():
        members = [c['id'] for c in circuits.values() if s['id'] in c['segmentIds']]
        if not members:
            issue('unassigned_segment', s['id'], 'Trecho sem circuito associado; contagem ainda não definida.')
        formations = [c for c in project['cables'] if s['id'] in cable_rows[c['id']]['segments']]
        complete = bool(members) and all(next(r for r in circuit_rows if r['id'] == c)['valid'] for c in members)
        physical, insulated, functions = 0, 0, defaultdict(int)
        for circuit_id in members:
            if not any(c['circuitId'] == circuit_id for c in formations):
                complete = False
                issue('missing_formation', s['id'], 'Um circuito deste trecho ainda não tem formação de cabos declarada.')
        for cable in formations:
            row = cable_rows[cable['id']]
            complete = complete and row['valid']
            q, n = cable['quantity'], len(row['roles'])
            if cable['formation'] == 'multicore':
                physical += q
            elif cable['formation'] == 'single_core':
                physical += q * n
            elif cable['formation'] == 'insulated':
                insulated += q * n
            for role in row['roles']:
                functions[role] += q
        if any(i['severity'] == 'error' for i in issues):
            complete = False
        if set(s['circuitIds']) != set(members):
            issue('membership_cache', s['id'], 'A lista derivada de circuitos será sincronizada ao salvar a estrutura.')
        segment_rows.append(dict(id=s['id'], circuitIds=members, complete=bool(complete),
                                 physicalCables=physical if complete else None,
                                 insulatedConductors=insulated if complete else None,
                                 functions=dict(functions) if complete else None))
    return dict(projectId=project['id'], inputRevision=project['revision'], version=VERSION,
                status='pending' if issues else 'validated', issues=issues,
                circuits=circuit_rows, segments=segment_rows)


def _references(project, target, ids):
    """Contract references, including arrays; block deletion instead of cascading."""
    def walk(model, item):
        for key, spec in CONTRACT['models'][model].items():
            value = item[key]
            if value is None:
                continue
            if spec.get('target') == target and value in ids:
                return True
            if spec['type'] == 'object' and walk(spec['model'], value):
                return True
            if spec['type'] == 'array':
                if spec['items'].get('target') == target and any(v in ids for v in value):
                    return True
                if spec['items'].get('model') and any(walk(spec['items']['model'], v) for v in value):
                    return True
        return False
    return walk('Project', project)


def mutate_topology(project, operation):
    checked(project)
    if not isinstance(operation, dict):
        raise ValueError('Operação inválida.')
    next_project = deepcopy(project)
    action = operation.get('action')
    if action == 'prepare':
        prepare_independent(next_project, operation)
    elif action == 'points':
        for kind, collection in (('panel', 'panels'), ('consumer', 'consumers')):
            for item in next_project[collection]:
                if kind == 'consumer' and item['type'] == 'panel':
                    continue
                if not any(n['kind'] == kind and n['entityId'] == item['id'] for n in next_project['nodes']):
                    next_project['nodes'].append(create_entity('Node', kind=kind, entityId=item['id'], label=item['tag']))
    elif action == 'path':
        origin, rows = operation.get('origin'), operation.get('rows')
        basis, prefix = operation.get('basis'), operation.get('prefix')
        if basis not in ('physical', 'cumulative') or not isinstance(rows, list) or not 1 <= len(rows) <= 100 or not isinstance(prefix, str) or not prefix.strip():
            raise ValueError('Informe prefixo, base das distâncias e de 1 a 100 destinos.')
        previous = 0
        for index, row in enumerate(rows):
            if not isinstance(row, dict):
                raise ValueError('Destino inválido.')
            value = row.get('distance')
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                raise ValueError('Informe distâncias finitas e não negativas.')
            length = value - previous if basis == 'cumulative' else value
            if length < 0:
                raise ValueError('Distâncias acumuladas devem crescer a partir da origem escolhida.')
            next_project['segments'].append(create_entity('Segment', tag=f'{prefix.strip()}-{index+1}',
                fromNodeId=origin, toNodeId=row.get('nodeId'), length=length, kind=operation.get('kind', 'trunk')))
            previous, origin = value, row.get('nodeId')
    elif action in ('save', 'delete'):
        collection = operation.get('collection')
        if collection not in MODELS:
            raise ValueError('Cadastro de estrutura desconhecido.')
        model = MODELS[collection]
        item_id = operation.get('id')
        old = next((i for i in next_project[collection] if i['id'] == item_id), None)
        if item_id and old is None:
            raise ValueError('Item não encontrado. Reabra o formulário.')
        if collection == 'panels' and old and old['consumerId']:
            raise ValueError('Este quadro pertence a um consumidor painel. Edite ou exclua pelo cadastro de consumidores para preservar o vínculo.')
        if action == 'delete':
            if not old:
                raise ValueError('Selecione o item para excluir.')
            if collection == 'cables':
                cores = {w['id'] for w in next_project['conductors'] if w['cableId'] == item_id}
                if _references(next_project, 'conductors', cores):
                    raise ValueError('Os condutores desta formação têm vínculos. Remova os vínculos primeiro.')
                next_project['conductors'] = [w for w in next_project['conductors'] if w['id'] not in cores]
            # Segment membership is a cache, not an independent blocker.
            if collection == 'circuits':
                for s in next_project['segments']:
                    s['circuitIds'] = [c for c in s['circuitIds'] if c != item_id]
            if _references(next_project, collection, {item_id}) or (collection in ('panels', 'consumers') and any(n['entityId'] == item_id for n in next_project['nodes'])):
                raise ValueError('Item vinculado a outros registros. Remova os vínculos antes de excluir.')
            next_project[collection] = [i for i in next_project[collection] if i['id'] != item_id]
        else:
            data = operation.get('data')
            if not isinstance(data, dict) or 'id' in data:
                raise ValueError('Dados do formulário inválidos.')
            item = create_entity(model, **((old or {}) | data))
            if collection == 'circuits':
                node = next((n for n in next_project['nodes'] if n['id'] == item['originNodeId']), None)
                item['originPanelId'] = node['entityId'] if node and node['kind'] == 'panel' else None
            if collection == 'cables':
                roles = operation.get('roles')
                if not isinstance(roles, list) or len(roles) != len(set(roles)) or any(r not in ('L1', 'L2', 'L3', 'N', 'PE', 'PEN') for r in roles):
                    raise ValueError('Informe funções distintas para os condutores.')
                previous = {w['role']: w for w in next_project['conductors'] if w['cableId'] == item['id']}
                removed = {w['id'] for role, w in previous.items() if role not in roles}
                if _references(next_project, 'conductors', removed):
                    raise ValueError('Função vinculada à infraestrutura. Remova o vínculo antes de alterar.')
                next_project['conductors'] = [w for w in next_project['conductors'] if w['cableId'] != item['id']]
                for role in roles:
                    core = create_entity('Conductor', **previous[role]) if role in previous else create_entity('Conductor', role=role)
                    core.update(cableId=item['id'], circuitId=item['circuitId'], formation=item['formation'])
                    next_project['conductors'].append(core)
            if old:
                next_project[collection] = [item if i['id'] == old['id'] else i for i in next_project[collection]]
            else:
                next_project[collection].append(item)
    else:
        raise ValueError('Operação não reconhecida.')
    for s in next_project['segments']:
        s['circuitIds'] = [c['id'] for c in next_project['circuits'] if s['id'] in c['segmentIds']]
    checked(next_project)
    before = {(i['code'], i['targetId']) for i in analyze_topology(project)['issues'] if i['severity'] == 'error'}
    after = analyze_topology(next_project)
    added = [i for i in after['issues'] if i['severity'] == 'error' and (i['code'], i['targetId']) not in before]
    if added:
        raise ValueError(added[0]['message'])
    next_project['revision'] += 1
    # Physical topology changes invalidate the scope/group declarations of stage 6.
    for cable in next_project['cables']:
        cable['design']['scopeConfirmed'] = None
        cable['design']['manualIbConfirmed'] = None
    for segment in next_project['segments']:
        segment['thermal']['methodConfirmed'] = None
        segment['thermal']['groupingConfirmed'] = None
    next_project['currentStage'] = max(5, next_project['currentStage'])
    for result in next_project['results']:
        result.update(status='invalidated', measurements=[], criteria=[], reason='Estrutura alterada. Recalcule as grandezas.')
    checked(next_project)
    return next_project


def topology_request(payload):
    project, token = payload.get('project'), payload.get('request')
    if not isinstance(project, dict) or not isinstance(token, dict):
        raise ValueError('Envie projeto e requisição da estrutura.')
    expected = dict(projectId=project.get('id'), inputRevision=project.get('revision'), domain='topology',
                    engineVersion=CONTRACT['engineVersion'], rulesVersion=VERSION)
    if token != expected or type(token.get('inputRevision')) is not int:
        raise ValueError('Requisição desatualizada. Recarregue o projeto.')
    checked(project)
    result = mutate_topology(project, payload['operation']) if 'operation' in payload else project
    return dict(request=expected, project=result, analysis=analyze_topology(result))
