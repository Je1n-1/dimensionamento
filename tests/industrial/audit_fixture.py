"""Synthetic stage-11 installation. Never use its declared impedances in a real project."""
import math
from voltcalc.industrial.contracts import create_entity as e
from voltcalc.industrial.infrastructure import physical_signature
from voltcalc.industrial.voltage import impedance_signature


def source():
    return e('Source', kind='catalog', manufacturer='Fabricante sintético QA', model='Modelo de ensaio',
             reference='QA Etapa 11: valores sintéticos, sem fabricante real')


def installation():
    p=e('Project', name='QA Etapa 11 - 30 consumidores', description='Instalação sintética de auditoria, sem uso real.', currentStage=10)
    p['supply'].update(phases='three', voltageFN=220, voltageFF=380, frequency=60, earthing='TN-S')
    def panel(tag, parent=None):
        q=e('Panel',tag=tag,parentPanelId=parent, supply=p['supply']);p['panels'].append(q)
        n=e('Node',kind='panel',entityId=q['id'],label=tag);p['nodes'].append(n)
        return q,n
    def segment(tag,a,b,length):
        s=e('Segment',tag=tag,fromNodeId=a['id'],toNodeId=b['id'],length=length,installationMethod='B1',temperature=30)
        s['thermal'].update(methodConfirmed=True,noRadiation=True,groupingConfirmed=True,grouping='conservative')
        p['segments'].append(s)
        p['infrastructures'].append(e('Infrastructure',segmentId=s['id'],type='conduit',innerDiameter=100,
            dimensionSource=source(),location='outdoor',continuousLength=length,bends90=0,routeConfirmed=True,candidateDiameters=[50,75,100]))
        return s
    def circuit(tag,origin,paths,loads,connection,manual=None,panel_id=None):
        c=e('Circuit',tag=tag,purpose='lighting' if connection=='FN' else 'power',role='feeder' if panel_id else 'terminal',
            originNodeId=origin['id'],originPanelId=origin['entityId'],consumerIds=[x['id'] for x in loads],segmentIds=[s['id'] for s in paths],destinationPanelIds=[panel_id] if panel_id else [])
        c['voltageStudy'].update(scopeConfirmed=True)
        if len(loads)!=1:c['voltageStudy'].update(nominalVoltage=220 if connection=='FN' else 380,frequency=60,powerFactor=1,balanced=True)
        p['circuits'].append(c)
        for s in paths:s['circuitIds'].append(c['id'])
        b=e('Cable',tag='F-'+tag,circuitId=c['id'],formation='single_core')
        b['design'].update(connection=connection,harmonicsPercent=0,scopeConfirmed=True,peLocation='included')
        if manual is not None:b['design'].update(manualIb=manual,manualIbConfirmed=True,manualIbSource='Corrente equivalente declarada exclusivamente para o ensaio sintético')
        b['voltageImpedance'].update(resistance=.5 if panel_id else 2,reactance=0,temperature=70,source=source(),confirmed=True)
        p['cables'].append(b)
        roles=['L1','N','PE'] if connection=='FN' else ['L1','L2','L3','PE']+(['N'] if connection=='3FN' else [])
        for role in roles:p['conductors'].append(e('Conductor',circuitId=c['id'],cableId=b['id'],role=role,section=70 if panel_id else 35,
            material='Cu',insulation='PVC',formation='single_core',outerDiameter=12 if panel_id else 9,source=source()))
        return c,b
    main,root=panel('QGBT')
    root['position']=dict(x=30,y=300)
    p['voltagePolicy'].update(originNodeId=root['id'],originType='delivery_lv',originConfirmed=True)
    types=['motor','heating','lighting','other','drive','transformer','heating','lighting','lighting','lighting']
    for group in range(3):
        sub,node=panel(f'QD-{group+1}',main['id']);node['position']=dict(x=300,y=group*700)
        entry=segment(f'AL-{group+1}',root,node,10+group*5)
        circuit(f'AL-{group+1}',root,[entry],[],'3FN',manual=60,panel_id=sub['id'])
        loads=[];paths=[];nodes=[];chain=[]
        for j,kind in enumerate(types):
            connection='FN' if kind=='lighting' else '3F'
            voltage=220 if connection=='FN' else 380
            load=e('Consumer',tag=f'C{group*10+j+1:02d}',description=f'{kind} - cenário de auditoria',type=kind,
                power=220 if connection=='FN' else 380*math.sqrt(3)*5,unit='W',powerBasis='electrical',
                voltage=voltage,frequency=60,connection=connection,phaseSet='A' if connection=='FN' else 'ABC',
                balanced=True,powerFactor=1,panelId=sub['id'])
            if kind=='motor':
                load.update(power=3,unit='kW',powerBasis='mechanical',efficiency=.9,powerFactor=.85)
                p['motors'].append(e('Motor',consumerId=load['id'],plateCurrent=8,currentPreference='plate',poles=4,
                    nominalConditionsConfirmed=True,exclusiveS1Circuit=True,usesServiceFactor=False,source=source()))
            p['consumers'].append(load);loads.append(load)
            n=e('Node',kind='consumer',entityId=load['id'],label=load['tag'],position=dict(x=600+(j%5)*230,y=group*700+(j//5)*240))
            p['nodes'].append(n)
            # First five loads share a trunk; the other five branch from the panel.
            s=segment(f'T{group+1}-{j+1}',nodes[-1] if 0<j<5 else node,n,5)
            if j<5:chain.append(s);paths.append(list(chain))
            else:paths.append([s])
            nodes.append(n)
            if j<8:circuit(load['tag'],node,paths[-1],[load],connection,manual=10 if kind in ('other','drive','transformer') else None)
        circuit(f'IL-{group+1}',node,paths[8]+paths[9],loads[8:],'FN',manual=2)
    for w in p['conductors']:w['physicalSignature']=physical_signature(p,'conductors',w)
    for b in p['cables']:b['voltageImpedance']['signature']=impedance_signature(p,b)
    return p


if __name__=='__main__':
    import json
    print(json.dumps(installation(),ensure_ascii=False))
