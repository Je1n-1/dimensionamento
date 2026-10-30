"""Radial complete-path drop. Geometry, impedances, hypotheses and references stay explicit."""
import copy
import hashlib
import json
import math

from .contracts import CONTRACT, validate_entity
from .topology import analyze_topology
from .currents import calculate_consumer as calculate_current
from .conductors import current_for, route
from .conductor_rules import Pending, require
from .voltage_rules import VERSION, TOTAL_LIMITS, FORMULA_SOURCE, voltage_drop, compatible


def circuit_inputs(project,circuit):
    loads=[c for c in project['consumers'] if c['id'] in circuit['consumerIds']]
    single=loads[0] if len(loads)==1 and not circuit['destinationPanelIds'] else None
    d=circuit['voltageStudy']
    return dict(voltage=d['nominalVoltage'] if d['nominalVoltage'] is not None else single['voltage'] if single else None,
                frequency=d['frequency'] if d['frequency'] is not None else single['frequency'] if single else None,
                powerFactor=d['powerFactor'] if d['powerFactor'] is not None else single['powerFactor'] if single else None,
                balanced=d['balanced'] if d['balanced'] is not None else single['balanced'] if single else None)


def impedance_signature(project,cable):
    circuit=next((c for c in project['circuits'] if c['id']==cable['circuitId']),None)
    cores=sorted([[w[k] for k in ('role','section','material','insulation','formation')] for w in project['conductors'] if w['cableId']==cable['id']],key=str)
    segments=[]
    for s in project['segments']:
        if circuit and s['id'] in route(cable,circuit):
            infra=sorted([[i['type'],i['arrangement'],i['spacing']] for i in project['infrastructures'] if i['segmentId']==s['id']],key=str)
            segments.append([s['installationMethod'],s['temperature'],s['thermal']['grouping'],infra])
    data=[cores,cable['formation'],cable['quantity'],cable['design']['connection'],cable['design']['arrangement'],
          circuit_inputs(project,circuit)['frequency'] if circuit else None,sorted(segments,key=str)]
    return hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()


def path_chain(project,consumer,topology):
    policy=project['voltagePolicy'];origin=policy['originNodeId']
    require(origin is not None and policy['originType'] in TOTAL_LIMITS and policy['originConfirmed'] is True,
            'Defina a origem normativa e confirme o ponto inicial da instalação em Origem e limites.')
    node=next((n for n in project['nodes'] if n['id']==origin),None)
    require(node and node['kind'] in ('origin','panel'),'A origem normativa deve ser um ponto de origem ou quadro.')
    kind,target='consumer',consumer['id'];chain=[];seen=set()
    while True:
        feeds=[c for c in project['circuits'] if target in c['consumerIds' if kind=='consumer' else 'destinationPanelIds']]
        require(len(feeds)==1,'Defina um único circuito de alimentação para cada carga/quadro do percurso completo.')
        circuit=feeds[0]
        require(circuit['id'] not in seen,'Ciclo na cadeia de alimentação; revise quadros e circuitos.')
        seen.add(circuit['id'])
        check=next(c for c in topology['circuits'] if c['id']==circuit['id'])
        require(check['valid'],'Circuito '+circuit['tag']+': corrija o percurso em Caminhos e circuitos.')
        path=next((p for p in check['paths'] if p['kind']==kind and p['entityId']==target),None)
        require(path is not None,'Percurso não encontrado para o destino.')
        require(circuit['role']==('terminal' if kind=='consumer' else 'feeder'),'Classifique o circuito como terminal ou alimentador conforme seu destino.')
        chain.append((circuit,path))
        if circuit['originNodeId']==origin:break
        previous=next((n for n in project['nodes'] if n['id']==circuit['originNodeId']),None)
        require(previous and previous['kind']=='panel','A origem normativa escolhida não é alcançada pela cadeia de alimentação.')
        kind,target='panel',previous['entityId']
    return list(reversed(chain))


