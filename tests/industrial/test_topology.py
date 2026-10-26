"""Physical route and grouping regressions; no normative sizing assertions."""
import copy
import json
import unittest
from urllib.request import Request, urlopen
from urllib.error import HTTPError

import test_engine
from voltcalc.industrial.contracts import CONTRACT, create_entity as entity, validate_entity
from voltcalc.industrial.topology import analyze_topology, mutate_topology, topology_request, VERSION


def radial():
    p = entity('Project', name='Teste de derivações')
    panel = entity('Panel', tag='QCMD')
    p['panels'].append(panel)
    p['nodes'].append(entity('Node', kind='panel', entityId=panel['id'], label='QCMD'))
    for i in range(3):
        c = entity('Consumer', tag=f'M{i+1}', type='motor', quantity=15)
        p['consumers'].append(c)
        p['nodes'].append(entity('Node', kind='consumer', entityId=c['id'], label=c['tag']))
    p = mutate_topology(p, dict(action='path', origin=p['nodes'][0]['id'], prefix='A', basis='cumulative',
        rows=[dict(nodeId=n['id'], distance=d) for n, d in zip(p['nodes'][1:], (28, 35, 51))]))
    for i, consumer in enumerate(p['consumers']):
        p = mutate_topology(p, dict(action='save', collection='circuits', data=dict(tag=f'C{i+1}',
            originNodeId=p['nodes'][0]['id'], consumerIds=[consumer['id']], segmentIds=[s['id'] for s in p['segments'][:i+1]])))
        p = mutate_topology(p, dict(action='save', collection='cables', data=dict(tag=f'F{i+1}',
            circuitId=p['circuits'][-1]['id'], formation='single_core'), roles=['L1','L2','L3','PE']))
    for s in p['segments']:
        s.update(installationMethod='B1', temperature=35)
        p['infrastructures'].append(entity('Infrastructure', segmentId=s['id'], type='conduit'))
    return p


def token(p):
    return dict(projectId=p['id'], inputRevision=p['revision'], domain='topology',
                engineVersion=CONTRACT['engineVersion'], rulesVersion=VERSION)


