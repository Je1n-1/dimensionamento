"""Stage 7. Physical envelopes follow the actual topology; missing data stays pending."""
import copy
import hashlib
import json
import math

from .contracts import CONTRACT, create_entity, validate_entity
from .topology import analyze_topology
from .infrastructure_rules import VERSION, REFERENCE, circular_area, conduit_geometry, continuous_route


def physical_signature(project, collection, item):
    cores = ([item] if collection == 'conductors' else
             [c for c in project['conductors'] if c['cableId'] == item['id']])
    data = sorted([[c['role'], c['section'], c['material'], c['insulation'], c['formation']] for c in cores], key=str)
    # Stable across project duplication; identities and routes do not affect a product's diameter.
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def catalog_source(source):
    return (source['kind'] == 'catalog' and
            all(str(source[k]).strip() for k in ('manufacturer', 'model', 'reference')))


def referenced(source):
    return source['kind'] in ('catalog', 'manual') and bool(source['reference'].strip())


def physical_items(project, segment):
    circuits = {c['id']: c for c in project['circuits']}
    items = []
    for cable in project['cables']:
        circuit = circuits.get(cable['circuitId'])
        if circuit is None:
            continue
        route = circuit['segmentIds'] if cable['routeMode'] == 'circuit' else cable['segmentIds']
        if segment['id'] not in route:
            continue
        cores = [c for c in project['conductors'] if c['cableId'] == cable['id']]
        members = [('cables', cable)] if cable['formation'] == 'multicore' else [('conductors', c) for c in cores]
        for collection, item in members:
            signature = physical_signature(project, collection, item)
            valid = (item['outerDiameter'] is not None and catalog_source(item['source']) and
                     item['physicalSignature'] == signature and
                     all(c['section'] is not None and c['material'] and c['insulation'] for c in (cores if collection == 'cables' else [item])))
            items.append(dict(id=item['id'], collection=collection, cableId=cable['id'],
                              label=cable['tag'] + (' · multipolar' if collection == 'cables' else ' · ' + str(item['role'])),
                              quantity=cable['quantity'], outerDiameter=item['outerDiameter'],
                              source=item['source'], valid=bool(valid)))
    return items


