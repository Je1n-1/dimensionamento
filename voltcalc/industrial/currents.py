"""Stage 4 application service: pure calculation, no repository or HTTP coupling."""
import math
from voltcalc.industrial.contracts import CONTRACT, create_entity, validate_entity
from voltcalc.industrial.power import powers, finite, FACTORS
from voltcalc.industrial.catalogs import lookup_motor
from voltcalc.industrial.current_rules import motor_design_minimum, VERSION

CHOICES = {'auto': 'automática', 'plate': 'placa', 'catalog': 'catálogo', 'formula': 'fórmula'}
BASES = {'electrical': 'ativa elétrica absorvida', 'mechanical': 'mecânica de saída', 'apparent': 'aparente'}


def declared(value):
    return 'não informado' if value is None else 'sim' if value else 'não'


def calculate_consumer(consumer, motor, revision):
    result = create_entity('CalculationResult', domain='currents', targetId=consumer['id'],
                           inputRevision=revision, engineVersion=CONTRACT['engineVersion'],
                           rulesVersion=VERSION, status='pending')
    trace, pending = [], []
    values, power_notes = powers(consumer)
    pending.extend(power_notes)
    q, voltage, connection = consumer['quantity'], consumer['voltage'], consumer['connection']
    if consumer['phaseSet'] is not None and consumer['phaseSet'] not in {'FN': ('A','B','C'), 'FF': ('AB','BC','CA'), '3F': ('ABC',), '3FN': ('ABC',)}.get(connection, ()):
        raise ValueError('Fases incompatíveis com a ligação do consumidor.')
    trace.append(f"Ligação={connection or 'não informada'}; tensão={voltage if voltage is not None else 'não informada'} V; frequência={consumer['frequency'] if consumer['frequency'] is not None else 'não informada'} Hz; equilíbrio declarado: {declared(consumer['balanced'])}.")
    formula = None
    if connection not in ('FN', 'FF', '3F', '3FN') or voltage is None:
        pending.append('Corrente pela fórmula: informe tensão e ligação; use tensão entre fases para FF/3F e fase-neutro para FN.')
    elif connection in ('3F', '3FN') and consumer['balanced'] is not True:
        pending.append('Corrente trifásica pela fórmula: confirme carga equilibrada. Cargas desequilibradas exigem cálculo por fase, ainda não implementado.')
    elif values['apparent_va'] is not None:
        factor = math.sqrt(3) if connection in ('3F', '3FN') else 1
        formula = finite(values['apparent_va'] / (factor * voltage))
        trace.append(f'I calculada por equipamento = S / (k × U); S={values["apparent_va"]:.12g} VA; k={factor:.12g}; U={voltage:g} V; I={formula:.12g} A.')
    if consumer['power'] is not None:
        trace.append(f"Entrada por equipamento: {consumer['power']:g} {consumer['unit']} ({BASES[consumer['powerBasis']]}); multiplicador SI={FACTORS[consumer['unit']]:.14g}; FP={consumer['powerFactor'] if consumer['powerFactor'] is not None else 'não informado'}; η={consumer['efficiency'] if consumer['efficiency'] is not None else 'não informado'}; quantidade={q}. P elétrica = P mecânica/η; S = P elétrica/FP. Bases não são intercambiáveis.")
    nominal, selected, design = None, None, None
    if consumer['type'] == 'motor':
        if motor is None:
            pending.append('Especialização de motor ausente.')
        else:
            choice = motor['currentPreference']
            if choice == 'auto':
                choice = 'plate' if motor['plateCurrent'] is not None else 'catalog' if motor['catalogId'] or motor['catalogCurrent'] is not None else 'formula'
            trace.append(f"Preferência: {CHOICES[motor['currentPreference']]}; fonte escolhida: {CHOICES[choice]}; polos={motor['poles'] if motor['poles'] is not None else 'não informado'}.")
            if choice == 'plate':
                if motor['plateCurrent'] is None:
                    pending.append('Fonte placa selecionada, mas a corrente não foi informada.')
                else:
                    nominal, selected = motor['plateCurrent'], 'plate'
                    trace.append(f"Fonte: placa informada pelo usuário, In={nominal:g} A. {motor['source']['manufacturer']} {motor['source']['model']}; {motor['source']['reference']}.")
            elif choice == 'catalog':
                try:
                    if motor['catalogId']:
                        nominal, reference = lookup_motor(consumer, motor)
                    else:
                        source = motor['source']
                        if motor['catalogCurrent'] is None or not all(source[k].strip() for k in ('manufacturer', 'model', 'edition', 'reference')) or any(consumer[k] is None for k in ('voltage', 'frequency', 'power')) or motor['poles'] is None:
                            raise ValueError('Catálogo manual: informe corrente, fabricante, modelo, edição, referência, potência, tensão, frequência e polos.')
                        nominal = motor['catalogCurrent']
                        reference = 'Catálogo informado pelo usuário: ' + '; '.join(source[k] for k in ('manufacturer', 'model', 'edition', 'reference'))
                    selected = 'catalog'
                    trace.append(reference)
                except ValueError as error:
                    pending.append(str(error))
            elif choice == 'formula' and formula is not None:
                selected = 'formula'
                pending.append('Estimativa por fórmula não substitui corrente nominal do motor. Informe placa ou catálogo para obter Ib mínimo normativo.')
            design, note = motor_design_minimum(consumer, motor, nominal, values['mechanical_w'])
            (trace if design is not None else pending).append(note)
            values.update(starting_a=motor['startingCurrent'], measured_a=motor['measuredCurrent'])
            trace.append('Correntes de partida e medida, quando preenchidas, são entradas do usuário e não substituem In ou Ib.')
            trace.append(f"Escopo declarado: condições nominais: {declared(motor['nominalConditionsConfirmed'])}; circuito exclusivo S1/gaiola: {declared(motor['exclusiveS1Circuit'])}; usa FS: {declared(motor['usesServiceFactor'])}; FS={motor['serviceFactor'] if motor['serviceFactor'] is not None else 'não informado'}. Regra {VERSION}.")
    elif formula is not None:
        selected = 'formula'
        # A load estimate is not a sized feeder or a verified motor nominal rating.
        trace.append('Carga não motor: corrente calculada, sem corrente nominal certificada nem dimensionamento do circuito nesta etapa.')
    effective = nominal if nominal is not None else formula if selected == 'formula' else None
    values.update(nominal_a=nominal, calculated_a=formula, selected_a=effective, design_minimum_a=design)
    values['electrical_total_w'] = None if values['electrical_w'] is None else finite(values['electrical_w'] * q)
    values['apparent_total_va'] = None if values['apparent_va'] is None else finite(values['apparent_va'] * q)
    trace.append('Potências totais deste registro multiplicam a quantidade uma única vez. Correntes exibidas são por equipamento; correntes de circuitos/quadros não são somadas sem topologia. Não há fator de demanda aplicado.')
    result['measurements'] = [create_entity('Measurement', code=key, value=value,
                                           unit='A' if key.endswith('_a') else 'VA' if key.endswith('_va') else 'W') for key, value in values.items()]
    result['currentSource'] = selected
    result['status'] = 'calculated' if effective is not None else 'pending'
    result['reason'] = ' '.join(dict.fromkeys(pending)) or 'Grandezas calculadas para as entradas informadas. Cabo, proteção e conformidade geral não verificados.'
    result['trace'] = '\n'.join(trace)
    result['criteria'] = [create_entity('Criterion', code='conductor_and_protection', status='pending', reason='Condutores e proteção não verificados na Etapa 4.', reference='Etapas posteriores do roteiro')]
    return result


