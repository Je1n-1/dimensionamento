import copy
import unittest
from uuid import uuid4

from voltcalc.web.api import post_payload
from voltcalc.calculations.sizing import calculate
from voltcalc.calculations.panel import build_panel


def equipment(kind='lighting', **changes):
    return dict(id=str(uuid4()), kind=kind, name='Consumidor', room='Sala',
                **(dict(quantity=1, power=100, powerFactor=1, distance=20,
                        connection='fn') | changes))


def payload(*items):
    return dict(context=dict(equipment=list(items), distribute=True,
                             conditions=dict(temperature=30, groupCount=1)),
                supply=dict(phases='tri', network='127/220'), circuits=[])


class PlanningTests(unittest.TestCase):
    def test_grouped_lighting_and_individual_dedicated_consumers(self):
        data = payload(equipment(quantity=15, power=100), equipment('shower', quantity=2, power=5500, connection='ff'))
        original = copy.deepcopy(data)
        result = post_payload('/api/propose', data)['circuits']
        self.assertEqual(data, original, 'Preview must not mutate the project.')
        self.assertEqual(len(result), 3)
        self.assertEqual([c['loads'][0]['quantity'] for c in result], [15, 1, 1])
        self.assertEqual(sum(c['loads'][0]['power'] * c['loads'][0]['quantity'] for c in result), 12500)
        self.assertEqual(len({c['id'] for c in result}), 3)
        self.assertEqual(result[1]['connection'], 'ff')

    def test_allocation_reduces_peak_without_changing_connection_or_voltage(self):
        data = payload(*(equipment(power=1270) for _ in range(3)))
        circuits = post_payload('/api/propose', data)['circuits']
        panel = build_panel(circuits, data['supply'])
        self.assertEqual({c['phaseSet'] for c in circuits}, set('ABC'))
        self.assertAlmostEqual(panel['maxCurrent'], 10)
        self.assertAlmostEqual(panel['spread'], 0)
        self.assertTrue(all(c['connection'] == 'fn' for c in circuits))

    def test_existing_circuits_are_preserved_and_considered(self):
        data = payload(equipment(power=1270))
        existing = post_payload('/api/propose', data)['circuits']
        existing[0]['phaseSet'] = 'A'
        data['circuits'] = existing
        data['context']['equipment'][0]['id'] = 'next-item'
        before = copy.deepcopy(data)
        new = post_payload('/api/propose', data)['circuits']
        self.assertEqual(data, before)
        self.assertNotEqual(new[0]['phaseSet'], 'A')

    def test_optional_allocation_and_invalid_existing_data(self):
        data = payload(*(equipment(power=100) for _ in range(3)))
        data['context']['distribute'] = False
        circuits = post_payload('/api/propose', data)['circuits']
        self.assertEqual({c['phaseSet'] for c in circuits}, {'A'})
        data['context']['distribute'] = True
        data['circuits'] = [dict(circuits[0], phaseSet='Z')]
        data['context']['equipment'][0]['id'] = 'next-item'
        result = post_payload('/api/propose', data)
        self.assertTrue(result['warnings'])

    def test_sizing_uses_engine_and_keeps_unverified_protection_pending(self):
        data = payload(equipment(quantity=15))
        circuit = post_payload('/api/propose', data)['circuits'][0]
        r = calculate(circuit, .08, data['supply'])
        self.assertIsNotNone(r['chosen'])
        self.assertIsNotNone(r['protection']['nominal'])
        self.assertIsNone(r['protection']['shortOk'])
        self.assertAlmostEqual(r['ib'], 1500/127)

    def test_incompatible_supply_and_missing_values_rejected(self):
        for overrides in (dict(quantity=0), dict(quantity=1.5), dict(power=''), dict(powerFactor=0), dict(distance=''), dict(power=float('nan'))):
            with self.subTest(overrides=overrides), self.assertRaises(ValueError):
                post_payload('/api/propose', payload(equipment(**overrides)))
        data = payload(equipment(connection='ff'))
        data['supply']['phases'] = 'mono'
        with self.assertRaises(ValueError):
            post_payload('/api/propose', data)

    def test_bounded_expansion(self):
        with self.assertRaises(ValueError):
            post_payload('/api/propose', payload(equipment('shower', quantity=301)))

    def test_incomplete_existing_distances_do_not_prevent_phase_totals(self):
        data = payload(equipment())
        existing = post_payload('/api/propose', data)['circuits']
        existing[0]['loads'][0]['distance'] = ''
        data['circuits'] = existing
        data['context']['equipment'][0]['id'] = 'next-item'
        result = post_payload('/api/propose', data)
        self.assertFalse(result['warnings'])

    def test_repeated_proposal_preserves_applied_consumers_and_proposes_only_missing(self):
        data = payload(equipment('shower', quantity=2))
        first = post_payload('/api/propose', data)['circuits']
        data['circuits'] = [first[0]]
        second = post_payload('/api/propose', data)
        self.assertEqual(len(second['circuits']), 1)
        self.assertEqual(second['circuits'][0]['planningOrigin'], first[1]['planningOrigin'])
        self.assertTrue(second['warnings'])
        data['circuits'] += second['circuits']
        with self.assertRaisesRegex(ValueError, 'já foram adicionados'):
            post_payload('/api/propose', data)
