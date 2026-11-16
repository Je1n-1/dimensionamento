import copy
import json
import math
import unittest
from urllib.request import Request, urlopen

from industrial.test_conductors import fixture as conductor_fixture
from industrial.test_structure import IndustrialHttpTests
from voltcalc.industrial.contracts import CONTRACT, create_entity as entity, validate_entity
from voltcalc.industrial.voltage import calculate_project, voltage_request, impedance_signature
from voltcalc.industrial.voltage_rules import VERSION, voltage_drop, compatible


def fixture():
    p=conductor_fixture()
    p['voltagePolicy'].update(originNodeId=p['nodes'][0]['id'],originType='delivery_lv',originConfirmed=True)
    for c in p['circuits']:c['voltageStudy']['scopeConfirmed']=True
    for w in p['conductors']:w['section']=10
    for cable in p['cables']:
        cable['voltageImpedance'].update(resistance=2,reactance=.08,temperature=70,confirmed=True,
            source=entity('Source',kind='manual',reference='Fixture sintética R AC a 70 C / 60 Hz'))
        cable['voltageImpedance']['signature']=impedance_signature(p,cable)
    return p


def token(p):return dict(projectId=p['id'],inputRevision=p['revision'],domain='voltage',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)


def feeder_fixture():
    p=fixture();origin=entity('Node',kind='origin',label='Entrega BT');p['nodes'].append(origin)
    segment=entity('Segment',tag='Entrada',fromNodeId=origin['id'],toNodeId=p['nodes'][0]['id'],length=20,installationMethod='B1',temperature=35)
    p['segments'].append(segment)
    circuit=entity('Circuit',tag='Alimentador',role='feeder',purpose='power',originNodeId=origin['id'],destinationPanelIds=[p['panels'][0]['id']],segmentIds=[segment['id']])
    circuit['voltageStudy'].update(nominalVoltage=380,frequency=60,powerFactor=1,balanced=True,scopeConfirmed=True)
    p['circuits'].append(circuit)
    cable=entity('Cable',tag='F-entrada',circuitId=circuit['id'],formation='single_core')
    cable['design'].update(connection='3F',manualIb=60,manualIbConfirmed=True,manualIbSource='Soma fixture 3 x 20 A')
    cable['voltageImpedance']=copy.deepcopy(p['cables'][0]['voltageImpedance'])
    p['cables'].append(cable)
    for role in ['L1','L2','L3','PE']:p['conductors'].append(entity('Conductor',cableId=cable['id'],circuitId=circuit['id'],role=role,section=10,material='Cu',insulation='PVC',formation='single_core'))
    p['voltagePolicy']['originNodeId']=origin['id']
    cable['voltageImpedance']['signature']=impedance_signature(p,cable)
    return p