def analyze_segment(project, segment, topology):
    row = dict(id=segment['id'], tag=segment['tag'], status='pending', count=None,
               area=None, occupancy=None, limit=None, minimumDiameter=None, minimumWidth=None,
               minimumHeight=None, suggestedDiameter=None, criteria=[], pending=[], trace=[], items=[])
    def criterion(code, passed, message):
        row['criteria'].append(dict(code=code,status='verified' if passed else 'failed',message=message))
    t = next(t for t in topology['segments'] if t['id'] == segment['id'])
    row['items'] = physical_items(project, segment)
    if not t['complete'] or any(not c['valid'] for c in topology['circuits']):
        row['pending'].append('Complete os caminhos, vínculos e formações em Consumidores e cargas → Caminhos e circuitos.')
        return row
    if any(c['cableId'] is None for c in project['conductors']):
        row['pending'].append('Há condutores sem formação no projeto; vincule-os antes de verificar as contagens.')
        return row
    row['count'] = sum(i['quantity'] for i in row['items'])
    if not row['count']:
        row['pending'].append('Nenhum elemento físico atravessa este trecho.')
        return row
    if any(not i['valid'] for i in row['items']):
        row['pending'] += [i['label'] + ': confirme seção/material/isolação, diâmetro externo e referência do fabricante para esta construção.' for i in row['items'] if not i['valid']]
        return row
    row['area'] = sum(circular_area(i['outerDiameter']) * i['quantity'] for i in row['items'])
    if not math.isfinite(row['area']):
        raise ValueError('Área fora do intervalo numérico.')
    row['trace'].append('Área ocupada = Σ quantidade × π × diâmetro externo² / 4, em mm². Inclui PE e neutro; multipolar conta uma envoltória, sem somar novamente suas veias.')
    infrastructures = [i for i in project['infrastructures'] if i['segmentId'] == segment['id']]
    if len(infrastructures) != 1:
        row['pending'].append('Cadastre uma infraestrutura para o trecho. Múltiplos condutos no mesmo trecho exigem repartição física ainda não implementada.')
        return row
    infra = infrastructures[0]
    for key, label in (('dimensionSource','Referência dimensional'),('limitSource','Critério de arranjo')):
        source = infra[key]
        if referenced(source):
            row['trace'].append(label + ': ' + ' · '.join(source[k] for k in ('manufacturer','model','edition','reference') if source[k]))
    if infra['conductorIds']:
        row['pending'].append('Seleção parcial de condutores não suportada: esta análise exige todos os elementos do trecho na mesma infraestrutura.')
        return row
    if infra['type'] == 'conduit':
        row.update(conduit_geometry(row['area'], row['count'], infra['innerDiameter']))
        row['trace'].append(REFERENCE + '. Diâmetro mínimo calculado é interno; não é bitola comercial nem garante enfiação.')
        if infra['innerDiameter'] is None or not referenced(infra['dimensionSource']):
            row['pending'].append('Informe diâmetro interno útil do eletroduto e sua referência dimensional.')
        else:
            criterion('occupancy', row['occupancy'] <= row['limit'] + 1e-9,
                      f"Ocupação {row['occupancy']:.3f}% / limite {row['limit']}% — {REFERENCE}.")
        if infra['candidateDiameters'] and referenced(infra['dimensionSource']):
            row['suggestedDiameter'] = next((d for d in sorted(set(infra['candidateDiameters'])) if d + 1e-9 >= row['minimumDiameter']), None)
            if row['suggestedDiameter'] is None:
                row['pending'].append('Nenhum diâmetro interno da lista informada atende à ocupação; não extrapolado.')
        if infra['routeConfirmed'] is not True or infra['continuousLength'] is None or infra['location'] is None or infra['bends90'] is None:
            row['pending'].append('Informe o percurso contínuo entre caixas/extremidades, localização e curvas de 90°, confirmando os limites desse percurso.')
        elif segment['length'] is None or infra['continuousLength'] < segment['length']:
            row['pending'].append('O percurso contínuo informado é menor que este segmento físico. Divida o segmento nas caixas reais ou corrija o comprimento.')
        else:
            check = continuous_route(infra['continuousLength'], infra['bends90'], infra['location'])
            criterion('pull_length', check['lengthPasses'], f"Comprimento contínuo {infra['continuousLength']:g} m; máximo {check['maximumLength']:g} m — 6.2.11.1.6-b. Exceção por aumento de tamanho nominal não implementada.")
            criterion('bends', check['bendsPass'], 'Até três curvas de 90° por percurso — 6.2.11.1.7. Outros ângulos exigem estudo específico.')
    elif infra['type'] in ('tray','solid_tray','perforated_tray','ladder'):
        if infra['width'] is not None and infra['height'] is not None:
            area = infra['width'] * infra['height']
            if not math.isfinite(area) or area <= 0:
                raise ValueError('Área útil fora do intervalo numérico.')
            row['occupancy'] = row['area'] / area * 100
        if any(c['formation'] == 'insulated' for c in project['cables'] if c['id'] in {i['cableId'] for i in row['items']}):
            row['pending'].append('Condutores apenas isolados neste encaminhamento exigem verificação específica de instalação; não suportado nesta análise.')
        if infra['arrangement'] != 'single_layer' or infra['spacing'] is None:
            row['pending'].append('Defina arranjo em camada única e espaçamento livre entre envoltórias. Outros arranjos exigem estudo específico.')
        else:
            row['minimumWidth'] = sum(i['outerDiameter']*i['quantity'] for i in row['items']) + (row['count']-1)*infra['spacing']
            row['minimumHeight'] = max(i['outerDiameter'] for i in row['items'])
            if not math.isfinite(row['minimumWidth']):
                raise ValueError('Espaçamento fora do intervalo numérico.')
            row['trace'].append('Largura livre mínima = soma dos diâmetros + (quantidade − 1) × espaçamento. Altura livre mínima = maior diâmetro. Limites geométricos, sem reserva/margens automáticas.')
            if not all(infra[k] is not None for k in ('width','height')) or not referenced(infra['dimensionSource']):
                row['pending'].append('Informe largura/altura internas úteis e a referência dimensional da infraestrutura.')
            elif not referenced(infra['limitSource']) or infra['arrangementConfirmed'] is not True:
                row['pending'].append('Registre o critério de projeto/instrução de fabricante e confirme arranjo, espaçamento e ventilação aplicáveis.')
            else:
                criterion('arrangement', infra['width'] >= row['minimumWidth'] and infra['height'] >= row['minimumHeight'], 'Encaixe em camada única pelo critério declarado: ' + infra['limitSource']['reference'])
                if infra['occupancyLimit'] is not None:
                    row['limit'] = infra['occupancyLimit']
                    criterion('project_occupancy', row['occupancy'] <= row['limit'], 'Limite adicional de projeto/fabricante; não é limite universal da NBR 5410.')
    else:
        row['pending'].append('Tipo de encaminhamento sem modelo geométrico implementado. Informe uma solução suportada ou registre estudo específico.')
    failed = any(c['status'] == 'failed' for c in row['criteria'])
    row['status'] = 'review' if failed else 'pending' if row['pending'] else 'calculated'
    return row


