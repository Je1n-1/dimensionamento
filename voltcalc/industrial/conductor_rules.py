"""Versioned, partial 2004 conductor rules. Never imports residential tables."""
import json
import math
from voltcalc.paths import ROOT

DATA = json.loads((ROOT / 'data/industrial/conductors-2004.v1.json').read_text(encoding='utf8'))
VERSION = DATA['version']
SECTIONS = sorted(map(float, DATA['tables']['36']['Cu']))
AIR = {10:(1.22,1.15),15:(1.17,1.12),20:(1.12,1.08),25:(1.06,1.04),30:(1,1),35:(.94,.96),40:(.87,.91),45:(.79,.87),50:(.71,.82),55:(.61,.76),60:(.50,.71),65:(None,.65),70:(None,.58),75:(None,.50),80:(None,.41)}
SOIL = {10:(1.10,1.07),15:(1.05,1.04),20:(1,1),25:(.95,.96),30:(.89,.93),35:(.84,.89),40:(.77,.85),45:(.71,.80),50:(.63,.76),55:(.55,.71),60:(.45,.65),65:(None,.60),70:(None,.53),75:(None,.46),80:(None,.38)}
GROUP42 = {
    'bundle':[1,.80,.70,.65,.60,.57,.54,.52,.50,.45,.41,.38],
    'wall':[1,.85,.79,.75,.73,.72,.72,.71,.70,.70,.70,.70],
    'ceiling':[.95,.81,.72,.68,.66,.64,.63,.62,.61,.61,.61,.61],
    'perforated':[1,.88,.82,.77,.75,.73,.73,.72,.72,.72,.72,.72],
    'ladder':[1,.87,.82,.80,.80,.79,.79,.78,.78,.78,.78,.78],
}
GROUP43 = [[.68,.62,.60,.58,.56],[.62,.57,.55,.53,.51],[.60,.55,.52,.51,.49],[.58,.53,.51,.49,.48],[.56,.51,.49,.48,.46]]
GROUP44 = [[.75,.80,.85,.90,.90],[.65,.70,.75,.80,.85],[.60,.60,.70,.75,.80],[.55,.55,.65,.70,.80],[.50,.55,.60,.70,.80]]
GROUP45 = {
    'buried_multi':[[.85,.90,.95,.95],[.75,.85,.90,.95],[.70,.80,.85,.90],[.65,.80,.85,.90],[.60,.80,.80,.80]],
    'buried_single':[[.80,.90,.90,.95],[.70,.80,.85,.90],[.65,.75,.80,.90],[.60,.70,.80,.90],[.60,.70,.80,.90]],
}

class Pending(ValueError):
    """An applicability condition or required input is unresolved."""

def require(condition, message):
    if not condition:
        raise Pending(message)

def temperature_factor(temperature, insulation, underground=False):
    require(temperature is not None and 10 <= temperature <= 80, 'Tabela 40: informe temperatura entre 10 e 80 °C; valores externos exigem estudo específico.')
    adopted = next(t for t in (SOIL if underground else AIR) if t >= temperature)
    value = (SOIL if underground else AIR)[adopted][insulation != 'PVC']
    require(value is not None, 'Tabela 40: não há fator para esta isolação e temperatura.')
    return value, adopted

def capacity(method, material, insulation, loaded, arrangement, section):
    require(method in ('A1','A2','B1','B2','C','D','E','F','G'), 'Selecione método de referência A1 a G e confirme sua correspondência física à tabela 33.')
    require(loaded in (2,3,4), 'Tabelas de capacidade exigem dois ou três condutores carregados; quatro requerem a correção do neutro.')
    n = min(loaded,3)
    table = (36 if method in ('A1','A2','B1','B2','C','D') else 38) + (insulation != 'PVC')
    if table < 38:
        column = ('A1','A2','B1','B2','C','D').index(method)*2+n-2
    elif method == 'E': column = n-2
    elif method == 'F':
        require(n == 2 or arrangement in ('trefoil','flat'), 'Método F: informe trifólio ou plano justaposto.')
        column = 2 if n == 2 else 3 if arrangement == 'trefoil' else 4
    else:
        require(n == 3 and arrangement in ('horizontal','vertical'), 'Método G: exige três condutores carregados e plano espaçado horizontal ou vertical.')
        column = 5 if arrangement == 'horizontal' else 6
    for cell in DATA['excludedCells']:
        require(not (table==cell['table'] and material==cell['material'] and section==cell['section'] and column in cell['columns']), 'Célula da tabela 38 em revisão: alumínio 630 mm², F plano/G. Não utilizada.')
    row = DATA['tables'][str(table)][material].get(str(float(section)))
    require(row is not None, 'Seção ausente na tabela para este material.')
    return row[column], table