class VoltageTests(unittest.TestCase):
    def test_formulas_connections_and_invalid(self):
        for connection in ['FN','FF']:self.assertAlmostEqual(voltage_drop(10,50,2,0,1,connection),2)
        self.assertAlmostEqual(voltage_drop(10,50,2,.1,.8,'3F'),math.sqrt(3)*10*(1.6+.06)*.05)
        for args in [(10,50,2,0,0,'FN'),(10,-1,2,0,1,'FN'),(10,50,2,0,1,'FFN'),(1e308,1e308,2,0,1,'FN')]:
            with self.assertRaises(ValueError):voltage_drop(*args)

    def test_radial_lengths_and_real_results_no_mutation(self):
        p=fixture();before=copy.deepcopy(p);a=calculate_project(p)
        self.assertEqual(validate_entity('Project',p),[]);self.assertEqual(p,before)
        self.assertEqual([r['distance'] for r in a['results']],[28,35,51])
        for r,length in zip(a['results'],[28,35,51]):
            self.assertEqual(r['status'],'calculated',r['pending'])
            self.assertAlmostEqual(r['totalDrop'],math.sqrt(3)*20*2*length/1000)
            self.assertEqual(r['startingStatus'],'not_calculated')
            self.assertEqual(len(r['criteria']),2)
            self.assertAlmostEqual(sum(s['contribution'] for s in r['segments']),100)

    def test_complete_route_includes_feeder_and_separate_terminal(self):
        p=feeder_fixture();r=calculate_project(p)['results'][-1]
        self.assertEqual(r['status'],'calculated',r['pending']);self.assertEqual(r['distance'],71)
        self.assertEqual(r['segments'][0]['current'],60)
        self.assertAlmostEqual(r['totalDrop'],math.sqrt(3)*2*(60*20+20*51)/1000)
        self.assertGreater(r['totalPercent'],r['terminalPercent'])

    def test_total_and_terminal_limits_independent(self):
        p=feeder_fixture()
        p['segments'][-1]['length']=90
        a=calculate_project(p)['results'][0]
        self.assertEqual(a['status'],'review');self.assertEqual(a['criteria'][0]['status'],'failed');self.assertEqual(a['criteria'][1]['status'],'verified')
        p['voltagePolicy']['originType']='own_transformer'
        self.assertEqual(calculate_project(p)['results'][0]['status'],'calculated')
        p=fixture();p['voltagePolicy']['originType']='generator';p['segments'][0]['length']=240
        a=calculate_project(p)['results'][0]
        self.assertEqual(a['status'],'review');self.assertEqual(a['criteria'][0]['status'],'verified');self.assertEqual(a['criteria'][1]['status'],'failed')

    def test_phase_neutral_transition_and_full_chain(self):
        p=feeder_fixture();load=p['consumers'][0];load.update(connection='FN',phaseSet='A',voltage=220,power=2200)
        cable=p['cables'][0];cable['design']['connection']='FN'
        p['conductors']=[w for w in p['conductors'] if not(w['cableId']==cable['id'] and w['role']=='L3')]
        for w in p['conductors']:
            if w['cableId']==cable['id'] and w['role']=='L2':w['role']='N'
        feeder=p['cables'][-1];feeder['design']['connection']='3FN'
        p['conductors'].append(entity('Conductor',cableId=feeder['id'],circuitId=feeder['circuitId'],role='N',section=10,material='Cu',insulation='PVC',formation='single_core'))
        for c in [cable,feeder]:c['voltageImpedance']['signature']=impedance_signature(p,c)
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'calculated',r['pending'])
        self.assertAlmostEqual(r['totalDrop'],sum(s['percent'] for s in r['segments'])*220/100)
        self.assertAlmostEqual(r['terminalPercent'],2*10*2*.028/220*100)
        self.assertFalse(compatible(dict(connection='3F',roles=['L1','L2','L3'],voltage=380),dict(connection='FN',roles=['L1','N'],voltage=220)))

    def test_missing_data_never_zero_or_approved(self):
        for modify in [lambda p:p['voltagePolicy'].update(originConfirmed=False),lambda p:p['cables'][0]['voltageImpedance'].update(confirmed=False),lambda p:p['conductors'][0].update(section=None),lambda p:p['circuits'][0]['voltageStudy'].update(scopeConfirmed=False),lambda p:p['cables'][0]['voltageImpedance']['source'].update(reference='')]:
            p=fixture();modify(p);r=calculate_project(p)['results'][0]
            self.assertEqual(r['status'],'pending');self.assertIsNone(r['totalDrop']);self.assertTrue(r['pending'])
        p=fixture();p['nodes'].append(entity('Node',kind='origin',label='Origem desconectada'));p['voltagePolicy']['originNodeId']=p['nodes'][-1]['id']
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')

    def test_construction_invalidates_impedance_but_length_recalculates(self):
        for modify in [lambda p:p['conductors'][0].update(section=16),lambda p:p['segments'][0].update(temperature=40),lambda p:p['segments'][0].update(installationMethod='C'),lambda p:p['consumers'][0].update(frequency=50)]:
            p=fixture();modify(p);self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        p=fixture();p['segments'][0]['length']=56
        self.assertAlmostEqual(calculate_project(p)['results'][0]['totalDrop'],voltage_drop(20,56,2,.08,1,'3F'))

    def test_unsupported_conditions_and_temperature(self):
        for modify in [lambda p:p['cables'][0].update(quantity=2),lambda p:p['consumers'][0].update(balanced=False),lambda p:p['cables'][0]['design'].update(harmonicsPercent=10),lambda p:p['cables'][0]['voltageImpedance'].update(temperature=95),lambda p:p['consumers'][0].update(phaseSet='AB')]:
            p=fixture();modify(p);self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        p=fixture();p['consumers'][0]['balanced']=False;p['circuits'][0]['voltageStudy']['balanced']=True
        p['cables'][0]['design'].update(manualIb=30,manualIbConfirmed=True,manualIbSource='Teste')
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')

    def test_custom_limit_is_additional_and_referenced(self):
        p=fixture();c=p['circuits'][0];c['voltageDropLimit']=.1
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        c['limitSource']['reference']='Projeto';r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'review');self.assertEqual(r['criteria'][-1]['status'],'failed')
        c['voltageDropLimit']=100;p['segments'][0]['length']=300
        self.assertEqual(calculate_project(p)['results'][0]['status'],'review')

    def test_operation_revision_atomicity_and_reconfirmation(self):
        p=fixture();before=copy.deepcopy(p);c=p['cables'][0];z=copy.deepcopy(c['voltageImpedance']);z['resistance']=3
        a=voltage_request(dict(project=p,request=token(p),operation=dict(collection='cables',id=c['id'],data={'voltageImpedance':z})))
        self.assertEqual(p,before);self.assertEqual(a['project']['revision'],p['revision']+1)
        self.assertEqual(a['analysis']['inputRevision'],a['project']['revision']);self.assertEqual(a['analysis']['results'][0]['status'],'calculated')
        for data in [{'quantity':2},{'voltageImpedance':{**z,'resistance':-1}}]:
            with self.assertRaises(ValueError):voltage_request(dict(project=p,request=token(p),operation=dict(collection='cables',id=c['id'],data=data)))
        with self.assertRaises(ValueError):voltage_request(dict(project=p,request={**token(p),'inputRevision':99}))
        self.assertEqual(p,before)


class VoltageHttpTests(IndustrialHttpTests):
    def test_voltage_api(self):
        p=fixture()
        request=Request(self.url+'/api/industrial/voltage',data=json.dumps(dict(project=p,request=token(p))).encode(),headers={'Content-Type':'application/json'})
        with urlopen(request) as response:
            body=json.load(response);self.assertEqual(body['analysis']['results'][0]['status'],'calculated')