def segment_result(project,circuit,segment,consumer,currents):
    cables=[c for c in project['cables'] if c['circuitId']==circuit['id'] and segment['id'] in route(c,circuit)]
    require(len(cables)==1,'Trecho '+segment['tag']+': selecione uma única formação completa; paralelismo/repartição de funções não implementados.')
    cable=cables[0];d=cable['design'];z=cable['voltageImpedance'];v=circuit_inputs(project,circuit)
    require(cable['quantity']==1,'Formações em paralelo exigem impedância equivalente e divisão de corrente específicas.')
    connection=d['connection']
    require(connection in ('FN','FF','3F','3FN'),'Defina ligação FN, FF ou trifásica na formação; FFN desequilibrada não implementada.')
    require(circuit['voltageStudy']['scopeConfirmed'] is True,'Circuito '+circuit['tag']+': confirme regime permanente senoidal, carga resistiva/indutiva e escopo de cálculo.')
    require(v['voltage'] is not None and v['frequency'] in (50,60) and v['powerFactor'] is not None,'Circuito '+circuit['tag']+': informe tensão, frequência 50/60 Hz e fator de potência.')
    require(connection not in ('3F','3FN') or v['balanced'] is True,'Confirme equilíbrio trifásico; desequilíbrio exige cálculo por fase não implementado.')
    require(d['harmonicsPercent'] in (None,0),'Harmônicas declaradas exigem impedâncias por frequência; modelo senoidal não aplicável.')
    loads=[c for c in project['consumers'] if c['id'] in circuit['consumerIds']]
    for load in loads:
        require('error' not in currents[load['id']], 'Carga '+load['tag']+': '+currents[load['id']].get('error',''))
        require(connection not in ('3F','3FN') or load['balanced'] is True,
                'Carga '+load['tag']+': equilíbrio trifásico não confirmado no cadastro; uma condição do circuito não substitui esse dado.')
        require(load['connection']==connection and load['voltage'] is not None and math.isclose(load['voltage'],v['voltage'],rel_tol=.001),
                'Tensão/ligação do circuito deve corresponder às cargas atendidas; transformação intermediária não implementada.')
        require(load['frequency']==v['frequency'],'Frequência do circuito diverge da carga ou não foi informada.')
    if len(loads)==1 and not circuit['destinationPanelIds'] and loads[0]['powerFactor'] is not None:
        require(math.isclose(loads[0]['powerFactor'],v['powerFactor'],rel_tol=1e-6),'Fator de potência diverge do consumidor; ajuste o dado de origem.')
    current,trace=current_for(project,circuit,d,currents)
    cores=[w for w in project['conductors'] if w['cableId']==cable['id']]
    roles=[w['role'] for w in cores if w['role']!='PE']
    expected={'FN':(1,1),'FF':(2,0),'3F':(3,0),'3FN':(3,1)}[connection]
    phases=[w for w in cores if w['role'] in ('L1','L2','L3')]
    require(len(phases)==expected[0] and roles.count('N')==expected[1] and len(set(roles))==len(roles) and 'PEN' not in roles,
            'Funções da formação não correspondem à ligação; PEN não é coberto.')
    if circuit['role']=='terminal':
        require(consumer['phaseSet'] is not None,'Informe as fases utilizadas pelo consumidor.')
        mapping={'A':'L1','B':'L2','C':'L3'}
        require({mapping[x] for x in consumer['phaseSet']}=={w['role'] for w in phases},'Fases do consumidor divergem das funções da formação.')
    live=phases+[w for w in cores if w['role']=='N' and connection=='FN']
    require(all(w['section'] is not None and w['material'] in ('Cu','Al') and w['insulation'] in ('PVC','XLPE','EPR') for w in live),'Informe seções adotadas, material e isolação no dimensionamento; sugestões não são aplicadas automaticamente.')
    require(len({(w['section'],w['material'],w['insulation']) for w in live})==1,'Fases/retorno com características distintas exigem impedâncias separadas; modelo não implementado.')
    source=z['source']
    require(z['confirmed'] is True and z['signature']==impedance_signature(project,cable),'Formação '+cable['tag']+': informe/reconfirme R e X para a seção, formação, método, frequência e condições térmicas atuais.')
    require(z['resistance'] is not None and z['reactance'] is not None and z['temperature'] is not None,
            'Informe resistência, reatância e temperatura adotada da resistência; zero de reatância só por referência explícita.')
    require(source['kind'] in ('catalog','manual') and source['reference'].strip(),'Registre a referência de R/X, incluindo construção, frequência e temperatura aplicáveis.')
    require(segment['temperature'] is not None,'Informe a temperatura ambiente do trecho; não confundir com temperatura do condutor.')
    maximum=70 if live[0]['insulation']=='PVC' else 90
    require(segment['temperature']<=z['temperature']<=maximum,'Temperatura adotada de R deve estar entre o ambiente e o limite de serviço da isolação. Não há modelo térmico automático.')
    require(segment['installationMethod'] is not None,'Informe o método de instalação do trecho para conferir a aplicabilidade de R/X.')
    require(segment['length'] is not None and segment['length']>=0,'Informe o comprimento físico do trecho.')
    drop=voltage_drop(current,segment['length'],z['resistance'],z['reactance'],v['powerFactor'],connection)
    return dict(id=circuit['id']+':'+segment['id'],segmentId=segment['id'],circuitId=circuit['id'],cableId=cable['id'],
                tag=segment['tag'],circuitTag=circuit['tag'],cableTag=cable['tag'],length=segment['length'],
                connection=connection,roles=roles,voltage=v['voltage'],frequency=v['frequency'],powerFactor=v['powerFactor'],
                current=current,section=live[0]['section'],material=live[0]['material'],temperature=z['temperature'],
                resistance=z['resistance'],reactance=z['reactance'],drop=drop,percent=drop/v['voltage']*100,
                source=source,trace=trace)


