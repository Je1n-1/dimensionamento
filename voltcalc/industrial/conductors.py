"""Conductor pre-sizing by physical formation and worst thermal segment.

Results are revision-bound analyses, not protection or global compliance verdicts.
"""
import copy
from .contracts import CONTRACT, validate_entity
from .currents import calculate_project as calculate_currents
from .topology import analyze_topology
from .conductor_rules import VERSION, SECTIONS, Pending, require, capacity, temperature_factor, grouping_factor, pe_section

FUTURE = ['Proteção contra sobrecarga e curto-circuito: não verificada.',
          'Seccionamento automático, coordenação, partida e condições de conexão: não verificados.',
          'Queda de tensão: não calculada (Etapa 8). Ocupação: não calculada (Etapa 7).',
          'Temperatura real do condutor: não calculada; não há modelo térmico.']

def route(cable, circuit):
    return cable['segmentIds'] if cable['routeMode']=='selected' else circuit['segmentIds']

def phase_cores(project, cable):
    return [c for c in project['conductors'] if c['cableId']==cable['id'] and c['role'] in ('L1','L2','L3','N')]

def current_for(project, circuit, design, currents):
    consumers = [c for c in project['consumers'] if c['id'] in circuit['consumerIds']]
    auto, notes = None, []
    if len(consumers)==1 and not circuit['destinationPanelIds'] and circuit['role']=='terminal':
        c = consumers[0]
        values = {v['code']:v['value'] for v in currents[c['id']]['measurements']}
        if c['type']=='motor':
            auto = values.get('design_minimum_a') if c['quantity']==1 else None
            notes.append('Motor único: Ib mínimo de 6.5.1.3.1, com fonte e condições verificadas pelo serviço de correntes.')
        elif c['type'] not in ('panel','transformer','drive','other'):
            value = values.get('selected_a')
            auto = value*c['quantity'] if value is not None else None
            notes.append('Carga terminal: corrente por equipamento × quantidade; simultaneidade de 100%, sem demanda.')
        if auto is not None:
            require(c['connection']==design['connection'], 'Ligação do circuito difere da ligação do consumidor usado no cálculo automático.')
            if c['frequency'] is not None:
                require(c['frequency'] in (50,60), 'Frequência fora de 50/60 Hz: modelo de capacidade não aplicável.')
    manual = design['manualIb']
    if manual is not None:
        require(manual>0 and design['manualIbConfirmed'] is True and design['manualIbSource'].strip(), 'Ib informado: informe origem/memória e confirme que considera cargas, regime e condições do circuito.')
        require(auto is None or manual>=auto, 'Ib informado é menor que a corrente de carga/limite mínimo calculável para este circuito.')
        return manual, ['Ib informado pelo usuário; estudo de cargas/grupos não verificado pelo sistema. Fonte: '+design['manualIbSource']]
    require(auto is not None and auto>0, 'Ib pendente: motor requer fonte nominal e condições válidas da Etapa 4; grupos/alimentadores exigem Ib informado com memória de cálculo.')
    return auto, notes+[currents[consumers[0]['id']]['trace']]

