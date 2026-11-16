"""Residential load preview only: NBR 5410:2004, corrected 2008, 9.5.2.

Does not certify the installation, locate outlets or update the 1997 sizing tables.
Uses the standard three-point 600 VA allocation; optional two-point reduction
is deliberately not applied. Input data is never mutated.
"""
import math
from voltcalc.calculations.planning import numeric

TYPES = {'living', 'bedroom', 'kitchen', 'laundry', 'bathroom', 'balcony', 'other'}
REFERENCE = 'ABNT NBR 5410:2004, versão corrigida 2008 · 9.5.2'


def residential_preview(payload):
    if payload.get('propertyType') not in ('house', 'apartment'):
        raise ValueError('A previsão por cômodo se aplica aqui a casas e apartamentos. Para outros usos, cadastre as cargas de projeto.')
    include = payload.get('include', {'sockets': True, 'lighting': True})
    if not isinstance(include, dict) or any(not isinstance(include.get(k, False), bool) for k in ('sockets', 'lighting')) or not any(include.get(k, False) for k in ('sockets', 'lighting')):
        raise ValueError('Selecione tomadas e/ou iluminação para a prévia.')
    rooms = payload.get('rooms')
    if not isinstance(rooms, list) or not 1 <= len(rooms) <= 100:
        raise ValueError('Informe de 1 a 100 cômodos.')
    result, seen = [], set()
    for room in rooms:
        if not isinstance(room, dict):
            raise ValueError('Cômodo inválido.')
        name = str(room.get('name', '')).strip()[:60]
        if not name or name in seen:
            raise ValueError('Use nomes distintos para os cômodos, como Quarto 1 e Quarto 2.')
        seen.add(name)
        row = dict(name=name, issues=[], notes=[], reference=REFERENCE)
        try:
            kind = room.get('type')
            if kind not in TYPES:
                raise ValueError('Selecione o uso do cômodo.')
            area = None if room.get('area') in ('', None) else numeric(room['area'], 'Área (m²)', .01, 100000)
            perimeter = None if room.get('perimeter') in ('', None) else numeric(room['perimeter'], 'Perímetro (m)', .01, 100000)
            if area is None and (include.get('lighting') or include.get('sockets') and kind == 'other'):
                raise ValueError('Informe a área (m²) para a previsão selecionada.')
            needs_perimeter = kind in ('living', 'bedroom', 'kitchen', 'laundry') or kind == 'other' and area is not None and area > 6
            if perimeter is None and include.get('sockets') and needs_perimeter:
                raise ValueError('Informe o perímetro (m) para os pontos de tomada.')
            if kind in ('kitchen', 'laundry'):
                minimum = math.ceil(perimeter / 3.5) if perimeter is not None else None
                row['notes'].append('Conferir pelo menos duas tomadas de corrente acima da bancada da pia (podem compartilhar um ponto) e circuitos exclusivos para tomadas desses locais: 9.5.2.2.1 b e 9.5.3.2.')
            elif kind in ('bathroom', 'balcony'):
                minimum = 1
            elif kind in ('living', 'bedroom') or area is not None and area > 6:
                minimum = math.ceil(perimeter / 5) if perimeter is not None else None
            else:
                minimum = 1
            sockets = (minimum or 0) if room.get('sockets') in ('', None) else numeric(room['sockets'], 'Pontos de tomada', 0, 1000, True)
            lights = 1 if room.get('lights') in ('', None) else numeric(room['lights'], 'Pontos de luz', 0, 1000, True)
            light_va = 100 + 60 * max(0, math.floor((area - 6) / 4)) if area is not None else None
            wet = kind in ('kitchen', 'laundry', 'bathroom')
            socket_va = min(sockets, 3) * 600 + max(sockets - 3, 0) * 100 if wet else sockets * 100
            row.update(minSockets=minimum, sockets=sockets, lights=lights,
                       lightingVA=light_va, socketsVA=socket_va,
                       socketCountOk=sockets >= minimum if minimum is not None else None, lightCountOk=lights >= 1)
            if include.get('sockets', False) and sockets < minimum:
                row['issues'].append(f'Quantidade informada: {sockets}; mínimo calculado: {minimum} pontos de tomada.')
            if include.get('lighting', False) and lights < 1:
                row['issues'].append('Prever ao menos um ponto de luz; exceções e posição exigem análise do local.')
            if kind == 'bathroom':
                row['notes'].append('Conferir posição junto ao lavatório, volumes de segurança e proteção DR: 9.1 e 5.1.3.2. Não verificados pela contagem.')
            if kind == 'balcony':
                row['notes'].append('A exceção de localização junto ao acesso depende das condições construtivas: 9.5.2.2.1 c.')
            row['notes'].append('Potência de iluminação é previsão para dimensionamento, não potência nominal das lâmpadas. Distribuição física e adequação aos equipamentos ainda precisam ser conferidas.')
        except ValueError as error:
            row['issues'].append(str(error))
        row['ready'] = not row['issues']
        result.append(row)
    return dict(reference=REFERENCE, rooms=result,
                complete=all(row['ready'] for row in result),
                policy='Potências em VA. Regra de 600 VA para os três primeiros pontos nos ambientes aplicáveis; a redução opcional para dois pontos não foi utilizada.')
