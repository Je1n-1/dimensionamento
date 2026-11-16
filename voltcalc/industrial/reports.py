"""Stage 10: recompute a revision-bound report; never trust saved numeric results."""
import base64
import csv
import hashlib
import io
import json
from datetime import datetime, timezone
from .contracts import CONTRACT, validate_entity
from .overview import calculate_project

VERSION = 'industrial-report-1'
LIMITS = ('Verificação parcial. Não constitui declaração de conformidade integral. '
          'Proteção, curto-circuito, coordenação, partida, esquemas de aterramento, harmônicas e demais condições fora dos serviços implementados permanecem não verificadas. '
          'Fontes de placa, catálogo e dados manuais são declarações do usuário. '
          'Seções sugeridas não substituem as seções adotadas no cadastro. Valores ausentes não são considerados zero. '
          'Potência consolidada é soma dos registros de cargas, sem demanda e sem balanço de energia de cadeias transformador/acionamento/motor.')
LABELS = dict(name='Nome', description='Descrição', type='Tipo', tag='Identificação', quantity='Quantidade', power='Potência por equipamento',
    unit='Unidade', powerBasis='Base da potência', voltage='Tensão (V)', frequency='Frequência (Hz)', powerFactor='Fator de potência',
    efficiency='Rendimento', connection='Ligação', phaseSet='Fases utilizadas', balanced='Equilíbrio declarado',
    length='Comprimento físico (m)', temperature='Temperatura (°C)', section='Seção (mm²)', material='Material', insulation='Isolação',
    formation='Formação', role='Função', installationMethod='Método de instalação', environment='Ambiente', notes='Observações',
    source='Fonte', manufacturer='Fabricante', model='Modelo', edition='Edição', reference='Referência', kind='Tipo de referência',
    currentSource='Fonte da corrente', trace='Memória de cálculo', pending='Pendências / limites', criteria='Critérios',
    reason='Justificativa', message='Descrição do critério', status='Situação', value='Valor', code='Grandeza / critério',
    mechanical_w='Potência mecânica por equipamento (W)', electrical_w='Potência ativa por equipamento (W)', apparent_va='Potência aparente por equipamento (VA)',
    electrical_total_w='Potência ativa do registro (W)', apparent_total_va='Potência aparente do registro (VA)',
    nominal_a='Corrente nominal por equipamento (A)', calculated_a='Corrente estimada por equipamento (A)', selected_a='Corrente utilizada por equipamento (A)',
    design_minimum_a='Ib mínimo de motor (A)', ib='Ib (A)', neutral='Neutro sugerido (mm²)', pe='PE sugerido (mm²)',
    totalDrop='Queda total (V)', totalPercent='Queda total (%)', terminalPercent='Queda terminal (%)',
    totalLimit='Limite total (%)', terminalLimit='Limite terminal (%)', distance='Percurso completo (m)',
    resistance='R AC (ohm/km)', reactance='X (ohm/km)', occupancy='Ocupação (%)', limit='Limite (%)',
    outerDiameter='Diâmetro externo (mm)', innerDiameter='Diâmetro interno (mm)', width='Largura útil (mm)', height='Altura útil (mm)',
    ft='Fator de temperatura', fg='Fator de agrupamento', factor='Fator combinado', requiredTableCapacity='Capacidade tabelada necessária (A)',
    measurements='Grandezas', segments='Trechos', supply='Alimentação', voltagePolicy='Origem e limites de queda',
    storageRevision='Revisão de gravação', revision='Revisão elétrica', schemaVersion='Versão do contrato',
    workflowStatus='Status organizacional', createdAt='Criação', updatedAt='Última gravação', currentStage='Etapa registrada',
    fromNodeId='Origem', toNodeId='Destino', originPanelId='Quadro de origem', destinationPanelIds='Quadros atendidos',
    consumerIds='Consumidores atendidos', segmentIds='Percurso', cableId='Formação', circuitId='Circuito', consumerId='Consumidor',
    position='Posição gráfica (sem escala física)', serviceTemperature='Limite de serviço da isolação (°C)')
