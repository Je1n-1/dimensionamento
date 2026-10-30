import copy
import json
import math
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from industrial.test_topology import radial
from industrial.test_structure import IndustrialHttpTests
from voltcalc.industrial.contracts import CONTRACT, create_entity as entity, validate_entity
from voltcalc.industrial.conductors import calculate_project, conductor_request
from voltcalc.industrial.conductor_rules import DATA, VERSION, Pending, capacity, temperature_factor, grouping_factor, pe_section
from voltcalc.industrial.topology import mutate_topology


def fixture():
    p=radial()
    for c in p['consumers']:
        c.update(type='heating',quantity=1,power=math.sqrt(3)*380*20,unit='W',powerBasis='electrical',powerFactor=1,voltage=380,frequency=60,connection='3F',balanced=True,phaseSet='ABC')
    for c in p['circuits']: c.update(purpose='power',role='terminal')
    for c in p['conductors']: c.update(material='Cu',insulation='PVC')
    for c in p['cables']:
        c['design'].update(connection='3F',scopeConfirmed=True,peLocation='included')
    for s in p['segments']:
        s.update(temperature=35)
        s['thermal'].update(methodConfirmed=True,noRadiation=True,groupingConfirmed=True,grouping='conservative')
    return p

def token(p):return dict(projectId=p['id'],inputRevision=p['revision'],domain='conductors',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)


