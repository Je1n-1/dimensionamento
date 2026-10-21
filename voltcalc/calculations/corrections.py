"""Resolve supported correction factors with explicit provenance and limits."""
from voltcalc.calculations.circuits import number


def temperature_correction(tables, method, insulation, value):
    temp = number(value)
    environment = 'soil' if method == 'D' else 'air'
    table = tables['temperature'][environment][insulation]
    points = sorted(int(key) for key in table)
    result = dict(input=temp, adopted=None, factor=None, environment=environment,
                  minimum=points[0], maximum=points[-1], policy='upper_table_entry',
                  reference='Tabela 35 · base histórica NBR 5410:1997')
    if not method:
        message = 'Confirme a instalação para determinar se a temperatura é do ar ou do solo.'
    elif temp is None:
        message = 'Informe a temperatura junto aos cabos para calcular o fator de temperatura.'
    elif not points[0] <= temp <= points[-1]:
        message = f'Temperatura fora da faixa implementada: {points[0]} a {points[-1]} °C. Não há extrapolação.'
    else:
        adopted = next(point for point in points if point >= temp)
        result.update(adopted=adopted, factor=table[str(adopted)])
        message = (f'{temp:g} °C informados → entrada de {adopted} °C utilizada. '
                   'Critério conservador do programa: próxima temperatura tabelada superior, sem interpolação; o valor informado é preservado.'
                   if adopted != temp else f'Fator obtido diretamente para {adopted} °C.')
    return result | dict(message=message)


def grouping_correction(tables, method, count, layout):
    count = number(count)
    factor = None
    reference = None
    if count is None or not count.is_integer() or not 1 <= count <= 20:
        message = 'Informe de 1 a 20 circuitos, incluindo este. Grupos de equipamentos não são circuitos adicionais.'
    elif count == 1:
        factor = 1
        message = 'Um único circuito: sem redução por agrupamento de circuitos neste modelo, mesmo que ele tenha vários grupos de equipamentos.'
    elif not method:
        message = 'Confirme a instalação antes de determinar o fator de agrupamento.'
    elif method == 'D':
        message = (f'{count:g} circuitos enterrados: falta implementar a tabela específica de agrupamento subterrâneo '
                   'e seus critérios de disposição e espaçamento. Não é um campo que você deixou vazio. '
                   'Se você contou grupos de lâmpadas de um único circuito, reveja a quantidade; '
                   'se são circuitos distintos, esta combinação ainda não pode ser dimensionada automaticamente.')
    elif layout == 'bundle':
        factor = tables['group1'][str(int(count))]
        reference = 'Tabela 37, item 1 · base histórica NBR 5410:1997'
        message = f'{count:g} circuitos no mesmo eletroduto ou em feixe: fator calculado automaticamente pela disposição implementada.'
    else:
        message = 'A disposição espaçada ou não identificada exige critérios que ainda não foram implementados. Confirme a disposição real; não altere o cadastro apenas para liberar o cálculo.'
    return dict(factor=factor, count=count, reference=reference, message=message)
