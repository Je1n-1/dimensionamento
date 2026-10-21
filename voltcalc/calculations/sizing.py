"""Seleção preliminar de seção e proteção com rastreabilidade dos critérios."""
import json
import math
from voltcalc.paths import DATA

from voltcalc.calculations.circuits import number, profile, voltage_trace
from voltcalc.calculations.validation import diagnostics
from voltcalc.calculations.corrections import temperature_correction, grouping_correction

TABLES = json.loads((DATA / 'nbr1997.json').read_text(encoding='utf-8'))
BREAKERS = (6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000)


def method_of(c):
    if c.get('unknownInstallation'):
        return None
    if c.get('methodOverride'):
        return c['methodOverride'] if c['methodOverride'] in ('A1', 'A2', 'B1', 'B2', 'C', 'D') else None
    single = c.get('cableForm') == 'single'
    if c.get('installation') == 'embedded' and c.get('wall') == 'thermal':
        return 'A1' if single else 'A2'
    if c.get('installation') in ('embedded', 'conduit'):
        return 'B1' if single else 'B2'
    return {'surface': 'C', 'buried': 'D'}.get(c.get('installation'))


def calculate(c, reactance=.08, supply=None):
    if not isinstance(c, dict):
        raise ValueError('Cada circuito deve ser um objeto.')
    electrical = profile(c, supply)
    issues, notices = electrical['issues'], electrical['notices']
    ib = electrical['ib']
    x, i2, group, temp, limit = (number(v) for v in (reactance, c.get('i2Factor'), c.get('groupCount'), c.get('temperature'), c.get('maxDrop')))
    if not isinstance(c.get('description'), str) or not c['description'].strip():
        issues.append('Informe um nome para o circuito.')
    if x is None or not 0 <= x <= 2:
        issues.append('Reatância precisa estar entre 0 e 2 Ω/km.')
    if i2 is None or not 1 <= i2 <= 3:
        issues.append('Relação I₂/In deve estar entre 1 e 3 e ser confirmada para o dispositivo.')
    if group is None or not group.is_integer() or not 1 <= group <= 20:
        issues.append('Informe um número inteiro de circuitos agrupados entre 1 e 20.')
    if limit is None or not 0 < limit <= 20:
        issues.append('Limite de queda deve ser maior que zero e até 20%.')
    enums = dict(metal=('Cu', 'Al'), insulation=('PVC', 'EPR', 'XLPE'), cableForm=('single', 'multi'),
                 wall=('masonry', 'thermal'), installation=('embedded', 'conduit', 'surface', 'buried', 'tray', 'overhead'),
                 groupLayout=('bundle', 'spaced', 'unknown'), methodOverride=('', 'A1', 'A2', 'B1', 'B2', 'C', 'D'),
                 type=('lighting', 'sockets', 'motor', 'shower', 'transformer', 'other'))
    field_labels = dict(metal='material do condutor', insulation='isolação do cabo',
                        cableForm='construção do cabo', wall='material da parede',
                        installation='forma de instalação', groupLayout='disposição do agrupamento',
                        methodOverride='método de referência', type='tipo do circuito')
    for key, options in enums.items():
        if c.get(key) not in options:
            issues.append(f"Preencha ou confira: {field_labels[key]}.")
    if not isinstance(c.get('unknownInstallation', False), bool):
        issues.append('Identificação de instalação inválida.')
    method = method_of(c) if c.get('installation') in enums['installation'] else None
    insulation = 'PVC' if c.get('insulation') == 'PVC' else 'EPR_XLPE'
    soil = method == 'D'
    thermal = temperature_correction(TABLES, method, insulation, temp)
    grouping = grouping_correction(TABLES, method, group, c.get('groupLayout'))
    fct, fca = thermal['factor'], grouping['factor']
    loaded = electrical['loaded']
    column = f'{method}/{int(loaded)}' if loaded in (2, 3) else ''
    col = TABLES['meta']['columns'].index(column) if column in TABLES['meta']['columns'] else -1
    if not method:
        notices.append('Método não determinado ou fora das tabelas implementadas. A seção fica pendente.')
    if method and fct is None:
        notices.append(thermal['message'])
    elif thermal['adopted'] != temp:
        notices.append(thermal['message'])
    if method and fca is None:
        notices.append('Agrupamento não coberto para essa disposição. O fator fica pendente.')
    if soil:
        notices.append('Resistividade e profundidade do solo são documentais; precisam de verificação específica.')
    if soil and group is not None and group > 1:
        notices.append('Agrupamento subterrâneo requer fatores específicos; seleção pendente.')
    if c.get('type') == 'motor':
        notices.append('Partida de motor e atuação da proteção não são verificadas neste modelo.')
    if electrical['phase'] == 'tri':
        notices.append('Cada grupo trifásico deve representar potência total equilibrada entre as três fases. Cargas monofásicas desequilibradas exigem outro estudo.')
    notices.append('FP tratado como cos φ indutivo. Harmônicas, cargas capacitivas e desequilíbrio não são modelados.')
    if 'loads' in c:
        notices.append('Uma seção e as mesmas condições de instalação em todo o circuito; a corrente total orienta a proteção comum.')

    mode = c.get('breakerMode', 'auto')
    requested = number(c.get('breakerCurrent'))
    if mode not in ('auto', 'verify'):
        issues.append('Escolha sugerir disjuntor ou verificar disjuntor informado.')
    if mode == 'verify' and (requested is None or not 0 < requested <= 10000):
        issues.append('Informe a corrente nominal do disjuntor em A, maior que zero e até 10.000 A.')
    eligible = not issues and ib is not None and col >= 0 and fct is not None and fca is not None and not (soil and group > 1)
    rows = []
    minimum = 16 if c.get('metal') == 'Al' else (2.5 if c.get('type') == 'sockets' else 1.5)
    rho, alpha = (.01724, .00393) if c.get('metal') == 'Cu' else (.02826, .00403)
    temperature_limit = 70 if insulation == 'PVC' else 90
    def trace(section):
        resistance = rho * (1 + alpha * (temperature_limit - 20)) * 1000 / section
        return voltage_trace(electrical, resistance, x)
    if eligible:
        for size, row in sorted(TABLES['ampacities'][insulation][c['metal']].items(), key=lambda item: float(item[0])):
            section = float(size)
            if section < minimum:
                continue
            iz = row[col] * fct * fca
            drop = trace(section)
            options = (requested,) if mode == 'verify' else BREAKERS
            breaker = next((a for a in options if a >= ib-1e-8 and a <= iz+1e-8 and a*i2 <= 1.45*iz+1e-8), None)
            rows.append(dict(section=section, itab=row[col], iz=iz, dv=drop['dv'], dvPct=drop['dvPct'], breaker=breaker,
                             ampOk=ib <= iz+1e-8, dropOk=drop['dvPct'] <= limit+1e-8))
    smallest = next((r for r in rows if r['ampOk']), None)
    cable = next((r for r in rows if r['ampOk'] and r['dropOk']), None)
    chosen = next((r for r in rows if r['ampOk'] and r['dropOk'] and r['breaker']), None)
    if chosen:
        notices.append('Resultado parcial: curva, partida, interrupção e demais verificações exigem dados reais do dispositivo.')
    elif eligible:
        notices.append('Nenhuma combinação atende a todos os critérios na lista disponível.')
    if mode == 'verify' and requested is not None and ib is not None and requested < ib:
        notices.append(f'O disjuntor informado ({requested:g} A) é menor que a corrente da carga ({ib:.2f} A). Aumentar o cabo não resolve essa incompatibilidade.')
    short, icu = number(c.get('shortIk')), number(c.get('breakerIcu'))
    short_ok = icu >= short if short is not None and short > 0 and icu is not None and icu > 0 else None
    reference = chosen or cable
    nominal = requested if mode == 'verify' else (chosen['breaker'] if chosen else None)
    protection = dict(mode=mode, nominal=nominal,
                      loadOk=nominal >= ib if nominal is not None and ib is not None else None,
                      cableOk=nominal <= reference['iz'] if nominal is not None and reference else None,
                      conventionalOk=nominal*i2 <= 1.45*reference['iz'] if nominal is not None and i2 is not None and reference else None,
                      shortOk=short_ok)
    protection['failed'] = any(protection[key] is False for key in ('loadOk', 'cableOk', 'conventionalOk', 'shortOk'))
    if short_ok is False:
        notices.append('A capacidade de interrupção informada é inferior a Ik: o dispositivo informado não atende a essa comparação.')
    criteria = dict(minimum=minimum, ampacity=smallest['section'] if smallest else None,
                    voltageDrop=next((r['section'] for r in rows if r['dropOk']), None),
                    protection=next((r['section'] for r in rows if r['breaker']), None))
    names = dict(minimum='Seção mínima do modelo', ampacity='Capacidade de corrente', voltageDrop='Queda de tensão', protection='Coordenação de sobrecarga')
    determining = [names[key] for key, value in criteria.items() if chosen and value == chosen['section']]
    if chosen and chosen['section'] == minimum:
        determining = [names['minimum'] + ' (os outros critérios também são atendidos nessa seção)']
    factor = fct * fca if fct is not None and fca is not None else None
    required = ib / factor if ib is not None and factor else None
    details = trace(reference['section']) if reference else dict(segments=[], endpoints=[])
    result = dict(c=c, method=method, ib=ib, voltage=electrical['voltage'], phase=electrical['phase'], loaded=loaded,
                connection=electrical['connection'], totals=electrical['totals'], loadResults=electrical['loads'],
                routeMode=electrical['routeMode'], segments=details['segments'], endpoints=details['endpoints'],
                fct=fct, fca=fca, combinedFactor=factor, requiredAmpacity=required, eligible=eligible, all=rows,
                smallest=smallest, cableCandidate=cable, chosen=chosen, shortOk=short_ok, protection=protection,
                criteria=criteria, determining=determining, issues=issues, notices=notices, table=31 if insulation=='PVC' else 32)
    result['corrections'] = dict(temperature=thermal, grouping=grouping)
    result['diagnostics'] = diagnostics(c, result, supply)
    result['selectionBlockers'] = [d for d in result['diagnostics'] if d['blocksSelection']]
    return result