VALUES = dict(pending='Pendente', calculated='Calculado (escopo parcial)', review='Revisar', verified='Critério verificado e atendido',
    failed='Critério não atendido', not_implemented='Não implementado', not_calculated='Não calculado', invalidated='Invalidado',
    formula='Fórmula', plate='Placa', catalog='Catálogo', manual='Manual', motor='Motor', lighting='Iluminação', heating='Aquecimento',
    panel='Quadro', transformer='Transformador', drive='Acionamento', other='Outra carga')
HISTORICAL = 'Queda de tensão: não calculada (Etapa 8). Ocupação: não calculada (Etapa 7).'
LABELS.update(segmentId='Trecho', originNodeId='Ponto de origem', entityId='Elemento associado', label='Nome do ponto',
    normativeProfile='Perfil normativo', origin='Origem da alimentação', originConfirmed='Origem confirmada',
    thermal='Condições térmicas', methodConfirmed='Método confirmado', groupingConfirmed='Agrupamento confirmado',
    riskAcknowledged='Limitações reconhecidas', grouping='Critério de agrupamento', circuits='Circuitos',
    purpose='Finalidade', design='Condições de projeto', scopeConfirmed='Escopo confirmado', peLocation='Localização do PE',
    voltageImpedance='Impedância para queda', voltageStudy='Estudo de queda', confirmed='Confirmação',
    routeMode='Arranjo dos condutores', loaded='Condutores carregados', adoptedTemperature='Temperatura adotada (°C)',
    referenceScope='Escopo da referência', minimumDiameter='Diâmetro mínimo (mm)', minimumWidth='Largura mínima (mm)',
    minimumHeight='Altura mínima (mm)', suggestedDiameter='Diâmetro sugerido (mm)', count='Quantidade de envoltórias',
    collection='Origem do registro', valid='Dados válidos', total_drop='Queda no percurso completo', terminal_drop='Queda no circuito terminal',
    ampacity='Capacidade de condução', minimum='Seção mínima', circuitTag='Identificação do circuito',
    startingStatus='Verificação da partida', contribution='Contribuição na queda (%)', equivalentDrop='Queda equivalente (V)',
    excluded='Condições excluídas', conditions='Condições de cálculo', serviceFactor='Fator de serviço', poles='Número de polos',
    plateCurrent='Corrente de placa (A)', catalogCurrent='Corrente de catálogo (A)', measuredCurrent='Corrente informada (A)')
VALUES.update(draft='Em edição', archived='Arquivado', active='Ativo', electrical='Potência elétrica ativa',
    mechanical='Potência mecânica', apparent='Potência aparente', power='Força', terminal='Terminal',
    feeder='Alimentador', single_core='Unipolares', multicore='Multipolar', insulated='Condutores isolados',
    circuit='Mesmo percurso do circuito', included='Incluído', conservative='Conservador', trunk='Trecho principal',
    conduit='Eletroduto', delivery_lv='Entrega em baixa tensão', conductors='Condutores')


def versions():
    return dict(report=VERSION, contract=CONTRACT['version'], engine=CONTRACT['engineVersion'],
        **{k:CONTRACT[k]['version'] for k in ('currentRules','topology','conductorRules','infrastructureRules','voltageRules','overview')})


