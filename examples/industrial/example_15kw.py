"""Reproducible teaching example. Synthetic assumptions, not an installation design."""
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from voltcalc.industrial.contracts import CONTRACT, create_entity, validate_entity
from voltcalc.industrial.voltage import impedance_signature
from voltcalc.industrial.infrastructure import physical_signature


def build_example():
    def e(entity_type, key, **values):
        item = create_entity(entity_type, **values)
        if 'id' in item:
            item['id'] = str(uuid5(NAMESPACE_URL, 'voltcalc-didatico-15kw/' + entity_type + '/' + key))
        return item

    project = e('Project', 'project', name='Exemplo completo — 9 cargas · 15.000 W', currentStage=10,
        description='EXEMPLO SINTÉTICO: 3 aquecedores de 2,5 kW + 3 aquecedores de 1,5 kW + 3 luminárias resistivas de 1 kW. '
        '5 kW por fase; rede ideal 380/220 V, 60 Hz, FP=1. Percursos independentes. '
        'Origem de entrega BT assumida no QD. Não inclui alimentador externo, demanda ou proteção. '
        'R é hipótese didática a 70 °C: 22,5/seção em ohm/km; X=0. Não é catálogo. '
        'Ver docs/industrial/EXEMPLO_15000W.md antes de interpretar os resultados.')
    project['supply'].update(phases='three', voltageFN=220, voltageFF=380, frequency=60, earthing='TN-S')
    panel = e('Panel', 'QD', tag='QD-DIDATICO', description='Quadro de distribuição do exercício', supply=project['supply'])
    root = e('Node', 'QD', kind='panel', entityId=panel['id'], label=panel['tag'])
    project['panels'].append(panel)
    project['nodes'].append(root)
    project['voltagePolicy'].update(originNodeId=root['id'], originType='delivery_lv', originConfirmed=True)

    for index, phase in enumerate('ABC'):
        for prefix, kind, watts, length, section in [('AQ','heating',2500,10+index,2.5), ('AC','heating',1500,11+index,2.5), ('IL','lighting',1000,12+index,1.5)]:
            tag = prefix + '-' + phase
            load = e('Consumer', tag, tag=tag, type=kind, power=watts, quantity=1,
                unit='W', powerBasis='electrical', voltage=220, frequency=60, connection='FN',
                phaseSet=phase, powerFactor=1, hasPE=True, panelId=panel['id'],
                description=(f'Aquecedor resistivo {watts} W' if kind=='heating' else 'Luminária resistiva 1.000 W'),
                distance=length, distanceBasis='cumulative', temperature=30, installationMethod='B1',
                cableMaterial='copper', cableType='insulated', insulation='PVC',
                insulationDescription='PVC/A 70 °C', environment='Interior, alvenaria, eletroduto exclusivo e sem radiação',
                notes='Hipótese didática: FP=1, regime permanente, sem harmônicas. '
                'Iluminação agregada no ponto final, não distribuída pelo percurso. '
                'Um consumidor por circuito. TN-S é hipótese, sem verificação do aterramento. Potência elétrica: rendimento não aplicável.')
            node = e('Node', tag, kind='consumer', entityId=load['id'], label=tag)
            segment = e('Segment', tag, tag='T-'+tag, fromNodeId=root['id'], toNodeId=node['id'],
                length=length, kind='branch', installationMethod='B1', temperature=30,
                environment='Exercício: eletroduto independente, alvenaria, sem radiação',
                notes='Condições assumidas apenas para demonstração; sem infraestrutura compartilhada.')
            segment['thermal'].update(methodConfirmed=True, noRadiation=True, groupingConfirmed=True, grouping='bundle')
            load.update(plannedSegmentId=segment['id'], plannedSegmentTag=segment['tag'])
            circuit = e('Circuit', tag, tag='C-'+tag, purpose='lighting' if kind=='lighting' else 'power',
                role='terminal', originPanelId=panel['id'], originNodeId=root['id'],
                consumerIds=[load['id']], segmentIds=[segment['id']])
            circuit['voltageStudy']['scopeConfirmed'] = True
            segment['circuitIds'] = [circuit['id']]
            cable = e('Cable', tag, tag='F-'+tag, circuitId=circuit['id'], formation='insulated')
            cable['design'].update(connection='FN', scopeConfirmed=True, harmonicsPercent=0, peLocation='included')
            cable['voltageImpedance'].update(resistance=22.5/section, reactance=0, temperature=70, confirmed=True,
                source=e('Source', tag, kind='manual', reference='HIPÓTESE DIDÁTICA, sem catálogo: R=22,5/S ohm/km a 70 °C; X=0. Não usar em projeto real sem fonte validada.'))
            project['consumers'].append(load)
            project['nodes'].append(node)
            project['segments'].append(segment)
            project['infrastructures'].append(e('Infrastructure', tag, segmentId=segment['id'], type='conduit',
                innerDiameter=20, location='indoor', continuousLength=length, bends90=0, routeConfirmed=True,
                dimensionSource=e('Source', tag, kind='manual', reference='HIPÓTESE DIDÁTICA: diâmetro INTERNO útil de 20 mm, não bitola comercial; percurso retilíneo exclusivo entre QD e carga.'),
                notes='Cada segmento é um percurso contínuo de até 14 m, sem curvas, sem trecho comum com outros circuitos.'))
            project['circuits'].append(circuit)
            project['cables'].append(cable)
            for role in [{'A':'L1','B':'L2','C':'L3'}[phase], 'N', 'PE']:
                project['conductors'].append(e('Conductor', tag+'-'+role, circuitId=circuit['id'], cableId=cable['id'],
                    role=role, section=section, material='Cu', insulation='PVC', formation='insulated',
                    outerDiameter=3.55 if section==2.5 else 2.95,
                    source=e('Source', tag+'-'+role, kind='catalog', manufacturer='Corfio', model='Cabo Flexível BWF 750 V',
                        edition='Página oficial consultada em 07/11/2026; sem edição declarada',
                        reference='https://www.corfio.com.br/pt/produto/cabo-flexivel-bwf-750v — tabela Dados construtivos: 2,5 mm² / Ø3,55 mm; 1,5 mm² / Ø2,95 mm. Fonte apenas dimensional; R AC continua hipótese didática.')))
            for wire in project['conductors']:
                wire['physicalSignature'] = physical_signature(project, 'conductors', wire)
            cable['voltageImpedance']['signature'] = impedance_signature(project, cable)
    errors = validate_entity('Project', project)
    if errors:
        raise ValueError(errors)
    return project


