"""Field locations for calculation diagnostics; no second electrical engine."""
import re
from voltcalc.calculations.circuits import number


def diagnostics(c, result, supply=None):
    items = []
    def add(message, field, step, scope='field', index=None, blocking=True, selection=None):
        items.append(dict(message=message, field=field, step=step, scope=scope,
                          index=index, blocking=blocking, blocksSelection=blocking if selection is None else selection))
    rules = [
        ('nome', 'description', 1), ('tipo do circuito', 'type', 1),
        ('fases escolhidas', 'phaseSet', 2), ('fase–neutro', 'connection', 2),
        ('tensão', 'voltage', 2), ('carregados', 'connection', 2),
        ('material do condutor', 'metal', 3), ('isolação', 'insulation', 3),
        ('construção', 'cableForm', 3), ('parede', 'wall', 3),
        ('instalação', 'installation', 3), ('método', 'methodOverride', 3),
        ('agrup', 'groupCount', 4), ('queda', 'maxDrop', 5),
        ('percurso', 'routeMode', 5), ('I₂/In', 'i2Factor', 5),
        ('corrente nominal', 'breakerCurrent', 5), ('disjuntor', 'breakerMode', 5),
    ]
    for message in result['issues']:
        match = re.match(r'Equipamento (\d+):', message)
        if match:
            index = int(match[1]) - 1
            keys = [('descrição', 'description'), ('quantidade', 'quantity'),
                    ('potência positiva', 'power'), ('fator de potência', 'powerFactor'),
                    ('distância', 'distance'), ('unidade', 'unit'), ('rendimento', 'efficiency')]
            located = [(word, key) for word, key in keys if word in message]
            if 'quantidade inteira' in message:
                load = c.get('loads', [c])[index]
                qty, power = number(load.get('quantity')), number(load.get('power'))
                located = []
                if qty is None or qty < 1 or not qty.is_integer():
                    located.append(('', 'quantity'))
                if power is None or power <= 0:
                    located.append(('', 'power'))
            for _, key in located or [('', 'power')]:
                add(message, key, 2, 'load', index)
        else:
            field, step = next(((key, step) for word, key, step in rules if word in message), ('description', 1))
            add(message, field, step)
    if not result['method']:
        add('Instalação sem método coberto pelas tabelas disponíveis. A seção e o disjuntor automático ficam pendentes.', 'installation', 3, blocking=False, selection=True)
    if result['method'] and result['fct'] is None:
        add(result['corrections']['temperature']['message'], 'temperature', 5, blocking=False, selection=True)
    if result['method'] and result['fca'] is None:
        add(result['corrections']['grouping']['message'], 'groupCount' if result['method']=='D' else 'groupLayout', 4, blocking=False, selection=True)
    if c.get('connection') == 'legacy':
        add('Confirme a ligação importada para compor o quadro de cargas.', 'connection', 2, blocking=False)
    if isinstance(supply, dict) and c.get('voltageMode') == 'manual' and c.get('connection') in ('fn', 'ff', 'tri'):
        network = {'127/220': (127, 220), '220/380': (220, 380)}.get(supply.get('network'))
        if supply.get('network') == 'custom':
            network = (number(supply.get('phaseVoltage')), number(supply.get('lineVoltage')))
        expected = network[0 if c['connection'] == 'fn' else 1] if network else None
        if expected and result['voltage'] and abs(expected - result['voltage']) > .01:
            add(f'A tensão manual difere da rede para esta ligação ({expected:g} V). O cálculo isolado usa a tensão informada, mas este circuito não pode compor o quadro até corrigir a incompatibilidade.', 'voltage', 2, blocking=False)
    if result['protection']['loadOk'] is False:
        add('O disjuntor informado é menor que a corrente da carga. Aumentar a seção não resolve essa incompatibilidade.', 'breakerCurrent', 5, blocking=False)
    if result['shortOk'] is False:
        add('A capacidade de interrupção informada é inferior à corrente de curto-circuito.', 'breakerIcu', 5, blocking=False)
    elif result['shortOk'] is None:
        add('Interrupção ainda não verificada: faltam Ik e/ou a capacidade do dispositivo. Isso não impede a sugestão nominal preliminar.', 'shortIk', 5, blocking=False)
    if result['eligible'] and not result['chosen']:
        add('Nenhuma combinação de cabo e disjuntor da lista atende a todos os critérios. Consulte as verificações do resultado.', 'breakerMode', 5, blocking=False, selection=True)
    return items
