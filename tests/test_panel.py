import copy
import json
import math
from pathlib import Path
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from voltcalc.importers.csv_import import import_csv
from engine import calculate
from voltcalc.calculations.panel import build_panel
from test_distributed import mixed, load
import test_engine

SAMPLE = (Path(__file__).resolve().parents[1]/'examples'/'residencia.csv').read_text(encoding='utf-8-sig')
SUPPLY = dict(phases='tri', network='220/380')


class PanelTests(unittest.TestCase):
    def test_reference_table(self):
        result = import_csv(SAMPLE)
        self.assertEqual(len(result['project']['circuits']), 8)
        self.assertEqual(result['warnings'], [])
        board = result['panel']
        self.assertTrue(board['complete'])
        self.assertEqual(board['p'], 12120)
        self.assertEqual(board['sumVA'], 12120)
        self.assertEqual(board['maxCurrent'], 25)
        self.assertEqual(board['maxPhases'], ['R'])
        for phase, power, current in zip(board['phases'], (5500, 3300, 3320), (25, 15, 3320/220)):
            self.assertEqual(phase['p'], power)
            self.assertAlmostEqual(phase['current'], current)

    def test_import_does_not_invent_sizing_inputs(self):
        result = import_csv(SAMPLE)
        for c in result['project']['circuits']:
            self.assertEqual(c['loads'][0]['distance'], '')
            self.assertEqual(c['temperature'], '')
            self.assertEqual(c['insulation'], '')
            self.assertEqual(c['groupCount'], '')
            r = calculate(c, supply=SUPPLY)
            self.assertIsNotNone(r['ib'])
            self.assertIsNone(r['chosen'])
            self.assertIsNone(r['protection']['cableOk'])
            self.assertEqual(r['segments'], [])

    def test_fp_is_derived_from_w_and_va(self):
        result = import_csv(SAMPLE.replace(';300;300;T;', ';300;240;T;'))
        c = result['project']['circuits'][1]
        self.assertAlmostEqual(c['loads'][0]['powerFactor'], .8)
        self.assertAlmostEqual(result['panel']['rows'][1]['ib'], 300/220)
        self.assertTrue(result['warnings'])

    def test_bad_input_is_rejected_not_silently_dropped(self):
        for bad in (SAMPLE.replace(';1320;1320;', ';1000;1320;'),
                    SAMPLE.replace(';1;Iluminação;', ';2;Iluminação;'),
                    SAMPLE.replace(';T;0;0;1320;', ';X;0;0;1320;'),
                    SAMPLE.replace(';F+N+PE;220;', ';F+N+PE;127;', 1),
                    SAMPLE.replace(';TOTAL;', ';9;'), SAMPLE.replace(';10\n', ';0\n', 1),
                    SAMPLE.replace(';1320;1320;', ';=SUM(A1);1320;'),
                    SAMPLE.replace(';1;Iluminação;', ';1;Iluminação;EXTRA;')):
            with self.subTest(bad=bad[:80]), self.assertRaises(ValueError):
                import_csv(bad)

    def test_bom_crlf_and_comma_decimals(self):
        result = import_csv('\ufeff'+SAMPLE.replace('\n', '\r\n').replace(';1320;', ';1.320,00;'))
        self.assertEqual(result['panel']['p'], 12120)

    def test_total_is_not_an_extra_circuit(self):
        result = import_csv(SAMPLE)
        self.assertEqual([c['number'] for c in result['project']['circuits']], list(map(str, range(1, 9))))
        self.assertEqual(result['project']['importInfo']['generalBreaker'], 32)

    def test_differences_reported_without_overwriting_source(self):
        result = import_csv(SAMPLE.replace(';6;6;10', ';6;7;10'))
        self.assertTrue(any('corrente do CSV' in w for w in result['warnings']))
        self.assertEqual(result['project']['circuits'][0]['source']['current'], 7)
        self.assertEqual(result['panel']['rows'][0]['ib'], 6)

    def test_missing_electrical_data_blocks_totals(self):
        project = import_csv(SAMPLE)['project']
        project['circuits'][0]['loads'][0]['power'] = ''
        panel = build_panel(project['circuits'], project['supply'])
        self.assertFalse(panel['complete'])
        self.assertIsNone(panel['maxCurrent'])
        self.assertIsNone(panel['p'])
        self.assertTrue(all(p['current'] is None for p in panel['phases']))

    def test_missing_distance_keeps_current_but_blocks_drop(self):
        c = mixed(loads=[load(distance='')])
        before = copy.deepcopy(c)
        result = calculate(c, supply=dict(phases='tri', network='127/220'))
        self.assertEqual(result['ib'], 5)
        self.assertIsNone(result['chosen'])
        self.assertEqual(c, before)

    def test_legacy_ambiguous_connection_blocks_totals(self):
        result = build_panel([mixed(connection='legacy')], SUPPLY)
        self.assertFalse(result['complete'])

    def test_manual_voltage_must_match_supply(self):
        result = build_panel([mixed(voltageMode='manual', voltage=220)], SUPPLY)
        self.assertFalse(result['complete'])

    def test_phase_phase_full_current_and_power_allocation(self):
        c = mixed(loads=[load(power=3800)])
        board = build_panel([c], SUPPLY)
        self.assertTrue(board['complete'])
        for p in board['phases'][:2]:
            self.assertAlmostEqual(p['current'], 10)
            self.assertEqual(p['p'], 1900)
        self.assertEqual(board['phases'][2]['current'], 0)

    def test_mixed_connections_use_phasor_sum(self):
        fn = mixed(connection='fn', phaseSet='A', loads=[load(power=2200)])
        ff = mixed(loads=[load(power=3800)])
        board = build_panel([fn, ff], SUPPLY)
        self.assertAlmostEqual(board['phases'][0]['current'], math.sqrt(200+200*math.cos(math.pi/6)))
        self.assertNotAlmostEqual(board['phases'][0]['current'], 20)
        self.assertEqual(board['p'], 6000)

    def test_balanced_three_phase(self):
        c = mixed(connection='tri', phaseSet='ABC', loads=[load(power=3800*math.sqrt(3))])
        board = build_panel([c], SUPPLY)
        for p in board['phases']:
            self.assertAlmostEqual(p['current'], 10)
        self.assertAlmostEqual(board['spread'], 0)

    def test_phase_change_recomputes_totals_without_mutation(self):
        project = import_csv(SAMPLE)['project']
        before = copy.deepcopy(project)
        build_panel(project['circuits'], project['supply'])
        self.assertEqual(before, project)
        project['circuits'][0]['phaseSet'] = 'A'
        board = build_panel(project['circuits'], project['supply'])
        self.assertAlmostEqual(board['maxCurrent'], 31)
        self.assertEqual(board['p'], 12120)

    def test_empty_project_has_no_fabricated_totals(self):
        r = build_panel([], SUPPLY)
        self.assertFalse(r['complete'])
        self.assertIsNone(r['maxCurrent'])


class PanelApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Reuse only the server fixture, not inherited test methods.
        test_engine.ApiTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        test_engine.ApiTests.tearDownClass.__func__(cls)

    def post(self, path, data):
        req = Request(self.url+path, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})
        with urlopen(req) as response:
            return json.load(response)

    def test_import_and_panel_end_to_end(self):
        result = self.post('/api/import-csv', dict(text=SAMPLE, filename='exemplo.csv'))
        project = result['project']
        panel = self.post('/api/panel', project)
        self.assertEqual(panel['maxCurrent'], 25)
        sizing = self.post('/api/calculate', project)
        self.assertTrue(all(r['chosen'] is None for r in sizing['results']))
        self.assertEqual(sizing['results'][7]['ib'], 25)

    def test_example_and_board_asset(self):
        with urlopen(self.url+'/api/example') as response:
            self.assertEqual(json.load(response)['panel']['p'], 12120)
        with urlopen(self.url+'/board.js') as response:
            self.assertEqual(response.status, 200)

    def test_errors_return_400(self):
        for path, data in [('/api/import-csv', dict(text='a;b')),
                           ('/api/import-csv', dict(text=None)),
                           ('/api/panel', dict(circuits=[], supply=None)),
                           ('/api/panel', dict(circuits=[None], supply=SUPPLY))]:
            with self.subTest(path=path), self.assertRaises(HTTPError) as err:
                self.post(path, data)
            self.assertEqual(err.exception.code, 400)
