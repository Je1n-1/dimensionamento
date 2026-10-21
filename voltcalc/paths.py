"""Paths are relative to this checkout, independent of the working directory."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
DATA = ROOT / "data"
EXAMPLES = ROOT / "examples"