def calculate_consumer(project,consumer,topology,currents):
    result=dict(id=consumer['id'],tag=consumer['tag'],status='pending',voltage=consumer['voltage'],distance=None,
                totalDrop=None,totalPercent=None,terminalPercent=None,totalLimit=None,terminalLimit=4,
                segments=[],criteria=[],pending=[],trace=[],startingStatus='not_calculated')
    try:
        require(not any(i['severity']=='error' for i in topology['issues']),'Corrija erros da topologia antes de analisar o percurso completo.')
        require(consumer['type'] not in ('panel','transformer','drive','other'),'Transformador, acionamento ou outra carga requer modelo de circuito e regime específico; análise não implementada para este tipo.')
        chain=path_chain(project,consumer,topology)
        result['totalLimit']=TOTAL_LIMITS[project['voltagePolicy']['originType']]
        by_segment={s['id']:s for s in project['segments']}
        blocks=[]
        for circuit,path in chain:
            rows=[segment_result(project,circuit,by_segment[sid],consumer,currents) for sid in path['segmentIds']]
            require(rows,'Circuito sem segmentos físicos.')
            require(all(math.isclose(row['current'],rows[0]['current'],rel_tol=1e-6) and row['connection']==rows[0]['connection'] and set(row['roles'])==set(rows[0]['roles']) for row in rows),
                    'Múltiplas formações em série devem representar a mesma ligação e Ib; reduções de corrente por derivação não são inferidas.')
            blocks.append((circuit,rows));result['segments']+=rows
        for (_,up),(_,down) in zip(blocks,blocks[1:]):
            require(compatible(up[-1],down[0]) and up[-1]['frequency']==down[0]['frequency'],
                    'Transição entre circuitos incompatível: confira fases, neutro, tensões e frequência; transformação/desequilíbrio não modelados.')
        total=sum(row['percent'] for row in result['segments'])
        terminal=sum(row['percent'] for row in blocks[-1][1])
        distance=sum(row['length'] for row in result['segments'])
        voltage=consumer['voltage']
        require(voltage is not None and voltage>0,'Informe a tensão nominal do consumidor.')
        require(math.isfinite(total) and math.isfinite(total*voltage/100) and math.isfinite(distance),'Queda ou percurso acumulado fora do intervalo numérico.')
        result.update(totalPercent=total,totalDrop=total*voltage/100,terminalPercent=terminal,
                      distance=distance)
        for row in result['segments']:
            row['equivalentDrop']=row['percent']*voltage/100
            row['contribution']=row['percent']/total*100 if total else 0
        def criterion(code,passed,message):
            result['criteria'].append(dict(code=code,status='verified' if passed else 'failed',message=message))
        criterion('total_drop',total<=result['totalLimit']+1e-9,f"Percurso completo: {total:.3f}% / {result['totalLimit']}% — 6.2.7.1, origem declarada.")
        criterion('terminal_drop',terminal<=4+1e-9,f'Circuito terminal: {terminal:.3f}% / 4% — 6.2.7.2.')
        for circuit,rows in blocks:
            if circuit['voltageDropLimit'] is not None:
                require(circuit['limitSource']['reference'].strip(),'Limite adicional do circuito requer referência de projeto.')
                value=sum(r['percent'] for r in rows)
                criterion('project_limit',value<=circuit['voltageDropLimit']+1e-9,'Limite adicional '+circuit['tag']+': '+str(circuit['voltageDropLimit'])+'%. Não substitui limites normativos.')
        result['status']='review' if any(c['status']=='failed' for c in result['criteria']) else 'calculated'
        result['trace']=['ΔU = k × Ib × (R cosφ + X senφ) × L; k=2 para FN/FF e √3 para trifásico equilibrado. R/X em Ω/km por condutor, L em km. Modelo longitudinal aproximado, corrente de projeto conforme 6.2.7.4.',
            'Percurso completo = alimentadores até a origem normativa + circuito terminal. Quedas somadas em percentuais na mesma rede; volts equivalentes referidos à tensão da carga. Transformações intermediárias não modeladas.',
            'Ib de cada circuito aplicado integralmente aos seus segmentos. Grupos/alimentadores usam estudo de Ib declarado; não há demanda automática nem redução por derivação.',
            'R deve corresponder à temperatura adotada e ao arranjo real; não há estimativa de temperatura nem correção automática da resistência. Não foi aplicada a suplementação opcional de limite para linhas principais acima de 100 m.',
            'Referência das fórmulas: '+FORMULA_SOURCE]
    except (Pending,ValueError) as error:
        result['pending'].append(str(error))
        # A prefix is not a complete result; keep it explicitly incomplete.
        result['status']='pending'
    return result


