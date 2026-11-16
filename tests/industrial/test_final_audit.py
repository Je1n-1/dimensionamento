import copy
import json
import math
import unittest
from industrial.audit_fixture import installation
from voltcalc.industrial.contracts import validate_entity,create_entity as e
from voltcalc.industrial.overview import calculate_project
from voltcalc.industrial.voltage import calculate_project as voltage
from voltcalc.industrial.conductors import calculate_project as conductors
from voltcalc.industrial.infrastructure import calculate_project as infrastructure
from voltcalc.industrial.currents import calculate_project as currents
from voltcalc.industrial.reports import build_report


class FinalIntegrationAudit(unittest.TestCase):
    def test_30_consumers_multiple_panels_branches_and_shared_circuits(self):
        p=installation();before=copy.deepcopy(p)
        self.assertEqual(validate_entity('Project',p),[])
        a=calculate_project(p)
        self.assertEqual(p,before);self.assertEqual(a['errors'],[])
        self.assertEqual(a['summary']['consumers'],30);self.assertEqual(a['summary']['panels'],4)
        self.assertEqual(len(p['circuits']),30);self.assertEqual(len(p['segments']),33)
        self.assertEqual(a['topology']['issues'],[])
        self.assertEqual([len(s['circuitIds']) for s in a['topology']['segments'][:6]],[1,5,4,3,2,1])
        self.assertTrue(all(r['status']=='calculated' for r in a['conductors']['results']))
        self.assertTrue(all(r['status']=='calculated' for r in a['infrastructure']['results']))
        self.assertEqual(sum(r['status']=='calculated' for r in a['voltage']['results']),21)
        self.assertEqual(sum(r['status']=='pending' for r in a['voltage']['results']),9)
        self.assertEqual(a['summary']['status'],'partial');self.assertEqual(a['summary']['protection'],'not_implemented')

    def test_independent_reference_arithmetic(self):
        p=installation();a=calculate_project(p)
        # 3 x (motor 3000/.9 + 5 electrical 5 A three-phase loads + 4 lighting loads).
        expected=3*(3000/.9+5*380*math.sqrt(3)*5+4*220)
        self.assertAlmostEqual(a['summary']['power'],expected)
        self.assertAlmostEqual(a['conductors']['results'][1]['ib'],8)
        light=a['voltage']['results'][2]
        self.assertAlmostEqual(light['distance'],25)
        feeder_percent=math.sqrt(3)*60*.5*.010/380*100
        terminal_percent=2*1*2*.015/220*100
        self.assertAlmostEqual(light['totalPercent'],feeder_percent+terminal_percent)
        self.assertAlmostEqual(light['terminalPercent'],terminal_percent)
        # Shared lighting circuit carries declared 2 A on either branch, not an inferred 1 A.
        shared=a['voltage']['results'][8]
        self.assertAlmostEqual(shared['terminalPercent'],2*2*2*.005/220*100)
        self.assertAlmostEqual(a['infrastructure']['results'][0]['occupancy'],5*(12/100)**2*100)

    def test_distance_motor_temperature_cable_and_infrastructure_changes(self):
        p=installation();base=calculate_project(p)
        q=copy.deepcopy(p);q['segments'][1]['length']*=2
        self.assertGreater(voltage(q)['results'][0]['totalPercent'],base['voltage']['results'][0]['totalPercent'])
        q=copy.deepcopy(p);q['motors'][0]['plateCurrent']=12
        self.assertEqual(conductors(q)['results'][1]['ib'],12)
        self.assertGreater(voltage(q)['results'][0]['totalPercent'],base['voltage']['results'][0]['totalPercent'])
        q=copy.deepcopy(p);q['segments'][1]['temperature']=50
        self.assertGreaterEqual(conductors(q)['results'][1]['section'],base['conductors']['results'][1]['section'])
        self.assertEqual(voltage(q)['results'][0]['status'],'pending')
        q=copy.deepcopy(p);q['conductors'][5]['section']=50
        self.assertEqual(infrastructure(q)['results'][1]['status'],'pending')
        self.assertEqual(voltage(q)['results'][0]['status'],'pending')
        q=copy.deepcopy(p);q['infrastructures'][0]['innerDiameter']=20
        self.assertEqual(infrastructure(q)['results'][0]['status'],'review')
        self.assertAlmostEqual(infrastructure(q)['results'][0]['occupancy'],180)

    def test_earthing_metadata_never_implies_protection_verification(self):
        p=installation()
        for scheme in ('TT','TN-S','TN-C','TN-C-S','IT'):
            q=copy.deepcopy(p);q['supply']['earthing']=scheme
            for panel in q['panels']:panel['supply']['earthing']=scheme
            self.assertEqual(validate_entity('Project',q),[])
            a=calculate_project(q)
            self.assertEqual(a['summary']['protection'],'not_implemented')
            self.assertEqual(build_report(q)['status'],'partial')
        # PEN is not silently interpreted as separate N and PE.
        q=copy.deepcopy(p);q['conductors'][3]['role']='PEN'
        self.assertEqual(conductors(q)['results'][0]['status'],'pending')
        self.assertTrue(any('PEN' in issue['message'] for issue in calculate_project(q)['topology']['issues']))

    def test_three_phase_with_without_neutral_and_unknown_harmonics(self):
        p=installation();rows=conductors(p)['results']
        self.assertIsNotNone(rows[0]['neutral']);self.assertIsNone(rows[1]['neutral'])
        p['cables'][0]['design']['harmonicsPercent']=None
        self.assertEqual(conductors(p)['results'][0]['status'],'pending')
        p['cables'][0]['design']['harmonicsPercent']=34
        self.assertEqual(conductors(p)['results'][0]['status'],'pending')

    def test_unsupported_loads_sources_and_coverage_remain_visible(self):
        p=installation();a=calculate_project(p);r=build_report(p)
        self.assertEqual(len(a['currents']),30)
        for i in (3,4,5):
            self.assertEqual(a['voltage']['results'][i]['status'],'pending')
            self.assertIsNone(a['voltage']['results'][i]['totalDrop'])
        text=json.dumps(r,ensure_ascii=False)
        for word in ['QA Etapa 11','não implementada','Proteção','partida']:
            self.assertTrue(word in text,word)
        self.assertEqual(r['summary']['consumers'],30)

    def test_plate_is_distinct_from_power_based_estimate(self):
        p=installation();a=currents(p)[0];values={m['code']:m['value'] for m in a['measurements']}
        self.assertAlmostEqual(values['calculated_a'],3000/(.9*.85*380*math.sqrt(3)))
        self.assertEqual(values['selected_a'],8);self.assertEqual(values['design_minimum_a'],8)
        p['motors'][0].update(usesServiceFactor=True,serviceFactor=1.15)
        values={m['code']:m['value'] for m in currents(p)[0]['measurements']}
        self.assertAlmostEqual(values['design_minimum_a'],9.2)