def calculate_project(project):
    if validate_entity('Project', project):
        raise ValueError('Projeto inválido para infraestrutura.')
    topology = analyze_topology(project)
    return dict(projectId=project['id'], inputRevision=project['revision'], version=VERSION,
                results=[analyze_segment(project,s,topology) for s in project['segments']],
                limitations=['Verificação geométrica parcial. Solicitações mecânicas, suportação, caixas/acessibilidade, separação de circuitos, requisitos de produto, continuidade e proteção não verificados.',
                             'Ocupação não substitui capacidade de corrente, agrupamento, proteção ou queda de tensão.'])


def infrastructure_request(payload):
    project, token = payload.get('project'), payload.get('request')
    if not isinstance(project,dict) or not isinstance(token,dict):
        raise ValueError('Envie projeto e requisição de infraestrutura.')
    expected=dict(projectId=project.get('id'),inputRevision=project.get('revision'),domain='infrastructure',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)
    if token != expected or any(type(token.get(k)) is not type(v) for k,v in expected.items()):
        raise ValueError('Requisição de infraestrutura desatualizada.')
    if validate_entity('Project',project):
        raise ValueError('Projeto inválido; nenhum dado alterado.')
    p=copy.deepcopy(project)
    operation=payload.get('operation')
    if operation is not None:
        if not isinstance(operation,dict) or set(operation)!={'collection','id','data'}:
            raise ValueError('Operação de infraestrutura inválida.')
        collection=operation['collection']; data=operation['data']
        if collection not in ('infrastructures','conductors','cables') or not isinstance(data,dict):
            raise ValueError('Coleção de infraestrutura inválida.')
        allowed=({'type','width','height','innerDiameter','dimensionSource','arrangement','spacing','occupancyLimit','limitSource','location','continuousLength','bends90','routeConfirmed','arrangementConfirmed','candidateDiameters','notes','segmentId'} if collection=='infrastructures' else {'outerDiameter','source'})
        if not set(data)<=allowed:
            raise ValueError('Campos de infraestrutura inválidos.')
        item=next((i for i in p[collection] if i['id']==operation['id']),None)
        if item is None:
            if collection!='infrastructures' or operation['id'] is not None:
                raise ValueError('Item não encontrado.')
            item=create_entity('Infrastructure');p[collection].append(item)
        item.update(copy.deepcopy(data))
        if collection=='infrastructures':
            if not item['segmentId'] or sum(i['segmentId']==item['segmentId'] for i in p['infrastructures'])!=1:
                raise ValueError('Selecione um trecho sem outra infraestrutura; múltiplos condutos exigem repartição específica.')
        else:
            if collection=='cables' and item['formation']!='multicore':
                raise ValueError('Diâmetro da formação é exclusivo de cabos multipolares; informe o de cada unipolar/condutor isolado.')
            if collection=='conductors' and item['formation']=='multicore':
                raise ValueError('Informe a envoltória multipolar, não o diâmetro de suas veias.')
            item['physicalSignature']=physical_signature(p,collection,item)
        if validate_entity('Project',p):
            raise ValueError('Dados físicos fora do contrato; nenhum dado alterado.')
        # Conservative: geometry edits may change installation and thermal grouping.
        for s in p['segments']:
            s['thermal']['methodConfirmed']=None;s['thermal']['groupingConfirmed']=None
        for cable in p['cables']:
            cable['design']['scopeConfirmed']=None
        p['revision']+=1;p['currentStage']=max(p['currentStage'],7)
        for r in p['results']:
            r.update(status='invalidated',measurements=[],criteria=[],reason='Dados físicos de infraestrutura alterados; recalcule os critérios afetados.')
    return dict(request=expected,project=p,analysis=calculate_project(p))
