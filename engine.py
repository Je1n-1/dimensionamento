"""Public calculation API retained for existing callers."""
from voltcalc.calculations.circuits import number
from voltcalc.calculations.sizing import TABLES, BREAKERS, calculate, method_of

__all__ = ["number", "TABLES", "BREAKERS", "calculate", "method_of"]