def calculate_project(project):
    if validate_entity('Project',project):raise ValueError('Projeto inválido para queda de tensão.')
    topology=analyze_topology(project)
    motors={m['consumerId']:m for m in project['motors']}
    currents={}
    for c in project['consumers']:
        try:currents[c['id']]=calculate_current(c,motors.get(c['id']),project['revision'])
        except ValueError as error:currents[c['id']]={'error':str(error)}
    results=[calculate_consumer(project,c,topology,currents) for c in project['consumers'] if c['type']!='panel']
    return dict(projectId=project['id'],inputRevision=project['revision'],version=VERSION,results=results)


def voltage_request(payload):
    project,token=payload.get('project'),payload.get('request')
    if not isinstance(project,dict) or not isinstance(token,dict):raise ValueError('Envie projeto e requisição de queda de tensão.')
    expected=dict(projectId=project.get('id'),inputRevision=project.get('revision'),domain='voltage',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)
    if token!=expected or any(type(token.get(k)) is not type(v) for k,v in expected.items()):raise ValueError('Requisição de queda desatualizada.')
    if validate_entity('Project',project):raise ValueError('Projeto inválido; nenhum dado alterado.')
    p=copy.deepcopy(project);operation=payload.get('operation')
    if operation is not None:
        if not isinstance(operation,dict) or set(operation)!={'collection','id','data'}:raise ValueError('Operação de queda inválida.')
        collection=operation['collection'];data=operation['data']
        if collection not in ('project','circuits','cables') or not isinstance(data,dict):raise ValueError('Dados de queda inválidos.')
        allowed={'voltagePolicy'} if collection=='project' else {'voltageStudy','voltageDropLimit','limitSource'} if collection=='circuits' else {'voltageImpedance'}
        if not set(data)<=allowed:raise ValueError('Campos de queda inválidos.')
        item=p if collection=='project' and operation['id']==p['id'] else next((i for i in p.get(collection,[]) if i['id']==operation['id']),None)
        if item is None:raise ValueError('Item não encontrado.')
        item.update(copy.deepcopy(data))
        if validate_entity('Project',p):raise ValueError('Parâmetros de queda fora do contrato; nenhum dado alterado.')
        if collection=='cables':item['voltageImpedance']['signature']=impedance_signature(p,item)
        p['revision']+=1;p['currentStage']=max(p['currentStage'],8)
        for r in p['results']:r.update(status='invalidated',measurements=[],criteria=[],reason='Entradas de queda alteradas; recalcule na revisão atual.')
    return dict(request=expected,project=p,analysis=calculate_project(p))
