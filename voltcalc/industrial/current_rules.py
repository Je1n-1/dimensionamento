"""Limited 2004 rule; not a conductor/protection or global conformity engine."""
from voltcalc.industrial.power import finite

VERSION = 'nbr5410-2004-motors-6.5.1.3.1-v1'
REFERENCE = 'ABNT NBR 5410:2004 (corrigida 2008), 6.5.1.1 e 6.5.1.3.1'


def motor_design_minimum(consumer, motor, nominal, mechanical_w):
    if nominal is None:
        return None, 'Ib mínimo pendente: falta corrente nominal de placa/catálogo para as condições efetivas.'
    if consumer['voltage'] is None or consumer['frequency'] is None or consumer['connection'] is None:
        return None, 'Ib mínimo pendente: informe tensão, frequência e ligação efetivas do motor.'
    if motor['nominalConditionsConfirmed'] is not True:
        return None, 'Confirme que a corrente nominal corresponde à tensão, frequência e maior potência/velocidade efetivamente utilizadas.'
    if consumer['quantity'] != 1:
        return None, f"Este registro contém {consumer['quantity']} motores. O critério implementado exige circuito terminal exclusivo de um único motor; não dimensiona alimentadores de grupos."
    if motor['exclusiveS1Circuit'] is not True:
        return None, 'Ib mínimo pendente: confirme circuito terminal exclusivo de um motor de gaiola, S1, em aplicação industrial normal, fora das exclusões de 6.5.1.1.'
    if mechanical_w is None or mechanical_w > 150000:
        return None, 'Informe potência mecânica de até 150 kW para o escopo limitado de 6.5.1.1. Outros casos requerem análise específica.'
    if motor['usesServiceFactor'] is None:
        return None, 'Informe se a operação utilizará o fator de serviço declarado pelo fabricante.'
    factor = 1
    if motor['usesServiceFactor']:
        factor = motor['serviceFactor']
        if factor is None or factor <= 1:
            return None, 'Para explorar o fator de serviço, informe FS > 1 declarado pelo fabricante. Não se reduz a corrente nominal.'
    return finite(nominal * factor), f'Ib mínimo = In × {factor:g}; {REFERENCE}. Limite inferior para este motor; não verifica cabo nem proteção.'
