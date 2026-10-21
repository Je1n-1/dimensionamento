import unittest
from test_distributed import mixed, load, SUPPLY
from engine import calculate


class DiagnosticTests(unittest.TestCase):
    def test_manual_voltage_mismatch_is_visible_without_changing_legacy_calculation(self):
        r = calculate(mixed(connection='fn', phaseSet='A', voltageMode='manual', voltage=380), supply=SUPPLY)
        self.assertEqual(r['voltage'], 380)
        self.assertTrue(any(d['field'] == 'voltage' and '127 V' in d['message'] for d in r['diagnostics']))

    def test_missing_distance_locates_group_and_preserves_current(self):
        r = calculate(mixed(loads=[load(distance='')]), supply=SUPPLY)
        d = next(d for d in r['diagnostics'] if d['field'] == 'distance')
        self.assertEqual((d['scope'], d['index'], d['step'], d['blocking']), ('load', 0, 2, True))
        self.assertIsNotNone(r['ib'])
        self.assertIsNone(r['chosen'])

    def test_missing_installation_explains_no_breaker(self):
        r = calculate(mixed(installation='', metal=''), supply=SUPPLY)
        self.assertTrue(any(d['field'] == 'metal' and d['blocking'] for d in r['diagnostics']))
        self.assertTrue(any(d['field'] == 'installation' and 'disjuntor' in d['message'] for d in r['diagnostics']))
        self.assertIsNone(r['protection']['nominal'])

    def test_unavailable_temperature_is_located(self):
        r = calculate(mixed(temperature=''), supply=SUPPLY)
        self.assertTrue(any(d['field'] == 'temperature' for d in r['diagnostics']))
        self.assertIsNone(r['chosen'])

    def test_missing_short_circuit_still_suggests_nominal(self):
        r = calculate(mixed(shortIk='', breakerIcu=''), supply=SUPPLY)
        self.assertIsNotNone(r['protection']['nominal'])
        self.assertTrue(any(d['field'] == 'shortIk' and not d['blocking'] for d in r['diagnostics']))

    def test_wrong_breaker_is_located(self):
        r = calculate(mixed(breakerMode='verify', breakerCurrent=1), supply=SUPPLY)
        self.assertTrue(any(d['field'] == 'breakerCurrent' for d in r['diagnostics']))
        self.assertEqual(r['protection']['nominal'], 1)
