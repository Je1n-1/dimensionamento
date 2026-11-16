import copy
import json
import unittest
from urllib.request import Request,urlopen
from industrial.test_voltage import fixture,feeder_fixture
from industrial.test_structure import IndustrialHttpTests
from voltcalc.industrial.contracts import CONTRACT,create_entity as entity,validate_entity
from voltcalc.industrial.overview import VERSION,calculate_project,mutate_overview,overview_request
from voltcalc.industrial.voltage import calculate_project as voltage

def token(p):return dict(projectId=p['id'],inputRevision=p['revision'],domain='overview',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)

class OverviewTests(unittest.TestCase):
    def test_consolidates_current_revision_without_mutation(self):
        p=fixture();before=copy.deepcopy(p);a=calculate_project(p)
        self.assertEqual(p,before);self.assertEqual(a['summary']['consumers'],3)
        self.assertEqual(a['summary']['powerKnown'],3);self.assertGreater(a['summary']['power'],39000)
        self.assertEqual(a['summary']['status'],'partial');self.assertEqual(a['summary']['protection'],'not_implemented')
        self.assertEqual(a['voltage'],voltage(p))
        for name in ['topology','conductors','infrastructure','voltage']:self.assertEqual(a[name]['inputRevision'],p['revision'])

    def test_visual_positions_do_not_change_electrical_results(self):
        p=fixture();before=copy.deepcopy(p);old=voltage(p)
        new=mutate_overview(p,dict(action='positions',positions=[dict(id=p['nodes'][1]['id'],position=dict(x=-100,y=600))]))
        self.assertEqual(p,before);self.assertEqual(new['revision'],p['revision']);self.assertEqual(voltage(new),old)
        self.assertEqual(new['segments'],p['segments']);self.assertEqual(new['cables'],p['cables'])
        self.assertEqual(new['currentStage'],9)

    def test_distance_persists_invalidates_and_recalculates(self):
        p=fixture();r=entity('CalculationResult',domain='currents',targetId=p['consumers'][0]['id'],inputRevision=p['revision'],engineVersion=CONTRACT['engineVersion'],rulesVersion=CONTRACT['currentRules']['version']);p['results'].append(r)
        new=mutate_overview(p,dict(action='segment',id=p['segments'][0]['id'],data=dict(length=56,notes='Percurso conferido')))
        self.assertEqual(new['revision'],p['revision']+1);self.assertEqual(new['results'][0]['status'],'invalidated')
        self.assertEqual(new['segments'][0]['notes'],'Percurso conferido')
        self.assertIsNone(new['cables'][0]['design']['scopeConfirmed'])
        self.assertAlmostEqual(voltage(new)['results'][0]['totalDrop'],voltage(p)['results'][0]['totalDrop']*2)

    def test_connection_edit_and_cycle_rejected_atomically(self):
        p=fixture();before=copy.deepcopy(p);segment=p['segments'][1]
        new=mutate_overview(p,dict(action='segment',id=segment['id'],data=dict(fromNodeId=p['nodes'][0]['id'])))
        self.assertEqual(new['segments'][1]['fromNodeId'],p['nodes'][0]['id'])
        # Circuit memberships remain explicit and are not silently rewritten.
        self.assertEqual(new['circuits'],p['circuits'])
        with self.assertRaises(ValueError):mutate_overview(p,dict(action='segment',id=segment['id'],data=dict(toNodeId=p['nodes'][0]['id'])))
        self.assertEqual(p,before)

    def test_invalid_positions_and_operations(self):
        p=fixture();before=copy.deepcopy(p);id=p['nodes'][0]['id']
        for rows in [[dict(id='missing',position=dict(x=1,y=2))],[dict(id=id,position=dict(x=float('inf'),y=0))],[dict(id=id,position=dict(x=1,y=2))]*2,[dict(id=id,position=dict(x=True,y=2))]]:
            with self.assertRaises(ValueError):mutate_overview(p,dict(action='positions',positions=rows))
        with self.assertRaises(ValueError):mutate_overview(p,dict(action='segment',id=p['segments'][0]['id'],data=dict(length=-1)))
        with self.assertRaises(ValueError):mutate_overview(p,dict(action='segment',id=p['segments'][0]['id'],data=dict(temperature=10)))
        self.assertEqual(p,before)

    def test_partial_power_and_domain_errors_are_explicit(self):
        p=fixture();p['consumers'][0]['power']=None
        a=calculate_project(p);self.assertEqual(a['summary']['powerKnown'],2)
        p['consumers'][0]['phaseSet']='A'
        a=calculate_project(p);self.assertTrue(a['errors']);self.assertIsNone(a['conductors'])
        self.assertIsNotNone(a['infrastructure']);self.assertEqual(a['summary']['status'],'partial')

    def test_layout_envelope_and_stale_request(self):
        p=fixture();op=dict(action='positions',positions=[dict(id=p['nodes'][0]['id'],position=dict(x=42,y=80))])
        answer=overview_request(dict(project=p,request=token(p),operation=op))
        self.assertIsNone(answer['analysis']);self.assertEqual(answer['project']['revision'],p['revision'])
        with self.assertRaises(ValueError):overview_request(dict(project=p,request={**token(p),'inputRevision':999}))

    def test_feeder_consolidation_and_empty(self):
        p=feeder_fixture();a=calculate_project(p)
        self.assertEqual(a['summary']['segments'],4);self.assertEqual(a['voltage']['results'][0]['distance'],48)
        empty=calculate_project(entity('Project',name='Vazio'))
        self.assertIsNone(empty['summary']['power']);self.assertIsNone(empty['summary']['maxDrop']);self.assertEqual(empty['summary']['status'],'partial')

class OverviewHttpTests(IndustrialHttpTests):
    def test_overview_api(self):
        p=fixture();req=Request(self.url+'/api/industrial/overview',data=json.dumps(dict(project=p,request=token(p))).encode(),headers={'Content-Type':'application/json'})
        with urlopen(req) as response:self.assertEqual(json.load(response)['analysis']['summary']['consumers'],3)
