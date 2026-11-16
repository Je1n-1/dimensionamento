import copy
import hashlib
import json
import math
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import test_engine
from voltcalc.paths import ROOT
from voltcalc.industrial.contracts import CONTRACT, create_entity as entity, validate_entity
from voltcalc.industrial.catalogs import CATALOG, lookup_motor
from voltcalc.industrial.power import convert_power
from voltcalc.industrial.currents import calculate_project, current_request
from voltcalc.industrial.current_rules import VERSION


def fixture(**overrides):
    consumer = entity('Consumer', type='motor', tag='M1', power=20, unit='cv',
                      powerBasis='mechanical', voltage=380, frequency=60,
                      connection='3F', phaseSet='ABC', balanced=True, powerFactor=.85, efficiency=.9,
                      **overrides)
    motor = entity('Motor', consumerId=consumer['id'], poles=4,
                   catalogId=CATALOG['id'], nominalConditionsConfirmed=True,
                   exclusiveS1Circuit=True, usesServiceFactor=False)
    project = entity('Project', name='QA correntes', consumers=[consumer], motors=[motor])
    return project, project['consumers'][0], project['motors'][0]


def result(project):
    r = calculate_project(project)[0]
    assert not validate_entity('CalculationResult', r)
    return r, {m['code']: m['value'] for m in r['measurements']}


def request(project):
    return {'project': project, 'request': {'projectId': project['id'], 'inputRevision': project['revision'],
            'domain': 'currents', 'engineVersion': CONTRACT['engineVersion'], 'rulesVersion': VERSION}}