def calculate_project(project):
    errors = validate_entity('Project', project)
    if errors:
        raise ValueError('Contrato industrial inválido: ' + errors[0]['path'])
    # Do not double-count electrical panels/transformers/drives with downstream loads.
    # Per-record power is available; installation-wide aggregation awaits topology.
    motors = {}
    for motor in project['motors']:
        if motor['consumerId'] in motors:
            raise ValueError('Motor com especialização duplicada.')
        motors[motor['consumerId']] = motor
    return [calculate_consumer(c, motors.get(c['id']), project['revision']) for c in project['consumers']]


def current_request(payload):
    project, token = payload.get('project'), payload.get('request')
    if not isinstance(project, dict) or not isinstance(token, dict):
        raise ValueError('Envie projeto e requisição de cálculo industrial.')
    expected = {'projectId': project.get('id'), 'inputRevision': project.get('revision'), 'domain': 'currents',
                'engineVersion': CONTRACT['engineVersion'], 'rulesVersion': VERSION}
    if token != expected or any(type(token.get(key)) is not type(value) for key,value in expected.items()):
        raise ValueError('Requisição industrial desatualizada. Recarregue a aplicação.')
    results = calculate_project(project)
    if any(validate_entity('CalculationResult', result) for result in results):
        raise ValueError('Resultado industrial fora do contrato.')
    return {'request': expected, 'results': results}
