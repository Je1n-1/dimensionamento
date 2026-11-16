"""Versioned geometry rules. No thermal, protection or overall conformity verdict."""
import math

VERSION = 'nbr5410-2004-infrastructure-1'
REFERENCE = 'ABNT NBR 5410:2004, 6.2.11.1.6-a, página impressa 120'


def conduit_limit(count):
    if count < 1:
        raise ValueError('A ocupação exige ao menos um elemento físico.')
    return 53 if count == 1 else 31 if count == 2 else 40


def circular_area(diameter):
    try:
        area = math.pi * (diameter / 2) ** 2
    except OverflowError as error:
        raise ValueError('Dimensão fora do intervalo numérico.') from error
    if not math.isfinite(area) or area <= 0:
        raise ValueError('Dimensão fora do intervalo numérico.')
    return area


def conduit_geometry(area, count, diameter):
    limit = conduit_limit(count)
    minimum = math.sqrt(4 * area / (math.pi * limit / 100))
    occupancy = None if diameter is None else 100 * area / circular_area(diameter)
    return dict(limit=limit, minimumDiameter=minimum, occupancy=occupancy)


def continuous_route(length, bends, location):
    """Only straight routes or declared 90-degree bends; no nominal-size exception."""
    maximum = (15 if location == 'indoor' else 30) - 3 * bends
    return dict(maximumLength=maximum, lengthPasses=length <= maximum,
                bendsPass=bends <= 3, reference='6.2.11.1.6-b e 6.2.11.1.7')