def input_digest(p):
    # Saved results have no authority; presentation and input data do.
    data={k:v for k,v in p.items() if k!='results'}
    return hashlib.sha256(json.dumps(data,sort_keys=True,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()).hexdigest()


def scalar(v, names=None):
    if v is None:return 'Não informado / não calculado'
    if v is True:return 'Sim'
    if v is False:return 'Não'
    if isinstance(v,(int,float)):return format(v,'.6g').replace('.',',')
    return (names or {}).get(v,VALUES.get(v,LABELS.get(v,v))) or 'Não informado'


def flatten(value, names, prefix='', omit_empty=False):
    rows=[]
    if omit_empty and (value is None or value=='' or value==[]):return rows
    if isinstance(value,dict):
        for k,v in value.items():
            if k in ('id','signature','inputRevision','engineVersion','rulesVersion'):continue
            rows.extend(flatten(v,names,(prefix+' / ' if prefix else '')+LABELS.get(k,k),omit_empty))
    elif isinstance(value,list):
        for i,v in enumerate(value):
            if v==HISTORICAL:continue
            rows.extend(flatten(v,names,f'{prefix} [{i+1}]',omit_empty))
        if not value:rows.append([prefix,'Sem registros'])
    else:
        # Long traces become separate rows so a single table row never exceeds a page.
        text=str(scalar(value,names))
        lines=text.splitlines() or ['']
        for line in lines:
            for start in range(0,max(1,len(line)),600):rows.append([prefix,line[start:start+600]])
    return rows


def block(title, rows, columns=None):
    return dict(title=title,columns=columns or ['Parâmetro','Valor'],rows=rows or [['Registros','Nenhum']])


def diagram(p):
    degrees={n['id']:0 for n in p['nodes']};out={id:[] for id in degrees};depth={}
    for s in p['segments']:
        if s['fromNodeId'] in out and s['toNodeId'] in degrees:
            out[s['fromNodeId']].append(s['toNodeId']);degrees[s['toNodeId']]+=1
    queue=[id for id in degrees if not degrees[id]]
    for id in queue:depth[id]=0
    for id in queue:
        for target in out[id]:
            depth[target]=max(depth.get(target,0),depth[id]+1);degrees[target]-=1
            if not degrees[target]:queue.append(target)
    rows={};nodes=[]
    for n in p['nodes']:
        d=depth.get(n['id'],0);row=rows.get(d,0);rows[d]=row+1
        nodes.append(dict(id=n['id'],label=n['label'],kind=n['kind'],**(n['position'] or dict(x=60+d*260,y=60+row*140))))
    return dict(nodes=nodes,edges=[dict(id=s['id'],tag=s['tag'],fromId=s['fromNodeId'],toId=s['toNodeId'],length=s['length']) for s in p['segments']])


def build_report(p):
    if validate_entity('Project',p) or not p['name'].strip():raise ValueError('Projeto inválido para relatório.')
    a=calculate_project(p)
    names={p['id']:p['name']}
    for values in p.values():
        if isinstance(values,list):
            for item in values:
                if isinstance(item,dict) and 'id' in item:names[item['id']]=item.get('tag') or item.get('label') or item.get('role') or item['id']
    for item in p['infrastructures']:
        names[item['id']]='Infraestrutura / '+names.get(item.get('segmentId'),'trecho não informado')
    for item in p['motors']:
        names[item['id']]='Motor / '+names.get(item.get('consumerId'),'consumidor não informado')
    sections=[]
    basics={k:v for k,v in p.items() if not isinstance(v,list) and k!='id'}
    sections.append(dict(title='Dados gerais e versões',blocks=[block('Projeto',flatten(basics,names,omit_empty=True)),block('Versões dos serviços',flatten(versions(),{}))]))
    for key,title in [('consumers','Consumidores e cargas'),('motors','Dados e fontes dos motores'),('panels','Quadros'),('nodes','Pontos e posições'),('segments','Trechos físicos'),('circuits','Circuitos'),('cables','Formações de cabos e impedâncias'),('conductors','Condutores adotados'),('infrastructures','Infraestruturas')]:
        sections.append(dict(title=title,blocks=[block(names[item['id']],flatten(item,names,omit_empty=True)) for item in p[key]]))
    pending=[['Limite geral',LIMITS]]
    pending.extend(['Topologia',i['message']] for i in a['topology']['issues'])
    pending.extend([e['domain'],e['message']] for e in a['errors'])
    for r in a['currents']:
        if r['status']!='calculated' or r.get('reason'):pending.append(['Corrente '+names.get(r['targetId'],''),r['reason']])
    current_blocks=[]
    for r in a['currents']:
        # Historical criterion belongs to the current service; conductor results have their own section.
        data={k:v for k,v in r.items() if k not in ('criteria','targetId','domain')}
        current_blocks.append(block(names.get(r['targetId'],'Consumidor'),flatten(data,names)))
    sections.append(dict(title='Potências, correntes e fontes utilizadas',blocks=current_blocks))
    for domain,title in [('conductors','Dimensionamento de condutores'),('infrastructure','Ocupação e infraestrutura'),('voltage','Queda de tensão em regime permanente')]:
        blocks=[]
        for r in (a[domain] or {}).get('results',[]):
            data={k:v for k,v in r.items() if k not in ('candidates','segments','items')}
            blocks.append(block(r.get('tag') or names.get(r['id'],''),flatten(data,names)))
            # Compact repeated segment/envelope records without discarding their technical fields.
            for key,label in [('segments','Memória por trecho'),('items','Envoltórias físicas')]:
                if not r.get(key):continue
                rows=[]
                for item in r[key]:
                    values=flatten(item,names,omit_empty=True)
                    text='; '.join(f'{k}: {v}' for k,v in values)
                    caption=item.get('tag') or item.get('label') or names.get(item.get('id'),'Item')
                    for start in range(0,max(1,len(text)),600):rows.append([caption,text[start:start+600]])
                blocks.append(block(label+' - '+(r.get('tag') or names.get(r['id'],'')),rows))
            if r.get('candidates'):
                candidates=[]
                for c in r['candidates']:
                    details='; '.join(f"{names.get(s['id'],s['id'])}: tabela {s['table']}, Iz={scalar(s['iz'])} A, corrigida={scalar(s['corrected'])} A" for s in c.get('segments',[]))
                    candidates.append([scalar(c['section']),scalar(c['ampacity']),scalar(c['passes']),c.get('reason',''),details])
                blocks.append(block('Comparação de seções - '+r['tag'],candidates,['mm²','Iz corrigida (A)','Atende','Motivo','Valores por trecho']))
            pending.extend([title+' / '+(r.get('tag') or names.get(r['id'],'')),v] for v in r.get('pending',[]) if v!=HISTORICAL)
            pending.extend([title,c.get('message') or c.get('reason') or c.get('code','')] for c in r.get('criteria',[]) if c['status'] in ('failed','pending'))
        sections.append(dict(title=title,blocks=blocks))
    sections.insert(0,dict(title='Pendências e limites de cobertura',blocks=[block('Revisão necessária',pending,['Origem','Pendência / limite'])]))
    from .report_summary import summary_sections
    return dict(version=VERSION,projectId=p['id'],inputRevision=p['revision'],inputDigest=input_digest(p),
        generatedAt=datetime.now(timezone.utc).isoformat(),projectName=p['name'],summary=a['summary'],versions=versions(),
        status='partial',disclaimer=LIMITS,sections=sections,diagram=diagram(p),
        summarySections=summary_sections(p,a,pending,versions()))


def csv_report(report):
    output=io.StringIO(newline='');writer=csv.writer(output,delimiter=';',lineterminator='\r\n')
    def safe(v):
        text=str(v)
        return "'"+text if text.lstrip().startswith(('=','+','-','@','\t','\r')) else text
    writer.writerow(['Projeto','Revisão','Seção','Item','Linha','Campo','Valor'])
    for section in report['sections']:
        for b in section['blocks']:
            for i,row in enumerate(b['rows'],1):
                for field,value in zip(b['columns'],row):writer.writerow(map(safe,[report['projectName'],report['inputRevision'],section['title'],b['title'],i,field,value]))
    return '\ufeff'+output.getvalue()


def report_request(payload):
    p=payload.get('project');token=payload.get('request');format=payload.get('format','view')
    detail=payload.get('pdfDetail','full')
    if detail not in ('summary','full'):raise ValueError('Detalhamento do PDF inválido.')
    if not isinstance(p,dict) or format not in ('view','pdf','csv'):raise ValueError('Formato de relatório inválido.')
    expected=dict(projectId=p.get('id'),inputRevision=p.get('revision'),domain='reports',version=VERSION)
    if token!=expected or type(token.get('inputRevision')) is not int:raise ValueError('Requisição de relatório desatualizada.')
    report=build_report(p)
    result=dict(request=expected,report=report)
    if format=='csv':result.update(content=csv_report(report),mime='text/csv;charset=utf-8',extension='csv')
    if format=='pdf':
        from .report_pdf import render_pdf
        result.update(content=base64.b64encode(render_pdf(report,detail=detail)).decode(),mime='application/pdf',extension='pdf',pdfDetail=detail)
    return result
