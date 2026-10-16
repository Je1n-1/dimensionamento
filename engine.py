"""Motor preliminar VoltCalc. Base histórica de 1997; sem dependência de interface."""
import json
import math
from pathlib import Path

TABLES = json.loads((Path(__file__).parent / 'data' / 'nbr1997.json').read_text(encoding='utf-8'))
BREAKERS = (6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000)


def number(value):
    if value is None or isinstance(value, bool) or value == '':
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError, OverflowError):
        return None


def method_of(c):
    if c.get('unknownInstallation'):
        return None
    override = c.get('methodOverride')
    if override:
        return override if override in ('A1', 'A2', 'B1', 'B2', 'C', 'D') else None
    installation = c.get('installation')
    single = c.get('cableForm') == 'single'
    if installation == 'embedded' and c.get('wall') == 'thermal':
        return 'A1' if single else 'A2'
    if installation in ('embedded', 'conduit'):
        return 'B1' if single else 'B2'
    return {'surface': 'C', 'buried': 'D'}.get(installation)


def calculate(c, reactance=0.08):
    if not isinstance(c, dict):
        raise ValueError('Cada circuito deve ser um objeto.')
    issues, notices = [], []
    values = {key: number(c.get(key)) for key in (
        'power', 'quantity', 'voltage', 'powerFactor', 'efficiency', 'length',
        'maxDrop', 'i2Factor', 'groupCount', 'loaded', 'temperature', 'shortIk', 'breakerIcu')}
    p, qty, voltage, pf, efficiency = (values[k] for k in ('power', 'quantity', 'voltage', 'powerFactor', 'efficiency'))
    length, limit, i2, group, loaded, temp = (values[k] for k in ('length', 'maxDrop', 'i2Factor', 'groupCount', 'loaded', 'temperature'))
    x = number(reactance)
    positive = lambda v: v is not None and v > 0
    if not isinstance(c.get('description'), str) or not c['description'].strip():
        issues.append('Informe um nome para o circuito.')
    if qty is None or qty < 1 or not qty.is_integer():
        issues.append('Quantidade inválida.')
    if not positive(p) or not positive(voltage):
        issues.append('Potência e tensão devem ser finitas e maiores que zero.')
    if not positive(pf) or pf > 1:
        issues.append('Fator de potência precisa estar entre 0 e 1.')
    if c.get('unit') in ('CV', 'HP') and (not positive(efficiency) or efficiency > 1):
        issues.append('Informe o rendimento do motor entre 0 e 1.')
    if length is None or length < 0 or not positive(limit):
        issues.append('Distância ou limite de queda inválido.')
    if i2 is None or not 1 <= i2 <= 3:
        issues.append('Relação I₂/In deve ser um número entre 1 e 3, confirmado para o dispositivo.')
    if group is None or not group.is_integer() or not 1 <= group <= 20:
        issues.append('Informe um número inteiro de circuitos agrupados entre 1 e 20.')
    if loaded not in (2, 3) or (c.get('phase') == 'tri' and loaded != 3):
        issues.append('Trifásico equilibrado requer 3 condutores carregados neste modelo; monofásico aceita 2 ou 3 para análise específica.')
    if x is None or not 0 <= x <= 2:
        issues.append('Reatância precisa estar entre 0 e 2 Ω/km.')
    enums = {
        'phase': ('mono', 'tri'), 'unit': ('W', 'kW', 'VA', 'kVA', 'CV', 'HP'),
        'metal': ('Cu', 'Al'), 'insulation': ('PVC', 'EPR', 'XLPE'),
        'cableForm': ('single', 'multi'), 'wall': ('masonry', 'thermal'),
        'installation': ('embedded', 'conduit', 'surface', 'buried', 'tray', 'overhead'),
        'groupLayout': ('bundle', 'spaced', 'unknown'), 'methodOverride': ('', 'A1', 'A2', 'B1', 'B2', 'C', 'D'),
        'type': ('lighting', 'sockets', 'motor', 'shower', 'transformer', 'other'),
    }
    for key, options in enums.items():
        if c.get(key) not in options:
            issues.append(f'Valor inválido para {key}.')
    if not isinstance(c.get('unknownInstallation', False), bool):
        issues.append('Identificação de instalação inválida.')

    method = method_of(c) if not any(c.get(k) not in enums[k] for k in ('installation', 'methodOverride', 'wall', 'cableForm')) else None
    ib = None
    if positive(p) and positive(qty) and positive(voltage) and c.get('phase') in ('mono', 'tri'):
        unit = c.get('unit')
        apparent = None
        try:
            if unit in ('VA', 'kVA'):
                apparent = p * qty * (1000 if unit == 'kVA' else 1)
            elif positive(pf) and pf <= 1:
                if unit in ('W', 'kW'):
                    apparent = p * qty * (1000 if unit == 'kW' else 1) / pf
                elif unit in ('CV', 'HP') and positive(efficiency) and efficiency <= 1:
                    apparent = p * qty * (735.49875 if unit == 'CV' else 745.699872) / efficiency / pf
            if apparent is not None:
                current = apparent / voltage / (math.sqrt(3) if c['phase'] == 'tri' else 1)
                ib = current if math.isfinite(current) else None
        except (OverflowError, ZeroDivisionError):
            pass
    if ib is None:
        issues.append('Não foi possível calcular uma corrente finita.')

    insulation = 'PVC' if c.get('insulation') == 'PVC' else 'EPR_XLPE'
    soil = method == 'D'
    temp_key = str(int(temp)) if temp is not None and temp.is_integer() else ''
    fct = TABLES['temperature']['soil' if soil else 'air'][insulation].get(temp_key) if method else None
    fca = 1 if group == 1 else None
    if method and not soil and c.get('groupLayout') == 'bundle' and group is not None and group.is_integer():
        fca = TABLES['group1'].get(str(int(group)))
    column = f'{method}/{int(loaded)}' if loaded in (2, 3) else ''
    col = TABLES['meta']['columns'].index(column) if column in TABLES['meta']['columns'] else -1
    if not method:
        notices.append('Método de instalação não determinado ou fora das tabelas implementadas.')
    if method and fct is None:
        notices.append('Temperatura fora das entradas explícitas da tabela 35.')
    if method and fca is None:
        notices.append('Fator de agrupamento não disponível para essa disposição.')
    if soil:
        notices.append('Resistividade térmica e profundidade do solo são documentais; requerem verificação específica.')
    if soil and group is not None and group > 1:
        notices.append('Agrupamento subterrâneo requer tabelas específicas; seleção pendente.')
    if c.get('type') == 'motor':
        notices.append('Motores exigem análise adicional de partida e proteção específica.')
    eligible = not issues and col >= 0 and fct is not None and fca is not None and not (soil and group > 1)
    rows = []
    if eligible:
        minimum = 16 if c['metal'] == 'Al' else (2.5 if c['type'] == 'sockets' else 1.5)
        rho, alpha = (0.01724, 0.00393) if c['metal'] == 'Cu' else (0.02826, 0.00403)
        target = 70 if insulation == 'PVC' else 90
        for section_text, row in sorted(TABLES['ampacities'][insulation][c['metal']].items(), key=lambda item: float(item[0])):
            section = float(section_text)
            if section < minimum:
                continue
            iz = row[col] * fct * fca
            resistance = rho * (1 + alpha * (target - 20)) * 1000 / section
            dv = (math.sqrt(3) if c['phase'] == 'tri' else 2) * ib * (length / 1000) * (resistance * pf + x * math.sqrt(max(0, 1 - pf * pf)))
            percent = dv / voltage * 100
            if not math.isfinite(dv) or not math.isfinite(percent):
                issues.append('Valores excedem a faixa numérica suportada.')
                rows = []
                eligible = False
                break
            breaker = next((a for a in BREAKERS if a >= ib - 1e-8 and a <= iz + 1e-8 and a * i2 <= 1.45 * iz + 1e-8), None)
            rows.append(dict(section=section, itab=row[col], iz=iz, dv=dv, dvPct=percent, breaker=breaker, ampOk=ib <= iz, dropOk=percent <= limit))
    smallest = next((r for r in rows if r['ampOk']), None)
    chosen = next((r for r in rows if r['ampOk'] and r['dropOk'] and r['breaker']), None)
    if chosen:
        notices.append('Disjuntor nominal preliminar: curva, I₂ e capacidade de interrupção requerem documentação real.')
    elif eligible:
        notices.append('Nenhuma combinação atende simultaneamente aos critérios implementados na lista considerada.')
    short, icu = values['shortIk'], values['breakerIcu']
    return dict(c=c, method=method, ib=ib, fct=fct, fca=fca, eligible=eligible, all=rows,
                smallest=smallest, chosen=chosen, shortOk=icu >= short if positive(short) and positive(icu) else None,
                issues=issues, notices=notices, table=31 if insulation == 'PVC' else 32)