class TopologyTests(unittest.TestCase):
    def test_derivations_remove_circuits_and_cables_after_each_load(self):
        p = radial()
        before = copy.deepcopy(p)
        a = analyze_topology(p)
        self.assertEqual(a['issues'], [])
        self.assertEqual([s['length'] for s in p['segments']], [28,7,16])
        self.assertEqual([len(s['circuitIds']) for s in a['segments']], [3,2,1])
        self.assertEqual([s['physicalCables'] for s in a['segments']], [12,8,4])
        self.assertEqual([s['functions']['PE'] for s in a['segments']], [3,2,1])
        self.assertEqual([c['paths'][0]['length'] for c in a['circuits']], [28,35,51])
        self.assertEqual(p, before)
        self.assertNotIn('conforme', json.dumps(a).lower())

    def test_multicore_parallel_and_insulated_are_not_confused(self):
        p = radial()
        for formation, expected in [('multicore',(6,0)), ('insulated',(0,24))]:
            q = copy.deepcopy(p)
            for c in q['cables']:
                c.update(formation=formation, quantity=2)
            for c in q['conductors']:
                c['formation']=formation
            row = analyze_topology(q)['segments'][0]
            self.assertEqual((row['physicalCables'],row['insulatedConductors']),expected)
            self.assertEqual(row['functions']['PE'],6)

    def test_selected_formation_changes_along_circuit(self):
        p=radial(); cable=p['cables'][-1]; circuit=p['circuits'][-1]
        cable.update(routeMode='selected',segmentIds=[s['id'] for s in p['segments'][:2]])
        p=mutate_topology(p,dict(action='save',collection='cables',data=dict(tag='Final',circuitId=circuit['id'],formation='multicore',routeMode='selected',segmentIds=[p['segments'][2]['id']]),roles=['L1','L2','L3','PE']))
        self.assertEqual([s['physicalCables'] for s in analyze_topology(p)['segments']],[12,8,1])

    def test_missing_formation_never_publishes_zero(self):
        p=radial(); p['cables']=[]; p['conductors']=[]
        a=analyze_topology(p)
        self.assertTrue(all(s['physicalCables'] is None for s in a['segments']))
        self.assertIn('missing_formation',[i['code'] for i in a['issues']])

    def test_distances_require_explicit_basis_and_are_atomic(self):
        p=radial(); before=copy.deepcopy(p)
        for basis, distances in [('other',[1,2]),('cumulative',[35,28]),('physical',[-1,3]),('physical',[True,3]),('physical',[float('nan'),3])]:
            with self.subTest(basis=basis,distances=distances), self.assertRaises(ValueError):
                mutate_topology(p,dict(action='path',basis=basis,prefix='Bad',origin=p['nodes'][0]['id'],rows=[dict(nodeId=p['nodes'][i+1]['id'],distance=d) for i,d in enumerate(distances)]))
        self.assertEqual(p,before)
        q=entity('Project',nodes=p['nodes'])
        q=mutate_topology(q|{'consumers':p['consumers'],'panels':p['panels']},dict(action='path',basis='physical',prefix='B',origin=p['nodes'][0]['id'],rows=[dict(nodeId=p['nodes'][i+1]['id'],distance=d) for i,d in enumerate([28,35,51])]))
        self.assertEqual([s['length'] for s in q['segments']],[28,35,51])

    def test_branch_has_independent_origin_and_group_membership(self):
        p=radial()
        c=entity('Consumer',tag='M4',type='motor'); p['consumers'].append(c)
        n=entity('Node',kind='consumer',entityId=c['id'],label='M4');p['nodes'].append(n)
        p=mutate_topology(p,dict(action='path',basis='cumulative',prefix='B',kind='branch',origin=p['nodes'][1]['id'],rows=[dict(nodeId=n['id'],distance=25)]))
        p=mutate_topology(p,dict(action='save',collection='circuits',data=dict(tag='C4',originNodeId=p['nodes'][0]['id'],consumerIds=[c['id']],segmentIds=[p['segments'][0]['id'],p['segments'][-1]['id']])))
        a=analyze_topology(p)
        self.assertEqual(a['circuits'][-1]['paths'][0]['length'],53)
        self.assertEqual([len(s['circuitIds']) for s in a['segments']],[4,2,1,1])

    def test_cycle_and_self_loop_rejected_without_mutation(self):
        p=radial(); before=copy.deepcopy(p)
        for origin in [p['nodes'][0]['id'],p['nodes'][-1]['id']]:
            with self.assertRaisesRegex(ValueError,'ciclo'):
                mutate_topology(p,dict(action='save',collection='segments',data=dict(tag='Loop',fromNodeId=origin,toNodeId=p['nodes'][0]['id'],length=1)))
        self.assertEqual(p,before)

    def test_alternative_route_is_ambiguous(self):
        p=radial(); edge=entity('Segment',tag='Direct',fromNodeId=p['nodes'][0]['id'],toNodeId=p['nodes'][-1]['id'],length=4)
        p['segments'].append(edge); p['circuits'][-1]['segmentIds'].append(edge['id'])
        a=analyze_topology(p)
        self.assertIn('ambiguous_path',[i['code'] for i in a['issues']])
        self.assertFalse(a['circuits'][-1]['valid'])

    def test_origin_destinations_connectivity_and_length_pending(self):
        p=radial();p['circuits'][0]['originNodeId']=None;p['circuits'][1]['segmentIds']=[];p['segments'][0]['length']=None
        a=analyze_topology(p); codes={i['code'] for i in a['issues']}
        self.assertTrue({'circuit_origin','unreachable','segment_length'}<=codes)
        self.assertIsNone(a['circuits'][-1]['paths'][0]['length'])
        self.assertIsNone(a['segments'][0]['physicalCables'])

    def test_duplicate_binding_and_feed_rejected(self):
        p=radial()
        with self.assertRaisesRegex(ValueError,'ponto físico'):
            mutate_topology(p,dict(action='save',collection='nodes',data=dict(kind='consumer',entityId=p['consumers'][0]['id'],label='Duplicado')))
        with self.assertRaisesRegex(ValueError,'mais de um circuito'):
            mutate_topology(p,dict(action='save',collection='circuits',data=dict(tag='Dup',consumerIds=[p['consumers'][0]['id']])))

    def test_reference_aware_deletion_and_owned_core_cleanup(self):
        p=radial()
        for collection in ['nodes','panels','segments','circuits']:
            with self.subTest(collection=collection), self.assertRaises(ValueError):
                mutate_topology(p,dict(action='delete',collection=collection,id=p[collection][0]['id']))
        q=mutate_topology(p,dict(action='delete',collection='cables',id=p['cables'][0]['id']))
        self.assertEqual(len(q['conductors']),8)
        self.assertEqual(len(p['conductors']),12)
        self.assertEqual(validate_entity('Project',q),[])

    def test_core_update_preserves_source_and_dimensions(self):
        p=radial(); p['conductors'][0]['section']=10
        c=p['cables'][0]
        q=mutate_topology(p,dict(action='save',collection='cables',id=c['id'],data=dict(tag='Changed'),roles=['L1','L2','L3','PE']))
        self.assertEqual(next(w for w in q['conductors'] if w['id']==p['conductors'][0]['id'])['section'],10)
        self.assertEqual(q['revision'],p['revision']+1)

    def test_points_action_is_idempotent_and_never_changes_inputs(self):
        p=radial();p['nodes']=[];p['circuits']=[];p['segments']=[];p['cables']=[];p['conductors']=[];p['infrastructures']=[]
        q=mutate_topology(p,dict(action='points'));r=mutate_topology(q,dict(action='points'))
        self.assertEqual(q['nodes'],r['nodes'])
        self.assertEqual(q['consumers'],p['consumers'])
        self.assertEqual(len(q['nodes']),4)

    def test_empty_project_pending_and_drafts_allowed(self):
        p=entity('Project')
        self.assertEqual(analyze_topology(p)['status'],'pending')
        p=mutate_topology(p,dict(action='save',collection='circuits',data=dict(tag='C1')))
        self.assertEqual(analyze_topology(p)['status'],'pending')

    def test_parent_panel_cycle_rejected(self):
        p=radial()
        with self.assertRaisesRegex(ValueError,'hierarquia'):
            mutate_topology(p,dict(action='save',collection='panels',id=p['panels'][0]['id'],data=dict(parentPanelId=p['panels'][0]['id'])))

    def test_panel_owned_by_consumer_is_preserved(self):
        p=radial();c=entity('Consumer',tag='Q',type='panel');p['consumers'].append(c);p['panels'][0]['consumerId']=c['id']
        for action in ('save','delete'):
            with self.assertRaisesRegex(ValueError,'cadastro de consumidores'):
                mutate_topology(p,dict(action=action,collection='panels',id=p['panels'][0]['id'],data={'tag':'changed'}))

    def test_infrastructure_and_unassigned_segments_remain_pending(self):
        p=radial();p['infrastructures'][0]['type']=None
        p['segments'].append(entity('Segment',tag='Extra',fromNodeId=p['nodes'][0]['id'],toNodeId=p['nodes'][1]['id'],length=1,installationMethod='B1',temperature=30))
        p['infrastructures'].append(entity('Infrastructure',type='conduit'))
        codes={i['code'] for i in analyze_topology(p)['issues']}
        self.assertTrue({'infrastructure_type','infrastructure_segment','unassigned_segment'}<=codes)

    def test_request_version_revision_and_no_mutation(self):
        p=radial(); request=token(p)
        answer=topology_request(dict(project=p,request=request))
        self.assertEqual(answer['project'],p)
        for key in request:
            bad=request|{key:'wrong'}
            with self.assertRaises(ValueError):topology_request(dict(project=p,request=bad))

    def test_changes_invalidate_results_and_preserve_trace(self):
        p=radial()
        p['results']=[entity('CalculationResult',targetId=p['consumers'][0]['id'],domain='currents',status='calculated',
            inputRevision=p['revision'],engineVersion=CONTRACT['engineVersion'],rulesVersion=CONTRACT['currentRules']['version'],trace='Placa informada',
            measurements=[entity('Measurement',code='nominal_a',value=12,unit='A')])]
        q=mutate_topology(p,dict(action='save',collection='segments',id=p['segments'][0]['id'],data={'length':30}))
        self.assertEqual(q['results'][0]['status'],'invalidated')
        self.assertEqual(q['results'][0]['measurements'],[])
        self.assertEqual(q['results'][0]['trace'],'Placa informada')
        self.assertEqual(p['results'][0]['measurements'][0]['value'],12)


class TopologyHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_engine.ApiTests.setUpClass();cls.url=test_engine.ApiTests.url
    @classmethod
    def tearDownClass(cls):
        test_engine.ApiTests.tearDownClass()
    def test_http_analysis_and_atomic_invalid_operation(self):
        p=radial();payload=dict(project=p,request=token(p))
        def send(body):
            return urlopen(Request(self.url+'/api/industrial/topology',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'}))
        with send(payload) as response:
            result=json.load(response)
        self.assertEqual(result['analysis']['status'],'validated')
        with self.assertRaises(HTTPError) as error:
            send(payload|{'operation':dict(action='delete',collection='nodes',id=p['nodes'][0]['id'])})
        self.assertEqual(error.exception.code,400)