def export_example():
    project = build_example()
    backup = dict(format='voltcalc-industrial-project',version=1,
        exportedAt=datetime.now(timezone.utc).isoformat(), contractVersion=CONTRACT['version'], project=project)
    path = Path(__file__).with_name('exemplo_15000W.json')
    path.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding='utf-8')
    return path


def export_report():
    """Generate the same summary as the application, preceded by worked input notes."""
    from voltcalc.industrial.reports import build_report, block, csv_report
    from voltcalc.industrial.report_pdf import render_pdf
    project = build_example()
    report = build_report(project)
    report['summarySections'].insert(0, dict(title='Como reproduzir este exercício', blocks=[block('Entradas adotadas', [
        ['Distribuição', 'Fases A, B e C: cada uma alimenta 2.500 + 1.500 + 1.000 W. Total: 9 cargas, 9 circuitos, 15.000 W; 5.000 W e 22,727 A por fase.'],
        ['Alimentação e corrente', 'Rede 380/220 V, 60 Hz. Todos os circuitos são fase-neutro de 220 V, FP=1. Ib=P/220. Potência elétrica informada; rendimento mecânico não se aplica.'],
        ['Percursos e instalação', 'Um eletroduto exclusivo por circuito, 10 a 14 m, interior, retilíneo, B1, 30 °C, sem radiação; um circuito agrupado, dois condutores carregados, mais PE. Ft=1 e Fg=1.'],
        ['Condutores adotados', 'Cobre, PVC/A 70 °C, condutores isolados. Aquecedores: fase, N e PE de 2,5 mm²; iluminação: 1,5 mm². Dimensões externas: 3,55 e 2,95 mm, respectivamente (Corfio).'],
        ['Ocupação', 'Hipótese: eletroduto com diâmetro interno útil de 20 mm; não é bitola comercial. Área = soma de 3 envoltórias, incluindo neutro e PE. Ocupação = 3 × (diâmetro externo / 20)² × 100.'],
        ['Queda de tensão', 'Hipótese didática: R=22,5/S ohm/km a 70 °C e X=0; não é impedância de catálogo. Queda FN = 2 × L × Ib × R/1000; percentual = queda/220 × 100. Origem de entrega BT no QD: limite total 5%, terminal 4%, conforme perfil implementado.'],
        ['Exemplo AQ-C', 'P=2.500 W; L=12 m; S=2,5 mm²; Ib=11,3636 A; R=9 ohm/km. Queda=2,4545 V=1,1157%. Ocupação=3 × (3,55/20)² × 100=9,451875%.'],
        ['Fonte dimensional', 'Corfio, Cabo Flexível BWF 750 V; página oficial consultada em 07/11/2026, sem edição declarada: https://www.corfio.com.br/pt/produto/cabo-flexivel-bwf-750v'],
        ['Limites', 'Exercício de regime permanente, cargas resistivas ideais. Não inclui alimentador a montante, demanda, motores ou partida. TN-S é hipótese, sem validação do aterramento. Proteção e curto-circuito não implementados; nenhum disjuntor é apresentado como dimensionado.']
    ])]))
    output = Path('output/pdf/voltcalc-15000w-9-cargas.pdf')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_bytes(render_pdf(report,detail='summary'))
    Path(__file__).with_name('relatorio_15000W.csv').write_text(csv_report(report),encoding='utf-8-sig')
    return output


if __name__ == '__main__':
    print(export_example())