class ConductorTests(unittest.TestCase):
    def test_worst_shared_segment_and_no_mutation(self):
        p=fixture();before=copy.deepcopy(p);a=calculate_project(p)
        self.assertEqual(p,before)
        self.assertEqual([r['section'] for r in a['results']],[10,10,10])
        r=a['results'][-1]
        self.assertEqual([s['circuits'] for s in r['segments']],[3,2,1])
        self.assertAlmostEqual(r['segments'][0]['factor'],.94/math.sqrt(3))
        self.assertAlmostEqual(r['ib'],20)
        self.assertEqual(r['pe'],10);self.assertIsNone(r['neutral'])
        self.assertTrue(any('Proteção' in s for s in r['pending']))
        self.assertNotIn('conforme',json.dumps(a).lower())
        self.assertFalse(any(c['code']=='protection' for c in r['criteria']))

    def test_table_cells_and_all_rows(self):
        self.assertEqual(capacity('B1','Cu','PVC',3,None,2.5),(21,36))
        self.assertEqual(capacity('B1','Cu','XLPE',3,None,2.5),(28,37))
        self.assertEqual(capacity('E','Cu','PVC',2,None,16),(94,38))
        self.assertEqual(capacity('F','Cu','EPR',3,'trefoil',35),(169,39))
        self.assertEqual(capacity('G','Al','XLPE',3,'vertical',1000),(1472,39))
        for table,metals in DATA['tables'].items():
            self.assertEqual(len(metals['Cu']),24);self.assertEqual(len(metals['Al']),16)
            for material,rows in metals.items():
                for row in rows.values():
                    self.assertEqual(len(row),12 if int(table)<38 else 7)
                    self.assertTrue(all(v>0 for v in row))
        with self.assertRaises(Pending): capacity('G','Al','PVC',3,'horizontal',630)
        with self.assertRaises(Pending): capacity('F','Cu','PVC',3,None,4)
        with self.assertRaises(Pending): capacity('G','Cu','PVC',2,'horizontal',4)

    def test_temperature_rounding_bounds_and_no_extrapolation(self):
        self.assertEqual(temperature_factor(34,'PVC'),(.94,35))
        self.assertEqual(temperature_factor(30,'PVC'),(1,30))
        self.assertEqual(temperature_factor(20,'EPR',True),(1,20))
        self.assertEqual(temperature_factor(80,'XLPE',True),(.38,80))
        for t in [None,-5,9,81]:
            with self.assertRaises(Pending):temperature_factor(t,'PVC')
        with self.assertRaises(Pending):temperature_factor(65,'PVC')

    def test_group_tables_boundaries(self):
        s=fixture()['segments'][0];s['thermal'].update(grouping='bundle')
        for n,f in [(1,1),(2,.8),(8,.52),(9,.5),(11,.5),(12,.45),(15,.45),(16,.41),(19,.41),(20,.38),(200,.38)]:
            self.assertEqual(grouping_factor(s,n)[0],f)
        s.update(installationMethod='C');s['thermal']['grouping']='ceiling'
        self.assertEqual(grouping_factor(s,1)[0],.95)
        s['thermal'].update(grouping='layers',layers=2,circuitsPerLayer=3)
        self.assertEqual(grouping_factor(s,6)[0],.62)
        with self.assertRaises(Pending):grouping_factor(s,5)
        s.update(installationMethod='D',soilDepth=.7,soilResistivity=2.5)
        s['thermal'].update(grouping='direct',spacing='0.125')
        self.assertEqual(grouping_factor(s,3)[0],.75)
        s['thermal'].update(grouping='buried_multi',spacing='0.5')
        self.assertEqual(grouping_factor(s,4)[0],.85)
        s['thermal']['grouping']='buried_single'
        self.assertEqual(grouping_factor(s,4)[0],.8)
        with self.assertRaises(Pending):grouping_factor(s,7)
        s.update(soilDepth=1)
        with self.assertRaises(Pending):grouping_factor(s,2)

    def test_soil_correction_only_applicable_conditions(self):
        s=fixture()['segments'][0];s.update(installationMethod='D',soilDepth=.7,soilResistivity=1.6)
        s['thermal'].update(grouping='buried_multi')
        self.assertEqual(grouping_factor(s,1)[1],1.05)
        with self.assertRaises(Pending):grouping_factor(s,2)
        s['thermal']['grouping']='direct'
        with self.assertRaises(Pending):grouping_factor(s,1)

    def test_no_silent_unknown_conditions(self):
        for field in ['methodConfirmed','noRadiation','groupingConfirmed']:
            p=fixture();p['segments'][0]['thermal'][field]=None
            self.assertTrue(all(r['section'] is None for r in calculate_project(p)['results']))
        p=fixture();p['cables'][0]['design']['scopeConfirmed']=None
        self.assertIsNone(calculate_project(p)['results'][0]['section'])

    def test_group_unknown_or_mixed_insulations_blocked(self):
        for value in [None,'XLPE']:
            p=fixture();p['conductors'][0]['insulation']=value
            self.assertTrue(all(r['section'] is None for r in calculate_project(p)['results']))

    def test_parallel_and_pen_are_not_silently_sized(self):
        p=fixture();p['cables'][0]['quantity']=2
        self.assertTrue(all(r['section'] is None for r in calculate_project(p)['results']))
        p=fixture();p['conductors'][3]['role']='PEN'
        self.assertIn('PEN',calculate_project(p)['results'][0]['pending'][0])

    def test_homogeneous_requires_known_sections_and_candidate_range(self):
        p=fixture()
        for s in p['segments']:s.update(temperature=30);s['thermal']['grouping']='bundle'
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        for c in p['conductors']:c['section']=6
        self.assertEqual(calculate_project(p)['results'][0]['section'],6)
        for c in p['conductors'][4:]:c['section']=120
        r=calculate_project(p)['results'][0]
        self.assertGreaterEqual(r['section'],70)

    def test_neutral_four_loaded_and_high_harmonics(self):
        p=fixture();b=p['cables'][0];c=p['consumers'][0];c['connection']='3FN'
        p['conductors'].append(entity('Conductor',circuitId=b['circuitId'],cableId=b['id'],role='N',material='Cu',insulation='PVC',formation='single_core'))
        b['design'].update(connection='3FN',harmonicsPercent=20)
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['loaded'],4);self.assertEqual(r['neutral'],r['section']);self.assertEqual(r['segments'][0]['fn'],.86)
        b['design']['harmonicsPercent']=34
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        b['design']['harmonicsPercent']=None
        self.assertIsNone(calculate_project(p)['results'][0]['section'])

    def test_loaded_functions_do_not_equal_supply_phases_blindly(self):
        p=fixture();p['cables'][0]['design']['connection']='FN'
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        p=fixture();p['circuits'][0]['loadedConductors']=2
        self.assertIn('diverge',calculate_project(p)['results'][0]['pending'][0])

    def test_pe_rules_and_missing_pe_does_not_assert_protection(self):
        for s,expected in [(1.5,1.5),(16,16),(25,16),(35,16),(50,25),(70,35),(95,50),(120,70)]:self.assertEqual(pe_section(s,'Cu','included'),expected)
        self.assertEqual(pe_section(1.5,'Cu','exposed'),4)
        self.assertEqual(pe_section(1.5,'Cu','protected'),2.5)
        self.assertEqual(pe_section(16,'Al','exposed'),16)
        p=fixture();p['conductors']=[c for c in p['conductors'] if c['role']!='PE']
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'calculated');self.assertIsNone(r['pe']);self.assertIn('PE ausente',r['pending'][0])

    def test_aluminum_requires_industrial_conditions(self):
        p=fixture()
        for c in p['conductors']:c['material']='Al'
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        for b in p['cables']:b['design']['aluminumConditionsConfirmed']=True
        self.assertGreaterEqual(calculate_project(p)['results'][0]['section'],16)
        p['circuits'][0]['purpose']='control'
        self.assertIsNone(calculate_project(p)['results'][0]['section'])

    def test_buried_group_requires_homogeneous_sections(self):
        p=fixture()
        for s in p['segments']:
            s.update(installationMethod='D',soilDepth=.7,soilResistivity=2.5)
            s['thermal'].update(grouping='buried_single',spacing='0')
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        for c in p['conductors']:c['section']=6
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['section'],6)
        self.assertAlmostEqual(r['segments'][0]['factor'],.84*.7)

    def test_incompatible_formation_and_method(self):
        p=fixture();p['segments'][0]['installationMethod']='E'
        self.assertIn('multipolar',calculate_project(p)['results'][0]['pending'][0])
        p=fixture();p['segments'][0]['installationMethod']='C'
        p['segments'][0]['thermal']['grouping']='perforated'
        for c in p['conductors']:c['section']=6
        self.assertIn('incompatível',calculate_project(p)['results'][0]['pending'][0])

    def test_manual_ib_requires_provenance_and_not_below_load(self):
        p=fixture();d=p['cables'][0]['design'];d.update(manualIb=10,manualIbSource='Estudo',manualIbConfirmed=True)
        self.assertIn('menor',calculate_project(p)['results'][0]['pending'][0])
        d['manualIb']=30
        self.assertEqual(calculate_project(p)['results'][0]['ib'],30)
        d['manualIbSource']=''
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        p=fixture();p['circuits'][0]['role']='feeder'
        self.assertIn('Ib pendente',calculate_project(p)['results'][0]['pending'][0])

    def test_quantity_applied_once_and_motor_no_estimate_nominal(self):
        p=fixture();p['consumers'][0]['quantity']=3
        self.assertAlmostEqual(calculate_project(p)['results'][0]['ib'],60)
        p['consumers'][0]['type']='motor'
        self.assertIsNone(calculate_project(p)['results'][0]['ib'])

    def test_motor_nominal_current_and_service_factor_from_stage4(self):
        p=fixture();c=p['consumers'][0]
        c.update(type='motor',power=20,unit='cv',powerBasis='mechanical',powerFactor=.85,efficiency=.9)
        p['motors'].append(entity('Motor',consumerId=c['id'],catalogId='weg-w21-fockink-2006-v1',poles=4,nominalConditionsConfirmed=True,exclusiveS1Circuit=True,usesServiceFactor=True,serviceFactor=1.15))
        r=calculate_project(p)['results'][0]
        self.assertAlmostEqual(r['ib'],34.96);self.assertEqual(r['section'],16)
        self.assertTrue(any('Fonte' in line or 'catálogo' in line for line in r['trace']))

    def test_adopted_section_failure_is_explicit_and_not_overwritten(self):
        p=fixture();p['conductors'][0]['section']=1.5
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['section'],10);self.assertTrue(any('Revisar seção' in x for x in r['pending']))
        self.assertEqual(p['conductors'][0]['section'],1.5)

    def test_consumer_phase_must_exist_in_formation(self):
        p=fixture();p['consumers'][0].update(connection='FN',phaseSet='C',power=4400,voltage=220)
        b=p['cables'][0];b['design']['connection']='FN'
        p['conductors']=[c for c in p['conductors'] if c['cableId']!=b['id'] or c['role'] in ('L1','PE')]
        p['conductors'].append(entity('Conductor',circuitId=b['circuitId'],cableId=b['id'],role='N',material='Cu',insulation='PVC',formation='single_core'))
        self.assertIn('Fases cadastradas',calculate_project(p)['results'][0]['pending'][0])

    def test_unknown_methods_and_no_adequate_section(self):
        p=fixture();p['segments'][0]['installationMethod']='Bandeja'
        self.assertIsNone(calculate_project(p)['results'][0]['section'])
        p=fixture();p['cables'][0]['design'].update(manualIb=99999,manualIbConfirmed=True,manualIbSource='Estudo específico')
        r=calculate_project(p)['results'][0]
        self.assertIsNone(r['section']);self.assertIn('Nenhuma seção',r['pending'][0])

    def test_atomic_inputs_and_revision_protocol(self):
        p=fixture();before=copy.deepcopy(p)
        op=dict(collection='cables',id=p['cables'][0]['id'],data=dict(material='Al',adoptedSection=25))
        a=conductor_request(dict(project=p,request=token(p),operation=op))
        self.assertEqual(p,before);self.assertEqual(a['project']['revision'],p['revision']+1)
        self.assertEqual(a['project']['currentStage'],6);self.assertEqual(validate_entity('Project',a['project']),[])
        self.assertEqual(a['project']['conductors'][0]['section'],25);self.assertIsNone(a['project']['conductors'][3]['section'])
        for data in [dict(material='steel'),dict(adoptedSection=True),dict(design={}),dict(section=5)]:
            with self.assertRaises(ValueError):conductor_request(dict(project=p,request=token(p),operation=op|dict(data=data)))
        with self.assertRaises(ValueError):conductor_request(dict(project=p,request=token(p)|dict(inputRevision=True)))
        with self.assertRaises(ValueError):conductor_request(dict(project=p,request=token(p)|dict(rulesVersion='1997')))
        self.assertEqual(p,before)

    def test_structure_edit_clears_confirmations(self):
        p=fixture();p['cables'][0]['design'].update(manualIbConfirmed=True)
        changed=mutate_topology(p,dict(action='save',collection='segments',id=p['segments'][0]['id'],data=dict(temperature=40)))
        self.assertIsNone(changed['cables'][0]['design']['scopeConfirmed'])
        self.assertIsNone(changed['cables'][0]['design']['manualIbConfirmed'])
        self.assertIsNone(changed['segments'][0]['thermal']['methodConfirmed'])


class ConductorHttpTests(IndustrialHttpTests):
    def test_conductor_route_and_invalid_source(self):
        p=fixture();payload=dict(project=p,request=token(p))
        request=Request(self.url+'/api/industrial/conductors',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'},method='POST')
        with urlopen(request) as response:body=json.load(response)
        self.assertEqual(body['analysis']['results'][0]['section'],10)
        payload['request']['rulesVersion']='1997'
        request.data=json.dumps(payload).encode()
        with self.assertRaises(HTTPError) as error:urlopen(request)
        self.assertEqual(error.exception.code,400)

if __name__=='__main__':unittest.main()
