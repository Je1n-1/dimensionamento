import copy
import json
import math
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from industrial.test_topology import radial
from industrial.test_structure import IndustrialHttpTests
from voltcalc.industrial.contracts import CONTRACT, create_entity as entity, validate_entity
from voltcalc.industrial.infrastructure import calculate_project, infrastructure_request, physical_signature
from voltcalc.industrial.infrastructure_rules import VERSION, conduit_limit, conduit_geometry, continuous_route


def source():
    return entity('Source',kind='catalog',manufacturer='Fabricante sintético QA',model='Cabo teste',edition='fixture',reference='Dados sintéticos para teste, não usar em projeto')


def fixture():
    p=radial()
    for c in p['conductors']:
        c.update(section=2.5,material='Cu',insulation='PVC',outerDiameter=4,source=source())
        c['physicalSignature']=physical_signature(p,'conductors',c)
    for i in p['infrastructures']:
        i.update(innerDiameter=25,dimensionSource=source(),location='outdoor',continuousLength=30,bends90=0,routeConfirmed=True,candidateDiameters=[16,20,25,32])
    return p


def token(p):
    return dict(projectId=p['id'],inputRevision=p['revision'],domain='infrastructure',engineVersion=CONTRACT['engineVersion'],rulesVersion=VERSION)