def calculate_cable(project, cable, topology, currents):
    result = dict(id=cable['id'], tag=cable['tag'], circuitId=cable['circuitId'], status='pending',
                  ib=None, section=None, neutral=None, pe=None, serviceTemperature=None,
                  material=None, insulation=None, loaded=None, segments=[], candidates=[],
                  pending=[], trace=[], criteria=[])
    try:
        circuits = {c['id']:c for c in project['circuits']}
        circuit = circuits.get(cable['circuitId'])
        require(circuit is not None, 'Vincule a formação a um circuito.')
        result['circuitTag'] = circuit['tag']
        result['consumers'] = [c['tag'] for c in project['consumers'] if c['id'] in circuit['consumerIds']]
        require(not any(i['severity']=='error' for i in topology['issues']), 'Corrija os erros de Caminhos e circuitos antes de calcular condutores.')
        topology_circuit = next((c for c in topology['circuits'] if c['id']==circuit['id']),None)
        require(topology_circuit and topology_circuit['valid'], 'Circuito sem percurso único válido até seus destinos.')
        d = cable['design']
        require(d['scopeConfirmed'] is True, 'Confirme instalação fixa, condutores isolados/cabos sem armação até 0,6/1 kV, 50/60 Hz, regime contínuo e método aplicável; outros casos exigem estudo específico.')
        require(cable['quantity']==1, 'Formações em paralelo exigem divisão de corrente e condições específicas; não implementado.')
        cores = [c for c in project['conductors'] if c['cableId']==cable['id']]
        roles = [c['role'] for c in cores]
        require('PEN' not in roles, 'PEN exige verificações específicas; não implementado nesta etapa.')
        connection = d['connection']
        expected = {'FN':(1,True),'FF':(2,False),'FFN':(2,True),'3F':(3,False),'3FN':(3,True)}
        require(connection in expected, 'Informe a ligação elétrica desta formação.')
        phases, neutral = expected[connection]
        require(len([r for r in roles if r in ('L1','L2','L3')])==phases and roles.count('N')==int(neutral) and len(set(roles))==len(roles), 'Funções de fase/neutro cadastradas não correspondem à ligação; ajuste a formação em Caminhos e circuitos.')
        present_phases={r for r in roles if r in ('L1','L2','L3')}
        phase_names={'A':'L1','B':'L2','C':'L3'}
        for consumer in project['consumers']:
            if consumer['id'] in circuit['consumerIds'] and consumer['phaseSet']:
                require({phase_names[p] for p in consumer['phaseSet']}<=present_phases, 'Fases cadastradas na formação não incluem as fases utilizadas pelos consumidores do circuito.')
        loaded = 3 if connection in ('FFN','3F','3FN') else 2
        if connection in ('FFN','3FN'):
            h=d['harmonicsPercent']
            require(h is not None, 'Informe taxa de terceira harmônica e seus múltiplos para verificar o neutro.')
            require(h<=33, 'Harmônicas acima de 33%: dimensionamento específico de neutro (Anexo F) não implementado.')
            if connection=='3FN' and h>15: loaded=4
        result['loaded']=loaded
        require(circuit['loadedConductors'] in (None,loaded), 'Número declarado de condutores carregados diverge das funções e harmônicas; ajuste-o na estrutura.')
        live=phase_cores(project,cable)
        materials={c['material'] for c in live}; insulations={c['insulation'] for c in live}
        require(len(materials)==1 and next(iter(materials)) in ('Cu','Al'), 'Informe o mesmo material para fases e neutro da formação.')
        require(len(insulations)==1 and next(iter(insulations)) in ('PVC','XLPE','EPR'), 'Informe isolação PVC, XLPE ou EPR comum às fases e neutro.')
        material,insulation=next(iter(materials)),next(iter(insulations))
        result.update(material=material,insulation=insulation,serviceTemperature=70 if insulation=='PVC' else 90)
        if material=='Al': require(d['aluminumConditionsConfirmed'] is True, 'Alumínio industrial: confirmar alimentação por subestação/transformador de AT ou fonte própria, instalação/manutenção BA5 e ausência de locais BD4 (6.2.3.8).')
        require(circuit['purpose'] in ('lighting','power','control'), 'Defina finalidade iluminação, força ou comando para aplicar a seção mínima.')
        require(not (material=='Al' and circuit['purpose']=='control'), 'Tabela 47 não fornece seção mínima de alumínio para comando/sinalização; estudo específico não implementado.')
        minimum = 16 if material=='Al' else {'lighting':1.5,'power':2.5,'control':.5}[circuit['purpose']]
        ib, trace = current_for(project,circuit,d,currents)
        result['ib']=ib;result['trace']+=trace
        ids=route(cable,circuit)
        require(ids, 'Selecione os trechos percorridos pela formação.')
        require(set(ids)<=set(circuit['segmentIds']), 'Formação fora do percurso do circuito.')
        for segment in [s for s in project['segments'] if s['id'] in ids]:
            prefix=segment['tag']+': '
            t=segment['thermal'];method=segment['installationMethod']
            require(t['methodConfirmed'] is True, prefix+'confirme a correspondência do método com a tabela 33, formação, disposição e afastamentos físicos.')
            require(t['noRadiation'] is True, prefix+'radiação solar/infravermelha desconhecida ou presente exige estudo NBR 11301; tabela 40 não cobre esse aquecimento.')
            if method in ('A2','B2','E'): require(cable['formation']=='multicore', prefix+'método selecionado requer cabo multipolar.')
            if method in ('F','G'): require(cable['formation']=='single_core',prefix+'nesta implementação F/G exigem cabos unipolares e disposição explícita.')
            if method in ('C','D'): require(cable['formation'] in ('single_core','multicore'),prefix+'condutores isolados nesta disposição exigem condições especiais não implementadas.')
            require(cable['formation'] in ('insulated','single_core','multicore'),prefix+'informe formação do cabo.')
            analyzed=next(s for s in topology['segments'] if s['id']==segment['id'])
            require(analyzed['complete'],prefix+'formações/funções incompletas no trecho compartilhado.')
            group=[b for b in project['cables'] if b['circuitId'] in circuits and segment['id'] in route(b,circuits[b['circuitId']])]
            require(all(b['quantity']==1 for b in group),prefix+'grupo contém formações em paralelo; estudo específico pendente.')
            require(len(group)==len(set(b['circuitId'] for b in group)),prefix+'formações do mesmo circuito sobrepostas; distribuição da corrente não implementada.')
            for b in group:
                other=phase_cores(project,b)
                require(other and all(c['insulation'] in ('PVC','XLPE','EPR') for c in other),prefix+'informe isolação dos demais circuitos agrupados.')
                require(all((c['insulation']=='PVC')==(insulation=='PVC') for c in other),prefix+'grupo com temperaturas máximas de serviço distintas exige cálculo pela menor temperatura; combinação não implementada.')
            homogeneous = t['grouping'] in ('bundle','wall','ceiling','perforated','ladder','layers','direct','buried_multi','buried_single') and len(group)>1
            other_sections = [c['section'] for b in group if b['id']!=cable['id'] for c in phase_cores(project,b)]
            if homogeneous:
                require(all(s in SECTIONS for s in other_sections),prefix+'grupo homogêneo: informe seções adotadas dos outros circuitos para comparar a faixa de três seções; caso contrário, exige estudo específico ou F=1/√n nas disposições implementadas ao ar.')
            if method=='D':
                if t['grouping']=='buried_multi': require(all(b['formation']=='multicore' for b in group),prefix+'tabela 45 selecionada exige um cabo multipolar por eletroduto.')
                if t['grouping']=='buried_single': require(all(b['formation']=='single_core' for b in group),prefix+'tabela 45 selecionada exige um unipolar por eletroduto; confirmar condições eletromagnéticas.')
            if t['grouping']=='layers': require(all(b['formation']=='multicore' or len([c for c in phase_cores(project,b) if c['role']!='N'])==3 for b in group),prefix+'tabela 43 exige circuitos trifásicos ou cabos multipolares.')
            ft,temp=temperature_factor(segment['temperature'],insulation,method=='D')
            fg,fs,reference=grouping_factor(segment,len(group))
            fn=.86 if loaded==4 else 1
            # Validate method/arrangement before enumerating sections.
            capacity(method,material,insulation,loaded,d['arrangement'],minimum)
            result['segments'].append(dict(id=segment['id'],tag=segment['tag'],method=method,
                temperature=segment['temperature'],adoptedTemperature=temp,ft=ft,fg=fg,fs=fs,fn=fn,
                factor=ft*fg*fs*fn,circuits=len(group),reference=reference,
                homogeneousSections=other_sections if homogeneous else [],
                requiredTableCapacity=ib/(ft*fg*fs*fn)))
        require(len(result['segments'])==len(set(ids)), 'Há trechos ausentes na formação.')
        for section in SECTIONS:
            if material=='Al' and section<16: continue
            candidate=dict(section=section,minimum=section>=minimum,ampacity=None,passes=False,segments=[],reason='')
            try:
                for row in result['segments']:
                    if row['homogeneousSections']:
                        indices=[SECTIONS.index(s) for s in row['homogeneousSections']+[section]]
                        require(max(indices)-min(indices)<=2, 'Seção fora da faixa homogênea declarada do grupo; use estudo específico ou F=1/√n.')
                    iz,table=capacity(row['method'],material,insulation,loaded,d['arrangement'],section)
                    candidate['segments'].append(dict(id=row['id'],table=table,iz=iz,corrected=iz*row['factor']))
                candidate['ampacity']=min(r['corrected'] for r in candidate['segments'])
                candidate['passes']=candidate['minimum'] and candidate['ampacity']>=ib
                if not candidate['passes']: candidate['reason']='Seção mínima' if not candidate['minimum'] else 'Capacidade inferior a Ib'
            except Pending as e: candidate['reason']=str(e)
            result['candidates'].append(candidate)
        selected=next((c for c in result['candidates'] if c['passes']),None)
        require(selected is not None, 'Nenhuma seção disponível atende aos critérios implementados; não extrapolar tabelas.')
        result.update(section=selected['section'],neutral=selected['section'] if neutral else None,status='calculated')
        result['criteria']=[dict(code='ampacity',status='verified',reason='Ib ≤ Iz corrigida em todos os trechos; 6.2.5.8.'),dict(code='minimum',status='verified',reason=f'Seção mínima {minimum:g} mm²; tabela 47.')]
        result['trace'].append('Iz corrigida = Iz tabela × Ft × Fg × Fsolo × Fneutro. Temperaturas intermediárias arredondadas para a próxima classe superior; sem extrapolação. O trecho de menor capacidade governa a formação. Neutro sem redução de seção.')
        pe=next((c for c in cores if c['role']=='PE'),None)
        try:
            require(pe and pe['material']==material, 'PE ausente ou de material diferente das fases: tabela 58 simplificada não aplicável.')
            result['pe']=pe_section(selected['section'],material,d['peLocation'])
            result['criteria'].append(dict(code='pe_section',status='verified',reason='Seção pela tabela 58 e mínimo de 6.4.3.1.4; função de proteção/curto-circuito ainda não verificada.'))
        except Pending as e: result['pending'].append(str(e))
        for core in live:
            if core['section'] is not None:
                adopted=next((c for c in result['candidates'] if c['section']==core['section']),None)
                result['trace'].append(f"Seção cadastrada {core['role']}={core['section']:g} mm²: {'atende aos critérios calculados' if adopted and adopted['passes'] else 'não atende ou não consta da tabela'}. Não alterada automaticamente.")
                if not adopted or not adopted['passes']:
                    result['pending'].append(f"Revisar seção cadastrada de {core['role']}: {core['section']:g} mm² não atende aos critérios calculados ou não consta da tabela.")
    except Pending as e:
        result['pending'].append(str(e))
    result['pending']+=FUTURE
    return result

