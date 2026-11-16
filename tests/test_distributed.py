import math
import unittest

from voltcalc.calculations.circuits import profile, voltage_trace
from engine import calculate
from test_engine import circuit

SUPPLY = dict(phases='tri', network='127/220')


def load(power=1100, distance=10, **updates):
    return dict(description='Lâmpadas', quantity=1, power=power, unit='W', powerFactor=1,
                efficiency=.9, distance=distance) | updates


def mixed(**updates):
    return circuit(phase='mono', voltage=220, loaded=2, insulation='PVC', connection='ff',
                   phaseSet='AB', voltageMode='auto', routeMode='linear', maxDrop=4,
                   loads=[load(), load(distance=30)]) | updates


class DistributedTests(unittest.TestCase):
    def test_different_equipment_totals(self):
        c = mixed(loads=[load(9, 10, quantity=8), load(12, 20, quantity=5), load(20, 30, quantity=2)])
        r = calculate(c, supply=SUPPLY)
        self.assertEqual(r['totals']['p'], 172)
        self.assertEqual(r['totals']['quantity'], 15)
        self.assertAlmostEqual(r['ib'], 172/220)
        self.assertEqual(len(r['segments']), 3)

    def test_linear_route_analytic_voltage_drop(self):
        p = profile(mixed(), SUPPLY)
        r = voltage_trace(p, resistance=1, reactance=0)
        self.assertEqual([s['length'] for s in r['segments']], [10, 20])
        self.assertEqual([s['current'] for s in r['segments']], [10, 5])
        # First 10 m carry 10 A; next 20 m carry only 5 A. Two conductors.
        self.assertAlmostEqual(r['dv'], 2*(10*.01+5*.02))
        self.assertAlmostEqual(r['endpoints'][0]['dv'], .2)
        self.assertAlmostEqual(r['endpoints'][1]['dv'], .4)

    def test_independent_branches_do_not_sum_voltage_drops(self):
        p = profile(mixed(routeMode='independent'), SUPPLY)
        r = voltage_trace(p, resistance=1, reactance=0)
        self.assertEqual([s['current'] for s in r['segments']], [5, 5])
        self.assertAlmostEqual(r['dv'], .3)
        self.assertAlmostEqual(r['endpoints'][0]['dv'], .1)

    def test_order_and_collocated_loads(self):
        a = calculate(mixed(), supply=SUPPLY)
        b = calculate(mixed(loads=list(reversed(mixed()['loads']))), supply=SUPPLY)
        self.assertEqual(a['chosen'], b['chosen'])
        p = profile(mixed(loads=[load(distance=20), load(distance=20)]), SUPPLY)
        self.assertEqual(len(p['segments']), 1)
        self.assertAlmostEqual(voltage_trace(p, 1, 0)['dv'], .4)

    def test_power_factor_components_are_combined(self):
        c = mixed(loads=[load(800, powerFactor=.8), load(600, powerFactor=.6)])
        r = calculate(c, supply=SUPPLY)
        self.assertAlmostEqual(r['totals']['p'], 1400)
        self.assertAlmostEqual(r['totals']['q'], 1400)
        self.assertAlmostEqual(r['ib'], math.hypot(1400, 1400)/220)

    def test_house_supply_does_not_make_circuit_three_phase(self):
        fn = calculate(mixed(connection='fn', phaseSet='A', loads=[load(1270)]), supply=SUPPLY)
        self.assertEqual(fn['voltage'], 127)
        self.assertEqual(fn['loaded'], 2)
        self.assertAlmostEqual(fn['ib'], 10)
        ff = calculate(mixed(loads=[load(1500)]), supply=SUPPLY)
        tri = calculate(mixed(connection='tri', phaseSet='ABC', loads=[load(1500)]), supply=SUPPLY)
        self.assertAlmostEqual(ff['ib'], 1500/220)
        self.assertAlmostEqual(tri['ib'], 1500/(math.sqrt(3)*220))
        self.assertEqual(tri['loaded'], 3)

    def test_network_change(self):
        r = calculate(mixed(connection='fn', phaseSet='A'), supply=dict(phases='tri', network='220/380'))
        self.assertEqual(r['voltage'], 220)

    def test_unavailable_phases(self):
        r = calculate(mixed(), supply=dict(phases='mono', network='127/220'))
        self.assertIsNone(r['chosen'])
        self.assertTrue(any('fases' in issue for issue in r['issues']))

    def test_bad_load_never_disappears_silently(self):
        for bad in (dict(power=-1), dict(powerFactor=''), dict(distance=-5), dict(quantity=1.5)):
            r = calculate(mixed(loads=[load(), load(**bad)]), supply=SUPPLY)
            self.assertTrue(r['issues'])
            self.assertIsNone(r['chosen'])
            self.assertIsNone(r['ib'])

    def test_explicit_breaker_smaller_than_load_cannot_be_fixed_by_cable(self):
        r = calculate(mixed(breakerMode='verify', breakerCurrent=6), supply=SUPPLY)
        self.assertIsNone(r['chosen'])
        self.assertIsNotNone(r['cableCandidate'])
        self.assertFalse(r['protection']['loadOk'])
        self.assertTrue(r['protection']['failed'])

    def test_fixed_breaker_can_determine_larger_cable(self):
        r = calculate(mixed(breakerMode='verify', breakerCurrent=63, loads=[load(100, 1)]), supply=SUPPLY)
        self.assertEqual(r['chosen']['breaker'], 63)
        self.assertGreater(r['chosen']['section'], r['cableCandidate']['section'])
        self.assertIn('Coordenação de sobrecarga', r['determining'])

    def test_breaking_capacity_failure_visible(self):
        r = calculate(mixed(shortIk=10, breakerIcu=6), supply=SUPPLY)
        self.assertIsNotNone(r['chosen'])
        self.assertFalse(r['shortOk'])
        self.assertTrue(r['protection']['failed'])

    def test_capacity_explanation_uses_factors(self):
        r = calculate(mixed(temperature=40, groupCount=2), supply=SUPPLY)
        self.assertAlmostEqual(r['combinedFactor'], .87*.8)
        self.assertAlmostEqual(r['requiredAmpacity'], r['ib']/(.87*.8))
        self.assertAlmostEqual(r['chosen']['iz'], r['chosen']['itab']*.87*.8)

    def test_old_flat_and_new_single_group_match(self):
        old = circuit()
        migrated = old | dict(connection='tri', phaseSet='ABC', voltageMode='manual', routeMode='linear',
                              loads=[{**old, 'distance': old['length']}])
        a, b = calculate(old), calculate(migrated, supply=SUPPLY)
        self.assertEqual(a['chosen'], b['chosen'])
        self.assertEqual(a['ib'], b['ib'])

    def test_three_phase_trace_uses_line_voltage(self):
        p = profile(mixed(connection='tri', phaseSet='ABC'), SUPPLY)
        r = voltage_trace(p, 1, 0)
        self.assertAlmostEqual(r['dv'], .2)

    def test_legacy_loaded_count_is_preserved_until_connection_confirmed(self):
        old = circuit(phase='mono', loaded=3, voltage=220)
        migrated = old | dict(connection='legacy', legacyLoaded=3, voltageMode='manual',
                              loads=[{**old, 'distance': old['length']}])
        self.assertEqual(calculate(old)['chosen'], calculate(migrated)['chosen'])
        self.assertEqual(calculate(migrated)['loaded'], 3)
        confirmed = migrated | dict(connection='ff', phaseSet='AB', legacyLoaded=None)
        self.assertEqual(calculate(confirmed, supply=SUPPLY)['loaded'], 2)


if __name__ == '__main__':
    unittest.main()
