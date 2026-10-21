import unittest
from corrections import temperature_correction
from sizing import TABLES, calculate
from test_distributed import mixed, load, SUPPLY


class CorrectionTests(unittest.TestCase):
    def example(self, **updates):
        return mixed(description='Lâmpadas', type='lighting', installation='buried', insulation='PVC',
                     temperature=34, groupCount=2,
                     loads=[load(100, 50, quantity=15), load(100, 15, quantity=2)]) | updates

    def test_reported_case_names_actual_missing_factor(self):
        r = calculate(self.example(), supply=SUPPLY)
        self.assertEqual(r['totals']['p'], 1700)
        self.assertAlmostEqual(r['ib'], 1700/220)
        self.assertEqual(r['corrections']['temperature']['input'], 34)
        self.assertEqual(r['corrections']['temperature']['adopted'], 35)
        self.assertEqual(r['fct'], .84)
        self.assertIsNone(r['fca'])
        self.assertIsNone(r['chosen'])
        self.assertIsNone(r['requiredAmpacity'])
        self.assertEqual(len(r['selectionBlockers']), 1)
        self.assertIn('falta implementar', r['selectionBlockers'][0]['message'])
        self.assertEqual(r['selectionBlockers'][0]['step'], 4)

    def test_one_circuit_with_two_load_groups_selects(self):
        r = calculate(self.example(groupCount=1), supply=SUPPLY)
        self.assertEqual(r['fca'], 1)
        self.assertIsNotNone(r['chosen'])
        self.assertEqual(r['protection']['nominal'], 10)
        self.assertEqual(r['selectionBlockers'], [])
        self.assertAlmostEqual(r['requiredAmpacity'], r['ib']/.84)

    def test_supported_non_buried_group_auto_factor(self):
        r = calculate(self.example(installation='embedded'), supply=SUPPLY)
        self.assertEqual(r['fca'], .8)
        self.assertEqual(r['fct'], .94)
        self.assertIsNotNone(r['chosen'])

    def test_intermediate_factor_is_never_more_permissive_than_lower_entry(self):
        for environment, method in [('air','B1'), ('soil','D')]:
            for insulation in ('PVC','EPR_XLPE'):
                table = TABLES['temperature'][environment][insulation]
                points = sorted(map(int, table))
                for lower, upper in zip(points, points[1:]):
                    r = temperature_correction(TABLES, method, insulation, lower+.1)
                    self.assertEqual(r['adopted'], upper)
                    self.assertEqual(r['factor'], table[str(upper)])
                    self.assertLessEqual(r['factor'], table[str(lower)])
                for point in points:
                    self.assertEqual(temperature_correction(TABLES, method, insulation, point)['factor'],table[str(point)])

    def test_no_extrapolation_or_guessing_invalid_values(self):
        for value in (9, 60.1, 81, '', None, 'abc', float('inf'), True):
            self.assertIsNone(temperature_correction(TABLES,'D','PVC',value)['factor'])
        self.assertIsNone(temperature_correction(TABLES,None,'PVC',34)['factor'])

    def test_changes_recalculate_environment_and_insulation(self):
        for installation, insulation, expected in [('embedded','PVC',.94), ('buried','PVC',.84),
                                                   ('embedded','EPR',.96), ('buried','XLPE',.89)]:
            r = calculate(self.example(installation=installation, insulation=insulation, groupCount=1),supply=SUPPLY)
            self.assertEqual(r['fct'],expected)
            self.assertEqual(r['c']['temperature'],34)
