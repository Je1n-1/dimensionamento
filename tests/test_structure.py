"""Integration checks for relocated assets, package paths and public entry points."""
import re
import subprocess
import sys
import tempfile
import unittest
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit
from urllib.request import urlopen

from voltcalc.paths import ROOT
from voltcalc.web.assets import ASSETS
import test_engine


class StructureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        test_engine.ApiTests.setUpClass()
        cls.url = test_engine.ApiTests.url

    @classmethod
    def tearDownClass(cls):
        test_engine.ApiTests.tearDownClass()

    def test_html_and_all_imported_modules_are_public_and_resolvable(self):
        with urlopen(self.url) as response:
            html = response.read().decode()
        self.assertIn('type="module"', html)
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
                    for dependency in re.findall(r'\bfrom\s+[\'\"]([^\'\"]+)[\'\"]', source):
                        queue.append(urlsplit(urljoin(self.url+route, dependency)).path)
        self.assertIn('/js/core/state.js', seen)
        self.assertIn('/js/features/grid.js', seen)
        self.assertIn('/js/views/results.js', seen)
        self.assertGreaterEqual(len(seen), 20)

    def test_only_explicit_public_files_can_be_served(self):
        for route in ('/voltcalc/web/server.py', '/archive/original_html/app.js',
                      '/docs/analysis/evidencias.json', '/frontend/package.json',
                      '/js/../../engine.py', '/%2e%2e/engine.py'):
            with self.subTest(route=route), self.assertRaises(HTTPError) as error:
                urlopen(self.url+route)
            self.assertEqual(error.exception.code, 404)
        self.assertTrue(all(asset.is_file() for asset in ASSETS.values()))

    def test_server_entry_point_works_outside_project_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([sys.executable, str(ROOT/'server.py'), '--help'],
                                    cwd=directory, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('--port', result.stdout)

    def test_public_calculation_api_is_preserved(self):
        import engine
        from voltcalc.calculations import sizing
        self.assertIs(engine.calculate, sizing.calculate)
        self.assertIs(engine.TABLES, sizing.TABLES)
