import copy
import unittest
from voltcalc.industrial.contracts import create_entity as entity, validate_entity
from voltcalc.industrial.topology import mutate_topology, analyze_topology


def fixture():
    p = entity('Project', name='Cadastro simplificado')
    p['panels'] = [entity('Panel', tag='Q1')]
    for i, (connection, phase) in enumerate([('FN','B'), ('FF','CA'), ('3F','ABC')]):
        p['consumers'].append(entity('Consumer', type='lighting', tag=f'L{i+1}', power=100,
            unit='W', powerBasis='electrical', voltage=220, frequency=60, connection=connection,
            phaseSet=phase, hasPE=True, cableType='unipolar', cableMaterial='copper', insulation='PVC',
            installationMethod='B1', temperature=30, plannedSegmentTag='A'))
    op = dict(action='prepare', panelId=p['panels'][0]['id'], independentConfirmed=True,
        rows=[dict(consumerId=c['id'], distance=10+i*5) for i,c in enumerate(p['consumers'])])
    return p, op


class PreparationTests(unittest.TestCase):
    def test_batch_preserves_data_and_copies_declared_phases(self):
        p, op = fixture(); before = copy.deepcopy(p)
        q = mutate_topology(p, op)
        self.assertEqual(p, before)
        self.assertEqual(validate_entity('Project', q), [])
        self.assertEqual(len(q['circuits']), 3)
        self.assertEqual([s['length'] for s in q['segments']], [10,15,20])
        self.assertEqual(len({s['tag'] for s in q['segments']}), 3)
        self.assertEqual([i for i in analyze_topology(q)['issues'] if i['severity']=='error'], [])
        self.assertTrue(all(i['code']=='segment_infrastructure' for i in analyze_topology(q)['issues']))
        roles = [[c['role'] for c in q['conductors'] if c['cableId']==f['id']] for f in q['cables']]
        self.assertEqual(roles, [['L2','N','PE'],['L3','L1','PE'],['L1','L2','L3','PE']])
        self.assertTrue(all(c['section'] is None for c in q['conductors']))
        self.assertTrue(all(f['design']['scopeConfirmed'] is None for f in q['cables']))
        self.assertTrue(all(s['thermal']['groupingConfirmed'] is None for s in q['segments']))

    def test_batch_rejects_duplicates_without_partial_save(self):
        p, op = fixture(); before = copy.deepcopy(p)
        op['rows'].append(op['rows'][0])
        with self.assertRaises(ValueError): mutate_topology(p, op)
        self.assertEqual(p, before)
        p, op = fixture(); q=mutate_topology(p,op)
        with self.assertRaisesRegex(ValueError, 'já possui circuito'): mutate_topology(q,op)

    def test_invalid_distances_and_unconfirmed_topology_are_blocked(self):
        for value in [None, True, -1, 0, float('inf'), '10']:
            p, op=fixture(); op['rows'][1]['distance']=value
            with self.subTest(value=value), self.assertRaises(ValueError): mutate_topology(p,op)
        p, op=fixture(); op['independentConfirmed']=False
        with self.assertRaisesRegex(ValueError,'Confirme'): mutate_topology(p,op)

    def test_existing_paths_or_origin_are_not_overwritten(self):
        p, op=fixture()
        other=entity('Panel',tag='Q2');p['panels'].append(other);p['consumers'][0]['panelId']=other['id']
        with self.assertRaisesRegex(ValueError,'outro quadro'): mutate_topology(p,op)
        p, op=fixture();p=mutate_topology(p,dict(action='points'))
        node=next(n for n in p['nodes'] if n['kind']=='consumer')
        p['segments'].append(entity('Segment',tag='Existente',fromNodeId=p['nodes'][0]['id'],toNodeId=node['id'],length=10))
        with self.assertRaisesRegex(ValueError,'percurso físico'): mutate_topology(p,op)

    def test_missing_electrical_inputs_are_not_invented(self):
        for key in ['phaseSet','connection','cableType']:
            p, op=fixture();p['consumers'][0][key]=None
            with self.subTest(key=key), self.assertRaises(ValueError): mutate_topology(p,op)