def calculate_project(project):
    errors=validate_entity('Project',project)
    if errors: raise ValueError('Contrato industrial inválido: '+errors[0]['path'])
    topology=analyze_topology(project)
    currents={r['targetId']:r for r in calculate_currents(project)}
    return dict(projectId=project['id'],inputRevision=project['revision'],version=VERSION,
                results=[calculate_cable(project,c,topology,currents) for c in project['cables']])

def conductor_request(payload):
    project,token=payload.get('project'),payload.get('request')
    if not isinstance(project,dict) or not isinstance(token,dict): raise ValueError('Envie projeto e requisição de condutores.')
    expected=dict(projectId=project.get('id'),inputRevision=project.get('revision'),domain='conductors',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)
    if token!=expected or any(type(token.get(k)) is not type(v) for k,v in expected.items()): raise ValueError('Requisição de condutores desatualizada.')
    if validate_entity('Project',project): raise ValueError('Projeto inválido; nenhum dado alterado.')
    p=copy.deepcopy(project)
    operation=payload.get('operation')
    if operation is not None:
        if not isinstance(operation,dict) or set(operation)!={'collection','id','data'} or operation['collection'] not in ('cables','segments'): raise ValueError('Operação de condições inválida.')
        item=next((i for i in p[operation['collection']] if i['id']==operation['id']),None)
        if item is None: raise ValueError('Item não encontrado.')
        data=operation['data']
        allowed={'design','material','insulation','adoptedSection'} if operation['collection']=='cables' else {'thermal','installationMethod','temperature','soilDepth','soilResistivity'}
        if not isinstance(data,dict) or not set(data)<=allowed: raise ValueError('Campos de condições inválidos.')
        if operation['collection']=='cables':
            if 'adoptedSection' in data:
                for core in p['conductors']:
                    if core['cableId']==item['id'] and core['role'] in ('L1','L2','L3','N'): core['section']=data['adoptedSection']
            for key in ('material','insulation'):
                if key in data:
                    for core in p['conductors']:
                        if core['cableId']==item['id']: core[key]=data[key]
            if 'design' in data:item['design']=copy.deepcopy(data['design'])
        else: item.update(copy.deepcopy(data))
        if validate_entity('Project',p): raise ValueError('Condições fora do contrato; nenhum dado alterado.')
        p['revision']+=1;p['currentStage']=max(p['currentStage'],6)
        for r in p['results']: r.update(status='invalidated',measurements=[],criteria=[],reason='Condições de condutores alteradas; recalcule.')
    return dict(request=expected,project=p,analysis=calculate_project(p))
