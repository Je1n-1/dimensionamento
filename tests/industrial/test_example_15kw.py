import copy
import runpy
import unittest
from pathlib import Path
from voltcalc.industrial.overview import calculate_project

build_example = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'examples/industrial/example_15kw.py'))['build_example']


class TeachingExampleTests(unittest.TestCase):
    def test_fifteen_kw_links_results_and_limits(self):
        project = build_example()
        before = copy.deepcopy(project)
        analysis = calculate_project(project)
        self.assertEqual(project, before)
        self.assertEqual(analysis['errors'], [])
        self.assertEqual(analysis['summary']['pending'], 0)
        self.assertEqual(analysis['summary']['equipment'], 9)
        self.assertTrue(all(r['status']=='calculated' and not r['pending'] for r in analysis['infrastructure']['results']))
        self.assertAlmostEqual(analysis['summary']['maxOccupancy'], 9.451875)
        self.assertAlmostEqual(analysis['summary']['maxDrop'], 1.115702479338843)
        self.assertEqual(analysis['summary']['protection'], 'not_implemented')
        self.assertEqual(analysis['topology']['issues'], [])
        self.assertEqual(analysis['summary']['power'], 15000)
        self.assertEqual(len(project['circuits']), 9)
        for phase in 'ABC':
            self.assertEqual(sum(c['quantity']*c['power'] for c in project['consumers'] if c['phaseSet']==phase), 5000)
        self.assertTrue(all(r['status']=='calculated' for r in analysis['conductors']['results']))
        self.assertTrue(all(r['status']=='calculated' for r in analysis['voltage']['results']))
        for result in analysis['conductors']['results']:
            self.assertTrue(any('Proteção' in message for message in result['pending']))
            self.assertAlmostEqual(result['ib'], (2500 if 'AQ-' in result['tag'] else 1500 if 'AC-' in result['tag'] else 1000)/220)
        for cable in project['cables']:
            self.assertIn('HIPÓTESE DIDÁTICA', cable['voltageImpedance']['source']['reference'])
        self.assertTrue(all(c['source']['manufacturer']=='Corfio' for c in project['conductors']))
        self.assertEqual(len(project['infrastructures']), 9)
        self.assertTrue(all(i['innerDiameter']==20 for i in project['infrastructures']))

    def test_reproducible_example_has_consistent_planning_fields(self):
        self.assertEqual(build_example(), build_example())
        self.assertTrue(all(c['distance'] is not None for c in build_example()['consumers']))

    def test_inputs_match_each_independent_route(self):
        p = build_example()
        for c in p['consumers']:
            s = next(s for s in p['segments'] if s['id']==c['plannedSegmentId'])
            self.assertEqual(c['distance'], s['length'])
            self.assertEqual(c['installationMethod'], s['installationMethod'])
            self.assertEqual(c['temperature'], s['temperature'])
            self.assertEqual(c['quantity'], 1)
            self.assertTrue(10 <= c['distance'] <= 14)
        self.assertEqual(len(p['conductors']), 27)
