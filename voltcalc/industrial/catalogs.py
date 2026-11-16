"""Explicit, exact lookup of the supplied Fockink reproduction of WEG W21 data."""
import json
from voltcalc.paths import ROOT

CATALOG = json.loads((ROOT / 'data/industrial/catalogs/weg-w21-fockink-2006.v1.json').read_text(encoding='utf-8'))


def lookup_motor(consumer, motor):
    if motor['catalogId'] != CATALOG['id']:
        raise ValueError('Selecione explicitamente o catálogo WEG W21 fornecido.')
    if consumer['type'] != 'motor' or consumer['frequency'] != 60 or consumer['connection'] not in ('3F', '3FN'):
        raise ValueError('Esta tabela atende somente motores trifásicos WEG W21, 60 Hz, IP55.')
    if consumer['voltage'] not in (220, 380, 440) or motor['poles'] not in (2, 4, 6, 8):
        raise ValueError('A tabela exige tensão 220/380/440 V e 2/4/6/8 polos, sem interpolação.')
    if consumer['powerBasis'] != 'mechanical' or consumer['unit'] not in ('cv', 'kW', 'W') or consumer['power'] is None:
        raise ValueError('Use a potência mecânica da linha impressa em cv ou kW (ou W equivalentes). hp não equivale a cv.')
    unit = 'cv' if consumer['unit'] == 'cv' else 'kW'
    value = consumer['power'] / 1000 if consumer['unit'] == 'W' else consumer['power']
    row = next((r for r in CATALOG['rows'] if r[unit] == value), None)
    current = row and row['currents'][str(int(consumer['voltage']))][str(motor['poles'])]
    if current is None:
        raise ValueError('Combinação de potência, tensão e polos ausente na tabela. Nenhum valor foi interpolado.')
    reference = (f"WEG W21 IP55, 60 Hz; {row['cv']:g} cv / {row['kW']:g} kW; "
                 f"{consumer['voltage']:g} V; {motor['poles']} polos; In={current:g} A. "
                 f"{CATALOG['edition']}; reprodução {CATALOG['reproduction']}; registro {CATALOG['id']}.")
    return current, reference
