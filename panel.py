"""Quadro de cargas: soma fasorial senoidal na tensão nominal.

Sequência ABC (R/S/T), FP indutivo, simultaneidade 100%. Não calcula
alimentador, neutro, demanda, harmônicas ou desequilíbrio de tensão.
"""
import cmath
import copy
import math

from circuits import number, profile

PHASES = dict(A='R', B='S', C='T')
VECTORS = {p: cmath.rect(1, a) for p, a in zip('ABC', (0, -2*math.pi/3, 2*math.pi/3))}


def build_panel(circuits, supply):
    if not isinstance(supply, dict) or supply.get('phases') not in ('mono', 'bi', 'tri'):
        raise ValueError('Informe a alimentação da instalação.')
    available = dict(mono='A', bi='AB', tri='ABC')[supply['phases']]
    totals = {p: dict(p=0., current=0j, count=0) for p in available}
    rows, issues = [], []
    for index, circuit in enumerate(circuits):
        if not isinstance(circuit, dict):
            raise ValueError('Cada circuito deve ser um objeto.')
        # Distância não altera potência/corrente nominal. O motor de seção continua
        # exigindo o percurso real, sem usar estes zeros para dimensionar cabos.
        c = copy.deepcopy(circuit)
        if isinstance(c.get('loads'), list):
            for load in c['loads']:
                if isinstance(load, dict):
                    load['distance'] = 0
        c['length'], c['routeMode'] = 0, 'linear'
        r = profile(c, supply)
        connection = r['connection']
        assignment = c.get('phaseSet', 'ABC' if connection == 'tri' else '')
        errors = list(r['issues'])
        if connection == 'legacy':
            errors.append('Confirme a ligação e as fases deste circuito.')
        if not isinstance(assignment, str) or not assignment or any(p not in available for p in assignment):
            errors.append('Distribuição de fases não definida ou indisponível.')
        expected_voltage = {'127/220': (127, 220), '220/380': (220, 380)}.get(supply.get('network'))
        if supply.get('network') == 'custom':
            expected_voltage = (number(supply.get('phaseVoltage')), number(supply.get('lineVoltage')))
        expected = expected_voltage[0 if connection == 'fn' else 1] if expected_voltage else None
        if expected is None or expected <= 0 or r['voltage'] is None or abs(r['voltage']-expected) > .01:
            errors.append('A tensão do circuito precisa corresponder à rede para compor este quadro.')
        valid = not errors and r['ib'] is not None
        row = dict(id=c.get('id'), number=c.get('number') or str(index+1),
                   description=c.get('description', ''), connection=connection, phaseSet=assignment,
                   voltage=r['voltage'], p=r['totals']['p'] if valid else None,
                   s=r['totals']['s'] if valid else None, powerFactor=r['totals']['powerFactor'] if valid else None,
                   ib=r['ib'] if valid else None, valid=valid, issues=errors,
                   phasePower={p: None for p in 'ABC'}, phaseCurrent={p: None for p in 'ABC'})
        if valid:
            p, q, u = r['totals']['p'], r['totals']['q'], r['voltage']
            currents = dict.fromkeys('ABC', 0j)
            if connection == 'fn':
                currents[assignment] = complex(p, -q)/u * VECTORS[assignment]
            elif connection == 'ff':
                a, b = assignment
                direction = VECTORS[a]-VECTORS[b]
                current = complex(p, -q)/u * direction/abs(direction)
                currents[a], currents[b] = current, -current
            else:
                currents = {phase: complex(p, -q)/(math.sqrt(3)*u) * VECTORS[phase] for phase in 'ABC'}
            # Potência em FF é rateio cadastral de 50% por fase, não medição por polo.
            row['phasePower'] = {phase: p/len(assignment) if phase in assignment else 0 for phase in 'ABC'}
            row['phaseCurrent'] = {phase: abs(currents[phase]) for phase in 'ABC'}
            for phase in available:
                totals[phase]['p'] += row['phasePower'][phase]
                totals[phase]['current'] += currents[phase]
                totals[phase]['count'] += int(phase in assignment)
        else:
            issues.append(f"Circuito {row['number']}: " + ' '.join(errors))
        rows.append(row)
    complete = bool(rows) and all(r['valid'] for r in rows)
    phase_rows = [dict(phase=p, label=PHASES[p], p=v['p'] if complete else None,
                       current=abs(v['current']) if complete else None, count=v['count'])
                  for p, v in totals.items()]
    peak = max((r['current'] for r in phase_rows), default=None) if complete else None
    minimum = min((r['current'] for r in phase_rows), default=None) if complete else None
    return dict(rows=rows, complete=complete, phases=phase_rows, issues=issues,
                p=sum(r['p'] for r in rows) if complete else None,
                # Soma cadastral dos VA individuais, explicitamente rotulada.
                sumVA=sum(r['s'] for r in rows) if complete else None,
                maxCurrent=peak, spread=peak-minimum if complete else None,
                maxPhases=[r['label'] for r in phase_rows if complete and abs(r['current']-peak) < 1e-8])
