"""Read-only comparison against the three SENAI PDFs reviewed on 2026-10-21.

Run: python scripts/audit_senai.py [--output path.json]
This records matches and discrepancies; it is not a compliance certificate.
Page numbers refer to PDF pages. See docs/analysis/REVISAO_SENAI.md.
"""
import argparse
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from voltcalc.calculations.sizing import TABLES, calculate


def circuit(power=1000, voltage=127, pf=1, distance=12, kind='lighting', groups=3, unit='VA', **updates):
    return dict(
        id='senai-audit', description='Comparacao SENAI', type=kind,
        connection='fn' if voltage == 127 else 'ff', phaseSet='A' if voltage == 127 else 'AB',
        voltageMode='manual', voltage=voltage, routeMode='linear',
        loads=[dict(description='Carga', quantity=1, power=power, unit=unit,
                    powerFactor=pf, efficiency=1, distance=distance)],
        installation='embedded', wall='masonry', cableForm='single',
        methodOverride='', insulation='PVC', metal='Cu', groupCount=groups,
        groupLayout='bundle', temperature=35, maxDrop=4,
        breakerMode='auto', i2Factor=1.45, breakerIcu='', shortIk='',
        unknownInstallation=False, soilResistance='', soilDepth='',
    ) | updates


def summarize(c):
    r = calculate(c, supply=dict(phases='tri', network='127/220'))
    return {k: r[k] for k in ('ib', 'method', 'loaded', 'fct', 'fca',
                              'requiredAmpacity', 'criteria', 'chosen', 'issues')}


def audit():
    comparisons = []

    def compare(label, expected, actual):
        comparisons.append(dict(label=label, expected=expected, actual=actual,
                                matches=actual is not None and math.isclose(expected, actual, abs_tol=1e-10)))

    # UE1 pp.18-20: numeric entries only; reference-temperature rows are not printed.
    air_t = [10, 15, 20, 25, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]
    soil_t = [10, 15, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80]
    temperature = {
        ('air', 'PVC'): [1.22, 1.17, 1.12, 1.06, .94, .87, .79, .71, .61, .50],
        ('air', 'EPR_XLPE'): [1.15, 1.12, 1.08, 1.04, .96, .91, .87, .82, .76, .71, .65, .58, .50, .41],
        ('soil', 'PVC'): [1.10, 1.05, .95, .89, .84, .77, .71, .63, .55, .45],
        ('soil', 'EPR_XLPE'): [1.07, 1.04, .96, .93, .89, .85, .80, .76, .71, .65, .60, .53, .46, .38],
    }
    for (environment, insulation), values in temperature.items():
        for temp, expected in zip(air_t if environment == 'air' else soil_t, values):
            compare(f'FCT {environment}/{insulation}/{temp}', expected,
                    TABLES['temperature'][environment][insulation].get(str(temp)))
    # UE1 p.20 / UE2 p.10: first grouping arrangement, within the app's 1..20 range.
    factors = [1, .8, .7, .65, .6, .57, .54, .52] + [.5]*3 + [.45]*4 + [.41]*4 + [.38]
    for n, expected in enumerate(factors, 1):
        compare(f'FCA feixe/{n}', expected, TABLES['group1'].get(str(n)))
    # UE2 p.11 / UE1 p.23: complete copper/PVC rows from 0.5 through 6 mm2.
    rows = {
        '0.5': [7, 7, 7, 7, 9, 8, 9, 8, 10, 9, 12, 10],
        '0.75': [9, 9, 9, 9, 11, 10, 11, 10, 13, 11, 15, 12],
        '1.0': [11, 10, 11, 10, 14, 12, 13, 12, 15, 14, 18, 15],
        '1.5': [14.5, 13.5, 14, 13, 17.5, 15.5, 16.5, 15, 19.5, 17.5, 22, 18],
        '2.5': [19.5, 18, 18.5, 17.5, 24, 21, 23, 20, 27, 24, 29, 24],
        '4.0': [26, 24, 25, 23, 32, 28, 30, 27, 36, 32, 38, 31],
        '6.0': [34, 31, 32, 29, 41, 36, 38, 34, 46, 41, 47, 39],
    }
    for section, row in rows.items():
        for column, expected, actual in zip(TABLES['meta']['columns'], row, TABLES['ampacities']['PVC']['Cu'][section]):
            compare(f'Itab PVC/Cu/{section}/{column}', expected, actual)

    examples = {
        'UE2_pp8_19_lighting_1000VA': summarize(circuit()),
        'UE2_pp12_14_lighting_800W': summarize(circuit(power=800, unit='W', distance=0)),
        'UE2_pp12_14_sockets_1200W': summarize(circuit(power=1200, unit='W', kind='sockets', distance=0)),
        'UE2_pp20_22_TUE1': summarize(circuit(power=1200, unit='W', kind='sockets', pf=.85, distance=25, groups=4)),
        'UE2_pp20_22_TUE2': summarize(circuit(power=2000, voltage=220, unit='W', kind='sockets', pf=.85, distance=40, groups=4)),
    }
    probes = {}
    for kind in ('lighting', 'sockets', 'motor', 'shower', 'transformer', 'other'):
        probes[f'minimum_{kind}'] = summarize(circuit(power=500, voltage=220, unit='W', kind=kind, groups=1, distance=5))
    # Deliberate boundary case, not a worked example from the PDF.
    boundary = summarize(circuit(power=1500, voltage=220, pf=.95, unit='W', groups=1, distance=45))
    boundary['catalogue_1_5mm2_V_per_A_km'] = 27.6  # UE2 p.17, non-magnetic conduit, cos phi .95.
    boundary['catalogue_1_5mm2_drop_percent'] = 27.6 * boundary['ib'] * .045 / 220 * 100
    probes['voltage_drop_catalogue_boundary'] = boundary
    probes['terminal_limit_10_percent'] = summarize(circuit(power=1000, voltage=220, unit='W', groups=1, distance=160, maxDrop=10))
    probes['soil_1'] = summarize(circuit(installation='buried', groups=1, soilResistance=1))
    probes['soil_3'] = summarize(circuit(installation='buried', groups=1, soilResistance=3))

    unit_drop = lambda power, voltage, pf, length: .04 * voltage / ((power / (voltage*pf))*length/1000)
    return dict(
        basis='SENAI PDFs, reviewed 2026-10-21; comparison only, production calculations unchanged',
        table_comparisons=dict(count=len(comparisons), matches=sum(x['matches'] for x in comparisons),
                               discrepancies=[x for x in comparisons if not x['matches']]),
        examples=examples, probes=probes,
        manual_unit_drop_limits=dict(UE2_p16=unit_drop(1000,127,1,12), UE2_p18=unit_drop(2200,220,.95,30),
                                    UE2_p22=unit_drop(2000,220,.85,40)),
        comparisons= comparisons,
    )


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = audit()
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f"Recorded {result['table_comparisons']['count']} table comparisons in {args.output}")
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2))