def grouping_factor(segment, n):
    t, method = segment['thermal'], segment['installationMethod']
    mode = t['grouping']
    require(t['groupingConfirmed'] is True, 'Confirme disposição, carregamento semelhante e condições do agrupamento; não contar equipamentos nem PE como circuitos.')
    require(n >= 1, 'Agrupamento sem circuitos identificados.')
    if method == 'D':
        require(mode in ('direct','buried_multi','buried_single'), 'Método D: selecione a disposição enterrada das tabelas 44 ou 45.')
        require(segment['soilDepth'] == .7, 'Modelo enterrado restrito à profundidade de 0,7 m; outras profundidades exigem cálculo específico.')
        rho = segment['soilResistivity']
        require(rho is not None, 'Informe a resistividade térmica do solo.')
        if mode == 'direct' or n > 1:
            require(rho == 2.5, 'Tabelas 44/45: agrupamento enterrado requer resistividade de 2,5 K·m/W; outra combinação exige estudo específico.')
            soil = 1
        else:
            require(1 <= rho <= 3, 'Tabela 41: resistividade fora da faixa implementada de 1 a 3 K·m/W.')
            soil = next(f for r,f in [(1,1.18),(1.5,1.10),(2,1.05),(2.5,1),(3,.96)] if r >= rho)
        if n == 1: return 1, soil, '6.2.5.4; tabela 41 (solo arredondado para classe superior quando necessário)'
        require(n <= 6, 'Tabelas 44/45 implementadas até seis circuitos; não extrapolar.')
        choices = ['0','diameter','0.125','0.25','0.5'] if mode=='direct' else ['0','0.25','0.5','1']
        require(t['spacing'] in choices, 'Informe um espaçamento previsto na tabela de agrupamento enterrado.')
        rows = GROUP44 if mode=='direct' else GROUP45[mode]
        return rows[n-2][choices.index(t['spacing'])], soil, f'Tabela {44 if mode=="direct" else 45}; valores aproximados (nota: até ±10%)'
    if mode == 'conservative':
        require(method in ('A1','A2','B1','B2','C','E','F'), 'F=1/√n não aplicado a esta disposição pelo modelo.')
        return 1/math.sqrt(n),1,'6.2.5.5.5: hipótese conservadora para grupo não homogêneo, sem estudo específico'
    if mode == 'spaced':
        require(method in ('C','E','F','G'), 'Ausência de redução por espaçamento exige instalação ao ar livre apropriada.')
        return 1,1,'Tabela 42, nota 2: distância horizontal entre cabos adjacentes superior a 2 diâmetros externos, declarada'
    if mode == 'layers':
        require(method in ('C','E','F') and t['layers'] and t['circuitsPerLayer'], 'Tabela 43: informe camadas e circuitos por camada para C/E/F.')
        require(n == t['layers']*t['circuitsPerLayer'], 'Tabela 43: contagem da topologia não coincide com camadas × circuitos por camada.')
        def bucket(v): return next(i for i,maximum in enumerate([2,3,5,8,math.inf]) if v<=maximum)
        return GROUP43[bucket(t['layers'])][bucket(t['circuitsPerLayer'])],1,'Tabela 43: grupo em várias camadas, sem multiplicar novamente pela tabela 42'
    require(mode in GROUP42, 'Selecione uma disposição de agrupamento suportada.')
    allowed = {'bundle':('A1','A2','B1','B2','C','E','F'),'wall':('C',),'ceiling':('C',),'perforated':('E','F'),'ladder':('E','F')}
    require(method in allowed[mode], 'Disposição de agrupamento incompatível com o método de referência.')
    column = next(i for i,maximum in enumerate([1,2,3,4,5,6,7,8,11,15,19,math.inf]) if n<=maximum)
    return GROUP42[mode][column],1,'Tabela 42: grupo homogêneo (até três seções normalizadas sucessivas), carregamento semelhante declarado'

def pe_section(section, material, location):
    require(location in ('included','protected','exposed'), 'PE: informe se está no mesmo cabo/conduto fechado ou a proteção mecânica externa.')
    minimum = section if section<=16 else 16 if section<=35 else section/2
    if location != 'included': minimum = max(minimum,16 if material=='Al' else 2.5 if location=='protected' else 4)
    return next(s for s in SECTIONS if s >= minimum)