class InfrastructureTests(unittest.TestCase):
    def test_physical_count_and_derivations(self):
        p=fixture();before=copy.deepcopy(p);a=calculate_project(p)
        self.assertEqual(p,before)
        self.assertEqual([r['count'] for r in a['results']],[12,8,4])
        r=a['results'][0]
        self.assertAlmostEqual(r['area'],12*math.pi*4)
        self.assertAlmostEqual(r['occupancy'],30.72)
        self.assertAlmostEqual(r['minimumDiameter'],math.sqrt(480))
        self.assertEqual(r['suggestedDiameter'],25)
        self.assertTrue(all(r['status']=='calculated' for r in a['results']))
        self.assertNotIn('conforme',json.dumps(a).lower())

    def test_thresholds_and_boundaries(self):
        self.assertEqual([conduit_limit(n) for n in (1,2,3,40)],[53,31,40,40])
        for n in (1,2,3):
            area=n*math.pi*9
            r=conduit_geometry(area,n,None)
            self.assertAlmostEqual(conduit_geometry(area,n,r['minimumDiameter'])['occupancy'],r['limit'])
        with self.assertRaises(ValueError):conduit_limit(0)

    def test_multicore_count_once_and_parallel_multiplier(self):
        p=fixture()
        for c in p['cables']:
            c.update(formation='multicore',quantity=2,outerDiameter=10,source=source())
            for w in p['conductors']:
                if w['cableId']==c['id']:w['formation']='multicore'
            c['physicalSignature']=physical_signature(p,'cables',c)
        rows=calculate_project(p)['results']
        self.assertEqual([r['count'] for r in rows],[6,4,2])
        self.assertEqual(rows[2]['limit'],31)
        self.assertAlmostEqual(rows[0]['area'],6*math.pi*25)

    def test_missing_source_or_changed_construction(self):
        for field,value in [('outerDiameter',None),('source',entity('Source')),('section',4),('insulation','XLPE'),('material','Al')]:
            with self.subTest(field=field):
                p=fixture();p['conductors'][0][field]=value;r=calculate_project(p)['results'][0]
                self.assertEqual(r['status'],'pending');self.assertIsNone(r['area'])
                self.assertIn('referência',r['pending'][0])

    def test_geometry_failure_is_not_passed(self):
        p=fixture();p['infrastructures'][0]['innerDiameter']=10
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'review');self.assertEqual(r['criteria'][0]['status'],'failed')

    def test_route_checks_and_no_silent_exception(self):
        self.assertEqual(continuous_route(12,1,'indoor')['maximumLength'],12)
        self.assertTrue(continuous_route(12,1,'indoor')['lengthPasses'])
        self.assertFalse(continuous_route(12.001,1,'indoor')['lengthPasses'])
        self.assertFalse(continuous_route(1,4,'outdoor')['bendsPass'])
        p=fixture();i=p['infrastructures'][0]
        i.update(location='indoor',continuousLength=28)
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'review')
        i['routeConfirmed']=None
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        i.update(routeConfirmed=True,continuousLength=10)
        self.assertIn('menor',calculate_project(p)['results'][0]['pending'][0])

    def test_rectangular_single_layer_with_reference(self):
        p=fixture();i=p['infrastructures'][0]
        i.update(type='ladder',width=100,height=30,arrangement='single_layer',spacing=2,limitSource=source(),arrangementConfirmed=True)
        r=calculate_project(p)['results'][0]
        self.assertEqual(r['status'],'calculated');self.assertEqual(r['minimumWidth'],70)
        self.assertEqual(r['minimumHeight'],4);self.assertIsNone(r['limit'])
        i['width']=60
        self.assertEqual(calculate_project(p)['results'][0]['status'],'review')
        i.update(width=100,occupancyLimit=3)
        self.assertEqual(calculate_project(p)['results'][0]['status'],'review')
        i.update(occupancyLimit=None,arrangementConfirmed=None)
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')

    def test_all_supported_trays_and_other_pending(self):
        for kind in ('tray','solid_tray','perforated_tray','ladder','other'):
            p=fixture();p['infrastructures'][0].update(type=kind,width=100,height=30,arrangement='single_layer',spacing=0,limitSource=source(),arrangementConfirmed=True)
            self.assertEqual(calculate_project(p)['results'][0]['status'],'pending' if kind=='other' else 'calculated')

    def test_missing_and_multiple_infrastructure_and_partial_assignment(self):
        p=fixture();p['infrastructures']=[]
        self.assertTrue(all(r['status']=='pending' for r in calculate_project(p)['results']))
        p=fixture();p['infrastructures'].append(entity('Infrastructure',segmentId=p['segments'][0]['id']))
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        p=fixture();p['infrastructures'][0]['conductorIds']=[p['conductors'][0]['id']]
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')

    def test_bad_topology_and_unbound_core_block(self):
        p=fixture();p['circuits'][0]['segmentIds']=[]
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')
        p=fixture();p['conductors'].append(entity('Conductor'))
        self.assertEqual(calculate_project(p)['results'][0]['status'],'pending')

    def test_api_operation_atomic_and_invalidates(self):
        p=fixture();before=copy.deepcopy(p)
        a=infrastructure_request(dict(project=p,request=token(p),operation=dict(collection='conductors',id=p['conductors'][0]['id'],data=dict(outerDiameter=5,source=source()))))
        self.assertEqual(p,before);self.assertEqual(a['project']['revision'],p['revision']+1)
        self.assertEqual(a['project']['currentStage'],7)
        self.assertTrue(all(s['thermal']['groupingConfirmed'] is None for s in a['project']['segments']))
        self.assertTrue(all(c['design']['scopeConfirmed'] is None for c in a['project']['cables']))
        self.assertEqual(a['analysis']['inputRevision'],a['project']['revision'])
        for data in ({'outerDiameter':-1},{'outerDiameter':True},{'outerDiameter':float('inf')},{'quantity':0}):
            with self.assertRaises(ValueError):infrastructure_request(dict(project=p,request=token(p),operation=dict(collection='conductors',id=p['conductors'][0]['id'],data=data)))
        self.assertEqual(p,before)

    def test_no_result_for_wrong_token(self):
        p=fixture();t=token(p);t['inputRevision']+=1
        with self.assertRaises(ValueError):infrastructure_request(dict(project=p,request=t))

    def test_new_infrastructure_without_overwrite(self):
        p=fixture();p['infrastructures']=[]
        op=dict(collection='infrastructures',id=None,data=dict(segmentId=p['segments'][0]['id'],type='conduit'))
        a=infrastructure_request(dict(project=p,request=token(p),operation=op))
        self.assertEqual(len(a['project']['infrastructures']),1);self.assertEqual(p['infrastructures'],[])
        p=a['project']
        with self.assertRaises(ValueError):infrastructure_request(dict(project=p,request=token(p),operation=op))

    def test_no_candidate_is_not_extrapolated(self):
        p=fixture();p['infrastructures'][0]['candidateDiameters']=[8,10]
        r=calculate_project(p)['results'][0]
        self.assertIsNone(r['suggestedDiameter']);self.assertEqual(r['status'],'pending')


class InfrastructureHttpTests(IndustrialHttpTests):
    def test_infrastructure_endpoint(self):
        p=fixture();body=json.dumps(dict(project=p,request=token(p))).encode()
        with urlopen(Request(self.url+'/api/industrial/infrastructure',data=body,headers={'Content-Type':'application/json'})) as r:
            a=json.load(r)
        self.assertEqual(a['analysis']['results'][0]['count'],12)
        with self.assertRaises(HTTPError) as error:
            urlopen(Request(self.url+'/api/industrial/infrastructure',data=b'{}',headers={'Content-Type':'application/json'}))
        self.assertEqual(error.exception.code,400)
