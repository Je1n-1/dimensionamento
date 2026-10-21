"""Importação explícita do quadro de distribuição CSV fornecido como referência."""
import csv
import io
import re
import unicodedata
import uuid

from panel import build_panel


def normalized(value):
    return re.sub(r'[^A-Z0-9]', '', unicodedata.normalize('NFKD', value.upper()).encode('ascii', 'ignore').decode())


def decimal(value, label, optional=False):
    value = value.strip()
    if not value and optional:
        return None
    if ',' in value:
        value = value.replace('.', '').replace(',', '.')
    if not re.fullmatch(r'\d+(?:\.\d+)?', value):
        raise ValueError(f'{label}: número ausente ou inválido.')
    result = float(value)
    if not 0 <= result <= 1e9:
        raise ValueError(f'{label}: valor fora da faixa suportada.')
    return result


def import_csv(text, filename='Quadro de cargas.csv'):
    if not isinstance(text, str) or not text.strip() or len(text) > 2_000_000:
        raise ValueError('Envie um CSV não vazio de até 2 MB.')
    text = text.lstrip('\ufeff')
    rows = list(csv.reader(io.StringIO(text), delimiter=';', strict=True))
    header_index = next((i for i, row in enumerate(rows) if 'CIRCUITO' in [normalized(v) for v in row]), None)
    if header_index is None:
        raise ValueError('Cabeçalho CIRCUITO não encontrado. Use o modelo CSV separado por ponto e vírgula.')
    headers = [normalized(v) for v in rows[header_index]]
    required = ['CIRCUITO', 'DESCRICAO', 'ESQUEMA', 'TENSAO', 'POTENCIATOTALVA', 'POTENCIATOTALW', 'FASES', 'IA', 'DISJUNTORA']
    if any(headers.count(key) != 1 for key in required):
        raise ValueError('Colunas ausentes ou repetidas. Use o mesmo cabeçalho do exemplo de residência.')
    records = []
    for i, row in enumerate(rows[header_index+1:], header_index+2):
        if not any(v.strip() for v in row):
            continue
        if len(row) != len(headers):
            raise ValueError(f'Linha {i}: quantidade de colunas diferente do cabeçalho.')
        record = {h: row[j].strip() for j, h in enumerate(headers) if h}
        record['_line'] = i
        records.append(record)
    total_rows = [r for r in records if normalized(r['CIRCUITO']) == 'TOTAL']
    if len(total_rows) != 1:
        raise ValueError('O arquivo deve conter uma única linha TOTAL com a alimentação da instalação.')
    total = total_rows[0]
    network = total['TENSAO'].replace(' ', '')
    if network not in ('127/220', '220/380') or normalized(total['ESQUEMA']) != '3FNPE':
        raise ValueError('Este importador aceita quadro trifásico 3F+N+PE nas redes 127/220 ou 220/380 V.')
    fn, ff = map(int, network.split('/'))
    supply = dict(phases='tri', network=network, phaseVoltage=fn, lineVoltage=ff)
    data = [r for r in records if r is not total]
    if not 1 <= len(data) <= 300:
        raise ValueError('O CSV deve conter entre 1 e 300 circuitos.')
    circuits, warnings, seen = [], [], set()
    for r in data:
        label = f"Linha {r['_line']}, circuito {r['CIRCUITO']}"
        if not r['CIRCUITO'] or r['CIRCUITO'] in seen:
            raise ValueError(f'{label}: identificação vazia ou repetida.')
        seen.add(r['CIRCUITO'])
        if not r['DESCRICAO'] or len(r['DESCRICAO']) > 70 or len(r['CIRCUITO']) > 30:
            raise ValueError(f'{label}: descrição vazia ou identificação longa demais.')
        schema = normalized(r['ESQUEMA'])
        connection = {'FNPE': 'fn', 'FFPE': 'ff', '2FPE': 'ff', '3FPE': 'tri', '3FNPE': 'tri'}.get(schema)
        phases = normalized(r['FASES']).translate(str.maketrans('RST', 'ABC'))
        expected = {'fn': ('A', 'B', 'C'), 'ff': ('AB', 'BC', 'CA'), 'tri': ('ABC',)}
        if connection not in expected or phases not in expected[connection]:
            raise ValueError(f'{label}: esquema ou fases incompatíveis.')
        voltage = decimal(r['TENSAO'], label+' tensão')
        if voltage != (fn if connection == 'fn' else ff):
            raise ValueError(f'{label}: tensão incompatível com a ligação e com a rede {network}.')
        p, s = decimal(r['POTENCIATOTALW'], label+' W'), decimal(r['POTENCIATOTALVA'], label+' VA')
        if not 0 < p <= s:
            raise ValueError(f'{label}: informe 0 < W ≤ VA. O fator de potência será derivado de W/VA.')
        current = decimal(r['IA'], label+' corrente')
        breaker = decimal(r['DISJUNTORA'], label+' disjuntor', optional=True)
        if breaker is not None and not 0 < breaker <= 10000:
            raise ValueError(f'{label}: disjuntor deve estar entre 0 e 10.000 A, sem incluir zero.')
        kind = 'lighting' if 'ILUMIN' in normalized(r['DESCRICAO']) else 'shower' if 'CHUVEIRO' in normalized(r['DESCRICAO']) else 'sockets' if 'TUG' in normalized(r['DESCRICAO']) else 'other'
        circuits.append(dict(
            id=str(uuid.uuid4()), number=r['CIRCUITO'], description=r['DESCRICAO'], type=kind,
            connection=connection, phaseSet=phases, voltageMode='auto', voltage=voltage, legacyLoaded=None,
            loads=[dict(id=str(uuid.uuid4()), description='Carga total importada', quantity=1, power=s,
                        unit='VA', powerFactor=p/s, efficiency='', distance='')],
            routeMode='linear', installation='', wall='', cableForm='', conduitType='', methodOverride='',
            insulation='', metal='', groupCount='', groupLayout='unknown', temperature='', maxDrop='',
            breakerMode='verify' if breaker else 'auto', breakerCurrent=breaker or '',
            breakerCurve='', i2Factor='', breakingCapacityType='Icn', breakerIcu='', shortIk='',
            soilResistance='', soilDepth='', unknownInstallation=True,
            source=dict(kind='csv', filename=str(filename)[:180], scheme=r['ESQUEMA'], p=p, s=s,
                        current=current, breaker=breaker, phaseSet=phases, voltage=voltage)))
    panel = build_panel(circuits, supply)
    for original, row in zip(data, panel['rows']):
        if abs(float(row['ib'])-decimal(original['IA'], 'Corrente')) > .011:
            warnings.append(f"Circuito {row['number']}: corrente do CSV difere da calculada por VA/tensão.")
        for phase, name in zip('ABC', 'RST'):
            for key, computed in ((f'POT{name}W', row['phasePower'][phase]), (f'IN{name}A', row['phaseCurrent'][phase])):
                if key in original and abs(decimal(original[key], key)-computed) > .011:
                    warnings.append(f"Circuito {row['number']}: {key} difere da distribuição recalculada.")
    for key, computed in [('POTENCIATOTALW', panel['p']), ('POTENCIATOTALVA', panel['sumVA']), ('IA', panel['maxCurrent'])]:
        if abs(decimal(total[key], 'TOTAL '+key)-computed) > .011:
            warnings.append(f'Linha TOTAL: {key} difere do valor recalculado.')
    for phase in panel['phases']:
        for key, computed in ((f"POT{phase['label']}W", phase['p']), (f"IN{phase['label']}A", phase['current'])):
            if key in total and abs(decimal(total[key], 'TOTAL '+key)-computed) > .011:
                warnings.append(f'Linha TOTAL: {key} difere do valor recalculado.')
    metadata = dict(filename=str(filename)[:180], warnings=warnings, sourceTotal=total,
                    generalBreaker=decimal(total['DISJUNTORA'], 'Disjuntor da linha TOTAL', optional=True))
    project = dict(format='VoltCalcGuiado-v3', schemaVersion=3, projectName='Residência — quadro importado',
                   supply=supply, circuits=circuits, draft=circuits[0], editingId=circuits[0]['id'],
                   selected=circuits[0]['id'], reactance=.08, importInfo=metadata)
    return dict(project=project, panel=panel, warnings=warnings)
