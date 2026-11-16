"""Power bases and unit conversion. No UI, persistence or residential dependency."""
import math

# Metric horsepower: 75 kgf m/s. Mechanical horsepower: 550 ft lbf/s.
# NIST SP 811 (2008), Appendix B; use definitions, not rounded catalog equivalents.
FACTORS = {'W': 1, 'kW': 1000, 'VA': 1, 'kVA': 1000,
           'cv': 75 * 9.80665, 'hp': 550 * .3048 * .45359237 * 9.80665}


def finite(value):
    if not math.isfinite(value):
        raise ValueError('Resultado fora do intervalo numérico suportado.')
    return value


def convert_power(value, unit, basis):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value <= 0:
        raise ValueError('Potência deve ser um número positivo.')
    if unit not in FACTORS:
        raise ValueError('Unidade de potência não suportada.')
    allowed = ['apparent'] if unit in ('VA', 'kVA') else ['mechanical'] if unit in ('cv', 'hp') else ['mechanical', 'electrical']
    if basis not in allowed:
        raise ValueError('Unidade incompatível com a base da potência.')
    return finite(value * FACTORS[unit])


def powers(consumer):
    """Per-unit quantities. Unknown PF/efficiency never becomes 1."""
    p = {'mechanical_w': None, 'electrical_w': None, 'apparent_va': None}
    notes = []
    if consumer['power'] is None:
        return p, ['Potência não informada.']
    value = convert_power(consumer['power'], consumer['unit'], consumer['powerBasis'])
    basis, pf, eta = consumer['powerBasis'], consumer['powerFactor'], consumer['efficiency']
    p[{'mechanical': 'mechanical_w', 'electrical': 'electrical_w', 'apparent': 'apparent_va'}[basis]] = value
    if basis == 'mechanical':
        if eta is None:
            notes.append('Informe o rendimento para converter potência mecânica em elétrica.')
        else:
            p['electrical_w'] = finite(value / eta)
    if p['electrical_w'] is not None:
        if pf is None:
            notes.append('Informe o fator de potência para obter potência aparente e corrente pela fórmula.')
        else:
            p['apparent_va'] = finite(p['electrical_w'] / pf)
    elif basis == 'apparent':
        if pf is None:
            notes.append('Potência ativa pendente de fator de potência; corrente aparente pode ser calculada.')
        else:
            p['electrical_w'] = finite(value * pf)
    return p, notes
