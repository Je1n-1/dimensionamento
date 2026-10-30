"""Stage 9: orchestration and graphical coordinates, never a new electrical engine."""
from copy import deepcopy
import math
from .contracts import CONTRACT, validate_entity
from .topology import analyze_topology, mutate_topology
from .currents import calculate_consumer as current
from .conductors import calculate_project as conductors
from .infrastructure import calculate_project as infrastructure
from .voltage import calculate_project as voltage

VERSION='industrial-overview-1'


def calculate_project(p):
    if validate_entity('Project',p):raise ValueError('Projeto inválido para visão geral.')
    data=dict(projectId=p['id'],inputRevision=p['revision'],version=VERSION,errors=[],currents=[])
    data['topology']=analyze_topology(p)
    motors={m['consumerId']:m for m in p['motors']}
    for c in p['consumers']:
        try:data['currents'].append(current(c,motors.get(c['id']),p['revision']))
        except ValueError as error:data['errors'].append(dict(domain='currents',targetId=c['id'],message=str(error)))
    for name,fn in [('conductors',conductors),('infrastructure',infrastructure),('voltage',voltage)]:
        try:data[name]=fn(p)
        except ValueError as error:
            data[name]=None;data['errors'].append(dict(domain=name,targetId=p['id'],message=str(error)))
    loads=[c for c in p['consumers'] if c['type']!='panel']
    powers=[m['value'] for r in data['currents'] if r['targetId'] in {c['id'] for c in loads} for m in r['measurements'] if m['code']=='electrical_total_w' and m['value'] is not None]
    total=sum(powers) if powers else None
    if total is not None and not math.isfinite(total):
        total=None;data['errors'].append(dict(domain='currents',targetId=p['id'],message='Soma de potências fora do intervalo numérico.'))
    ir=(data['infrastructure'] or {}).get('results',[]);vr=(data['voltage'] or {}).get('results',[])
    occupancy=[r['occupancy'] for r in ir if r['status']!='pending' and r['occupancy'] is not None]
    drops=[r['totalPercent'] for r in vr if r['status']!='pending' and r['totalPercent'] is not None]
    pending=sum(r['status']!='calculated' for name in ('conductors','infrastructure','voltage') for r in (data[name] or {}).get('results',[]))
    pending+=sum(r['status']!='calculated' for r in data['currents'])
    data['summary']=dict(consumers=len(loads),equipment=sum(c['quantity'] for c in loads),panels=len(p['panels']),segments=len(p['segments']),
        power=total,powerKnown=len(powers),powerTotal=len(loads),maxOccupancy=max(occupancy) if occupancy else None,maxDrop=max(drops) if drops else None,
        pending=pending+len(data['topology']['issues'])+len(data['errors']),status='partial',protection='not_implemented')
    return data


def mutate_overview(project,operation):
    if validate_entity('Project',project):raise ValueError('Projeto inválido; dados preservados.')
    if not isinstance(operation,dict):raise ValueError('Operação inválida.')
    p=deepcopy(project)
    if operation.get('action')=='positions':
        if set(operation)!={'action','positions'} or not isinstance(operation['positions'],list) or not 1<=len(operation['positions'])<=1000:raise ValueError('Posições inválidas.')
        nodes={n['id']:n for n in p['nodes']};seen=set()
        for entry in operation['positions']:
            if not isinstance(entry,dict) or set(entry)!={'id','position'} or not isinstance(entry['id'],str) or entry['id'] in seen or entry['id'] not in nodes:raise ValueError('Ponto inválido ou repetido.')
            seen.add(entry['id']);position=entry['position']
            if position is not None and validate_entity('MapPosition',position):raise ValueError('Coordenadas inválidas.')
            nodes[entry['id']]['position']=deepcopy(position)
        # Only drawing changes: electrical revision and results remain valid.
    elif operation.get('action')=='segment':
        if set(operation)!={'action','id','data'} or not isinstance(operation['data'],dict) or not set(operation['data'])<={'fromNodeId','toNodeId','length','notes'}:raise ValueError('Edição de trecho inválida.')
        if not any(s['id']==operation['id'] for s in p['segments']):raise ValueError('Trecho não encontrado.')
        p=mutate_topology(p,dict(action='save',collection='segments',id=operation['id'],data=operation['data']))
    else:raise ValueError('Operação da visão geral desconhecida.')
    p['currentStage']=max(p['currentStage'],9)
    if validate_entity('Project',p):raise ValueError('Alteração inválida; nenhum dado salvo.')
    return p


def overview_request(payload):
    p=payload.get('project');token=payload.get('request')
    if not isinstance(p,dict) or not isinstance(token,dict):raise ValueError('Envie projeto e requisição da visão geral.')
    expected=dict(projectId=p.get('id'),inputRevision=p.get('revision'),domain='overview',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)
    if token!=expected or type(token.get('inputRevision')) is not int:raise ValueError('Requisição desatualizada.')
    if validate_entity('Project',p):raise ValueError('Projeto inválido; nenhum dado alterado.')
    operation=payload.get('operation')
    result=mutate_overview(p,operation) if operation is not None else p
    # Mutations invalidate the displayed overview. Recalculation is an explicit action.
    return dict(request=expected,project=result,analysis=None if operation is not None else calculate_project(result))