class PowerCurrentTests(unittest.TestCase):
    def test_units_and_distinct_bases(self):
        for value, unit, basis, expected in [(2,'W','electrical',2),(2,'kW','electrical',2000),
                (2,'VA','apparent',2),(2,'kVA','apparent',2000),(1,'cv','mechanical',735.49875),
                (1,'hp','mechanical',745.6998715822702)]:
            with self.subTest(unit=unit):
                self.assertAlmostEqual(convert_power(value,unit,basis),expected)
        for unit,basis in [('VA','mechanical'),('kVA','electrical'),('cv','apparent'),('hp','electrical'),('W','apparent')]:
            with self.assertRaises(ValueError): convert_power(1,unit,basis)
        for value in [0,-1,True,float('inf'),float('nan')]:
            with self.assertRaises(ValueError): convert_power(value,'W','electrical')

    def test_mechanical_formula_uses_both_efficiency_and_pf(self):
        p,c,m=fixture();m['currentPreference']='formula'
        r,v=result(p)
        expected=20*735.49875/(.9*.85*math.sqrt(3)*380)
        self.assertAlmostEqual(v['calculated_a'],expected)
        self.assertAlmostEqual(v['selected_a'],expected)
        self.assertIsNone(v['nominal_a']);self.assertIsNone(v['design_minimum_a'])
        self.assertEqual(r['currentSource'],'formula')
        self.assertIn('não substitui',r['reason'])

    def test_apparent_formula_needs_no_pf_or_efficiency(self):
        p,c,m=fixture(); c.update(type='lighting',power=3.8,unit='kVA',powerBasis='apparent',powerFactor=None,efficiency=None)
        r,v=result(p)
        self.assertAlmostEqual(v['calculated_a'],10/math.sqrt(3))
        self.assertEqual(v['apparent_va'],3800);self.assertIsNone(v['electrical_w'])
        self.assertIn('ativa pendente',r['reason'])

    def test_active_power_does_not_apply_efficiency_twice(self):
        p,c,m=fixture();c.update(type='heating',power=10,unit='kW',powerBasis='electrical')
        r,v=result(p)
        self.assertAlmostEqual(v['calculated_a'],10000/(.85*math.sqrt(3)*380))
        self.assertIsNone(v['mechanical_w'])

    def test_fn_and_ff_use_voltage_across_load_without_sqrt3(self):
        for connection,phase in [('FN','B'),('FF','BC')]:
            p,c,m=fixture();c.update(type='lighting',power=2200,unit='W',powerBasis='electrical',powerFactor=1,connection=connection,phaseSet=phase,voltage=220,balanced=None)
            self.assertEqual(result(p)[1]['calculated_a'],10)

    def test_missing_and_unbalanced_are_pending_not_zero(self):
        for field in ('efficiency','powerFactor','voltage','connection','power','balanced'):
            p,c,m=fixture();m.update(currentPreference='formula',catalogId=None);c[field]=None
            if field=='connection':c['phaseSet']=None
            r,v=result(p)
            self.assertIsNone(v['calculated_a'],field);self.assertEqual(r['status'],'pending')
        p,c,m=fixture();m['currentPreference']='formula';c['balanced']=False
        self.assertIn('desequilibradas',result(p)[0]['reason'])

    def test_catalog_exact_poles_voltage_and_printed_power(self):
        p,c,m=fixture()
        for voltage,poles,expected in [(220,2,50.3),(380,4,30.4),(440,6,28.2),(380,8,30.6)]:
            c['voltage']=voltage;m['poles']=poles
            self.assertEqual(lookup_motor(c,m)[0],expected)
        c.update(voltage=380,power=15,unit='cv');m['poles']=4
        self.assertEqual(lookup_motor(c,m)[0],22.7)
        c.update(power=11,unit='kW');self.assertEqual(lookup_motor(c,m)[0],22.7)
        c.update(power=11000,unit='W');self.assertEqual(lookup_motor(c,m)[0],22.7)
        c.update(power=15*735.49875,unit='W')
        with self.assertRaises(ValueError):lookup_motor(c,m)

    def test_catalog_rejects_missing_or_out_of_scope(self):
        for changes in [{'power':500},{'power':20.1},{'voltage':400},{'frequency':50},{'connection':'FN'},{'unit':'hp'},{'powerBasis':'electrical'}]:
            p,c,m=fixture();c.update(changes);m['poles']=2
            with self.subTest(changes=changes), self.assertRaises(ValueError): lookup_motor(c,m)
        p,c,m=fixture();m['catalogId']=None
        with self.assertRaises(ValueError):lookup_motor(c,m)

    def test_catalog_transcription_source_and_missing_cells(self):
        self.assertEqual(len(CATALOG['rows']),35)
        self.assertEqual(hashlib.sha256((ROOT/CATALOG['sourceImage']).read_bytes()).hexdigest(),CATALOG['sha256'])
        for row in CATALOG['rows']:
            self.assertEqual(set(row['currents']),{'220','380','440'})
            for currents in row['currents'].values():
                self.assertEqual(set(currents),{'2','4','6','8'})
                self.assertTrue(all(v is None or v>0 for v in currents.values()))
        self.assertEqual(CATALOG['rows'][25]['currents']['220']['2'],289)
        self.assertIsNone(CATALOG['rows'][-1]['currents']['380']['2'])
        p,c,m=fixture();r,v=result(p)
        for term in ['2006','19/04/2021','47/111','W21','30.4','4 polos']: self.assertIn(term,r['trace'])

    def test_auto_priority_and_explicit_source_no_fallback(self):
        p,c,m=fixture();m['plateCurrent']=32
        r,v=result(p);self.assertEqual(r['currentSource'],'plate');self.assertEqual(v['selected_a'],32)
        m['currentPreference']='catalog';r,v=result(p);self.assertEqual(v['selected_a'],30.4)
        m.update(currentPreference='plate',plateCurrent=None)
        r,v=result(p);self.assertIsNone(v['selected_a']);self.assertIsNotNone(v['calculated_a']);self.assertEqual(r['status'],'pending')
        m['currentPreference']='catalog';c['frequency']=50
        r,v=result(p);self.assertIsNone(v['selected_a']);self.assertIn('60 Hz',r['reason'])

    def test_manual_catalog_requires_traceable_reference(self):
        p,c,m=fixture();m.update(catalogId=None,catalogCurrent=31)
        r,v=result(p);self.assertIsNone(v['nominal_a'])
        m['source'].update(manufacturer='WEG',model='Modelo informado',edition='2020',reference='Doc p.5')
        r,v=result(p);self.assertEqual(v['nominal_a'],31);self.assertIn('Doc p.5',r['trace'])

    def test_motor_ib_minimum_never_reduced_and_sf_is_intent(self):
        p,c,m=fixture();m['serviceFactor']=1.15
        self.assertEqual(result(p)[1]['design_minimum_a'],30.4)
        m['usesServiceFactor']=True
        self.assertAlmostEqual(result(p)[1]['design_minimum_a'],34.96)
        for sf in [None,1,.95]:
            m['serviceFactor']=sf;self.assertIsNone(result(p)[1]['design_minimum_a'])
        m.update(usesServiceFactor=False,serviceFactor=.95)
        self.assertEqual(result(p)[1]['design_minimum_a'],30.4)

    def test_ib_scope_unknown_groups_and_large_motor_pending(self):
        for field in ['exclusiveS1Circuit','nominalConditionsConfirmed','usesServiceFactor']:
            p,c,m=fixture();m[field]=None
            self.assertIsNone(result(p)[1]['design_minimum_a'])
        for changes in [{'quantity':2},{'power':250},{'voltage':None}]:
            p,c,m=fixture();c.update(changes);m.update(plateCurrent=100,currentPreference='plate')
            self.assertIsNone(result(p)[1]['design_minimum_a'])

    def test_partida_measurement_and_quantity_do_not_override_nominal(self):
        p,c,m=fixture();c['quantity']=3;m.update(startingCurrent=180,measuredCurrent=12)
        r,v=result(p)
        self.assertEqual(v['nominal_a'],30.4);self.assertEqual(v['selected_a'],30.4)
        self.assertEqual(v['starting_a'],180);self.assertEqual(v['measured_a'],12)
        self.assertAlmostEqual(v['electrical_total_w'],3*v['electrical_w'])
        self.assertAlmostEqual(v['apparent_total_va'],3*v['apparent_va'])

    def test_validation_overflow_finite_boolean_and_phase_errors(self):
        for changes in [{'efficiency':0},{'powerFactor':2},{'voltage':True},{'power':float('nan')},{'power':float('inf')},{'power':1e308,'unit':'kW'},{'power':1e308,'quantity':100},{'phaseSet':'A'}]:
            p,c,m=fixture();c.update(changes)
            with self.subTest(changes=changes), self.assertRaises((ValueError,OverflowError)):calculate_project(p)

    def test_atomic_input_and_no_later_stage_verdict(self):
        p,c,m=fixture();before=copy.deepcopy(p);r,v=result(p)
        self.assertEqual(p,before)
        self.assertTrue(all(k['status']=='pending' for k in r['criteria']))
        self.assertEqual(r['rulesVersion'],VERSION)
        self.assertEqual(p['circuits'],[]);self.assertEqual(p['conductors'],[])
        p['motors'].append(entity('Motor',consumerId=c['id']))
        with self.assertRaises(ValueError):calculate_project(p)

    def test_request_checks_version_project_and_revision(self):
        p,c,m=fixture();payload=request(p)
        self.assertEqual(len(current_request(payload)['results']),1)
        for key,value in [('domain','conductors'),('engineVersion','old'),('rulesVersion','1997'),('inputRevision',99),('projectId','other')]:
            bad=copy.deepcopy(payload);bad['request'][key]=value
            with self.assertRaises(ValueError):current_request(bad)
        payload['request']['inputRevision'] = False
        with self.assertRaises(ValueError):current_request(payload)


class CurrentHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_engine.ApiTests.setUpClass();cls.url=test_engine.ApiTests.url

    @classmethod
    def tearDownClass(cls):test_engine.ApiTests.tearDownClass()

    def test_post_isolated_endpoint_and_invalid_contract(self):
        p,c,m=fixture();payload=request(p)
        def send(data):
            return urlopen(Request(self.url+'/api/industrial/currents',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'}))
        with send(payload) as response:
            body=json.load(response);self.assertEqual(response.status,200)
            self.assertEqual(body['results'][0]['currentSource'],'catalog')
        payload['project']['consumers'][0]['powerFactor']=0
        with self.assertRaises(HTTPError) as error:send(payload)
        self.assertEqual(error.exception.code,400)
