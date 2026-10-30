"""Stage 8: steady-state longitudinal voltage drop, isolated 2004 limits."""
import math

VERSION='nbr5410-2004-voltage-1'
TOTAL_LIMITS={'own_transformer':7,'utility_transformer':7,'delivery_lv':5,'generator':7}
FORMULA_SOURCE='https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions'


def voltage_drop(current, length_m, resistance, reactance, power_factor, connection):
    if connection not in ('FN','FF','3F','3FN'):
        raise ValueError('Ligação fora do modelo de queda implementado.')
    if not (current>0 and length_m>=0 and resistance>0 and reactance>=0 and 0<power_factor<=1):
        raise ValueError('Parâmetros inválidos para queda de tensão.')
    k=math.sqrt(3) if connection in ('3F','3FN') else 2
    value=k*current*(resistance*power_factor+reactance*math.sqrt(1-power_factor**2))*(length_m/1000)
    if not math.isfinite(value):raise ValueError('Queda fora do intervalo numérico.')
    return value


def compatible(up, down):
    """No transformer ratio is invented; only phase/neutral conversion in one LV system."""
    a,b=up['connection'],down['connection']
    if not set(down['roles'])<=set(up['roles']):return False
    if a=='3FN' and b=='FN':return math.isclose(up['voltage']/math.sqrt(3),down['voltage'],rel_tol=.01)
    allowed=a==b or (a in ('3F','3FN') and b in ('FF','3F'))
    return allowed and math.isclose(up['voltage'],down['voltage'],rel_tol=.001)
