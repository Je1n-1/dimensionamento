import copy
import unittest
from voltcalc.web.api import post_payload
from voltcalc.calculations.sizing import calculate
from tests.test_planning import payload, equipment


def preview(**room):
    return post_payload('/api/residential', {'propertyType':'house', 'rooms':[dict(name='Sala',type='living',area=12,perimeter=14,**room)]})


class ResidentialTests(unittest.TestCase):
    def row(self, kind='living', area=12, perimeter=14, **values):
        request=dict(propertyType='house',rooms=[dict(name='Ambiente',type=kind,area=area,perimeter=perimeter,**values)])
        original=copy.deepcopy(request)
        result=post_payload('/api/residential',request)['rooms'][0]
        self.assertEqual(request,original)
        return result

    def test_perimeter_rounds_up(self):
        self.assertEqual(self.row(perimeter=10)['minSockets'],2)
        self.assertEqual(self.row(perimeter=10.01)['minSockets'],3)
        self.assertEqual(self.row('kitchen',perimeter=7)['minSockets'],2)
        self.assertEqual(self.row('kitchen',perimeter=7.01)['minSockets'],3)

    def test_lighting_whole_four_square_meter_increments(self):
        for area,expected in [(6,100),(6.1,100),(9.99,100),(10,160),(14,220)]:
            with self.subTest(area=area): self.assertEqual(self.row(area=area)['lightingVA'],expected)

    def test_room_specific_rules_and_no_optional_reduction(self):
        self.assertEqual(self.row('bathroom',sockets=1)['socketsVA'],600)
        self.assertEqual(self.row('kitchen',sockets=7)['socketsVA'],2200)
        self.assertEqual(self.row('laundry',sockets=4)['socketsVA'],1900)
        self.assertEqual(self.row('balcony',perimeter=20)['minSockets'],1)
        self.assertEqual(self.row('other',area=6,perimeter=20)['minSockets'],1)
        self.assertEqual(self.row('other',area=6.01,perimeter=20)['minSockets'],4)
        self.assertEqual(self.row('living',area=6,perimeter=20)['minSockets'],4)

    def test_missing_invalid_and_below_minimum_do_not_pass(self):
        for values in [dict(area=''),dict(perimeter=float('nan')),dict(sockets=1),dict(sockets=2.5),dict(lights=0),dict(type='unknown')]:
            request=dict(propertyType='house',rooms=[dict(name='Sala',type='living',area=12,perimeter=14)|values])
            result=post_payload('/api/residential',request)
            self.assertFalse(result['complete'])
            self.assertTrue(result['rooms'][0]['issues'])

    def test_non_residential_and_duplicate_names_rejected(self):
        with self.assertRaises(ValueError): post_payload('/api/residential',dict(propertyType='commercial',rooms=[]))
        room=dict(name='Sala',type='living',area=12,perimeter=14)
        with self.assertRaises(ValueError): post_payload('/api/residential',dict(propertyType='house',rooms=[room,room]))

    def test_batch_and_apparent_power_reach_sizing_without_multiplication(self):
        rooms=[dict(name='Sala',type='living',area=12,perimeter=14),dict(name='Cozinha',type='kitchen',area=10,perimeter=14)]
        result=post_payload('/api/residential',dict(propertyType='house',rooms=rooms))
        self.assertTrue(result['complete'])
        kitchen=result['rooms'][1]
        data=payload(equipment('sockets',quantity=kitchen['sockets'],power=kitchen['socketsVA'],unit='VA',powerBasis='total',powerFactor=.8))
        circuit=post_payload('/api/propose',data)['circuits'][0]
        sized=calculate(circuit,.08,data['supply'])
        self.assertAlmostEqual(sized['totals']['s'],1900)
        self.assertAlmostEqual(sized['totals']['p'],1520)
        self.assertAlmostEqual(sized['ib'],1900/127)

    def test_invalid_units_and_power_basis_rejected(self):
        for changes in [dict(unit='kVA'),dict(powerBasis='unknown')]:
            with self.assertRaises(ValueError): post_payload('/api/propose',payload(equipment(**changes)))

    def test_selected_scope_does_not_require_unused_dimensions(self):
        for kind,include,area,perimeter in [('living',dict(lighting=True),12,''),('bathroom',dict(sockets=True),'',''),('living',dict(sockets=True),'',14)]:
            result=post_payload('/api/residential',dict(propertyType='house',include=include,rooms=[dict(name='Ambiente',type=kind,area=area,perimeter=perimeter)]))
            self.assertTrue(result['complete'])
        with self.assertRaises(ValueError): post_payload('/api/residential',dict(propertyType='house',include={},rooms=[]))
