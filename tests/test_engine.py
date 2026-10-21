import json
import math
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from engine import calculate
from server import Handler


def circuit(**updates):
    result = dict(id='test', description='TR-01', type='transformer', quantity=1,
                  power=30, unit='kVA', phase='tri', voltage=380, powerFactor=1,
                  efficiency=.9, installation='embedded', wall='masonry', cableForm='single',
                  methodOverride='', insulation='XLPE', metal='Cu', loaded=3, groupCount=1,
                  groupLayout='bundle', temperature=35, length=50, maxDrop=3,
                  breakerCurve='C', i2Factor=1.45, breakerIcu='', shortIk='',
                  soilResistance='', soilDepth='', unknownInstallation=False)
    return result | updates


class EngineTests(unittest.TestCase):
    def test_original_example(self):
        r = calculate(circuit())
        self.assertAlmostEqual(r['ib'], 30000 / (380 * math.sqrt(3)))
        self.assertEqual(r['chosen']['section'], 10)
        self.assertEqual(r['chosen']['breaker'], 50)
        self.assertAlmostEqual(r['chosen']['dvPct'], 2.2835239612188367)

    def test_power_conversion(self):
        for unit, power, expected in [('VA', 2200, 10), ('kVA', 2.2, 10), ('W', 1760, 10),
                                      ('kW', 1.76, 10), ('CV', 1, 735.49875 / (.9 * .8 * 220)),
                                      ('HP', 1, 745.699872 / (.9 * .8 * 220))]:
            with self.subTest(unit=unit):
                r = calculate(circuit(unit=unit, power=power, phase='mono', loaded=2, voltage=220, powerFactor=.8))
                self.assertAlmostEqual(r['ib'], expected)

    def test_bad_i2(self):
        for value in ('', None, 0, -1, 'abc', float('inf'), True):
            with self.subTest(value=value):
                r = calculate(circuit(i2Factor=value))
                self.assertIsNone(r['chosen'])
                self.assertTrue(r['issues'])

    def test_three_phase_loaded(self):
        self.assertIsNone(calculate(circuit(loaded=2))['chosen'])

    def test_unsupported_conditions(self):
        for updates in [dict(installation='tray'), dict(installation='overhead'),
                        dict(installation='buried', groupCount=2), dict(temperature=81),
                        dict(groupLayout='spaced', groupCount=2), dict(unknownInstallation=True)]:
            with self.subTest(updates=updates):
                self.assertIsNone(calculate(circuit(**updates))['chosen'])

    def test_reactance_explicit_not_global(self):
        c = circuit(powerFactor=.8, length=200)
        self.assertEqual(calculate(c, .5)['chosen']['section'], 50)
        self.assertEqual(calculate(c, .08)['chosen']['section'], 35)
        self.assertEqual(calculate(c, .5), calculate(c, .5))

    def test_invalid_numbers(self):
        for updates in [dict(power=float('inf')), dict(voltage=0), dict(groupCount=2.5),
                        dict(length=''), dict(powerFactor=2), dict(quantity=True)]:
            with self.subTest(updates=updates):
                self.assertIsNone(calculate(circuit(**updates))['chosen'])

    def test_cable_and_breaker_invariants(self):
        for insulation in ('PVC', 'XLPE'):
            for method in ('A1', 'A2', 'B1', 'B2', 'C', 'D'):
                for power in (1, 5, 30, 120):
                    c = circuit(insulation=insulation, methodOverride=method, power=power)
                    r = calculate(c)
                    chosen = r['chosen']
                    if chosen:
                        self.assertLessEqual(r['ib'], chosen['breaker'] + 1e-8)
                        self.assertLessEqual(chosen['breaker'], chosen['iz'] + 1e-8)
                        self.assertLessEqual(chosen['breaker'] * c['i2Factor'], 1.45 * chosen['iz'] + 1e-8)
                        self.assertLessEqual(chosen['dvPct'], c['maxDrop'])
                        self.assertFalse(any(a['ampOk'] and a['dropOk'] and a['breaker'] for a in r['all'] if a['section'] < chosen['section']))


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}'

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_site_and_engine(self):
        with urlopen(self.url + '/') as response:
            self.assertIn('VoltCalc Python', response.read().decode())
        with urlopen(self.url + '/tables.js') as response:
            self.assertIn(b'window.NBR1997=', response.read())
        request = Request(self.url + '/api/calculate', data=json.dumps({'circuits': [circuit()], 'reactance': .08}).encode(), headers={'Content-Type': 'application/json'})
        with urlopen(request) as response:
            self.assertEqual(json.load(response)['results'][0]['chosen']['section'], 10)

    def test_invalid_payload(self):
        for payload in ([], {}, {'circuits': [None]}, {'circuits': [circuit()], 'reactance': 'invalid'}):
            request = Request(self.url + '/api/calculate', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
            if isinstance(payload, dict) and payload.get('reactance') == 'invalid':
                with urlopen(request) as response:
                    self.assertIsNone(json.load(response)['results'][0]['chosen'])
            else:
                with self.assertRaises(HTTPError) as error:
                    urlopen(request)
                self.assertEqual(error.exception.code, 400)

    def test_private_files_not_served(self):
        for path in ('/server.py', '/../engine.py', '/original_html/app.js'):
            with self.assertRaises(HTTPError) as error:
                urlopen(self.url + path)
            self.assertEqual(error.exception.code, 404)

    def test_new_interface_assets_are_served(self):
        for path in ('/ui.js', '/model.js', '/help.js', '/illustrations.js', '/updates.css'):
            with self.subTest(path=path), urlopen(self.url + path) as response:
                self.assertEqual(response.status, 200)
                self.assertGreater(len(response.read()), 100)
        with urlopen(self.url + '/api/health') as response:
            self.assertEqual(json.load(response)['version'], 3)


if __name__ == '__main__':
    unittest.main()
