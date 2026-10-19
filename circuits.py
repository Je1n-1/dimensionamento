"""Cargas e percursos radiais, sob aproximação senoidal e FP indutivo.

Uma seção/material/isolação por circuito. Em trifásico cada grupo é equilibrado.
O modelo não resolve harmônicas, cargas capacitivas ou redes com malhas.
"""
import math


def number(value):
    if value is None or isinstance(value, bool) or value == '':
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError, OverflowError):
        return None


def profile(c, supply=None):
    issues, notices = [], []
    new = 'loads' in c
    connection = c.get('connection', 'tri' if c.get('phase') == 'tri' else 'legacy')
    phase = 'tri' if connection == 'tri' else 'mono'
    voltage = number(c.get('voltage'))
    loaded = 3 if phase == 'tri' else 2
    if new and c.get('legacyLoaded') is not None:
        loaded = number(c['legacyLoaded'])
        notices.append('Número de carregados preservado do arquivo anterior. Ao confirmar a ligação, o sistema passa a deduzi-lo automaticamente.')
    if not new:
        loaded = number(c.get('loaded'))
        if c.get('phase') not in ('mono', 'tri'):
            issues.append('Alimentação do circuito inválida.')
    if connection not in ('fn', 'ff', 'tri', 'legacy'):
        issues.append('Escolha fase–neutro, fase–fase ou trifásico equilibrado.')
    if connection == 'legacy' and new:
        notices.append('Circuito importado: confirme se a ligação monofásica é fase–neutro ou fase–fase. A tensão original foi preservada.')
    if new and connection != 'legacy':
        supply = supply if isinstance(supply, dict) else {}
        service = supply.get('phases', 'tri')
        phases = {'mono': 'A', 'bi': 'AB', 'tri': 'ABC'}.get(service, '')
        assignment = c.get('phaseSet', 'ABC' if phase == 'tri' else ('AB' if connection == 'ff' else 'A'))
        expected = ('A', 'B', 'C') if connection == 'fn' else (('AB', 'BC', 'CA') if connection == 'ff' else ('ABC',))
        if assignment not in expected or any(p not in phases for p in str(assignment)):
            issues.append('As fases escolhidas para o circuito não estão disponíveis na alimentação da instalação.')
        mode = c.get('voltageMode', 'manual')
        if mode not in ('auto', 'manual'):
            issues.append('Forma de informar tensão inválida.')
        if mode == 'auto':
            networks = {'127/220': (127, 220), '220/380': (220, 380)}
            network = supply.get('network', '127/220')
            if network in networks:
                fn, ff = networks[network]
            elif network == 'custom':
                fn, ff = number(supply.get('phaseVoltage')), number(supply.get('lineVoltage'))
            else:
                fn = ff = None
            voltage = fn if connection == 'fn' else ff
        else:
            notices.append('Tensão informada manualmente: confirme a compatibilidade com a rede e os equipamentos.')
    if voltage is None or voltage <= 0:
        issues.append('Informe uma tensão válida e maior que zero.')
    if loaded not in (2, 3) or (phase == 'tri' and loaded != 3):
        issues.append('Condutores carregados incompatíveis: trifásico equilibrado utiliza 3 neste modelo.')

    raw = c.get('loads') if new else [{**c, 'description': c.get('description', 'Carga'), 'distance': c.get('length')}]
    if not isinstance(raw, list) or not 1 <= len(raw) <= 100:
        issues.append('Cadastre de 1 a 100 grupos de equipamentos por circuito.')
        raw = []
    loads = []
    for index, item in enumerate(raw):
        label = f'Equipamento {index + 1}'
        if not isinstance(item, dict):
            issues.append(f'{label}: dados inválidos.')
            continue
        qty, power, pf, distance = (number(item.get(k)) for k in ('quantity', 'power', 'powerFactor', 'distance'))
        efficiency = number(item.get('efficiency'))
        unit = item.get('unit')
        if not isinstance(item.get('description'), str) or not item['description'].strip():
            issues.append(f'{label}: informe uma descrição.')
        if qty is None or qty < 1 or not qty.is_integer() or power is None or power <= 0:
            issues.append(f'{label}: quantidade inteira e potência positiva são necessárias.')
            continue
        if pf is None or not 0 < pf <= 1:
            issues.append(f'{label}: informe o fator de potência entre 0 e 1.')
            continue
        if distance is None or distance < 0:
            issues.append(f'{label}: distância deve ser finita e maior ou igual a zero.')
            continue
        if unit not in ('W', 'kW', 'VA', 'kVA', 'CV', 'HP'):
            issues.append(f'{label}: unidade inválida.')
            continue
        if unit in ('CV', 'HP') and (efficiency is None or not 0 < efficiency <= 1):
            issues.append(f'{label}: informe o rendimento entre 0 e 1.')
            continue
        apparent = qty * power * (1000 if unit in ('kW', 'kVA') else 1)
        if unit in ('CV', 'HP'):
            apparent *= (735.49875 if unit == 'CV' else 745.699872) / efficiency
        if unit not in ('VA', 'kVA'):
            apparent /= pf
        active = apparent * pf
        reactive = apparent * math.sqrt(max(0, 1 - pf * pf))
        if not all(math.isfinite(v) for v in (apparent, active, reactive)):
            issues.append(f'{label}: valores excedem a faixa numérica suportada.')
            continue
        loads.append(dict(index=index, description=item['description'] if isinstance(item.get('description'), str) else label,
                          quantity=qty, distance=distance, p=active, q=reactive, s=apparent))
    route = c.get('routeMode', 'linear')
    if route not in ('linear', 'independent'):
        issues.append('Escolha um percurso em sequência ou ramais independentes.')
    p, q = sum(row['p'] for row in loads), sum(row['q'] for row in loads)
    s = math.hypot(p, q)
    if not all(math.isfinite(v) for v in (p, q, s)):
        issues.append('Potência total excede a faixa numérica suportada.')
        p = q = s = 0
    denominator = voltage * (math.sqrt(3) if phase == 'tri' else 1) if voltage and voltage > 0 else None
    ib = s / denominator if denominator and s > 0 else None
    if ib is not None and not math.isfinite(ib):
        issues.append('Não foi possível calcular uma corrente finita.')
        ib = None
    segments = []
    if loads and not issues:
        if route == 'linear':
            previous = 0
            for distance in sorted({load['distance'] for load in loads}):
                downstream = [load for load in loads if load['distance'] >= distance]
                sp, sq = sum(load['p'] for load in downstream), sum(load['q'] for load in downstream)
                segments.append(dict(start=previous, end=distance, length=distance - previous, p=sp, q=sq,
                                     current=math.hypot(sp, sq) / denominator,
                                     loadIndices=[load['index'] for load in loads if load['distance'] == distance]))
                previous = distance
        else:
            for load in loads:
                segments.append(dict(start=0, end=load['distance'], length=load['distance'], p=load['p'], q=load['q'],
                                     current=load['s'] / denominator, loadIndices=[load['index']]))
    # Partial input must not produce a plausible total based on only valid rows.
    electrical_valid = len(loads) == len(raw) and bool(loads) and ib is not None
    if not electrical_valid:
        ib = None
    return dict(issues=issues, notices=notices, voltage=voltage, phase=phase, connection=connection,
                loaded=loaded, routeMode=route, loads=loads, segments=segments, ib=ib,
                totals=dict(p=p, q=q, s=s, quantity=sum(load['quantity'] for load in loads), powerFactor=p/s if s else None))


def voltage_trace(profile, resistance, reactance):
    """Queda aproximada por trecho na tensão nominal; não é fluxo de carga iterativo."""
    accumulated, worst = 0, 0
    segments, endpoints = [], []
    coefficient = 1 if profile['phase'] == 'tri' else 2
    load_by_index = {load['index']: load for load in profile['loads']}
    for segment in profile['segments']:
        dv = coefficient * (segment['p'] * resistance + segment['q'] * reactance) * (segment['length']/1000) / profile['voltage']
        accumulated = accumulated + dv if profile['routeMode'] == 'linear' else dv
        if not math.isfinite(accumulated):
            raise ValueError('Queda de tensão excede a faixa numérica suportada.')
        segments.append({**segment, 'dv': dv, 'accumulated': accumulated})
        for index in segment['loadIndices']:
            load = load_by_index[index]
            endpoints.append(dict(index=index, description=load['description'], distance=load['distance'], dv=accumulated,
                                  dvPct=100 * accumulated / profile['voltage']))
        worst = max(worst, accumulated)
    return dict(dv=worst, dvPct=100 * worst/profile['voltage'], segments=segments, endpoints=endpoints)
