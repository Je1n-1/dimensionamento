"""Optional initial circuit proposal; never modifies the user's saved circuits.

One lighting/socket group per inventory row; one dedicated circuit per other
consumer. This is an editable organizational heuristic, not a normative design.
Electrical sizing continues to use sizing.calculate and the phase-panel model.
"""
import copy
import math
from uuid import uuid4

from voltcalc.calculations.panel import build_panel


KINDS = {'lighting', 'sockets', 'shower', 'ac', 'microwave', 'washer',
         'motor', 'transformer', 'other'}


def numeric(value, label, low, high, integer=False):
    if isinstance(value, bool):
        raise ValueError(f'{label}: informe um número válido.')
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{label}: informe um número válido.') from None
    if not math.isfinite(result) or not low <= result <= high or (integer and result != int(result)):
        raise ValueError(f'{label}: use um valor entre {low} e {high}.')
    return int(result) if integer else result


def propose_circuits(payload):
    context, supply = payload.get('context'), payload.get('supply')
    existing = payload.get('circuits', [])
    if not isinstance(context, dict) or not isinstance(existing, list) or len(existing) > 300:
        raise ValueError('Contexto do projeto inválido.')
    # Also validates the supply enum before selecting phase combinations.
    existing_panel = build_panel(existing, supply)
    equipment = context.get('equipment')
    if not isinstance(equipment, list) or not 1 <= len(equipment) <= 100:
        raise ValueError('Cadastre de 1 a 100 grupos de equipamentos.')
    conditions = context.get('conditions', {})
    if not isinstance(conditions, dict):
        raise ValueError('Condições da proposta inválidas.')
    temperature = numeric(conditions.get('temperature'), 'Temperatura', 10, 80)
    group_count = numeric(conditions.get('groupCount'), 'Circuitos agrupados', 1, 20, True)
    circuits = []
    existing_origins = {c.get('planningOrigin') for c in existing if isinstance(c, dict) and c.get('planningOrigin')}
    skipped = 0
    for item in equipment:
        if not isinstance(item, dict) or item.get('kind') not in KINDS:
            raise ValueError('Tipo de equipamento inválido.')
        name = str(item.get('name', '')).strip()[:70]
        if not name:
            raise ValueError('Informe o nome de cada grupo de equipamentos.')
        count = numeric(item.get('quantity'), f'{name}: quantidade', 1, 1000, True)
        power = numeric(item.get('power'), f'{name}: potência em W', .01, 1e7)
        pf = numeric(item.get('powerFactor'), f'{name}: fator de potência', .01, 1)
        distance = numeric(item.get('distance'), f'{name}: distância em metros', 0, 10000)
        connection = item.get('connection')
        available = supply['phases']
        if connection not in ('fn', 'ff', 'tri') or (connection == 'ff' and available == 'mono') or (connection == 'tri' and available != 'tri'):
            raise ValueError(f'{name}: ligação incompatível com as fases disponíveis.')
        grouped = item['kind'] in ('lighting', 'sockets')
        amount = 1 if grouped else count
        if amount > 300:
            raise ValueError('A proposta excede o limite de 300 circuitos do projeto.')
        for index in range(amount):
            item_id = str(item.get('id', ''))[:70]
            origin = f'{item_id}:{index}' if item_id else None
            if item_id and (origin in existing_origins or item_id in existing_origins):
                skipped += 1
                continue
            if len(existing) + len(circuits) >= 300:
                raise ValueError('A proposta excede o limite de 300 circuitos do projeto.')
            label = name if amount == 1 else f'{name} {index + 1}'
            room = str(item.get('room', '')).strip()[:60]
            circuit = dict(
                id=str(uuid4()), number='', description=(label + (' · ' + room if room else ''))[:70],
                type=item['kind'] if item['kind'] in ('lighting', 'sockets', 'shower', 'motor', 'transformer') else 'other',
                connection=connection, phaseSet='ABC' if connection == 'tri' else 'AB' if connection == 'ff' else 'A',
                voltageMode='auto', voltage=127, legacyLoaded=None,
                loads=[dict(id=str(uuid4()), description=name, quantity=count if grouped else 1,
                            power=power, unit='W', powerFactor=pf, efficiency=1, distance=distance)],
                routeMode='linear', installation='embedded', wall='masonry', cableForm='single',
                conduitType='PVC', methodOverride='', insulation='PVC', metal='Cu',
                groupCount=group_count, groupLayout='bundle', temperature=temperature, maxDrop=4,
                breakerMode='auto', breakerCurrent=10, breakerCurve='C', i2Factor=1.45,
                breakingCapacityType='Icn', breakerIcu='', shortIk='', soilResistance='', soilDepth='',
                unknownInstallation=False, planningOrigin=origin,
            )
            circuits.append(circuit)

    # Greedy allocation using the existing phasor-current model, without changing
    # voltage/connection or relocating any already saved circuit.
    balance = bool(context.get('distribute', True))
    base = copy.deepcopy(existing)
    warnings = [f'{skipped} consumidor(es) já adicionado(s) foram preservados. Edite-os em Circuitos; mudanças no inventário não sobrescrevem circuitos salvos.'] if skipped else []
    if not circuits:
        raise ValueError('Todos os consumidores desta proposta já foram adicionados. Edite os circuitos existentes ou cadastre outros consumidores.')
    if existing and not existing_panel['complete']:
        balance = False
        warnings.append('Distribuição automática não aplicada: revise as grandezas e fases dos circuitos existentes.')
    for circuit in sorted(circuits, key=lambda c: -c['loads'][0]['power'] * c['loads'][0]['quantity']):
        choices = (list({'mono': 'A', 'bi': 'AB', 'tri': 'ABC'}[supply['phases']]) if circuit['connection'] == 'fn'
                   else ['AB', 'BC', 'CA'] if circuit['connection'] == 'ff' and supply['phases'] == 'tri'
                   else [circuit['phaseSet']])
        if balance:
            scored = []
            for phase in choices:
                circuit['phaseSet'] = phase
                panel = build_panel(base + [circuit], supply)
                if not panel['complete']:
                    raise ValueError('Confira as tensões da rede: ' + ' '.join(panel['issues']))
                scored.append((panel['maxCurrent'], panel['spread'], phase))
            circuit['phaseSet'] = min(scored)[2]
        base.append(copy.deepcopy(circuit))
    return {'circuits': circuits, 'warnings': warnings,
            'strategy': 'Uma linha de iluminação/tomadas gera um circuito; os demais consumidores recebem circuitos individuais. A alocação de fases busca reduzir a maior corrente a cada inclusão; não garante a distribuição ótima.'}
