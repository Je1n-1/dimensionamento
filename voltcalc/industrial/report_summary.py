"""Editorial projection of existing results; no electrical calculations."""
from .reports import block, scalar


def summary_sections(project, analysis, pending, service_versions):
    sections=[]

    def add(title, columns, rows):
        sections.append(dict(title=title, blocks=[block(title, rows, columns)] if rows else []))

    def criteria(result):
        if not result.get('criteria'):return 'Não avaliados'
        counts={status:sum(c['status']==status for c in result.get('criteria',[]))
                for status in ('verified','failed','pending')}
        return f"{counts['verified']} atendidos; {counts['failed']} falhos; {counts['pending']} pendentes"

    def compact_origins(origins):
        groups={}
        for origin in origins:
            if ' / ' in origin:domain,item=origin.rsplit(' / ',1)
            elif origin.startswith('Corrente '):domain,item='Corrente',origin[9:]
            else:domain,item=origin,''
            groups.setdefault(domain,[]).append(item)
        return '\n'.join(domain+(': '+', '.join(items) if any(items) else '') for domain,items in groups.items())

    currents={r['targetId']:r for r in analysis['currents']}
    rows=[]
    for consumer in project['consumers']:
        result=currents.get(consumer['id'],{})
        values={m['code']:m['value'] for m in result.get('measurements',[])}
        rows.append([consumer['tag']+' / '+consumer.get('description',''),scalar(consumer['type']),
            scalar(consumer['quantity']),scalar(values.get('electrical_total_w')),
            scalar(values.get('selected_a')),scalar(result.get('currentSource')),
            scalar(result.get('status','not_calculated'))])
    add('Cargas e correntes', ['Consumidor','Tipo','Qtd.','Potência ativa do registro (W)',
                             'Corrente por equipamento (A)','Fonte','Situação'],rows)
    add('Condutores - seções sugeridas',
        ['Formação / circuito','Ib (A)','Fase / N / PE (mm²)','Situação','Critérios calculados'],
        [[r['tag']+' / '+r.get('circuitTag',''),scalar(r.get('ib')),
          ' / '.join(scalar(r.get(k)) for k in ('section','neutral','pe')),
          scalar(r['status']),criteria(r)] for r in (analysis['conductors'] or {}).get('results',[])])
    add('Infraestrutura - ocupação geométrica',
        ['Trecho','Envoltórias','Ocupação / limite (%)','Situação','Critérios calculados'],
        [[r['tag'],scalar(r.get('count')),scalar(r.get('occupancy'))+' / '+scalar(r.get('limit')),
          scalar(r['status']),criteria(r)] for r in (analysis['infrastructure'] or {}).get('results',[])])
    add('Queda de tensão - regime permanente',
        ['Carga','Percurso (m)','Total / limite (%)','Terminal / limite (%)','Situação','Critérios calculados'],
        [[r['tag'],scalar(r.get('distance')),scalar(r.get('totalPercent'))+' / '+scalar(r.get('totalLimit')),
          scalar(r.get('terminalPercent'))+' / '+scalar(r.get('terminalLimit')),scalar(r['status']),criteria(r)]
         for r in (analysis['voltage'] or {}).get('results',[])])
    # Group identical reasons only; retain every affected origin and every message.
    grouped={}
    for origin,reason in pending:
        origins=grouped.setdefault(reason,[])
        if origin not in origins:origins.append(origin)
    add('Pendências e limites - motivos agrupados', ['Itens afetados','Pendência / limite'],
        [[compact_origins(origins),reason] for reason,origins in grouped.items()])
    add('Versões e rastreabilidade', ['Serviço','Versão'],[[key,str(value)] for key,value in service_versions.items()])
    return sections
