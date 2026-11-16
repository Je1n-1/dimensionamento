"""Explicit preparation of independent terminal circuits; no sizing decisions."""
import math
from .contracts import create_entity


def prepare_independent(project, operation):
    """Mutate only the caller's private copy, subsequently checked by topology."""
    if operation.get('independentConfirmed') is not True:
        raise ValueError('Confirme que são percursos independentes desde o quadro, sem trechos compartilhados.')
    panel = next((p for p in project['panels'] if p['id'] == operation.get('panelId')), None)
    rows = operation.get('rows')
    if panel is None or not isinstance(rows, list) or not 1 <= len(rows) <= 150:
        raise ValueError('Selecione um quadro e de 1 a 150 cargas.')
    seen = set()

    def point(kind, item):
        found = next((n for n in project['nodes'] if n['kind'] == kind and n['entityId'] == item['id']), None)
        if found is None:
            found = create_entity('Node', kind=kind, entityId=item['id'], label=item['tag'])
            project['nodes'].append(found)
        return found

    def tag(collection, base):
        base = base[:48]
        candidate, index = base, 2
        existing = {i['tag'].casefold() for i in project[collection]}
        while candidate.casefold() in existing:
            candidate = f'{base}-{index}'
            index += 1
        return candidate

    origin = point('panel', panel)
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Carga inválida.')
        consumer = next((c for c in project['consumers'] if c['id'] == row.get('consumerId')), None)
        if consumer is None or consumer['type'] == 'panel' or consumer['id'] in seen:
            raise ValueError('Selecione cargas distintas; quadros são configurados como alimentadores em Caminhos e circuitos.')
        seen.add(consumer['id'])
        if any(consumer['id'] in c['consumerIds'] for c in project['circuits']):
            raise ValueError(f"{consumer['tag']}: já possui circuito. Edite a estrutura existente.")
        if consumer['plannedSegmentId'] or consumer['panelId'] not in (None, panel['id']):
            raise ValueError(f"{consumer['tag']}: possui outro quadro ou trecho vinculado. Revise em Caminhos e circuitos.")
        length = row.get('distance')
        if isinstance(length, bool) or not isinstance(length, (int, float)) or not math.isfinite(length) or length <= 0:
            raise ValueError(f"{consumer['tag']}: informe o comprimento completo do quadro até a carga, maior que zero.")
        phases = {'FN': ('A','B','C'), 'FF': ('AB','BC','CA'), '3F': ('ABC',), '3FN': ('ABC',)}
        if consumer['phaseSet'] not in phases.get(consumer['connection'], ()):
            raise ValueError(f"{consumer['tag']}: informe ligação e fases compatíveis no cadastro.")
        formation = {'insulated':'insulated', 'unipolar':'single_core', 'multipolar':'multicore'}.get(consumer['cableType'])
        if not formation:
            raise ValueError(f"{consumer['tag']}: informe o tipo de cabo no cadastro.")
        destination = point('consumer', consumer)
        if any(destination['id'] in (s['fromNodeId'],s['toNodeId']) for s in project['segments']):
            raise ValueError(f"{consumer['tag']}: já tem percurso físico. Use Caminhos e circuitos.")
        segment = create_entity('Segment', tag=tag('segments', consumer['plannedSegmentTag'] or 'T-'+consumer['tag']),
            fromNodeId=origin['id'], toNodeId=destination['id'], length=length, kind='branch',
            installationMethod=consumer['installationMethod'], temperature=consumer['temperature'], environment=consumer['environment'])
        project['segments'].append(segment)
        circuit = create_entity('Circuit', tag=tag('circuits','C-'+consumer['tag']), purpose='lighting' if consumer['type']=='lighting' else 'power',
            role='terminal', originPanelId=panel['id'], originNodeId=origin['id'], consumerIds=[consumer['id']], segmentIds=[segment['id']])
        project['circuits'].append(circuit)
        cable = create_entity('Cable', tag=tag('cables','F-'+consumer['tag']), circuitId=circuit['id'], formation=formation, routeMode='circuit')
        cable['design']['connection'] = consumer['connection']
        project['cables'].append(cable)
        roles = [{'A':'L1','B':'L2','C':'L3'}[p] for p in consumer['phaseSet']]
        if consumer['connection'] in ('FN','3FN'):
            roles.append('N')
        if consumer['hasPE']:
            roles.append('PE')
        for role in roles:
            project['conductors'].append(create_entity('Conductor', cableId=cable['id'], circuitId=circuit['id'], role=role,
                formation=formation, material={'copper':'Cu','aluminum':'Al'}.get(consumer['cableMaterial']),
                insulation=consumer['insulation'] if consumer['insulation'] in ('PVC','XLPE','EPR') else None))
        consumer.update(panelId=panel['id'], plannedSegmentId=segment['id'], plannedSegmentTag=segment['tag'], distance=length, distanceBasis='cumulative')
