import json
import re
import unittest
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit

import test_engine
from voltcalc.industrial.contracts import CONTRACT, create_entity, validate_entity


class ContractTests(unittest.TestCase):
    def test_shared_contract_cases(self):
        cases = json.loads(Path(__file__).with_name('contract_cases.json').read_text(encoding='utf-8'))
        for case in cases:
            with self.subTest(case=case['name']):
                data = create_entity(case['model'], **case['changes'])
                self.assertEqual(not validate_entity(case['model'], data), case['valid'])

    def test_all_model_defaults_and_independent_lists(self):
        for name in CONTRACT['models']:
            data = create_entity(name)
            # Standalone results/criteria/measurements require explicit provenance/code.
            if name not in ('CalculationResult', 'Criterion', 'Measurement'):
                self.assertEqual(validate_entity(name, data), [], name)
        first, second = create_entity('Project'), create_entity('Project')
        first['consumers'].append(create_entity('Consumer'))
        self.assertEqual(second['consumers'], [])
        self.assertNotEqual(first['id'], second['id'])

    def test_ids_and_references(self):
        p = create_entity('Project')
        c = create_entity('Consumer')
        p['consumers'] = [c]
        p['motors'] = [create_entity('Motor', consumerId=c['id'])]
        self.assertEqual(validate_entity('Project', p), [])
        p['motors'][0]['consumerId'] = 'missing'
        self.assertIn('reference', [e['code'] for e in validate_entity('Project', p)])
        p['consumers'].append(c.copy())
        self.assertIn('duplicate', [e['code'] for e in validate_entity('Project', p)])

    def test_non_finite_unknown_and_missing_fields(self):
        for number in (float('nan'), float('inf'), 10**1000):
            self.assertTrue(validate_entity('Consumer', create_entity('Consumer', power=number)))
        with self.assertRaises(ValueError):
            create_entity('Project', residential=True)
        self.assertTrue(validate_entity('Project', {}))

    def test_normative_registry_is_unimplemented_and_empty(self):
        self.assertEqual(CONTRACT['rules']['status'], 'not_implemented')
        self.assertEqual(CONTRACT['rules']['tables'], [])
        self.assertNotIn('1997', json.dumps(CONTRACT))


class IndustrialHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_engine.ApiTests.setUpClass()
        cls.url = test_engine.ApiTests.url

    @classmethod
    def tearDownClass(cls):
        test_engine.ApiTests.tearDownClass()

    def test_entry_redirect_and_module_graph(self):
        with urlopen(self.url + '/industrial') as response:
            self.assertTrue(response.url.endswith('/industrial/'))
            html = response.read().decode()
        self.assertNotIn('/tables.js', html)
        self.assertNotIn('/js/app.js"', html.replace('/industrial/js/app.js"', ''))
        queue = re.findall(r'(?:src|href)="(/[^\"]+)"', html)
        seen = set()
        while queue:
            route = queue.pop()
            if route in seen:
                continue
            seen.add(route)
            with urlopen(self.url + route) as response:
                source = response.read().decode()
                self.assertEqual(response.status, 200)
                if route.endswith('.js'):
                    self.assertEqual(response.headers.get_content_type(), 'text/javascript')
                    queue.extend(urlsplit(urljoin(self.url+route, dep)).path for dep in re.findall(r'\bfrom\s+[\'\"]([^\'\"]+)[\'\"]', source))
        self.assertIn('/industrial/js/core/state.js', seen)
        self.assertFalse(any(route.startswith('/js/') for route in seen))

    def test_contract_route_and_source_privacy(self):
        with urlopen(self.url + '/industrial/contracts.v2.json') as response:
            self.assertEqual(json.load(response), CONTRACT)
        for route in ('/data/industrial/contracts.v1.json', '/voltcalc/industrial/contracts.py', '/api/industrial/calculate'):
            with self.subTest(route=route), self.assertRaises(HTTPError) as error:
                urlopen(self.url+route)
            self.assertEqual(error.exception.code, 404)
